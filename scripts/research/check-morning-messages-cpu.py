"""Execute original OVL18 morning selection and actual four-slot enqueue.
Graphics/RTC readiness and roster lookup are explicit controlled boundaries.
"""
import argparse,hashlib,json,random,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm_const import *
ap=argparse.ArgumentParser()
for n in ['rom','ram','out','catalog']:ap.add_argument('--'+n,required=True)
a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
ov=NintendoDSRom(raw).loadArm9Overlays()[18]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
u.mem_write(0x2000000,ram);u.mem_write(ov.ramAddress,bytes(ov.data))
w=lambda at:int.from_bytes(u.mem_read(at,4),'little')
def put(at,n,size=4):u.mem_write(at,(n&((1<<(size*8))-1)).to_bytes(size,'little'))
root=w(0x20fba08);player=w(root+4);scene=0x2500000;widget=0x2560000
params={};draws=[];selected=None
def ret(n=0):u.reg_write(UC_ARM_REG_R0,n);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
def hook(_,at,size,user):
 global selected
 if at==0x2043860:ret(0)
 elif at==0x207b9d0:ret(1)
 elif at==0x207bc9c:ret(params['season'])
 elif at==0x207bccc:ret(params['dayOfSeason'])
 elif at==0x207bd58:ret(params['year'])
 elif at==0x20431d4:
  channel=u.reg_read(UC_ARM_REG_R0);draws.append(channel);ret(params['random'][str(channel)])
 elif at==0x206206c:ret(params['rosterCount'])
 elif at==0x2062074:ret()
 elif at==0x20620e0:
  selected=u.reg_read(UC_ARM_REG_R1);ret(0x2570000)
 elif at==0x207e67c:ret()
u.hook_add(UC_HOOK_CODE,hook)
rng=random.Random(909);vectors=[]
for year in [0,1,3,4,99]:
 for season in range(4):
  for variant in range(60):
   params=dict(year=year,season=season,dayOfSeason=variant%8,cursor=variant+10 if variant%2 else variant,
      birthday=bool(variant%2),birthdayClaimed=bool(variant%3==0),rosterCount=variant%17,
      random={str(c):rng.randrange(102) for c in [210,213,214,215]})
   if variant%3==0:params['random']['213']=0
   u.mem_write(scene,bytes(0x10000));u.mem_write(widget,bytes(0x2000))
   put(root+0xa8,6);put(root+0xec0,int(params['birthdayClaimed']));put(scene+0xb2c,int(params['birthday']))
   put(player+0xaec,params['cursor'],1);put(w(0x2126234),widget)
   put(widget+0x43c,widget+0x1000);put(widget+0x440,widget+0x1010)
   draws=[];selected=None
   u.reg_write(UC_ARM_REG_R0,scene);u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,0x27f0000)
   u.emu_start(0x210ead8,0x27f0000,count=20000)
   assert u.reg_read(UC_ARM_REG_PC)==0x27f0000,hex(u.reg_read(UC_ARM_REG_PC))
   queue=[list(struct.unpack('<7i',u.mem_read(widget+0x1010+i*28,28))) for i in range(w(widget+0x1000))]
   vectors.append(dict(input=params,output=dict(cursor=u.mem_read(player+0xaec,1)[0],draws=draws,selected=selected,queue=queue)))
notes=[dict(id=i,sender=r[0],textId=r[1],required=bool(r[2]),minutes=r[3],effectId=r[4])
 for i in range(200) for r in [struct.unpack('<6i',u.mem_read(0x20eff94+i*24,24))]]
effects=[dict(id=i,kind=r[0],confirmation=bool(r[1]),choice=r[2],textId=r[3],value=r[4],extra=r[5])
 for i in range(86) for r in [struct.unpack('<7i',u.mem_read(0x20f126c+i*28,28))]]
receipt=dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,
 scope='OVL18 0210EAD8 / 021261CC..021263D8 and ARM9 0208BFD4 four-slot append',
 exclusions=['RTC/firmware birthday predicate supplied as a controlled boolean','roster lookup supplied; selected index and RNG calls recorded','UI and gift application tested separately'],vectors=vectors)
Path(a.out).write_text(json.dumps(receipt,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
Path(a.catalog).write_text(json.dumps(dict(version=1,notes=notes,effects=effects),separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(vectors=len(vectors),notes=len(notes),effects=len(effects))))
