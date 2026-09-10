"""Bounded original OVL18 idle selector/target and reaction parameter oracle.
Private ROM/RAM inputs; outputs are consumed numeric gameplay fields only.
"""
import argparse, hashlib, json, math, random, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *

ap=argparse.ArgumentParser()
for key in ['rom','ram','out','catalog']:ap.add_argument('--'+key,required=True)
a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
ov=NintendoDSRom(raw).loadArm9Overlays()[18]
assert ram[ov.ramAddress-0x2000000:ov.ramAddress-0x2000000+64]==bytes(ov.data[:64])
word=lambda at:struct.unpack_from('<I',ram,at-0x2000000)[0]
signed=lambda n:n if n<0x80000000 else n-0x100000000
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_map(0x4000000,0x1000)
actor=0x22e2d40;stop=0x27f0000;calls=[];rolls=[];cursor=0;capture=False
get=lambda at,n=4:int.from_bytes(u.mem_read(at,n),'little')
def put(at,n,size=4):u.mem_write(at,(n&((1<<(size*8))-1)).to_bytes(size,'little'))
def finish(n=0):u.reg_write(UC_ARM_REG_R0,n&0xffffffff);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
def hook(_,at,size,user):
    global cursor
    if at==0x20431d4:
        assert cursor<len(rolls)
        calls.append(['rng',u.reg_read(UC_ARM_REG_R0)]);finish(rolls[cursor]);cursor+=1
    elif at==0x21156b4 and capture:
        calls.append(['reaction',signed(u.reg_read(UC_ARM_REG_R1))]);finish(u.reg_read(UC_ARM_REG_R1))
    elif at in [0x203ea30,0x2065840]:calls.append(['presentation',hex(at)]);finish()
def hardware(_,access,at,size,value,user):
    if 0x40002a0<=at<0x40002b0:
        mode=get(0x4000280,2)&3
        n=int.from_bytes(u.mem_read(0x4000290,4 if mode==0 else 8),'little',signed=True)
        d=int.from_bytes(u.mem_read(0x4000298,8 if mode==2 else 4),'little',signed=True)
        assert d
        q=(abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1)
        put(0x40002a0,q,8);put(0x40002a8,n-q*d,8)
    elif at==0x40002b4:put(at,math.isqrt(get(0x40002b8,8 if get(0x40002b0,2)&1 else 4)))
u.hook_add(UC_HOOK_CODE,hook);u.hook_add(UC_HOOK_MEM_READ,hardware,begin=0x4000280,end=0x40002bf)
def reset():
    global cursor
    calls.clear();cursor=0;u.mem_write(0x2000000,ram);u.mem_write(0x27de000,bytes(0x4000))
def run(at,*args):
    for reg,value in zip([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3],args):u.reg_write(reg,value&0xffffffff)
    u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
    u.emu_start(at,stop,count=200000)
    assert u.reg_read(UC_ARM_REG_PC)==stop,hex(u.reg_read(UC_ARM_REG_PC))
    return signed(u.reg_read(UC_ARM_REG_R0))
cage=[[signed(word(0x20c8cc8+i*40+j*4)) for j in range(4)] for i in range(36)]
personality=[[signed(word(0x2128390+i*8+j*4)) for j in range(2)] for i in range(8)]
selectors=[];capture=True
for definition in range(36):
    for roll in [0,29,30,49,50,59,60,89,90,99,100,102]:
        reset();rolls=[roll,49];put(get(actor+0x120)+4,definition)
        result=run(0x2115b8c,actor)
        selectors.append(dict(kind='cage',definition=definition,field18=get(get(actor+0x118)+0x18),rolls=rolls[:cursor],reaction=result,calls=list(calls)))
for p in range(8):
    for roll in [0,49,50,99,100,102]:
        reset();rolls=[roll];put(get(actor+0x114)+0x18,p)
        result=run(0x2115cd8,actor)
        selectors.append(dict(kind='personality',personality=p,rolls=rolls[:cursor],reaction=result,calls=list(calls)))
capture=False;reactions=[]
for reaction in range(31):
    reset();rolls=[]
    # Reaction settings start at the original exit's defaults.
    for off in [0x190,0x194,0x198,0x19c,0x1a8,0x1c0,0x1c8]:put(actor+off,-1)
    for off in [0x1a0,0x1a4,0x1b4,0x1b8,0x1bc,0x1c4]:put(actor+off,0)
    put(get(actor+0x114)+0x1c,50)
    before=get(get(actor+0x114)+0x1c);state=run(0x21156b4,actor,reaction)
    reactions.append(dict(id=reaction,state=state,sequence=signed(get(actor+0x190)),icon=signed(get(actor+0x198)),alternateIcon=signed(get(actor+0x19c)),ticks=get(actor+0x1a0),completion=get(actor+0x1c4),
        alternate=signed(get(actor+0x194)),alternateTicks=get(actor+0x1bc),alternateCount=get(actor+0x1b8),secondTicks=signed(get(actor+0x1c8)),flipTicks=get(actor+0x1a4),
        conditionDelta=signed(get(get(actor+0x114)+0x1c)-before),movementTicks=get(actor+0x14c),destinationState=signed(get(actor+0x154))))
social=[]
for species in [8,21,99,201]:
    for peerSpecies in [8,21,99,201]:
        for distance in [0,200]:
            for reaction in [-1,8]:
                reset();rolls=[51,25,65,51];peer=get(actor+0x34);body=get(actor+0x3c);peerBody=get(peer+0x3c)
                position=[100*4096,100*4096,0];peerPosition=[(100+distance)*4096,100*4096,0]
                for obj,bodyPtr,sp,p in [(actor,body,species,position),(peer,peerBody,peerSpecies,peerPosition)]:
                    put(get(obj+0x114),sp);put(obj+0x118,0x20c1374+sp*0x84);u.mem_write(bodyPtr+0x24,struct.pack('<3i',*p))
                put(actor+0x40c,2);put(peer+0x34,actor);put(peer+0x43c,reaction);put(peer+8,1,1)
                put(actor+0x150,0);put(actor+0x134,0);put(actor+0x14c,0);put(actor+0x158,4,1)
                u.mem_write(actor+0x128,struct.pack('<3i',*position));state=run(0x2115d34,actor)
                social.append(dict(species=species,peerSpecies=peerSpecies,peerReaction=reaction,positionQ12=position,peerPositionQ12=peerPosition,
                    rolls=rolls[:cursor],state=1 if state==-1 else state,mode=get(actor+0x150),ticks=get(actor+0x14c),desiredAngleQ12=get(actor+0x134),
                    target=list(struct.unpack('<3i',u.mem_read(actor+0x128,12))),calls=list(calls)))
trajectories=[]
for state,entry,handler in [(13,0x211b638,0x211b498),(15,0x211b910,0x211b79c)]:
    reset();rolls=[];body=get(actor+0x3c);grid=get(0x2128c6c)
    u.mem_write(get(grid+8),bytes(get(grid)*get(grid+4)))
    position=[100*4096,100*4096,0]
    u.mem_write(body+0x24,struct.pack('<3i',*position));put(body+0x6dc,1)
    u.mem_write(actor+0x15c,struct.pack('<3i',4096,2048,0));put(actor+0x1c0,1);put(actor+0x10,0,2)
    run(entry,actor);samples=[]
    for tick in range(1,121):
        result=run(handler,actor)
        samples.append(dict(tick=tick,positionQ12=list(struct.unpack('<3i',u.mem_read(body+0x24,12))),done=result==1))
        if result==1:break
    assert samples[-1]['done']
    trajectories.append(dict(state=state,positionQ12=position,directionQ12=[4096,2048,0],samples=samples))
targets=[];rr=random.Random(20260908)
for _ in range(96):
    reset();rolls=[rr.randrange(103),rr.randrange(103)]
    position=[rr.randrange(32,600)*4096+17,rr.randrange(32,160)*4096+9,0]
    u.mem_write(get(actor+0x3c)+0x24,struct.pack('<3i',*position))
    run(0x2113af4,actor,32,128)
    targets.append(dict(positionQ12=position,rolls=rolls,target=list(struct.unpack('<3i',u.mem_read(actor+0x128,12))),calls=list(calls)))
species=[dict(field18=word(0x20c1374+i*0x84+0x18),field3a=ram[0xc1374+i*0x84+0x3a]) for i in range(228)]
catalog=dict(id='raising-activity-r1',romSha256=sha,cage=cage,personality=personality,reactions=reactions,species=species)
receipt=dict(romSha256=sha,selectors=selectors,targets=targets,reactions=reactions,social=social,trajectories=trajectories,stubbedPresentation=['0203EA30','02065840'],selectionBoundary='021156B4 captured only for selector cases; executed for reaction cases')
for path,data in [(a.catalog,catalog),(a.out,receipt)]:Path(path).write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(selectors=len(selectors),targets=len(targets),reactions=len(reactions))))
