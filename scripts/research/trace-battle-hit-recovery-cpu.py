"""R8: original ARM hit writers and notification 15/18/19/20/21.

Controlled damage-core output and scene services are explicit oracle seams.
Reaction branches, vertical SDK integration, exit cleanup and recovery decisions
execute cartridge instructions. No original full-match claim.
"""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);p.add_argument('--tables',required=True);args=p.parse_args()
raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
r=NintendoDSRom(raw);arm=bytes(decompress(r.arm9));ov=r.loadArm9Overlays()[19];data=bytes(ov.data)
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x400000);u.mem_write(0x2000000,arm);u.mem_write(ov.ramAddress,data)
C,A,S,P,O,M,G,T,STOP,STACK=[0x2300000+i*0x1000 for i in range(10)]
G=0x2320000;STOP=0x23f0000;STACK=0x23e0000
def put(a,v):u.mem_write(a,struct.pack('<I',v&0xffffffff))
def word(a):return int.from_bytes(u.mem_read(a,4),'little')
def signed(v):return (v&0x7fffffff)-(v&0x80000000)
def read(a):return signed(word(a))
cf=[0x22,0x3c,0x40,0x44,0x4c,0x50,0x84,0x88,0x8c,0x90,0x98,0x9a,0x158,0x15c,0x160,0x164,0x168,0x16c,0x170,0x17c,0x180]
af=[0xc,0x10,0x14,0x1c,0x24,0x28,0x2c,0x38,0x3c,0x40,0x44,0x48,0x4c,0x50,0x43c,0x440,0x6cc,0x6dc]
calls=[];rolls=[];config={};writer=False;branches=[]
def hook(uc,pc,size,_):
    if word(pc)&0x0f000000==0x0b000000:
        branches.append(hex(pc));branches[:]=branches[-20:]
    r0,r1=[u.reg_read(x) for x in [UC_ARM_REG_R0,UC_ARM_REG_R1]]
    if writer and pc==0x21149dc:
        u.reg_write(UC_ARM_REG_R5,config['damage']&0xffffffff);u.reg_write(UC_ARM_REG_R8,int(config.get('blocked',False)))
        u.reg_write(UC_ARM_REG_R4,config.get('defenderIndex',6));u.reg_write(UC_ARM_REG_R10,config.get('attackerIndex',8))
        if config['damage']>0:
            u.reg_write(UC_ARM_REG_R0,0);u.reg_write(UC_ARM_REG_R2,config.get('kind',0));u.reg_write(UC_ARM_REG_PC,0x2114d20)
        else:u.reg_write(UC_ARM_REG_PC,0x2114d78)
        return
    if pc==0x20431d4:
        value=config.get('roll',52);rolls.append(r0);u.reg_write(UC_ARM_REG_R0,value)
    elif pc==0x2114310:
        calls.append(['sequence',r1]);u.mem_write(A+0x58,bytes([r1]));u.reg_write(UC_ARM_REG_R0,1)
    elif pc==0x2047d98:u.reg_write(UC_ARM_REG_R0,config.get('height',48))
    elif pc==0x2047c48:u.reg_write(UC_ARM_REG_R0,config.get('finished',0))
    elif pc==0x21144cc:u.reg_write(UC_ARM_REG_R0,config.get('recoveryMove',0))
    elif pc in [0x203ea30,0x210fc68,0x2119294,0x2119718,0x2119948,0x2119a90,0x2119db0,0x2119dc0,0x211184c,0x2046478,0x2046490]:
        pass  # presentation services only; no state result consumed
    elif pc==0x21126dc:pass  # cross-team pointer invalidation, not this scalar oracle
    elif pc==0x2112630:
        put(T+0x14,word(T+0x14)+1);calls.append(['downCount',word(T+0x14)])
    elif pc in [0x211272c,0x2112774]:u.reg_write(UC_ARM_REG_R0,0) # global ending supplied explicitly
    else:return
    u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
def init(v):
    global config
    config=v;u.mem_write(C,bytes(0x10000));u.mem_write(G,bytes(0x50000));put(0x2131c40,G)
    put(C+4,A);put(C+0x10,S);put(C+0x14,S+0x300);put(C+0x2c,P);put(C+0x54,T);put(C+0x58,T)
    put(C+0x98,2);put(C+0x168,3);put(C+0x170,1);put(C+0x17c,15)
    put(S+0x50,v.get('hp',100));put(S+0x58,v.get('maxHp',1000));put(S+0x54,100)
    put(P,200*4096);put(P+4,150*4096);put(P+8,v.get('z',0));put(A+0x2c,v.get('z',0))
    put(T+0x10,v.get('teamCount',3));put(T+0x14,v.get('downed',0));put(G+0x1f12c,v.get('ending',0))
    put(O+0x20,M);put(O+0xe4,C+0x800);put(C+0x800+0x14,S+0x400)
    put(M+0x14,v.get('hitKind',0));put(M+0x50,v.get('kind',0));put(M+0x5c,v.get('status',0))
    for off in [0x9c,0xa0,0xa4]:put(S+off,6)
    put(P+0x20,100*4096);put(P+0x24,150*4096)
    for k,value in v.get('c',{}).items():put(C+int(k,16),value)
    for k,value in v.get('a',{}).items():put(A+int(k,16),value)
    calls.clear();rolls.clear()
def run(pc):
    for reg,v in [(UC_ARM_REG_R0,C),(UC_ARM_REG_R1,O),(UC_ARM_REG_R2,P+0x20),(UC_ARM_REG_SP,STACK),(UC_ARM_REG_LR,STOP)]:u.reg_write(reg,v)
    try:u.emu_start(pc,STOP,count=100000)
    except Exception:
        print('oracle failure',hex(u.reg_read(UC_ARM_REG_PC)),config,branches);raise
    assert u.reg_read(UC_ARM_REG_PC)==STOP,hex(u.reg_read(UC_ARM_REG_PC))
def snap():
    return {'c':{f'{o:x}':read(C+o) if o not in [0x22,0x98,0x9a] else int.from_bytes(u.mem_read(C+o,1 if o==0x98 else 2),'little') for o in cf},
      'a':{f'{o:x}':read(A+o) for o in af},'point':[read(P+i*4) for i in range(3)],
      'hp':read(S+0x50),'resource':read(S+0x54),'downed':read(T+0x14),'calls':list(calls),'rolls':list(rolls)}
writers=[];writer=True
for hp in [1,100,500]:
 for kind in range(14):
  for roll in [0,1]:
   v={'hp':hp,'damage':100,'hitKind':kind,'roll':roll};init(v);run(0x21149a8);writers.append({'input':v,'result':snap()})
for kind in [0,1,5]:
 v={'hp':100,'damage':-20,'hitKind':kind,'blocked':True};init(v);run(0x21149a8);writers.append({'input':v,'result':snap()})
for reaction in [9,10]:
 v={'hp':500,'damage':10,'hitKind':3 if reaction==9 else 4,'c':{'84':reaction,'90':19,'17c':15}};init(v);run(0x21149a8);writers.append({'input':v,'result':snap()})
for status in range(1,14):
 for roll in [0,19,20,29,30,102]:
  v={'hp':500,'damage':10,'hitKind':0,'roll':roll,'status':status};init(v);run(0x21149a8);writers.append({'input':v,'result':snap()})
for attacker,defender in [(27,26),(26,27),(27,27)]:
 for status in [1,3,6,10]:
  for roll in [0,19,20,29,30,49,50]:
   v={'hp':500,'damage':10,'hitKind':0,'roll':roll,'status':status,'attackerIndex':attacker,'defenderIndex':defender}
   init(v);run(0x21149a8);writers.append({'input':v,'result':snap()})
writer=False;reactions=[]
for reaction in range(14):
 for hp in [0,100]:
  for height in [0,1,2,3,24,48,64]:
   v={'hp':hp,'height':height,'c':{'84':reaction,'180':0},'finished':1};init(v);frames=[]
   for f in range(100):
    calls.clear();run(0x21130c8);frames.append(snap())
    if word(C+0x17c)!=15:break
    put(C+0x180,read(C+0x180)+1)
   reactions.append({'input':v,'frames':frames})
# Update-only branch boundaries, including repeated hit counters and status landings.
boundaries=[]
for reaction in [6,7,8,9,10,11,12,13]:
 for z in [-1,0,1,4096]:
  for counter in [0,1,2,24,30,31]:
   v={'z':z,'hp':100,'height':48,'finished':0,'c':{'84':reaction,'180':counter,'90':counter,'88':409,'158':9}}
   init(v);run(0x21130c8);boundaries.append({'input':v,'result':snap()})
recovery=[]
for n in [18,19,20,21]:
 for counter in [0,1,189,190,210,230,250,270,294,295,309,310,311]:
  for move in [0,28,29]:
   for roll in [0,44,45,49,50,89,90,102]:
    v={'hp':0,'roll':roll,'finished':1,'recoveryMove':move,'c':{'17c':n,'180':counter,'98':2}}
    init(v);run({18:0x21138c0,19:0x21139ac,20:0x2113b4c,21:0x2113d10}[n]);recovery.append({'input':v,'result':snap()})
for n in [18,19,20]:
 for ending,downed in [(1,0),(0,2)]:
  v={'hp':0,'ending':ending,'downed':downed,'c':{'17c':n,'180':0}};init(v);run({18:0x21138c0,19:0x21139ac,20:0x2113b4c}[n]);recovery.append({'input':v,'result':snap()})
table_sites={'moveEntry':0x21139a4,'noMoveEntry':0x21139a8,'moveFinal':0x2113b44,'noMoveFinal':0x2113b48}
table_addresses={name:word(site) for name,site in table_sites.items()}
dot=[]
for status in [0,1,7,13,14]:
 for remaining in [0,1,2,10,11,180,181]:
  for hp in [-1,0,1,3,4,5,30]:
   v={'hp':hp,'maxHp':100,'z':8192,'c':{'158':status,'15c':remaining,'17c':9,'3c':123},'a':{'6cc':17}}
   init(v);put(T+0x100,C)
   for reg,value in [(UC_ARM_REG_R0,C),(UC_ARM_REG_R4,word(0x210de00)),(UC_ARM_REG_R5,0),(UC_ARM_REG_R6,0),
      (UC_ARM_REG_R7,0),(UC_ARM_REG_R9,T+0x100),(UC_ARM_REG_R11,0),(UC_ARM_REG_SP,STACK)]:u.reg_write(reg,value)
   u.emu_start(0x210d700,0x210d8b4,count=100000)
   assert u.reg_read(UC_ARM_REG_PC)==0x210d8b4
   dot.append({'input':v,'result':{'hp':read(S+0x50),'z':read(P+8),'icon':read(A+0x6cc),
     'c':{f'{o:x}':read(C+o) for o in [0x3c,0x158,0x15c,0x168,0x16c,0x17c,0x180]}}})
tables={'romSha256':sha,'sinCosAddress':0x2099d6c,'sinCos':list(struct.unpack_from('<8192h',arm,0x99d6c)),
 'recoveryAddresses':table_addresses,'recovery':{name:[read(addr+i*4) for i in range(3)] for name,addr in table_addresses.items()}}
Path(args.tables).write_text(json.dumps(tables,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
out={'romSha256':sha,'overlaySha256':hashlib.sha256(data).hexdigest(),'scope':'Original CPU reaction and recovery branches; controlled damage result, indices attacker8/defender6, animation completion/height, recovery candidate and scene services',
 'writers':writers,'reactions':reactions,'boundaries':boundaries,'recovery':recovery,'dot':dot}
Path(args.out).write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'writers':len(writers),'reactionFrames':sum(len(x['frames']) for x in reactions),'boundaries':len(boundaries),'recovery':len(recovery),'dot':len(dot)}))
