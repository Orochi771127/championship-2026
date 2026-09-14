"""Original two-owned-team ready gate and individual result writer; no ROM export."""
import argparse, json, struct
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import *
from hunt_original_probe import load_rom, ROM_SHA

ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);args=ap.parse_args()
rom,arm,_=load_rom();u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x02000000,0x800000)
u.mem_write(0x02000000,arm)
def put(p,n,size=4):u.mem_write(p,(n&((1<<(size*8))-1)).to_bytes(size,'little'))
def word(p):return int.from_bytes(u.mem_read(p,4),'little',signed=True)
def overlay(index):
 o=rom.loadArm9Overlays([index])[index];u.mem_write(o.ramAddress,bytes(o.data))
def call(pc,args=[]):
 for r,n in zip([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2],args):u.reg_write(r,n)
 u.reg_write(UC_ARM_REG_SP,0x027e0000);u.reg_write(UC_ARM_REG_LR,0x027f0000)
 u.emu_start(pc,0x027f0000,count=10000);assert u.reg_read(UC_ARM_REG_PC)==0x027f0000
 return u.reg_read(UC_ARM_REG_R0)
root,individual,battle=0x02500000,0x02502000,0x02504000
put(0x020fba08,root);put(root+0xc98,5);overlay(10)
ready=[]
for left in range(4):
 for right in range(4):
  for team,count in enumerate([left,right]):
   for slot in range(3):put(root+0x158+team*0x44+0x14+slot*4,individual if slot<count else 0)
  result=call(0x0210fff0);assert bool(result)==(left>0 and right>0)
  ready.append(dict(counts=[left,right],ready=bool(result)))
overlay(19);results=[]
for team in [0,1]:
 for verdict in [3,4,5]:
  for variant in range(12):
   fields={'014':7,'024':[0,998,999,1000][variant%4],'028':[0,998,999,1000][variant%4],
    '050':[-12,0,1,45][variant%4],'054':variant,'058':101+variant,'05c':99+variant,'040':variant*9,'020':variant*9}
   u.mem_write(individual,bytes(0x1c8))
   for key,n in fields.items():put(individual+int(key,16),n)
   put(individual+0x44,4,1);put(individual+0x46,22,2)
   put(root+0xca0,-1);put(root+0xca4,1);put(root+0xca8,1)
   put(battle+0xea4,verdict);put(0x0210b2dc,0)
   for r,n in [(UC_ARM_REG_R0,individual),(UC_ARM_REG_R4,battle),(UC_ARM_REG_R5,0x0210b2dc),
    (UC_ARM_REG_R8,team),(UC_ARM_REG_R10,0x020fba08),(UC_ARM_REG_R11,999)]:u.reg_write(r,n)
   u.emu_start(0x0210e5ac,0x0210e798,count=1000);assert u.reg_read(UC_ARM_REG_PC)==0x0210e798
   results.append(dict(input=dict(mode=5,verdict=verdict,teamIndex=team,fields=fields),output=dict(
    fields={key:word(individual+int(key,16)) for key in fields},narrowFields={'044':u.mem_read(individual+0x44,1)[0],'046':int.from_bytes(u.mem_read(individual+0x46,2),'little')})))
report=dict(classification='BOUNDED_NATIVE_REPLAY',runtimeEligible=False,romSha256=ROM_SHA,
 sites={'ready':'OVL10 0210FFF0..0211007C','teamLoop':'OVL19 0210E544..0210E7B4','result':'OVL19 0210E5AC..0210E798'},
 scope='Type 0, mode 5, controlled caller registers for both owned teams; includes original draw handling; no renderer/input/transport acceptance',ready=ready,results=results)
Path(args.out).write_text(json.dumps(report,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(readyVectors=len(ready),resultVectors=len(results))))
