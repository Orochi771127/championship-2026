"""Replay the original Free Battle pool generator and export functional records."""
import argparse,hashlib,json,random,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0,UC_ARM_REG_SP,UC_ARM_REG_LR,UC_ARM_REG_PC
ap=argparse.ArgumentParser();ap.add_argument('--rom',required=True);ap.add_argument('--out',required=True);ap.add_argument('--catalog',required=True)
a=ap.parse_args();raw=Path(a.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
rom=NintendoDSRom(raw);u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_map(0x1ff8000,0x8000)
for s in rom.loadArm9().sections:u.mem_write(s.ramAddress,bytes(s.data))
def word(p):return int.from_bytes(u.mem_read(p,4),'little')
def byte(p):return u.mem_read(p,1)[0]
pools=[];indices=set()
for tier in range(10):
 row=[]
 for season in range(5):
  descriptor=word(0x20c8904+tier*20+season*4);n=byte(descriptor);ptr=word(descriptor+4)
  ids=[word(ptr+i*4) for i in range(n)];indices.update(ids);row.append(ids)
 pools.append(row)
assert min(indices)==456 and max(indices)==575 and len(indices)==120
presets=[]
for i in sorted(indices):
 p=0x20e39d8+i*68
 r={'recordIndex':i,**{f'field{o:02X}':word(p+o) for o in [0,4,16,20,24,28,32,36,40,44,48,52,56]},
    'field0C':int.from_bytes(u.mem_read(p+12,2),'little'),
    **{f'field{o:02X}':byte(p+o) for o in range(60,68)}}
 assert r['field00']<228
 presets.append(r)
draws=[];season=0;rng=random.Random(0)
def hook(_u,pc,size,data):
 if pc==0x20431d4:
  channel=u.reg_read(UC_ARM_REG_R0);assert channel==0
  value=rng.randrange(0x8000);draws.append(value);u.reg_write(UC_ARM_REG_R0,value);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
 elif pc==0x207bc9c:
  u.reg_write(UC_ARM_REG_R0,season);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook);vectors=[];root=0x02300000
for season in range(4):
 for seed in range(12):
  rng=random.Random(seed);draws.clear();u.mem_write(root,bytes(0x180));u.reg_write(UC_ARM_REG_R0,root)
  u.reg_write(UC_ARM_REG_SP,0x027e0000);u.reg_write(UC_ARM_REG_LR,0x027f0000)
  u.emu_start(0x2068c04,0x027f0000,count=1000000)
  assert u.reg_read(UC_ARM_REG_PC)==0x027f0000
  singles=[456+byte(root+0x12d+i) for i in range(byte(root+0x12c))]
  teams=[[456+byte(root+0x138+i*3+j) for j in range(3)] for i in range(byte(root+0x137))]
  assert 5<=len(singles)<=9 and len(set(singles))==len(singles) and 5<=len(teams)<=9
  vectors.append({'season':season,'seed':seed,'randomValues':list(draws),'singles':singles,'teams':teams})
callers=[]
for bank,sections in [('ARM9',[(s.ramAddress,bytes(s.data)) for s in rom.loadArm9().sections])]+[(f'OVL{i}',[(o.ramAddress,bytes(o.data))]) for i,o in rom.loadArm9Overlays().items()]:
 for base,data in sections:
  for off in range(0,len(data)-3,4):
   w=struct.unpack_from('<I',data,off)[0]
   if w&0x0f000000!=0x0b000000:continue
   delta=(w&0xffffff)*4
   if delta&0x2000000:delta-=0x4000000
   if base+off+8+delta==0x2068c04:callers.append(f'{bank}:{base+off:08X}')
report={'classification':'BOUNDED_NATIVE_REPLAY','romSha256':sha,'generator':'ARM9:02068C04',
 'generatorCallers':callers,'singleFilter':'02069070','teamFilter':'020690FC',
 'freeMenuReads':'OVL10:0210EA8C..0210EBF8','payoutSum':'ARM9:02088EC8','vectors':vectors,
 'boundaries':['Original generator, candidate filters and sort execute; RNG and season query are intercepted.',
 'Does not replay the complete menu or saving lifecycle. Functional preset fields only; names and executable bytes excluded.']}
catalog={'version':1,'evidence':'BOUNDED_NATIVE_REPLAY','presetStart':456,'pools':pools,'presets':presets}
for file,obj in [(a.out,report),(a.catalog,catalog)]:Path(file).write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'presets':len(presets),'vectors':len(vectors),'callers':callers}))
