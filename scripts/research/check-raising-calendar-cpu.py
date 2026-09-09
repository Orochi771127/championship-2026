"""Execute OVL1's calendar projection; graphics calls are explicit boundaries.

Private ROM/RAM are inputs only. The receipt contains controlled values and
numeric outputs, not program bytes or images. Player +BC is registration; +C0
is a won title. The championship flags are inputs, not inferred story progress.
"""
import argparse, hashlib, json, random, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

ap=argparse.ArgumentParser()
for name in ['rom','ram','out']:ap.add_argument('--'+name,required=True)
a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
ov=NintendoDSRom(raw).loadArm9Overlays()[1]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
u.mem_write(0x2000000,ram);u.mem_write(ov.ramAddress,bytes(ov.data))
word=lambda at:int.from_bytes(u.mem_read(at,4),'little')
def put(at,n,size=4):u.mem_write(at,(n&((1<<(8*size))-1)).to_bytes(size,'little'))
def finish(n=0):u.reg_write(UC_ARM_REG_R0,n);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
root=word(0x20fba08);player=word(root+4)
params={};output={}
boundaries=[0x207f348,0x207f51c,0x207f6dc,0x207f7c4,0x207ef28,0x207ee40,0x207ef1c,
  0x204bdf0,0x204bdf8,0x204c1e8,0x204c8a0,0x204c264,0x204c86c,0x204a5a4]
def hook(_,at,size,user):
 if at in boundaries:finish(0x2560000)
 elif at==0x207bc9c:finish(params['season'])
 elif at==0x207bccc:finish(params['dayOfSeason'])
 elif at==0x210b9c8:
  n=u.reg_read(UC_ARM_REG_R4);output['countdown']=n if n<0x80000000 else n-0x100000000
 elif at==0x210bcd0:
  sp=u.reg_read(UC_ARM_REG_SP)
  output['days']=[dict(day=i,registered=word(sp+8+i*8),unwon=word(sp+12+i*8)) for i in range(8)]
  u.emu_stop()
u.hook_add(UC_HOOK_CODE,hook)
rng=random.Random(20260909);vectors=[]
for year in [0,1,2,3,4,7,98,99]:
 for season in range(4):
  for day in range(8):
   for stage in range(4):
    flags=dict(stage=stage,entry=rng.randrange(2),worldEntry=rng.randrange(2))
    registered=[i for i in range(61) if rng.randrange(4)==0]
    won=[i for i in range(61) if rng.randrange(4)==0]
    rank=rng.randrange(10)
    params=dict(year=year,season=season,dayOfSeason=day,progressCounter=rank,
      registered=registered,won=won,championship=flags)
    u.mem_write(0x2500000,bytes(0x80000));u.mem_write(0x27de000,bytes(0x4000))
    put(root+8,year);put(player+0xae8,rank,2)
    for i in range(62):put(player+0xbc+i*8,int(i in registered));put(player+0xc0+i*8,int(i in won))
    for offset,key in [(0x4cc,'stage'),(0x4d0,'entry'),(0x4d4,'worldEntry')]:put(player+offset,flags[key])
    output={'countdown':None}
    u.reg_write(UC_ARM_REG_R0,0x2500000);u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,0x27f0000)
    try:u.emu_start(0x210b7ec,0x27f0000,count=100000)
    except Exception:
     print('CPU boundary',hex(u.reg_read(UC_ARM_REG_PC)),params);raise
    assert u.reg_read(UC_ARM_REG_PC)==0x210bcd0,hex(u.reg_read(UC_ARM_REG_PC))
    vectors.append(dict(input=params,output=output))
receipt=dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,scope='OVL1 0210B7EC through 0210BCCC numeric calendar projection',
 boundaries=[hex(n) for n in boundaries]+['clock accessors return controlled season/day'],
 exclusions=['Graphics, native layout, input handling, story writers and match registration UI are not executed by this oracle.'],vectors=vectors)
Path(a.out).write_text(json.dumps(receipt,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(vectors=len(vectors),out=a.out)))
