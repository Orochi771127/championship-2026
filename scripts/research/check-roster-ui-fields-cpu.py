"""Bounded original UI argument replay. Formatting/rendering callbacks are stubs.
No screen pixels or original code are exported; this does not validate UI layout.
Win-rate floating-point conversion and text translation remain outside this probe.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm_const import *
ap=argparse.ArgumentParser();ap.add_argument('--rom',required=True);ap.add_argument('--out',required=True)
args=ap.parse_args();raw=Path(args.rom).read_bytes()
sha=hashlib.sha256(raw).hexdigest();assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
arm=bytes(decompress(NintendoDSRom(raw).arm9))
vectors=json.loads(Path('docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json').read_text())['individualVectors']
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_write(0x2000000,arm)
view,record,stop,sp=0x2600000,0x2604000,0x27f0000,0x27ef000
reg=lambda n:u.reg_read(n)
word=lambda at:int.from_bytes(u.mem_read(at,4),'little')
def put(at,value,size=4):u.mem_write(at,(value&((1<<(size*8))-1)).to_bytes(size,'little'))
def finish(value=0):u.reg_write(UC_ARM_REG_R0,value&0xffffffff);u.reg_write(UC_ARM_REG_PC,reg(UC_ARM_REG_LR))
formatted={}
def hook(_,at,size,user):
 if at==0x2024184:
  node=(reg(UC_ARM_REG_R0)-view-0x1384)//0x40
  formatted[node]=[reg(UC_ARM_REG_R3),word(reg(UC_ARM_REG_SP))]
  finish();return
 if at==0x2002738:
  # Controlled Q12 divider adapter; win-rate arithmetic is not this probe's claim.
  finish((reg(UC_ARM_REG_R0)<<12)//reg(UC_ARM_REG_R1));return
 if at==0x207d234:finish(reg(UC_ARM_REG_R1));return
 if at in [0x20242c4,0x202ae3c,0x202a98c,0x202ad44,0x207f7c4,0x207ee40,0x207ef1c,0x2088830,0x208890c,0x2088bcc]:finish();return
u.hook_add(UC_HOOK_CODE,hook)
cases=[]
for v in vectors:
 p=v['after'];u.mem_write(view,bytes(0x1800));u.mem_write(record,bytes(0x200))
 for k,value in p['fields'].items():put(record+int(k,16),value)
 for k,value in p['narrowFields'].items():put(record+int(k,16),value,2 if k in ['046','194'] else 1)
 # Deliberately distinct nonzero count tests the counter read and denominator branch.
 put(record+0x24,18);put(record+0x28,7)
 formatted.clear();u.reg_write(UC_ARM_REG_SP,sp);u.reg_write(UC_ARM_REG_LR,stop)
 u.reg_write(UC_ARM_REG_R0,view);u.reg_write(UC_ARM_REG_R1,record)
 u.emu_start(0x2088480,stop,count=10000);assert reg(UC_ARM_REG_PC)==stop
 actual={key:formatted[node][0] for key,node in [('currentHp',0),('currentTp',1),('capacityG',2),('attack',3),('defense',4),('wisdom',5),('speed',6),('battleCount',9),('rebirthCount',14)]}
 actual.update(maxHp=formatted[0][1],maxTp=formatted[1][1])
 actual['rebirthCount']=struct.unpack('<i',struct.pack('<I',actual['rebirthCount']))[0]
 cases.append({'speciesIndex':v['speciesIndex'],'battleCountOverride':18,'actual':actual})
Path(args.out).write_text(json.dumps({'romSha256':sha,'function':'02088480','evidence':'BOUNDED_ORIGINAL_CPU_UI_ARGUMENT_REPLAY','seams':['synthetic screen and individual buffers','formatting, text and rendering stubs','Q12 divider adapter; win rate excluded'],'cases':cases},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'cases':len(cases),'fieldsPerCase':len(cases[0]['actual'])}))
