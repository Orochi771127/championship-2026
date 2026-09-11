"""Original OVL18 hand classifier and stroke state; synthetic input oracle."""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

ap=argparse.ArgumentParser();ap.add_argument('--rom',required=True);ap.add_argument('--out',required=True);args=ap.parse_args()
raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
rom=NintendoDSRom(raw);ov=rom.loadArm9Overlays()[18]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
u.mem_write(rom.arm9RamAddress,bytes(decompress(rom.arm9)));u.mem_write(ov.ramAddress,bytes(ov.data))
controller,actor,profile,body,stop=0x2300000,0x2301000,0x2302000,0x2303000,0x27f0000
def get(p):return int.from_bytes(u.mem_read(p,4),'little')
def put(p,n):u.mem_write(p,struct.pack('<I',n&0xffffffff))
def half(p,n):u.mem_write(p,struct.pack('<H',n&0xffff))
def ret(n=0):u.reg_write(UC_ARM_REG_R0,n&0xffffffff);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
touch=get(0x210c5f8);admit=1;inside=1;events=[];commands=[];rolls=[]
def hook(_,at,size,user):
    if at==0x20669c8:ret(actor)
    elif at==0x2116c14:events.append(['admission',u.reg_read(UC_ARM_REG_R1)]);ret(admit)
    elif at==0x20665d8:ret(inside)
    elif at==0x2116d20:
        u.mem_write(u.reg_read(UC_ARM_REG_R0),struct.pack('<3i',100*4096,100*4096,0));ret()
    elif at==0x2112378:events.append(['sequence',u.reg_read(UC_ARM_REG_R1)]);ret()
    elif at==0x203ea30:events.append(['sound',u.reg_read(UC_ARM_REG_R0)]);ret()
    elif at==0x2044100:ret(int(u.reg_read(UC_ARM_REG_R1) in commands))
    elif at==0x20431d4:
        events.append(['random',u.reg_read(UC_ARM_REG_R0)]);ret(rolls.pop(0))
    elif at==0x21156b4:events.append(['reaction',u.reg_read(UC_ARM_REG_R1)]);ret(9)
u.hook_add(UC_HOOK_CODE,hook)
def reset():
    u.mem_write(controller,bytes(0x4000));put(actor+0x114,profile);put(actor+0x3c,body);events.clear()
def run(at,p=controller):
    u.reg_write(UC_ARM_REG_R0,p);u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
    u.emu_start(at,stop,count=10000);assert u.reg_read(UC_ARM_REG_PC)==stop
    n=u.reg_read(UC_ARM_REG_R0);return n if n<0x80000000 else n-0x100000000
classification=[]
for held in [0,1]:
 for elapsed in [0,2,3,8,9,10,60]:
  for dx,dy in [(0,0),(3,0),(-3,3),(4,0),(0,-4)]:
   for admit,inside in [(1,1),(0,1),(1,0)]:
    reset();half(controller+0x10,elapsed);put(controller+0x30,100);put(controller+0x34,100)
    half(touch,100+dx);half(touch+2,100+dy);half(touch+4,held)
    result=run(0x210c4d0)
    classification.append(dict(held=held,elapsed=elapsed,delta=[dx,dy],admit=admit,inside=inside,result=result,events=list(events)))
strokeController=[]
for elapsed in [0,59,60,61]:
 for x,y in [(100,100),(103,100),(197,100),(196,100),(4,100)]:
  for held in [0,1]:
   reset();half(controller+0x10,elapsed);put(controller+0x30,100);put(controller+0x34,100)
   half(touch,x);half(touch+2,y);half(touch+4,held)
   result=run(0x210ca28)
   strokeController.append(dict(elapsed=elapsed,pointer=[x,y],held=held,result=result,counter=int.from_bytes(u.mem_read(controller+0x10,2),'little')))
strokes=[]
for conditionMask in range(8):
 for stress in [0,1,50,100]:
  reset();put(profile+0x1c,stress)
  for i,off in enumerate([0x134,0x138,0x13c]):put(profile+off,(conditionMask>>i)&1)
  put(actor+0x430,1);run(0x211959c,actor);entry=list(events);samples=[]
  for tick in range(1,61):
   events.clear();result=run(0x2119550,actor);run(0x2119604,actor)
   samples.append([tick,int.from_bytes(u.mem_read(actor+0xe,1),'little'),get(actor+0x420),result,list(events)])
  put(actor+0x430,0);release=run(0x2119550,actor);run(0x21195f4,actor)
  strokes.append(dict(conditionMask=conditionMask,stress=stress,stressAfter=get(profile+0x1c),entry=entry,samples=samples,release=release,musicAfterExit=get(actor+0x420)))
sleepCommands=[]
for personality in range(8):
 for roll in [0,9,10,39,40,49,50,79,80,99,100,102]:
  for command in [0x7e,0x7f,0x80]:
   reset();put(profile+0x18,personality);put(actor+0x480,0x79)
   commands=[command];rolls=[roll];result=run(0x21180cc,actor)
   sleepCommands.append(dict(personality=personality,roll=roll,command=command,result=result,events=list(events)))
commands=[]
tapEntry=[]
for count in [0,1,2,3,255]:
 for elapsed in [0,29,30,60]:
  reset();u.mem_write(actor+0x458,bytes([count,elapsed]));run(0x2119aec,actor)
  tapEntry.append(dict(count=count,elapsed=elapsed,after=list(u.mem_read(actor+0x458,2))))
taps=[]
for conditionMask in range(8):
 for previous in [1,4]:
  for personality in range(8):
   for trigger in [0,49,50,99,100,102]:
    for selection in [0,50]:
     reset();put(profile+0x18,personality);u.mem_write(actor+0xa,bytes([previous]));u.mem_write(actor+0x458,bytes([3]))
     for i,off in enumerate([0x134,0x138,0x13c]):put(profile+off,(conditionMask>>i)&1)
     put(actor+0x480,0x79);put(actor+0x478,0x59);rolls=[trigger,selection];result=run(0x21199f8,actor)
     taps.append(dict(conditionMask=conditionMask,previous=previous,personality=personality,trigger=trigger,selection=selection,
       result=result,count=int.from_bytes(u.mem_read(actor+0x458,1),'little'),events=list(events)))
report=dict(classification='BOUNDED_NATIVE_REPLAY',romSha256=sha,overlay18Sha256=hashlib.sha256(bytes(ov.data)).hexdigest(),
 boundaries=['Synthetic controller/resident; native pointer memory and exact native state functions.',
 'Actor lookup, hit test, command admission and screen projection are explicit intercepted inputs.',
 'Sequence and sound requests are recorded; this does not claim original device audio or rendering.'],
 classifier=classification,strokeController=strokeController,strokes=strokes,sleepCommands=sleepCommands,tapEntry=tapEntry,taps=taps)
Path(args.out).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:len(report[k]) for k in ['classifier','strokeController','strokes','sleepCommands','tapEntry','taps']}))
