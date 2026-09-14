"""Replay all title conditions and the original arena branch; no binary export."""
import argparse, json
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *
from hunt_original_probe import load_rom, ROM_SHA

ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);args=ap.parse_args()
rom,arm,_=load_rom();o=rom.loadArm9Overlays([10])[10]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x02000000,0x800000);u.mem_write(0x02000000,arm);u.mem_write(o.ramAddress,bytes(o.data))
def put(p,n):u.mem_write(p,(n&0xffffffff).to_bytes(4,'little'))
def word(p):return int.from_bytes(u.mem_read(p,4),'little',signed=True)
root,view,sp=0x02500000,0x02510000,0x027e0000
put(0x020fba08,root)
draws=[];value=0
def hook(uc,pc,size,_):
 if pc==0x020431d4:
  draws.append(uc.reg_read(UC_ARM_REG_R0));uc.reg_write(UC_ARM_REG_R0,value);uc.reg_write(UC_ARM_REG_PC,uc.reg_read(UC_ARM_REG_LR))
 elif pc in [0x0207f7c4,0x0207ee40]:
  uc.reg_write(UC_ARM_REG_R0,0);uc.reg_write(UC_ARM_REG_PC,uc.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
def call(pc,stop=0x027f0000):
 u.reg_write(UC_ARM_REG_SP,sp);u.reg_write(UC_ARM_REG_LR,stop);u.emu_start(pc,stop,count=30000);assert u.reg_read(UC_ARM_REG_PC)==stop
vectors=[]
for title in range(62):
 condition=word(0x020cd010+title*0x28)
 u.reg_write(UC_ARM_REG_R0,view+0xd4e8);u.reg_write(UC_ARM_REG_R1,condition&0xffffffff);call(0x02092380)
 # Replay the caller's -1 -> arena 9 override too, not a guessed replacement.
 u.reg_write(UC_ARM_REG_R5,view);u.reg_write(UC_ARM_REG_R1,0x28);u.reg_write(UC_ARM_REG_R3,title*0x28);call(0x02112680,0x0211269c)
 field=word(view+0xd4f8)
 for value in [0,1,2,3,4,5,6,7,17,0x7fffffff]:
  draws=[];put(root+0xca0,title);put(root+0xc9c,-99);u.reg_write(UC_ARM_REG_R9,view)
  call(0x02112e50,0x02112f58)
  vectors.append(dict(title=title,condition=condition,conditionArena=field,random=value,channels=draws,arena=word(root+0xc9c)))
Path(args.out).write_text(json.dumps(dict(classification='BOUNDED_NATIVE_REPLAY',runtimeEligible=False,romSha256=ROM_SHA,
 sites=['ARM9 02092380','OVL10 02112680..0211269C','OVL10 02112E50..02112F58'],
 scope='All 62 native title records, real condition decoding, caller override and arena branch. Only two UI helper calls and the RNG input are intercepted.',vectors=vectors),separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps(dict(vectors=len(vectors),fields=sorted(set(v['arena'] for v in vectors)))))
