"""Original OVL8 result preparation and rank commit, with UI calls stubbed.

Private ROM/RAM inputs never enter the product; output is controlled numeric
input/output plus rank rules extracted from the original data references.
"""
import argparse, hashlib, json, random, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

ap=argparse.ArgumentParser()
for name in ['rom','ram','out']: ap.add_argument('--'+name,required=True)
a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
ov=NintendoDSRom(raw).loadArm9Overlays()[8]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
u.mem_write(0x2000000,ram);u.mem_write(ov.ramAddress,bytes(ov.data))
word=lambda at:int.from_bytes(u.mem_read(at,4),'little')
def put(at,n,size=4): u.mem_write(at,(n&((1<<(size*8))-1)).to_bytes(size,'little'))
root=word(0x20fba08);player=word(root+4);scene=0x2500000
boundaries=[0x207e750,0x207d068,0x210cee8,0x210cfd8]
def hook(_,at,size,user):
 if at in boundaries:
  u.reg_write(UC_ARM_REG_R0,0);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
def call(at):
 u.reg_write(UC_ARM_REG_R0,scene);u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,0x27f0000)
 u.emu_start(at,0x27f0000,count=100000)
 assert u.reg_read(UC_ARM_REG_PC)==0x27f0000,hex(u.reg_read(UC_ARM_REG_PC))
rules=[dict(rank=i,tier=word(0x20e1e1c+i*36),wins=word(0x20e1e18+i*36)) for i in range(10)]
# Resolve the actual literal addresses rather than guessing table offsets.
tier_address=word(0x210d478);wins_address=word(0x210d480)
rules=[dict(rank=i,tier=word(tier_address+i*36)-1,wins=word(wins_address+i*36)) for i in range(10)]
rng=random.Random(20260909);vectors=[]
for rank in range(10):
 for category in range(6):
  for variant in range(10):
   won=[i for i in range(61) if variant==0 or (variant>1 and rng.randrange(3)==0)]
   registered=[i for i in range(61) if rng.randrange(3)==0]
   stage=rng.randrange(4);entry=rng.randrange(2);world=rng.randrange(2)
   match=(variant%3 if category==0 else (61 if variant==9 else rng.randrange(61)))
   rounds=[1,1] if variant%4 else [1,0]
   inp=dict(rank=rank,category=category,matchIndex=match,won=won,registered=registered,
     championship=dict(stage=stage,entry=entry,worldEntry=world),rounds=rounds)
   u.mem_write(scene,bytes(0x4000));u.mem_write(0x27de000,bytes(0x4000))
   put(player+0xae8,rank,2);put(player+0x4ec,0,2)
   for i in range(62):put(player+0xbc+i*8,int(i in registered));put(player+0xc0+i*8,int(i in won))
   for offset,n in [(0x4cc,stage),(0x4d0,entry),(0x4d4,world)]:put(player+offset,n)
   for offset,n in [(0xc98,category),(0xca0,match),(0xca4,len(rounds)),(0xeb8,0),(0xf38,-1),(0xc94,100)]:put(root+offset,n)
   for i,n in enumerate(rounds):put(root+0xcac+i*4,n)
   call(0x210d0c8)
   new_rank=word(scene+0x804)
   call(0x210e328)
   output=dict(rank=int.from_bytes(u.mem_read(player+0xae8,2),'little'),
     registered=[i for i in range(61) if word(player+0xbc+i*8)],won=[i for i in range(61) if word(player+0xc0+i*8)],
     championship=dict(stage=word(player+0x4cc),entry=word(player+0x4d0),worldEntry=word(player+0x4d4)),
     feeWaiver=bool(word(root+0xeb8)),rankNotice=word(root+0xf38),championshipNotice=word(scene+0x808))
   if output['rankNotice']==0xffffffff:output['rankNotice']=None
   vectors.append(dict(input=inp,output=output))
receipt=dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,
 scope='OVL8 0210D0C8 result preparation and 0210E328 rank commit',boundaries=[hex(n) for n in boundaries],
 rankRuleAddresses=dict(tier=hex(tier_address),wins=hex(wins_address)),rankRules=rules,vectors=vectors)
Path(a.out).write_text(json.dumps(receipt,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(vectors=len(vectors),rankRules=rules)))
