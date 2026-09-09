"""R9 normal-flow ARM oracle. Controlled inputs, never a full-match ROM claim.

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

p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);p.add_argument('--tables',required=True);args=p.parse_args()
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

tables={'romSha256':sha,'targetProfiles':[word(word(0x21159cc)+i*4) for i in range(3)],
 'placementAddress':word(0x2110040),'placements':[[read(word(0x2110040)+i*8+j*4) for j in range(2)] for i in range(6)],
 'pointerRewrites':{f'{p:x}':word(p) for p in [0x211c5fc,0x211c600,0x211c604,0x211c608]},
 'impulseDecay':word(0x2112d10),'runDecay':struct.unpack('<f',bytes(u.mem_read(0x2112eb4,4)))[0]}
targets=[];mode='target';rng=random.Random(9)
for selector in range(13):
 for n in range(80):
  v={'rolls':[rng.randrange(103)]};init(v);entries=[]
  for i in range(3):
   fields={'1c':rng.choice([-32768,0,1,50,32767]),'1e':rng.choice([-1,0,1]),'20':rng.choice([-1,0,1]),'17c':rng.choice([1,8,15,18,19,20,21]),'9a':rng.choice([0,0,2])}
   stats={f'{o:x}':rng.choice([-1,0,1,100,1000]) for o in [0x50,0x54,0x58,0x5c,0x84,0x88]}
   for k,x in fields.items():(half if k in ['1c','1e','20','9a'] else put)(C+i*0x1000+int(k,16),x)
   for k,x in stats.items():put(C+i*0x1000+0x400+int(k,16),x)
   entries.append({'c':fields,'stats':stats})
  ptr=run(0x2111f20,[T,selector]);targets.append({'selector':selector,'entries':entries,**v,'result':(ptr-C)//0x1000 if ptr else None,'rollsConsumed':len(rolls)})

positions=[];mode='position'
for state in [3,4,5]:
 for n in range(450):
  v={'state':state,'angle':rng.choice([0,8192,8193,16384,24575,24576,32768,40960,40961,49152,57343,57344,65535]),
    'distance':rng.choice([0,31*4096,32*4096-1,32*4096,48*4096-1,48*4096,50*4096,80*4096,81*4096]),
    'point':[rng.choice([20,49,50,200,366,367,400])*4096,rng.choice([20,49,50,150,222,223,260])*4096,0],
    'targetPoint':[250*4096,150*4096,0],'rolls':[rng.randrange(103),rng.randrange(103)],
    'c':{'168':state,'16c':n%2,'28':n%3,'78':1 if n%5==0 else 0,'7c':1,'80':1}}
  init(v);run({3:0x2115f38,4:0x21161f0,5:0x2116314}[state]);positions.append({'input':v,'result':snap()})

guards=[];mode='guard'
for lock in [0,1]:
 for globalLock in [0,1]:
  for busy in [0,1]:
   for hp in [None,-1,0,1]:
    for resource in [0,9,10,11]:
     v={'lock':lock,'globalLock':globalLock,'busy':busy,'targetHp':hp,'resource':resource,'cost':10};init(v)
     put(C+0x154,lock);put(C+0x1000+0x94,globalLock);put(O,busy);put(M+0x48,10);put(C+0x400+0x54,resource)
     if hp is None:put(C+0x5c,0)
     else:put(C+0x1000+0x400+0x50,hp)
     # Successful guard stops before presentation and VM initialization.
     def stop_charge(uc,pc,size,_):u.reg_write(UC_ARM_REG_R0,1);u.reg_write(UC_ARM_REG_PC,STOP)
     h=u.hook_add(UC_HOOK_CODE,stop_charge,begin=0x211c264,end=0x211c264)
     accepted=run(0x211c144,[O,C,M,C+0x300]);u.hook_del(h)
     guards.append({'input':v,'accepted':bool(accepted),'resourceAfter':read(C+0x400+0x54),'moveAssigned':word(O+0x20)==M})

placement=[];mode='placement'
for count in [1,2,3]:
 init({})
 for t in range(2):put(G+0x5e18+t*4,T+t*0x100);put(T+t*0x100+0x10,count)
 for t in range(2):
  for i in range(3):put(G+0x5e20+(t*3+i)*4,C+(t*3+i)*0x1000 if i<count else 0)
 u.reg_write(UC_ARM_REG_R9,G);u.reg_write(UC_ARM_REG_R4,0)
 run(0x210fd1c,end=0x210fde0)
 placement.append({'count':count,'points':[[read(C+i*0x1000+0x300+j*4) for j in range(3)] if i%3<count else None for i in range(6)]})
speeds=[];mode='speed'
for roll in range(103):
 init({'rolls':[17,roll]});u.reg_write(UC_ARM_REG_R5,C);run(0x2114154,end=0x21141b8);speeds.append({'roll':roll,'value':read(C+0x3c),'rollsConsumed':len(rolls)})
notifications=[];mode='notification'
handlers=[0x2112d5c,0x2112dcc,0x2112dfc,0x2112e34,0x2112eb8,0x2112ef0,0x2112f28,0x2112f60,0x2112f98,0x2112fd8,0x2113018,0x2113058,0x2113098]
for n in range(13):
 for k in [0,1,240,241,248,249,500]:
  v={'c':{'17c':n,'180':k,'3c':3100,'40':8192,'48':23,'4c':7},'walk':4096,'run':10000};init(v)
  run(handlers[n]);notifications.append({'input':v,'result':snap(),'actor440':read(C+0x800+0x440)})
movement=[];mode='movement'
for n in range(400):
 v={'c':{'17c':rng.randrange(22),'3c':rng.choice([0,1000,4096]),'40':rng.choice([0,1000,10000]),
    '44':rng.randrange(-65536,131072),'48':rng.randrange(4000),'4c':rng.choice([0,512,513,800,4096]),'50':rng.randrange(65536),'158':rng.choice([0,6,13]),'160':rng.choice([0,3])},'walk':4096}
 init(v);u.reg_write(UC_ARM_REG_R4,C);run(0x2112a18,end=0x2112c20)
 movement.append({'input':v,'result':snap(),'point':[read(C+0x300+j*4) for j in range(3)]})
geometry=[];mode='geometry'
for n in range(70):
 points=[[rng.randrange(250)*4096+rng.randrange(4096),rng.randrange(180)*4096, rng.randrange(3)*4096] for i in range(6)]
 if n%2==0:points[1]=[points[0][0]+1,points[0][1]+1,0]
 init({})
 for i,pt in enumerate(points):
  for j,v in enumerate(pt):put(G+0x5e38+i*12+j*4,v)
 run(0x210f5d8,[G,n%3==0]);geometry.append({'points':points,'skipSeparation':n%3==0,
   'resultPoints':[[read(G+0x5e38+i*12+j*4) for j in range(3)] for i in range(6)],
   'distances':[[read(G+0x1f140+i*24+j*4) for j in range(6)] for i in range(6)],
   'angles':[[int.from_bytes(u.mem_read(G+0x1f1d0+i*12+j*2,2),'little') for j in range(6)] for i in range(6)]})
launches=[];mode='launch'
for n in range(900):
 state=[14,15,16][n%3];v={'state':state,'c':{'168':state,'16c':rng.choice([0,0,0,1,2,3]),'17c':rng.choice([1,8,9,10,11,12,15]),
   '180':rng.choice([-255,0,1]),'154':rng.choice([0,1]),'3c':3000,'1c':0x7fff,'78':rng.choice([0,0,1]),'7c':1,'80':1},
   'globalAbort':bool(n%7==0),'allocated':bool(n%4),'initialized':bool(n%5),'finished':n%2,'angle':rng.randrange(65536),'moveField10':n%4}
 init(v);put(G+0x5ea8,2 if v['globalAbort'] else 0);put(M+0x10,v['moveField10']);put(O,1)
 run({14:0x2116aa4,15:0x2116cac,16:0x2116e94}[state]);launches.append({'input':v,'result':snap(),
   'tally':int.from_bytes(u.mem_read(C+0x1c,2),'little',signed=True),'slots':[bool(word(C+0x78+j*4)) for j in range(3)],'objectActive':bool(word(O)&1)})
locks=[];mode='locks'
for pc in [0x211cec4,0x211cefc,0x21156bc]:
 for ownerLock in [0,99,123]:
  for obj in [99,123]:
   for slots in [[0,0,0],[99,123,0],[123,99,99],[123,123,123]]:
    v={'routine':pc,'lock':ownerLock,'object':obj,'slots':slots};init(v);put(C+0x154,ownerLock)
    for j,x in enumerate(slots):put(C+0x78+j*4,x)
    result=run(pc,[C,obj]);locks.append({'input':v,'result':{'return':result,'lock':word(C+0x154),'slots':[word(C+0x78+j*4) for j in range(3)]}})
teamCounters=[];mode='team'
for n in range(300):
 members=[{'currentHp':rng.choice([0,1,199,200,399,400,499,500,599,600,799,800,1000]),'maxHp':1000,'statusCode':rng.randrange(16)} for _ in range(3)]
 before={'metric44':[rng.randrange(200) for _ in range(3)],'metric54':[rng.randrange(200) for _ in range(3)],'guard40':rng.randrange(200),'guard50':0}
 init({})
 for i,member in enumerate(members):
  put(C+i*0x1000+0x400+0x50,member['currentHp']);put(C+i*0x1000+0x158,member['statusCode'])
  put(T+0x44+i*4,before['metric44'][i]);put(T+0x54+i*4,before['metric54'][i])
 put(T+0x40,before['guard40']);run(0x211240c,[T])
 teamCounters.append({'members':members,'before':before,'result':{'metric44':[read(T+0x44+i*4) for i in range(3)],'metric54':[read(T+0x54+i*4) for i in range(3)],'guard40':read(T+0x40),'guard50':read(T+0x50)}})
support=[];mode='support'
for kind in [2,3]:
 for code in range(31):
  for hp in [-1,0,1,999,1001]:
   v={'kind':kind,'statusCode':code,'hp':hp,'maxHp':1000};init(v);put(C+0x400+0x50,hp);put(O+0x20,M);put(O+0xe4,C+0x1000);put(M+0x50,kind);put(M+0x5c,code)
   run(0x21149a8,[C,O,C+0x300]);support.append({'input':v,'result':{'hp':read(C+0x400+0x50),'calls':[x for x in calls if x[0] in ['clear','positive']]}})
out={'romSha256':sha,'overlaySha256':hashlib.sha256(bytes(ov.data)).hexdigest(),
 'scope':__doc__,'targets':targets,'positions':positions,'guards':guards,'placement':placement,'speeds':speeds,
 'notifications':notifications,'movement':movement,'geometry':geometry,'launches':launches,'locks':locks,'teamCounters':teamCounters,'support':support}
for path,data in [(args.out,out),(args.tables,tables)]:Path(path).write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:len(v) for k,v in out.items() if isinstance(v,list)}));print(json.dumps(tables))
