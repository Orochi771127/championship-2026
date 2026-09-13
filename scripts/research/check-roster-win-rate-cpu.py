"""ARM9 02088480 win-rate argument replay, including original soft-float code.
Only text lookup/copy, rendering and the final formatter are stubbed. The DS
integer divider is emulated. No original program bytes are written to output.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE,UC_HOOK_MEM_READ
from unicorn.arm_const import *
p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);a=p.parse_args()
raw=Path(a.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_map(0x4000000,0x1000)
u.mem_write(0x2000000,bytes(decompress(NintendoDSRom(raw).arm9)))
reg=lambda n:u.reg_read(n)
word=lambda at:int.from_bytes(u.mem_read(at,4),'little')
def put(at,v,n=4):u.mem_write(at,(v&((1<<(n*8))-1)).to_bytes(n,'little'))
def finish(v=0):u.reg_write(UC_ARM_REG_R0,v);u.reg_write(UC_ARM_REG_PC,reg(UC_ARM_REG_LR))
def hardware(_,access,at,size,value,user):
 if 0x40002a0<=at<0x40002b0:
  mode=word(0x4000280)&3
  n=int.from_bytes(u.mem_read(0x4000290,4 if mode==0 else 8),'little',signed=True)
  d=int.from_bytes(u.mem_read(0x4000298,8 if mode==2 else 4),'little',signed=True)
  assert d
  q=(abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1)
  put(0x40002a0,q,8);put(0x40002a8,n-q*d,8)
view,record,stop,sp=0x2600000,0x2604000,0x27f0000,0x27ef000
observed={}
def hook(_,at,size,user):
 if at==0x2024184:
  if reg(UC_ARM_REG_R0)==view+0x1604:
   observed['percent']=struct.unpack('<d',struct.pack('<II',reg(UC_ARM_REG_R3),word(reg(UC_ARM_REG_SP))))[0]
   fmt=reg(UC_ARM_REG_R2);buf=bytearray()
   while bytes(u.mem_read(fmt+len(buf),2))!=b'\0\0':buf.extend(u.mem_read(fmt+len(buf),2))
   observed['format']=buf.decode('utf-16-le')
  finish();return
 if at==0x207d234:finish(reg(UC_ARM_REG_R1));return
 if at in [0x20242c4,0x207f7c4,0x207ee40,0x207ef1c,0x2088830,0x208890c,0x2088bcc]:finish();return
u.hook_add(UC_HOOK_CODE,hook);u.hook_add(UC_HOOK_MEM_READ,hardware,begin=0x4000280,end=0x40002bf)
cases=[]
for battles in [0,1,2,3,7,10,19,61,100,999,9999,65535]:
 for wins in sorted({0,battles//3,battles//2,max(0,battles-1),battles}):
  u.mem_write(view,bytes(0x1800));u.mem_write(record,bytes(0x200));put(record,34);put(record+0x24,battles);put(record+0x28,wins)
  observed.clear();u.reg_write(UC_ARM_REG_R0,view);u.reg_write(UC_ARM_REG_R1,record);u.reg_write(UC_ARM_REG_SP,sp);u.reg_write(UC_ARM_REG_LR,stop)
  u.emu_start(0x2088480,stop,count=100000);assert reg(UC_ARM_REG_PC)==stop
  cases.append(dict(battles=battles,wins=wins,**observed))
Path(a.out).write_text(json.dumps(dict(romSha256=sha,function='ARM9 02088480',evidence='BOUNDED_ORIGINAL_CPU_FLOAT_ARGUMENT_REPLAY',
 seams=['synthetic individual/view','emulated DS integer divider','text and render stubs','final formatting excluded'],cases=cases),indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(cases=len(cases),formats=sorted({v['format'] for v in cases}),samples=cases[:8])))
