"""Replay the original Link Battle result boundary and record packet/arena sites."""
import argparse, json
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import *
from hunt_original_probe import load_rom, ROM_SHA

ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);args=ap.parse_args()
rom,arm,_=load_rom();u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x02000000,0x800000);u.mem_write(0x02000000,arm)
def put(p,n,size=4):u.mem_write(p,(n&((1<<(size*8))-1)).to_bytes(size,'little'))
def word(p):return int.from_bytes(u.mem_read(p,4),'little',signed=True)
def overlay(index):
 o=rom.loadArm9Overlays([index])[index];u.mem_write(o.ramAddress,bytes(o.data))

root,individual,battle=0x02500000,0x02502000,0x02504000
put(0x020fba08,root);put(root+0xc98,3);overlay(19)
results=[]
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
   results.append(dict(input=dict(mode=3,verdict=verdict,teamIndex=team,fields=fields),output=dict(
    fields={key:word(individual+int(key,16)) for key in fields},
    narrowFields={'044':u.mem_read(individual+0x44,1)[0],'046':int.from_bytes(u.mem_read(individual+0x46,2),'little')})))

report=dict(classification='BOUNDED_NATIVE_REPLAY',runtimeEligible=False,romSha256=ROM_SHA,
 sites={'teamPacketSend':'OVL9 02177038..0217713C, 0x44 bytes','individualPacketSend':'OVL9 021771E4..0217741C, 0x1C8 bytes',
  'arenaHostDraw':'OVL9 02175DC4..02175E14, candidates 0,1,2,3,4,5,7','arenaExchange':'OVL9 02175E18..02175EDC, 4 bytes',
  'fixedBattleSeed':'OVL9 021775D8..021775E0, master seed 0x14','result':'OVL19 0210E5AC..0210E798',
  'globalRecordExclusion':'OVL19 0210E21C..0210E27C'},
 scope='Mode 3 controlled result writer plus directly disassembled OVL9 packet, arena and seed boundaries; transport hardware is not emulated.',
 packet=dict(teamBytes=0x44,individualBytes=0x1c8,maxMembers=3),arenas=[0,1,2,3,4,5,7],battleMasterSeed=0x14,
 globalProgress='EXCLUDED',results=results,
 boundaries=['Wireless discovery, Nintendo WFC, friend-list UI and packet transport are outside this CPU replay.',
  'Packet sizes and exchange order are instruction evidence; this report exports no original packet payload or ROM bytes.'])
Path(args.out).write_text(json.dumps(report,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(resultVectors=len(results),changed=sum(r['input']['fields']!=r['output']['fields'] for r in results))))
