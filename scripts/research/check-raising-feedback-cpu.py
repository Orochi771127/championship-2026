"""Bounded native icon placement, status rotation and conditional-request oracle."""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

ap=argparse.ArgumentParser()
for k in ['rom','ram','out']:ap.add_argument('--'+k,required=True)
a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
ov=NintendoDSRom(raw).loadArm9Overlays()[18]
assert ram[ov.ramAddress-0x2000000:ov.ramAddress-0x2000000+64]==bytes(ov.data[:64])
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
actor=0x22e2d40;stop=0x27f0000;calls=[];width=height=0
def get(at):return int.from_bytes(u.mem_read(at,4),'little')
def put(at,n):u.mem_write(at,struct.pack('<I',n&0xffffffff))
def ret(n=0):u.reg_write(UC_ARM_REG_R0,n);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
def hook(_,at,size,user):
    if at==0x2047d98:ret(height)
    elif at==0x2047dcc:ret(width)
    elif at in [0x2047904,0x20479a4]:
        calls.append(dict(address=f'{at:08X}',sequence=u.reg_read(UC_ARM_REG_R1),frame=u.reg_read(UC_ARM_REG_R2) if at==0x20479a4 else None));ret()
u.hook_add(UC_HOOK_CODE,hook)
def reset():u.mem_write(0x2000000,ram);u.mem_write(0x27de000,bytes(0x4000));calls.clear()
def run(at,end=stop):
    u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
    u.emu_start(at,end,count=10000);assert u.reg_read(UC_ARM_REG_PC)==end
placements=[]
for width,height in [(16,24),(31,47),(8,8),(64,71)]:
    for flip in [0,1]:
        for encoded in [0,1,5,518,774,1286,31]:
            reset();body=get(actor+0x3c);put(actor+0x198,encoded);put(body+0x6dc,flip)
            position=[409617,286729,8192];u.mem_write(body+0x24,struct.pack('<3i',*position))
            u.reg_write(UC_ARM_REG_R0,actor);run(0x2115410)
            placements.append(dict(width=width,height=height,flip=flip,encoded=encoded,positionQ12=position,
                outputPositionQ12=list(struct.unpack('<3i',u.mem_read(actor+0x64,12))),calls=list(calls)))
statuses=[]
for mask in range(32):
    for state in [1,4,9]:
        reset();body=get(actor+0x3c)
        sick,wound,hungry,stress,music=[(mask>>n)&1 for n in range(5)]
        put(actor+0x418,hungry);put(actor+0x404,stress);put(actor+0x420,music);put(actor+0x400,0)
        u.mem_write(actor+8,bytes([state]));samples=[]
        for tick in range(1,242):
            u.reg_write(UC_ARM_REG_R4,actor);u.reg_write(UC_ARM_REG_R0,sick);u.reg_write(UC_ARM_REG_R1,wound)
            run(0x2110ec8,0x2110fb0)
            samples.append([tick,get(body+0x6cc),get(actor+0x400)])
        changes=[s for i,s in enumerate(samples) if i==0 or i==len(samples)-1 or s[1]!=samples[i-1][1]]
        statuses.append(dict(sick=sick,wound=wound,hungry=hungry,stress=stress,music=music,state=state,updates=len(samples),samples=changes))
Path(a.out).write_text(json.dumps(dict(romSha256=sha,evidence='BOUNDED_NATIVE_REPLAY',
    boundary='Original icon setup and status selector; body dimensions and renderer entry calls intercepted. No hardware rendering claim.',
    placements=placements,statuses=statuses),indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(placements=len(placements),statusCases=len(statuses),statusUpdates=sum(s['updates'] for s in statuses))))
