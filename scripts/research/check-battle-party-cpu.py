"""Bounded original qualification and ordinary-title result writers.

Only decoded functional fields are exported to the product catalog. CPU vectors
are research evidence; no ROM, executable bytes or memory snapshot enters runtime.
"""
import argparse, json, random, struct
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import *
from hunt_original_probe import load_rom, ROM_SHA

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--catalog', required=True)
a = ap.parse_args()
rom, arm, _ = load_rom()
ov = rom.loadArm9Overlays([19])[19]
u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
u.mem_map(0x02000000, 0x800000)
u.mem_write(0x02000000, arm)
u.mem_write(ov.ramAddress, bytes(ov.data))
def put(at, n, size=4):
    u.mem_write(at, (n & ((1 << (size*8))-1)).to_bytes(size, 'little'))
def word(at):
    return int.from_bytes(u.mem_read(at, 4), 'little', signed=True)
def call(at, args, end=0x027f0000):
    for r, n in zip([UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3], args): u.reg_write(r, n & 0xffffffff)
    u.reg_write(UC_ARM_REG_SP, 0x027e0000)
    u.reg_write(UC_ARM_REG_LR, end)
    u.emu_start(at, end, count=20000)
    assert u.reg_read(UC_ARM_REG_PC) == end
    return u.reg_read(UC_ARM_REG_R0)
cond, individual = 0x02500000, 0x02501000
titles = json.loads(Path('src/data/championship/catalogs/battle-title-events.r1.json').read_text(encoding='utf-8'))['records']
ids = sorted(set(t['field0C'] for t in titles))
rules = []
for index in ids:
    u.mem_write(cond, bytes(40))
    call(0x02092380, [cond, index])
    rules.append(dict(index=index, fields={f'{o:02x}':word(cond+o) for o in [0,4,8,12,16,20,28,32,36]},
                      minimum03c=int(u.mem_read(cond+24,1)[0]), minimum010=int(u.mem_read(cond+25,1)[0])))
species = []
for index in range(228):
    at = 0x020c1374 + index*0x84
    species.append(dict(index=index, fields={f'{o:02x}':word(at+o) for o in [12,16,20,24]}, field68=u.mem_read(at+0x68,1)[0]))
rng = random.Random(909)
vectors = []
for rule in rules:
    call(0x02092380, [cond, rule['index']])
    for s in species:
        for variant in range(3):
            f = {'000':s['index'], '010':rng.randrange(8), '018':rng.randrange(9)}
            narrow = {'03c':rng.randrange(256)}
            if variant == 1:
                f['010']=rule['minimum010']; f['018']=rule['fields']['1c']; narrow['03c']=rule['minimum03c']
            u.mem_write(individual, bytes(0x1c8))
            for key, n in f.items(): put(individual+int(key,16), n)
            for key, n in narrow.items(): put(individual+int(key,16), n, 1)
            accepted = call(0x02092244, [cond, individual])
            vectors.append(dict(rule=rule['index'],fields=f,narrowFields=narrow,accepted=bool(accepted)))
catalog = dict(version=1, evidence='BOUNDED_NATIVE_REPLAY', romSha256=ROM_SHA,
               source='ARM9 02092380 / 02092244; title condition caller OVL10 02112638..02112660', rules=rules, species=species)
results=[]
root, battle = 0x02502000, 0x02504000
for mode in [0,1]:
 for verdict in [3,4,5]:
  for event in [-1,0,1]:
   for variant in range(12):
    fields={'014':7,'024':[0,998,999,1000][variant%4],'028':[0,998,999,1000][variant%4],
      '050':[-12,0,1,45][variant%4],'054':variant,'058':101+variant,'05c':99+variant,
      '040':variant*9,'020':variant*9}
    u.mem_write(individual,bytes(0x1c8))
    for key,n in fields.items():put(individual+int(key,16),n)
    put(individual+0x44,4,1);put(individual+0x46,22,2)
    put(0x020fba08,root);put(root+0xc98,mode);put(root+0xca0,event)
    put(root+0xca4,1);put(root+0xca8,1 if variant%2 else 3)
    put(battle+0xea4,verdict);put(0x0210b2dc,0)
    for r,n in [(UC_ARM_REG_R0,individual),(UC_ARM_REG_R4,battle),(UC_ARM_REG_R5,0x0210b2dc),
      (UC_ARM_REG_R8,0),(UC_ARM_REG_R10,0x020fba08),(UC_ARM_REG_R11,999)]:u.reg_write(r,n)
    u.emu_start(0x0210e5ac,0x0210e798,count=1000)
    assert u.reg_read(UC_ARM_REG_PC)==0x0210e798
    results.append(dict(input=dict(mode=mode,verdict=verdict,event=event,cursor=1,totalRounds=1 if variant%2 else 3,fields=fields),
      output=dict(fields={key:word(individual+int(key,16)) for key in fields},narrowFields={'044':u.mem_read(individual+0x44,1)[0],'046':int.from_bytes(u.mem_read(individual+0x46,2),'little')})))
Path(a.catalog).write_text(json.dumps(catalog,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
Path(a.out).write_text(json.dumps(dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=ROM_SHA,
    scope='Original qualification and per-individual modes 0/1 type 0 result writer with controlled caller registers; excludes UI and surrounding event writers',vectors=vectors,results=results),separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(json.dumps(dict(rules=len(rules),species=len(species),qualificationVectors=len(vectors),resultVectors=len(results))))
