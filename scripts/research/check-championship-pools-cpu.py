"""Execute the original BSS initializer; verify every tournament draw prefix.

No ROM bytes are copied to runtime. The product catalog contains references to
the existing team catalog. BSS location is not evidence of absent source data.
"""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

ap=argparse.ArgumentParser();ap.add_argument('--rom',required=True);ap.add_argument('--out',required=True);ap.add_argument('--catalog-out',required=True)
args=ap.parse_args();raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
rom=NintendoDSRom(raw);arm=rom.loadArm9();ov=rom.loadArm9Overlays()[10]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000);u.mem_map(0x1ff8000,0x8000)
for section in arm.sections:u.mem_write(section.ramAddress,bytes(section.data))
u.mem_write(ov.ramAddress,bytes(ov.data))
def word(p):return int.from_bytes(u.mem_read(p,4),'little')
def put(p,v):u.mem_write(p,struct.pack('<I',v))
def run(pc,stop):
    u.reg_write(UC_ARM_REG_SP,0x27df000);u.reg_write(UC_ARM_REG_LR,stop)
    u.emu_start(pc,stop,count=100000);assert u.reg_read(UC_ARM_REG_PC)==stop

u.mem_write(0x210b0a8,bytes([0xa5])*560)
run(0x20998d4,0x27ff000)
categories=[]
for category in range(2):
    desc=word(0x2114d48+category*4);rounds=u.mem_read(desc,1)[0];lst=word(desc+12);pools=[]
    for round_index in range(rounds):
        n=u.mem_read(lst+round_index*8,1)[0];p=word(lst+round_index*8+4);teams=[]
        for i in range(n):
            record=bytes(u.mem_read(p+i*20,20))
            matches=[j for j in range(152) if bytes(u.mem_read(0x20ed2d8+j*20,20))==record]
            assert len(matches)==1,(category,round_index,i,matches)
            teams.append(matches[0])
        pools.append(dict(round=round_index,address=f'{p:08X}',teamIndices=teams))
    categories.append(dict(category=category,rounds=rounds,prize=word(desc+4),pools=pools))

roll=0;channels=[]
def hook(_u,pc,size,_data):
    if pc==0x20431d4:
        channels.append(u.reg_read(UC_ARM_REG_R0));u.reg_write(UC_ARM_REG_R0,roll);u.reg_write(UC_ARM_REG_PC,u.reg_read(UC_ARM_REG_LR))
u.hook_add(UC_HOOK_CODE,hook)
# The draw prefix clears session+1DC before constructing the selected trio.
put(word(0x2110fbc),0x2300000)
draws=[]
for category in categories:
    for pool in category['pools']:
        for roll in range(103):
            channels.clear();u.reg_write(UC_ARM_REG_R2,category['category']);u.reg_write(UC_ARM_REG_R3,pool['round'])
            run(0x2110a90,0x2110ae8)
            presets=[u.reg_read(reg) for reg in [UC_ARM_REG_R2,UC_ARM_REG_R1,UC_ARM_REG_R0]]
            team=pool['teamIndices'][roll%len(pool['teamIndices'])]
            assert presets==list(struct.unpack('<3I',u.mem_read(0x20ed2d8+team*20,12)))
            assert channels==[0]
            draws.append(dict(category=category['category'],round=pool['round'],roll=roll,teamIndex=team,presets=presets,channels=list(channels)))
report=dict(classification='BOUNDED_NATIVE_REPLAY',romSha256=sha,initializer='ARM9:020998D4',selector='OVL10:02110A90..02110AE8',
    correction='BSS pools are populated by a ROM initializer from the existing static team records. No live RAM dump is required for these pools.',
    boundaries=['Initializer executes all original instructions without intercepted calls.',
      'Selector uses synthetic session memory and intercepted channel-0 random input; original integer remainder executes.',
      'Draw prefix ends before opponent individual construction; this is not complete tournament scene acceptance.'],
    categories=categories,draws=draws)
catalog=dict(contract='NATIVE_CHAMPIONSHIP_OPPONENT_POOLS_V1',evidence='BOUNDED_NATIVE_REPLAY',initializer=report['initializer'],
    categories=[dict(category=c['category'],pools=[p['teamIndices'] for p in c['pools']]) for c in categories])
for file,obj in [(args.out,report),(args.catalog_out,catalog)]:Path(file).write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(teams=sum(len(p['teamIndices']) for c in categories for p in c['pools']),draws=len(draws))))
