"""OVL4 numeric UI replay, original divider instructions + emulated DS divider.
Synthetic player memory and no-op digit rendering; no gameplay writer or pixel QA.
Zero battle denominator is intentionally outside this receipt.
"""
import argparse,hashlib,json
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE,UC_HOOK_MEM_READ
from unicorn.arm_const import *
ap=argparse.ArgumentParser();ap.add_argument('--rom',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
raw=Path(a.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest();assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
r=NintendoDSRom(raw);ov=r.loadArm9Overlays()[4]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_map(0x4000000,0x1000)
u.mem_write(0x2000000,bytes(decompress(r.arm9)));u.mem_write(ov.ramAddress,bytes(ov.data))
get=lambda at,n=4:int.from_bytes(u.mem_read(at,n),'little')
def put(at,v,n=4):u.mem_write(at,(v&((1<<(n*8))-1)).to_bytes(n,'little'))
def hardware(_,access,at,size,value,user):
 if 0x40002a0<=at<0x40002b0:
  mode=get(0x4000280,2)&3
  n=int.from_bytes(u.mem_read(0x4000290,4 if mode==0 else 8),'little',signed=True)
  d=int.from_bytes(u.mem_read(0x4000298,8 if mode==2 else 4),'little',signed=True)
  assert d
  q=(abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1)
  put(0x40002a0,q,8);put(0x40002a8,n-q*d,8)
draws=[]
def hook(_,at,size,user):
 if at==0x207f958:
  draws.append(u.reg_read(UC_ARM_REG_R1));u.reg_write(UC_ARM_REG_R0,0);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook);u.hook_add(UC_HOOK_MEM_READ,hardware,begin=0x4000280,end=0x40002bf)
player,holder,view=0x2600000,0x2602000,0x2603000
put(get(0x210c070),holder);put(holder+4,player)
cases=[]
for rank in range(10):
 for title,book,maps,battles,wins in [(0,0,0,1,0),(1,1,1,3,2),(30,107,8,2,1),(61,216,17,9999,2499)]:
  u.mem_write(player,bytes(0x1000));put(player+0x4c8,1234567);put(player+0xae8,rank,2);put(player+0xaea,121,2)
  put(player+0x4d8,battles,2);put(player+0x4da,wins,2)
  for i in range(title):put(player+0xc0+i*8,1)
  for i in range(book):put(player+0x4ee+i,1,1)
  for i in range(maps):put(player+0x2ac+i*4,1)
  draws.clear();u.reg_write(UC_ARM_REG_R0,view);u.reg_write(UC_ARM_REG_SP,0x27ef000);u.reg_write(UC_ARM_REG_LR,0x27f0000)
  u.emu_start(0x210bb9c,0x210be80,count=60000);assert u.reg_read(UC_ARM_REG_PC)==0x210be80
  assert len(draws)==10
  cases.append(dict(rank=rank,titleCount=title,registeredCount=book,mapCount=maps,record=dict(battles=battles,wins=wins),
    actual=dict(zip(['money','hours','minutes','have','cage','title','guid','map','battle','win'],draws))))
Path(a.out).write_text(json.dumps(dict(romSha256=sha,function='OVL4 0210BB9C',evidence='BOUNDED_ORIGINAL_CPU_UI_ARGUMENT_REPLAY',
  seams=['synthetic player buffers','digit-renderer stub','emulated DS integer divider; original ARM9 arithmetic'],cases=cases),indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(cases=len(cases),numericFields=10)))
