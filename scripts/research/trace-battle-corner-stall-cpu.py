"""Corner-stall ARM oracle (2026-10-13). Controlled inputs, never a full-match ROM claim.

Original target, positioning and C144 guard instructions execute unchanged.
Scene animation, allocator, state/notification services and RNG are explicit
seams. Numeric tables only; no ROM graphics are emitted into the product.
"""
import argparse, hashlib, json, random, struct, math
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE, UC_HOOK_MEM_READ
from unicorn.arm_const import *

p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);args=p.parse_args()
raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
rom=NintendoDSRom(raw);arm=bytes(decompress(rom.arm9));ov=rom.loadArm9Overlays()[19]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x400000);u.mem_map(0x4000000,0x1000)
u.mem_write(0x2000000,arm);u.mem_write(ov.ramAddress,bytes(ov.data))
C,T,O,M,G,STOP,STACK=0x2300000,0x2310000,0x2311000,0x2312000,0x2320000,0x23f0000,0x23e0000
def put(a,v):u.mem_write(a,struct.pack('<I',v&0xffffffff))
def word(a):return int.from_bytes(u.mem_read(a,4),'little')
def read(a):return int.from_bytes(u.mem_read(a,4),'little',signed=True)
def half(a,v):u.mem_write(a,struct.pack('<H',v&65535))
config={};calls=[];rolls=[];mode='';rollIndex=0
def divider(uc,access,address,size,value,data):
 if 0x40002a0<=address<0x40002b0:
  dmode=int.from_bytes(u.mem_read(0x4000280,2),'little')&3
  n=int.from_bytes(u.mem_read(0x4000290,4 if dmode==0 else 8),'little',signed=True)
  d=int.from_bytes(u.mem_read(0x4000298,8 if dmode==2 else 4),'little',signed=True)
  q=(1 if n<0 else -1) if d==0 else (abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1)
  u.mem_write(0x40002a0,(q&0xffffffffffffffff).to_bytes(8,'little'))
  u.mem_write(0x40002a8,((n-q*d)&0xffffffffffffffff).to_bytes(8,'little'))
 if address==0x40002b4:
  size=8 if word(0x40002b0)&1 else 4
  put(address,math.isqrt(int.from_bytes(u.mem_read(0x40002b8,size),'little')))
u.hook_add(UC_HOOK_MEM_READ,divider,begin=0x4000280,end=0x40002bf)
def hook(uc,pc,size,_):
 global rollIndex
 r0,r1=[u.reg_read(r) for r in [UC_ARM_REG_R0,UC_ARM_REG_R1]]
 if mode=='locks' and pc==0x2054a34:u.reg_write(UC_ARM_REG_R0,[C,config['object']][r1])
 elif mode=='support' and pc in [0x211452c,0x21147e8]:calls.append(['clear' if pc==0x211452c else 'positive',r1])
 elif pc==0x20431d4:
  values=config.get('rolls',[0]);value=values[rollIndex%len(values)];rollIndex+=1;rolls.append(r0);u.reg_write(UC_ARM_REG_R0,value)
 elif pc==0x2114984:put(r0+0x168,r1);put(r0+0x16c,-255)
 elif pc==0x2112820:put(r0+0x17c,r1);put(r0+0x180,-255);calls.append(['notify',r1])
 elif pc==0x21157bc:calls.append(['gate'])
 elif pc==0x2114310:calls.append(['sequence',r1]);u.reg_write(UC_ARM_REG_R0,1)
 elif pc in [0x2114320,0x211436c]:u.reg_write(UC_ARM_REG_R0,config.get('walk' if pc==0x2114320 else 'run',4096))
 elif mode=='launch' and pc==0x210f8c4:
  calls.append(['allocate']);u.reg_write(UC_ARM_REG_R0,O if config.get('allocated',True) else 0)
 elif mode=='launch' and pc==0x211c098:
  put(O+0x20,M);calls.append(['initialize']);u.reg_write(UC_ARM_REG_R0,int(config.get('initialized',True)))
 elif pc==0x2047c48:u.reg_write(UC_ARM_REG_R0,config.get('finished',0))
 elif mode=='position' and pc==0x210f890:u.reg_write(UC_ARM_REG_R0,config['distance'])
 elif mode in ['position','launch'] and pc==0x21127ec:u.reg_write(UC_ARM_REG_R0,config['angle'])
 else:return
 u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
def init(v):
 global config,rollIndex
 config=v;rollIndex=0;calls.clear();rolls.clear();u.mem_write(C,bytes(0x70000));put(0x2131c40,G)
 for i in range(6):
  c=C+i*0x1000;s=c+0x400;a=c+0x800;pt=c+0x300
  put(c+4,a);put(c+0x10,s);put(c+0x2c,pt);put(c+0xc,i);put(c+0x5c,C+0x1000)
  put(s+0x50,100);put(s+0x54,100);put(s+0x58,1000);put(s+0x5c,1000)
  put(c+0x170,1);put(c+0x17c,1);put(c+0x28,10);put(c+0x1c,1);put(c+0x174,M)
  put(c+0x184,50*4096);put(c+0x188,30*4096);put(G+0x5e20+i*4,c)
  for j,x in enumerate(v.get('point' if i==0 else 'targetPoint',[200*4096,150*4096,0])):put(pt+j*4,x)
 put(T+0x10,3)
 for i in range(3):put(T+i*4,C+i*0x1000)
 for k,x in v.get('c',{}).items():put(C+int(k,16),x)
def run(pc,values=None,end=STOP):
 for reg,v in zip([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3],values or [C]):u.reg_write(reg,v&0xffffffff)
 u.reg_write(UC_ARM_REG_SP,STACK);u.reg_write(UC_ARM_REG_LR,STOP)
 try:u.emu_start(pc,end,count=100000)
 except Exception:print('oracle failure',mode,hex(u.reg_read(UC_ARM_REG_PC)),config);raise
 assert u.reg_read(UC_ARM_REG_PC)==end,hex(u.reg_read(UC_ARM_REG_PC))
 return u.reg_read(UC_ARM_REG_R0)
def snap():return {'c':{f'{o:x}':read(C+o) for o in [0x28,0x3c,0x40,0x44,0x48,0x4c,0x50,0x168,0x16c,0x170,0x17c,0x180]},'calls':list(calls),'rolls':list(rolls)}

# Inputs captured from the diagnostic practice battle (seed 5, arena 2, frames
# 435..840): every combatant held state 4 while its own notification was 1, 8
# or 9, i.e. not walking. Distances/angles are the previous-frame world matrix.
CASES=[
 {'label':'slot1_band_32_48','c':{'168':4,'16c':8,'17c':1,'180':100,'28':40,'40':0,'3c':3100},'distance':39*4096,'angle':29535,'point':[384*4096,198*4096,0],'targetPoint':[347*4096,210*4096,0]},
 {'label':'slot0_vertical_near','c':{'168':4,'16c':8,'17c':1,'180':100,'28':40,'40':0,'3c':3100},'distance':28*4096,'angle':46984,'point':[353*4096,238*4096,0],'targetPoint':[347*4096,210*4096,0]},
 {'label':'slot3_vertical_after_attack','c':{'168':4,'16c':8,'17c':9,'180':100,'28':40,'40':0,'3c':3100},'distance':28*4096,'angle':14216,'point':[347*4096,210*4096,0],'targetPoint':[353*4096,238*4096,0]},
 {'label':'slot4_band_after_attack','c':{'168':4,'16c':8,'17c':8,'180':100,'28':40,'40':0,'3c':3100},'distance':45*4096,'angle':7679,'point':[320*4096,207*4096,0],'targetPoint':[347*4096,210*4096,0]},
 {'label':'control_far_walks','c':{'168':4,'16c':8,'17c':1,'180':100,'28':40,'40':0,'3c':3100},'distance':48*4096,'angle':29535,'point':[384*4096,198*4096,0],'targetPoint':[335*4096,210*4096,0]},
 {'label':'control_near_launches','c':{'168':4,'16c':8,'17c':1,'180':100,'28':40,'40':0,'3c':3100},'distance':31*4096,'angle':29535,'point':[384*4096,198*4096,0],'targetPoint':[353*4096,210*4096,0]},
 {'label':'slot1_band_cooldown_spent','c':{'168':4,'16c':8,'17c':1,'180':100,'28':0,'40':0,'3c':3100},'distance':39*4096,'angle':29535,'point':[384*4096,198*4096,0],'targetPoint':[347*4096,210*4096,0]},
]
results=[]
for case in CASES:
 v={**case,'c':{**case['c'],'78':0,'7c':0,'80':0}}
 # 1) state 4 handler 0x021161F0
 mode='position';init(v);run(0x21161f0);handler=snap()
 # 2) notification-1 update (0x02112DCC) with the counter past entry, then
 # 3) the shared movement routine 0x02112A18..0x02112C20 that moves +0x2C.
 mode='movement';init({'c':{**v['c'],'44':handler['c']['44']},'walk':4096,'point':v['point']})
 u.reg_write(UC_ARM_REG_R4,C);run(0x2112a18,end=0x2112c20)
 moved=[read(C+0x300+j*4)-v['point'][j] for j in range(3)]
 results.append({'label':case['label'],'input':v,'stateHandler':handler,'movementDelta':moved})
out={'romSha256':sha,'overlaySha256':hashlib.sha256(bytes(ov.data)).hexdigest(),'scope':__doc__,'cases':results}
Path(args.out).write_text(json.dumps(out,indent=1)+'\n',encoding='utf-8',newline='\n')
for r in results:print(r['label'],'calls',r['stateHandler']['calls'],'state',r['stateHandler']['c']['168'],'period',r['stateHandler']['c']['170'],'heading',r['stateHandler']['c']['44'],'moved',r['movementDelta'])
