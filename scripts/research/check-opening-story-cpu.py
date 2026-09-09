"""Compare original opening card control without carrying its art into runtime.

Runs ARM9 0208E964's phase 4 branch and its actual four-card helpers. Only
graphics/audio/fade calls are stubbed. Input is the original touch-release flag.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_SP,UC_ARM_REG_LR,UC_ARM_REG_PC

ap=argparse.ArgumentParser()
for k in ['rom','ram','out']:ap.add_argument('--'+k,required=True)
a=ap.parse_args();ram=Path(a.ram).read_bytes()
assert len(ram)==0x400000
rom_bytes=Path(a.rom).read_bytes();rom_sha=hashlib.sha256(rom_bytes).hexdigest()
assert rom_sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
code=NintendoDSRom(rom_bytes).loadArm9().sections[0]
for start,end in [(0x208e964,0x208ec50),(0x2090474,0x20906e8)]:
    assert ram[start-0x2000000:end-0x2000000]==code.data[start-code.ramAddress:end-code.ramAddress]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
actor,drawable,stop=0x2500000,0x2510000,0x27f0000
get=lambda p,n=4:int.from_bytes(u.mem_read(p,n),'little',signed=n==4)
def put(p,v,n=4):u.mem_write(p,(v&((1<<(n*8))-1)).to_bytes(n,'little'))
def finish(v=0):u.reg_write(UC_ARM_REG_R0,v);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
stubs=[0x207ef28,0x207ee94,0x207ef1c,0x207f810,0x207f260,0x207f51c,0x207f6dc,0x210ba70,0x20438b0]
def hook(_,pc,size,data):
    if pc==0x207f7c4:finish(drawable)
    elif pc in stubs:finish()
u.hook_add(UC_HOOK_CODE,hook)
def reset():
    u.mem_write(0x2000000,ram);u.mem_write(actor,bytes(0x20000))
    put(actor+14,4,1)
    for i,(parts,wait) in enumerate(zip([4,2,2,1],[500,750,900,300])):
        c=actor+0x168+i*0x2c
        for off,v in {0:drawable,4:parts,12:c+0x2c if i<3 else 0,16:1 if i==0 else 0,28:wait,32:410,36:4096}.items():put(c+off,v)
def projection(frame):
    out=[frame,get(actor+0xe4)//4096,int(get(actor+14,1)==5)]
    for i in range(4):
        c=actor+0x168+i*0x2c
        out.extend(get(c+off) for off in [16,28,20,32,40,8])
    return out
cases=[]
for name,touches in [('automatic',set()),('every-frame',set(range(1,2000))),('early-release',{1,6,24,25}),('reading-release',{60,180,300,420}),('mixed',{20,500,920,1400,1850})]:
    reset();rows=[projection(0)];changes=[]
    for frame in range(1,3000):
        put(0x210a71e,int(frame in touches),2)
        u.reg_write(UC_ARM_REG_R0,actor);u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
        u.emu_start(0x208e964,stop,count=20000)
        assert u.reg_read(UC_ARM_REG_PC)==stop
        row=projection(frame)
        if frame%120==0 or any(row[3+i*6]!=rows[-1][3+i*6] for i in range(4)):changes.append(row)
        rows.append(row)
        if row[2]:break
    else:raise AssertionError(name)
    cases.append({'name':name,'releaseFrames':sorted(touches),'frames':frame,'sha256':hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest(),'checkpoints':changes})
out={'evidenceClass':'BOUNDED_ORIGINAL_CPU_EXECUTION','romSha256':rom_sha,'sourceRamSha256':hashlib.sha256(ram).hexdigest(),
     'controller':'ARM9 0208E964 phase 4','helpers':'02090474..020906E4',
     'fields':['frame','scrollPixels','done','four cards: phase,remaining,wait,scale,revealed,y'],
     'stubs':[hex(p) for p in [0x207f7c4,*stubs]],'cases':cases,
     'limits':['Graphics, sound, fade duration and device pacing are not validated by this CPU harness.']}
Path(a.out).write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'cases':len(cases),'frames':[c['frames'] for c in cases]}))
