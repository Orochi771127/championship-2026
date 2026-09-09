"""Independent original ARM math/AI15 probes with synthetic input records.
Only DS divider/sqrt MMIO, event query and terrain query are adapted. The
original normalization, vector operations and soft-float code execute.
"""
import json,struct,math,random
from pathlib import Path
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE,UC_HOOK_MEM_READ
from unicorn.arm_const import *
from hunt_original_probe import load_rom,ROM_SHA
_,arm,ov=load_rom();u=Uc(UC_ARCH_ARM,UC_MODE_ARM)
u.mem_map(0x02000000,0x400000);u.mem_map(0x04000000,0x1000)
u.mem_write(0x02000000,arm);u.mem_write(ov.ramAddress,bytes(ov.data))
AI,ACTOR,RESULT,STACK,STOP=0x02300000,0x02301000,0x02302000,0x023ef000,0x023f0000
def put(a,v):u.mem_write(a,struct.pack('<I',v&0xffffffff))
def get(a):return int.from_bytes(u.mem_read(a,4),'little',signed=True)
def vec(a):return list(struct.unpack('<3i',u.mem_read(a,12)))
def putvec(a,v):u.mem_write(a,struct.pack('<3i',*v))
def mmio(uc,access,address,size,value,data):
    if 0x040002a0<=address<0x040002b0:
        mode=get(0x04000280)&3
        n=int.from_bytes(u.mem_read(0x04000290,4 if mode==0 else 8),'little',signed=True)
        d=int.from_bytes(u.mem_read(0x04000298,8 if mode==2 else 4),'little',signed=True)
        q=(1 if n<0 else -1) if d==0 else abs(n)//abs(d)*(-1 if (n<0)!=(d<0) else 1)
        u.mem_write(0x040002a0,(q&0xffffffffffffffff).to_bytes(8,'little'))
        u.mem_write(0x040002a8,((n-q*d)&0xffffffffffffffff).to_bytes(8,'little'))
    if address==0x040002b4:put(address,math.isqrt(int.from_bytes(u.mem_read(0x040002b8,8 if get(0x040002b0)&1 else 4),'little')))
u.hook_add(UC_HOOK_MEM_READ,mmio,begin=0x04000280,end=0x040002bf)
blocked=False
def hook(uc,address,size,data):
    if address not in [0x02044100,0x0207c930]:return
    u.reg_write(UC_ARM_REG_R0,int(blocked) if address==0x0207c930 else 0)
    u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
def run(address,args):
    for r,v in zip([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3],args):u.reg_write(r,v&0xffffffff)
    u.reg_write(UC_ARM_REG_SP,STACK);u.reg_write(UC_ARM_REG_LR,STOP)
    u.emu_start(address,STOP,count=30000)
    assert u.reg_read(UC_ARM_REG_PC)==STOP,hex(u.reg_read(UC_ARM_REG_PC))
rng=random.Random(20260908);intersections=[];motions=[]
for i in range(400):
    points=[[rng.randrange(-128,512),rng.randrange(-128,512)] for _ in range(4)]
    if i%5==0:points=[[0,0],[64,0],[32,0],[96,0]]
    for j,v in enumerate([points[1][1],*points[2],*points[3]]):put(STACK+j*4,v)
    run(0x02122dc0,[RESULT,*points[0],points[1][0]])
    intersections.append({'points':points,'result':vec(RESULT)})
put(AI+0x40,ACTOR);put(0x0210aa1c,RESULT)
for i in range(240):
    p=[rng.randrange(32,512)*4096,rng.randrange(32,512)*4096,rng.randrange(0,25)*4096]
    v=[rng.randrange(-32000,32001),rng.randrange(-32000,32001),rng.randrange(-10000,10001)]
    if i%7==0:v=[0,0,0];p[2]=0
    blocked=i%3==0;putvec(ACTOR+0x24,p);putvec(AI+0x190,v);put(AI+0x0c,0);put(AI+0x10,77)
    run(0x021125a4,[AI])
    motions.append({'positionQ12':p,'velocityQ12':v,'blocked':blocked,'after':{'positionQ12':vec(ACTOR+0x24),
      'velocityQ12':vec(AI+0x190),'explosionPhase':u.mem_read(AI+14,1)[0],'counter':get(AI+0x10)&65535}})
putvec(RESULT,[0,0,0]);run(0x02002a6c,[RESULT,RESULT]);zero=vec(RESULT)
radar=[]
for species in range(228):
    for index in range(15):
        mask=struct.unpack_from('<H',arm,0xcb9e0+index*16)[0]
        put(AI+0x44,mask);put(ACTOR,species)
        run(0x02127884,[AI,ACTOR])
        radar.append([species,index,mask,u.reg_read(UC_ARM_REG_R0)])
out=Path(__file__).resolve().parents[2]/'reports/hunt-core-two-stage-2026-09-08/controls-cpu.json'
deadlines=[]
put(0x020fba08,RESULT)
for minute in range(0,1440,5):
    put(0x0210aa98,minute);u.reg_write(UC_ARM_REG_R5,AI)
    u.reg_write(UC_ARM_REG_SP,STACK)
    u.emu_start(0x02116ce4,0x02116d2c,count=30000)
    assert u.reg_read(UC_ARM_REG_PC)==0x02116d2c
    deadlines.append([minute,get(RESULT+0x18)])
out.write_text(json.dumps({'sourceSha256':ROM_SHA,'status':'CONTROLLED_CPU_PROBES_NOT_LIVE_GAMEPLAY',
  'zeroNormalization':zero,'wireIntersections':intersections,'explosionMotions':motions,'radarMatches':radar,
  'huntDeadlineMinutes':deadlines},indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'wire':len(intersections),'motion':len(motions),'zero':zero}))
