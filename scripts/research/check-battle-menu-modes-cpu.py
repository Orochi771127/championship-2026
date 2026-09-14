"""Replay OVL10 menu selection and text/resource dispatch; no ROM payload export."""
import argparse, hashlib, importlib.util, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R4, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

ap=argparse.ArgumentParser();ap.add_argument('--rom',required=True);ap.add_argument('--out',required=True)
args=ap.parse_args();raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
rom=NintendoDSRom(raw);u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x02000000,0x800000);u.mem_map(0x01ff8000,0x8000)
for section in rom.loadArm9().sections:u.mem_write(section.ramAddress,bytes(section.data))
ov=rom.loadArm9Overlays()[10];u.mem_write(ov.ramAddress,bytes(ov.data))
def put(p,n):u.mem_write(p,struct.pack('<I',n))
def word(p):return int.from_bytes(u.mem_read(p,4),'little')
root,screen=0x02300000,0x02400000;put(0x020fba08,root)
calls=[]
helpers={0x0204eb7c,0x020479a4,0x02052a74,0x0207d234,0x0205310c,0x02053280}
def hook(_u,pc,size,data):
 if pc in helpers:
  calls.append({'site':f'{pc:08X}','args':[u.reg_read(r) for r in [UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2]]})
  u.reg_write(UC_ARM_REG_R0,0);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
rows=[]
for selection,mode in enumerate([1,0,4,3,2,5]):
 calls.clear();put(screen+0x20,selection);put(root+0xc98,0xffffffff)
 u.reg_write(UC_ARM_REG_R4,screen);u.reg_write(UC_ARM_REG_SP,0x027e0000)
 u.emu_start(0x02111318,0x021113e4,count=1000)
 assert u.reg_read(UC_ARM_REG_PC)==0x021113e4 and word(root+0xc98)==mode
 text=[c for c in calls if c['site']=='0207D234'];assert len(text)==1 and text[0]['args'][1]==mode+0x29b
 sequence=[c for c in calls if c['site']=='020479A4'];assert len(sequence)==1
 rows.append({'localSelection':selection,'sessionMode':mode,'helpTextId':text[0]['args'][1],
              'bannerGroup':sequence[0]['args'][1],'bannerSequence':sequence[0]['args'][2]})
# Read the original help bank to independently resolve the meaning, not the product labels.
spec=importlib.util.spec_from_file_location('text_bank',Path(__file__).parents[1]/'build-tutorial-steps.py')
bank=importlib.util.module_from_spec(spec);spec.loader.exec_module(bank);_,chunks=bank.read_bank(rom)
needles=['とくべつなたいかい','タイトルマッチ','たいせんあいて','ツウシン','パスワード','2チーム']
for mode,needle in enumerate(needles):assert needle in bank.decode(chunks[0x29b+mode])
report={'classification':'BOUNDED_NATIVE_REPLAY','romSha256':sha,
 'sites':{'menuSelection':'OVL10:02111318..021113E0','helpDispatch':'OVL10:0210F7A8..0210F8CC',
          'nativeHelpBank':'ui/txt/txt_list_txt.dat','defaultPartyCondition':'ARM9:02092204',
          'championshipArena':'OVL10:0211110C','freeArenaDraw':'OVL10:02111144..02111190'},
 'modes':[{'id':name,'sessionMode':i,'helpTextId':0x29b+i} for i,name in enumerate(
   ['CHAMPIONSHIP','TITLE_MATCH','FREE_BATTLE','LINK_BATTLE','PASSWORD_BATTLE','PRACTICE_BATTLE'])],
 'vectors':rows,'boundaries':['Runs the original selection and helper dispatch instructions with synthetic screen/session RAM.',
 'Six UI renderer/text calls intercepted at documented helper addresses; does not execute the renderer or input device.',
 'Help bank IDs checked against original Japanese wording; original strings and ROM bytes are not exported.',
 'Communication transport, password codec and every subsequent screen require separate verification.']}
Path(args.out).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'modeVectors':len(rows),'modeValues':[r['sessionMode'] for r in rows]}))
