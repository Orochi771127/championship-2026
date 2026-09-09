"""Bounded D740 continuation oracle: original ARM allocation/ownership branches.
Allocator, box query, VM execution and 3D render calls are controlled boundaries.
Does not claim full-ROM matches, untraced rendering, or source-pixel eligibility.
"""
import argparse, hashlib, json, random, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);args=p.parse_args()
raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
ov=NintendoDSRom(raw).loadArm9Overlays()[19]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x400000);u.mem_write(ov.ramAddress,bytes(ov.data))
OWNER,TARGET,ACTION,MOVE,SPEC,BOX,POINT,OFFSET,WORLD,STACK=0x2300000,0x2301000,0x2311000,0x2312000,0x2313000,0x2313100,0x2313200,0x2313300,0x2320000,0x23e0000
BASE=WORLD+0x1f218
def put(a,v):u.mem_write(a,struct.pack('<I',v&0xffffffff))
def word(a):return int.from_bytes(u.mem_read(a,4),'little')
def signed(a):return int.from_bytes(u.mem_read(a,4),'little',signed=True)
def actor(i):return BASE+0x394+i*0xd4
def vm(i):return ACTION+0x2a0+i*0x1b4
config={};allocations=[];scripts=[];sparks=[]
def hook(uc,pc,size,_):
 r0,r1,r2,r3=[u.reg_read(r) for r in [UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3]]
 if pc==0x2054a4c:u.reg_write(UC_ARM_REG_R0,int((r0-(ACTION+0x2a0))//0x1b4 in config['busyAux']))
 elif pc==0x211b264:
  i=len(allocations);value=0 if i in config['failAllocations'] else actor(i)
  allocations.append({'encoded':r1,'mode':r2,'actor':value})
  if value:put(BASE+0x19e54+i*4,r2)
  u.reg_write(UC_ARM_REG_R0,value)
 elif pc==0x20648f0:u.reg_write(UC_ARM_REG_R0,TARGET+0x800)
 elif pc==0x2047e58:u.reg_write(UC_ARM_REG_R0,BOX)
 elif pc==0x2047d98:u.reg_write(UC_ARM_REG_R0,16)
 elif pc==0x2047904:pass
 elif pc==0x20548d4:scripts.append({'vm':r0,'pointer':r1,'args':[signed(r3+i*4) for i in range(r2)]})
 elif pc==0x2054980:pass
 elif pc in [0x211af20,0x211af60]:sparks.append('PRIMARY_3D' if pc==0x211af20 else 'SECONDARY_3D')
 else:return
 u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)

def run(pc,end):
 u.reg_write(UC_ARM_REG_SP,STACK);u.emu_start(pc,end,count=10000)
 assert u.reg_read(UC_ARM_REG_PC)==end,hex(u.reg_read(UC_ARM_REG_PC))

rng=random.Random(11);offsets=[]
for i in range(64):
 previous=i%8;count=i%10;point=[rng.randrange(-200000,200000) for _ in range(3)]
 u.mem_write(OWNER,bytes(0x70000));put(0x2131c40,WORLD);put(ACTION+0x10,previous);put(WORLD+0x47884,count)
 for j,v in enumerate(point):put(WORLD+0x47888+previous*12+j*4,v)
 u.reg_write(UC_ARM_REG_R4,ACTION);u.reg_write(UC_ARM_REG_R10,13)
 run(0x211d95c,0x211d9a0);address=u.reg_read(UC_ARM_REG_R6)
 offsets.append({'previous':previous,'count':count,'input':point,'next':word(ACTION+0x10),'offset':[signed(address+j*4) for j in range(3)]})

cases=[]
for i in range(128):
 config={'resultCode':[2,2,2,1,0][i%5],'nativeKind':5 if i%17==0 else 13,
  'species':[0,71,72,133,134,227][i%6],'specialPrelude':i%7==0,'recognizedBlockedScript':i%4!=0,
  'busyAux':list(range(i%5)),'busyChildren':list(range(24 if i%19==0 else 23 if i%13==0 else i%3)),
  'failAllocations':[0] if i%11==0 else [1] if i%9==0 else [],'ownerLocked':i%2==0,
  'point':[rng.randrange(-1000000,1000000) for _ in range(3)],'offset':[rng.randrange(-30000,30000) for _ in range(3)],
  'box':[rng.randrange(1,60),rng.randrange(1,60),rng.randrange(-60,0),rng.randrange(-60,0)],
  'moveOffsets':[rng.randrange(256) for _ in range(3)]}
 allocations.clear();scripts.clear();sparks.clear();u.mem_write(OWNER,bytes(0x70000));put(0x2131c40,WORLD)
 put(ACTION+0x20,MOVE);put(ACTION+0xe4,OWNER);put(OWNER+0x10,SPEC);put(SPEC,config['species'])
 put(OWNER+0x94,ACTION if config['ownerLocked'] else 0);put(TARGET+0x2c,POINT)
 put(MOVE+0x1c,0x2120900 if config['specialPrelude'] else 0x2120674)
 put(MOVE+0x3c,0x212f6ab if config['recognizedBlockedScript'] else 0x212f4a0)
 u.mem_write(MOVE+0x44,struct.pack('<H',0x131))
 for j,v in enumerate(config['moveOffsets']):u.mem_write(MOVE+[0x40,0x41,0x43][j],bytes([v]))
 for j in range(3):put(POINT+j*4,config['point'][j]);put(OFFSET+j*4,config['offset'][j])
 u.mem_write(BOX,struct.pack('<hhhh',*config['box']))
 for j in config['busyChildren']:put(ACTION+0x24+j*4,0xdead0000+j*4)
 for j in range(4):put(ACTION+0x970+j*4,0xf000+j)
 put(STACK+0x18,config['resultCode']);put(STACK+0x20,0)
 for reg,v in [(UC_ARM_REG_R4,ACTION),(UC_ARM_REG_R5,TARGET),(UC_ARM_REG_R6,OFFSET),(UC_ARM_REG_R10,config['nativeKind'])]:u.reg_write(reg,v)
 run(0x211da0c,0x211df2c)
 cases.append({'input':dict(config),'allocations':list(allocations),'scripts':list(scripts),'sparks':list(sparks),
  'handles':[word(ACTION+0x24+j*4) for j in range(24)],'owners':[word(ACTION+0x84+j*4) for j in range(24)],
  'bindings':[word(ACTION+0x970+j*4) for j in range(4)],
  'actors':[{'actor':a['actor'],'point':[signed(a['actor']+0x24+j*4) for j in range(3)],
   'active':u.mem_read(a['actor']+0x5b,1)[0],'mode':word(BASE+0x19e54+j*4)} for j,a in enumerate(allocations) if a['actor']]})

out={'romSha256':sha,'overlaySha256':hashlib.sha256(bytes(ov.data)).hexdigest(),
 'scope':'D95C_D99C_AND_DA0C_DF20_ORIGINAL_ARM_WITH_CONTROLLED_ALLOCATOR_BOX_VM_AND_3D_BOUNDARIES',
 'addresses':dict(owner=OWNER,target=TARGET,action=ACTION,move=MOVE,species=SPEC,world=WORLD),
 'offsets':offsets,'cases':cases}
Path(args.out).write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'offsetCases':len(offsets),'continuationCases':len(cases),'romSha256':sha}))
