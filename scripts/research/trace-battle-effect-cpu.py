"""R10 original 2D pool and rotated contact oracle. Controlled inputs, never a full-match ROM claim.

Original pool lists, segment/rotated contact, physics and animation execute.
Controlled resource/animator callbacks are limited to pool lifecycle tests.
Numeric tables only; no ROM graphics are emitted into the product.
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
 if mode=='pool' and pc==0x20476a0:calls.append(['resource',r0,r1])
 elif mode=='pool' and pc==0x2047904:calls.append(['sequence',r0,r1])
 elif mode=='pool' and pc==0x2047c48:u.reg_write(UC_ARM_REG_R0,config.get('done',{}).get(r0,0))
 elif mode=='pool' and pc in [0x2047a08,0x204819c]:calls.append(['animate' if pc==0x2047a08 else 'physics',r0,r1])
 elif mode=='contact' and pc==0x2047e58:u.reg_write(UC_ARM_REG_R0,r0+0xcc if r0 else 0)
 elif mode=='lookup' and pc==0x2054a34:u.reg_write(UC_ARM_REG_R0,config['actor'])
 elif mode=='lookup' and pc==0x233d000:u.reg_write(UC_ARM_REG_R0,config['resource'])
 elif mode=='followup' and pc==0x21145c0:
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

rng=random.Random(10);segments=[];mode='segment'
for n in range(600):
 v=[[rng.randrange(-1000,1000) for _ in range(2)] for _ in range(4)]
 if n%5==0:v=[[-10,0],[10,0],[-20+n%40,0],[20+n%40,0]]
 if n%7==0:v[1]=v[0].copy()
 init({})
 for i,x in enumerate(v[2]+v[3]):put(STACK+i*4,x)
 result=run(0x2066c90,v[0]+v[1]);segments.append({'points':v,'result':result})

contact=[];mode='contact'
for n in range(700):
 a=[rng.randrange(-30,1),rng.randrange(-30,1),rng.randrange(1,50),rng.randrange(1,50)]
 b=[rng.randrange(-30,1),rng.randrange(-30,1),rng.randrange(1,50),rng.randrange(1,50)]
 pt=[rng.randrange(80)*4096+rng.randrange(4096),rng.randrange(80)*4096,rng.randrange(20)*4096]
 qt=[rng.randrange(80)*4096,rng.randrange(80)*4096,rng.randrange(20)*4096]
 angle=rng.choice([0,0,1024,8192,16384,24576,32768,49152,65024]);table=0x20b9944
 # Use fixed sin/cos already independently dumped with R8 rather than assume table address.
 trig=json.loads(Path('src/data/championship/battleHitTables.json').read_text())['sinCos'];s,c=trig[(angle>>4)*2:(angle>>4)*2+2]
 init({})
 for actor,box,p in [(C,a,pt),(T,b,qt)]:
  for o,v in zip([0xcc,0xce,0xd0,0xd2],[box[2],box[3],box[0],box[1]]):half(actor+o,v)
  for i,v in enumerate(p):put(actor+0x24+i*4,v)
 put(C+0xc,s);put(C+0x10,c)
 result=run(0x211ba40,[C,T]);contact.append({'a':a,'b':b,'p':pt,'q':qt,'sin':s,'cos':c,'result':result})

pool=[];mode='pool';P=G+0x1f218
def initpool():
 init({});put(P+0x1b598,496);put(P+0x1b594,0)
 for i in range(496):put(P+0x1add4+i*4,P+0x394+i*0xd4);put(P+0x394+i*0xd4+0x54,-1)
 put(P+0x134+7*4,0x233f000)
def poolsnap():
 count=word(P+0x1b594);live=[word(P+0x1a614+i*4) for i in range(count)]
 return {'live':[(x-(P+0x394))//0xd4 for x in live],'free':word(P+0x1b598),
 'modes':[word(P+0x19e54+((x-(P+0x394))//0xd4)*4) for x in live]}
for encoded in [0,1,0x700,0x701,0x702,0x7ff,0x601,0x9701,0x9801,0xffff]:
 for md in [0,1,3]:
  initpool();result=run(0x211abfc,[P,encoded,md]);pool.append({'encoded':encoded,'mode':md,'index':(result-(P+0x394))//0xd4 if result else None,'snapshot':poolsnap()})
initpool();allocations=[]
for i in range(498):allocations.append(run(0x211abfc,[P,0x701,i%4]))
exhaustion={'allocated':sum(bool(x) for x in allocations),'snapshot':poolsnap()}
releases=[]
for i in [40,200,0,495,40]:
 run(0x211acf8,[P,allocations[i]]);releases.append({'index':495-i,'snapshot':poolsnap()})
initpool();active=[run(0x211abfc,[P,0x701,i%4]) for i in range(8)]
u.mem_write(active[2]+0x5b,b'\0');config['done']={active[0]:1};calls.clear()
# First 2D loop only, before unrelated 3D pools.
run(0x211a568,[P,0,4096],end=0x211a6a0)
update={'snapshot':poolsnap(),'calls':[[x[0],(x[1]-(P+0x394))//0xd4,x[2]] for x in calls]}
out={'romSha256':sha,'overlaySha256':hashlib.sha256(bytes(ov.data)).hexdigest(),
 'seams':['controlled transformed boxes for 0211BA40; full original softfloat and segment instructions','resource/animation engine callbacks for pool; full original reset/list operations'],
 'segments':segments,'contact':contact,'allocations':pool,'exhaustion':exhaustion,'releases':releases,'update':update}
mode='physics';physics=[]
for n in range(120):
 init({});delta=rng.choice([0,2048,4096,8192,-4096,5001])
 values=[rng.randrange(-100000,100000) for _ in range(9)]
 for o,v in zip([0x24,0x28,0x2c,0x3c,0x40,0x44,0x48,0x4c,0x50],values):put(C+o,v)
 run(0x204819c,[C,delta]);physics.append({'values':values,'delta':delta,
  'after':[read(C+o) for o in [0x24,0x28,0x2c,0x3c,0x40,0x44]]})
out['physics']=physics
mode='animation';players=[]
for delta in [2048,4096,8192,24576]:
 init({});A,S,F=C,T,O;durations=[0,4,9,4,3]
 u.mem_write(S,struct.pack('<HHIII',len(durations),0,65536,1,F))
 for i,duration in enumerate(durations):
  u.mem_write(F+i*8,struct.pack('<IHH',M+i*4,duration,0xbeef));put(M+i*4,i)
 put(A+0x14,4096);put(A+0xc,1);run(0x202e438,[A,S]);samples=[]
 for tick in range(50):
  run(0x202e188,[A,delta]);samples.append({'frameIndex':(word(A)-F)//8,'elapsedQ12':word(A+0x10),'active':word(A+0xc)})
 players.append({'durations':durations,'delta':delta,'samples':samples})
out['zeroTickPlayers']=players
# Original bank-demand loop, ending before any graphic-resource allocation.
mode='demand';demands=[]
catalog=json.loads(Path('src/data/championship/catalogs/battle-moves.r1.json').read_text())
records=catalog['records']
for ids in [[179,180,181],[254,255],list(range(10)),list(range(50,60))]:
 init({});P=G+0x1f218
 for i in range(6):put(G+0x5e20+i*4,0)
 put(G+0x5e20,C);u.mem_write(C+0x9c,bytes([len(ids)]))
 for i,index in enumerate(ids):put(C+0xa0+i*4,0x20cff9c+index*104)
 run(0x211a000,[P,0],end=0x211a180)
 demands.append({'ids':ids,'demand':list(struct.unpack('<152H',u.mem_read(P+4,304)))})
out['demands']=demands
mode='lookup';lookups=[]
for id in [0,1,7,19,151]:
 init({'actor':C if id else 0,'resource':0x233f000});P=G+0x1f218
 put(C,0x233d100);put(0x233d110,0x233d000)
 if id:put(P+0x134+id*4,0x233f000)
 result=run(0x211d2e0,[O]);lookups.append({'id':id,'result':result})
out['bankLookups']=lookups
Path(args.out).write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:len(v) for k,v in out.items() if isinstance(v,list)}))
