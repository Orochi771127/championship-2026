"""R9 closure ARM oracle: flags, pursuit and targeted follow-up. Controlled inputs, never a full-match ROM claim.

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
 if mode=='followup' and pc==0x21145c0:
  calls.append(['status',(r0-C)//0x1000,r1]);put(r0+0x168,8);put(r0+0x16c,-255)
 elif mode=='nearest' and pc==0x210f890:
  u.reg_write(UC_ARM_REG_R0,config['distances'][u.reg_read(UC_ARM_REG_R2)])
 elif mode=='pursuit' and pc==0x2112394:u.reg_write(UC_ARM_REG_R0,C+0x1000 if config['target'] else 0)
 elif mode=='pursuit' and pc==0x210f890:u.reg_write(UC_ARM_REG_R0,config['distance'])
 elif mode=='pursuit' and pc==0x21127ec:u.reg_write(UC_ARM_REG_R0,config['angle'])
 elif mode=='locks' and pc==0x2054a34:u.reg_write(UC_ARM_REG_R0,[C,config['object']][r1])
 elif mode=='support' and pc in [0x211452c,0x21147e8]:calls.append(['clear' if pc==0x211452c else 'positive',r1])
 elif pc==0x20431d4:
  values=config.get('rolls',[0]);value=values[rollIndex%len(values)];rollIndex+=1;rolls.append(r0);u.reg_write(UC_ARM_REG_R0,value)
 elif pc==0x2114984:put(r0+0x168,r1);put(r0+0x16c,-255)
 elif pc==0x2112820:put(r0+0x17c,r1);put(r0+0x180,-255);calls.append(['notify',(r0-C)//0x1000,r1])
 elif pc==0x21157bc and mode!='gate':calls.append(['gate'])
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

rng=random.Random(910);nearest=[];mode='nearest'
for n in range(160):
 v={'distances':[rng.choice([0,1,4096,0x270f000,0x270f001]) for _ in range(3)],'flags':[rng.choice([0,1,2,3,4]) for _ in range(3)]};init(v)
 for i,f in enumerate(v['flags']):half(C+i*0x1000+0x9a,f);put(C+i*0x1000+8,i)
 result=run(0x2112394,[T,0]);nearest.append({'input':v,'index':(result-C)//0x1000 if result else None})

pursuit=[];mode='pursuit'
for n in range(420):
 v={'c':{'168':8,'16c':n%3,'24':rng.choice([-1,0,1]),'28':rng.choice([-1,0,1]),'78':n%2,'7c':1,'80':1},
 'angle':rng.choice([0,8192,8193,24575,24576,32768,40960,40961,57343,57344,65535]),
 'distance':rng.choice([0,131071,131072,196607,196608]),'target':n%7!=0,'flags':rng.choice([0,0,2]),'notify':rng.choice([1,15,18]),
 'point':[200*4096,150*4096,0],'targetPoint':[210*4096,149*4096,0],'rolls':[rng.randrange(216)]}
 init(v);half(C+0x1000+0x9a,v['flags']);put(C+0x1000+0x17c,v['notify']);u.mem_write(C+0xe4,b'\x03')
 for i in range(3):put(C+0xc0+i*4,101+i)
 if not v['target']:put(C+0x5c,0)
 run(0x21164c8);pursuit.append({'input':v,'result':snap(),'move':word(C+0x174),'target':bool(word(C+0x5c))})

followup=[];mode='followup'
for n in range(200):
 v={'moveId':n%3,'members':[{'hp':rng.choice([-1,0,1,100]),'flags':rng.choice([0,0,2]),'notify':rng.choice([1,15,18,19,20,21]),'count':rng.choice([1,2,3])} for _ in range(3)],'rolls':[rng.randrange(216) for _ in range(3)]};init(v)
 put(C+0x178,v['moveId']);put(C+0x58,T)
 for i,c in enumerate(v['members']):
  t=C+(i+1)*0x1000;put(T+i*4,t);put(t+0x400+0x50,c['hp']);half(t+0x9a,c['flags']);put(t+0x17c,c['notify']);u.mem_write(t+0xe4,bytes([c['count']]))
  for j in range(3):put(t+0xc0+j*4,100+i*10+j)
 u.reg_write(UC_ARM_REG_R10,C);put(STACK+28,STOP)
 run(0x2116fd8);followup.append({'input':v,'calls':list(calls),'rolls':list(rolls),
  'members':[{'state':read(C+(i+1)*0x1000+0x168),'counter':read(C+(i+1)*0x1000+0x16c),'owner':word(C+(i+1)*0x1000+0x5c)==C,'move':word(C+(i+1)*0x1000+0x174)} for i in range(3)]})

gates=[];mode='gate'
for timer in [-1,0,1,120]:
 for speed in [0,1,2,12,31,100]:
  v={'timer':timer,'speed':speed};init(v);put(C+0x158,1);put(C+0x24,timer);put(C+0x400+0x8c,speed)
  run(0x21157bc);gates.append({'input':v,'state':read(C+0x168),'cooldown':read(C+0x28),'primary':read(C+0x184),'secondary':read(C+0x188)})

flags=[];mode='flags'
for old in [0,1,2,3,4,7,0x80000000,0xffffffff]:
 for occupied in [None,0,1,5]:
  init({});put(G+0x5ea8,old);u.reg_write(UC_ARM_REG_R1,G+0x5000);run(0x210cdd0,end=0x210cde4);initial=word(G+0x5ea8)
  put(G+0x5ea8,old)
  if occupied is not None:put(C+occupied*0x1000+0x94,1)
  put(STACK+4,0);u.reg_write(UC_ARM_REG_R1,G+0x5000);u.reg_write(UC_ARM_REG_R10,G);run(0x210d3a4,end=0x210d414);frame=word(G+0x5ea8)
  run(0x211505c,end=0x2115074);knockout=word(G+0x5ea8)
  flags.append({'old':old,'occupied':occupied,'initial':initial,'frame':frame,'knockout':knockout})

# Numeric provenance only. The referenced graphics stay in the research pack.
bank_table=word(0x211a3ec);banks=[]
for i in range(1,152):
 ptr=word(bank_table+(i-1)*4);name=bytes(u.mem_read(ptr,100)).split(b'\0')[0].decode('ascii')
 banks.append({'id':i,'name':name,'pointer':ptr})
out={'romSha256':sha,'overlaySha256':hashlib.sha256(bytes(ov.data)).hexdigest(),
 'scope':__doc__,'seams':['native animator/notification/state services','controlled RNG channel216','controlled distance table for pursuit','status1 setter independently validated by R8'],
 'nearest':nearest,'pursuit':pursuit,'followup':followup,'gates':gates,'flags':flags,'effectBankProvenance':banks}
Path(args.out).write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:len(v) for k,v in out.items() if isinstance(v,list)}))
