"""Original treatment controller and reaction clock; private ROM/RAM inputs.

Scene routing, stylus hit selection and rendering are explicit stubs. Inventory
admission, state gate and the reaction wait execute original ARM instructions.
"""
import argparse, hashlib, itertools, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

ap=argparse.ArgumentParser()
for k in ['rom','ram','out']:ap.add_argument('--'+k,required=True)
a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
rom=NintendoDSRom(raw);ov=rom.loadArm9Overlays()[18]
assert ram[ov.ramAddress-0x2000000:ov.ramAddress-0x2000000+64]==bytes(ov.data[:64])
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
scene,actor,record,root,inventory=0x2500000,0x2504000,0x2505000,0x2510000,0x2512000
stop=0x27f0000;calls=[];params={}
get=lambda p,n=4:int.from_bytes(u.mem_read(p,n),'little')
def put(p,v,n=4):u.mem_write(p,(v&((1<<(8*n))-1)).to_bytes(n,'little'))
def reg(r):return u.reg_read(r)
def finish(n=0):u.reg_write(UC_ARM_REG_R0,n&0xffffffff);u.reg_write(UC_ARM_REG_PC,reg(UC_ARM_REG_LR))
def hook(_,at,size,user):
    if at==0x210d838:finish(-1)
    elif at==0x2044100:finish(int(reg(UC_ARM_REG_R1)==0x69))
    elif at==0x20669c8:finish(actor)
    elif at==0x2044134:finish(params['state'])
    elif at==0x204409c:calls.append(['command',reg(UC_ARM_REG_R1)]);finish()
    elif at==0x2047c48:finish(params.get('iconEnded',0))
    elif at==0x21156b4:calls.append(['reaction',reg(UC_ARM_REG_R1)]);finish(9)
    elif at==0x20431d4:calls.append(['rng',reg(UC_ARM_REG_R0)]);finish(params['roll'])
    elif at in [0x2060e68,0x2060cd4,0x207e750,0x207e67c,0x207d068,0x2120364]:finish()
u.hook_add(UC_HOOK_CODE,hook)
def reset():
    calls.clear();u.mem_write(0x2000000,ram);u.mem_write(scene,bytes(0x20000));u.mem_write(0x27de000,bytes(0x4000))
    put(0x20fba08,root);put(root+4,inventory);put(actor+0x114,record)
def run(pc):
    u.reg_write(UC_ARM_REG_R0,actor if params.get('timeline') else scene)
    u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
    u.emu_start(pc,stop,count=100000)
    assert reg(UC_ARM_REG_PC)==stop,hex(reg(UC_ARM_REG_PC))
    return reg(UC_ARM_REG_R0)
admission=[]
for kind,state,condition,stock,species in itertools.product(range(2),range(28),[0,1],[0,1,2],[0,8]):
    params=dict(state=state);reset();put(record,species);put(record+(0x134 if kind==0 else 0x138),condition)
    offset=0x24 if kind==0 else 0x22;put(inventory+offset,stock,2)
    run(0x210f0b0 if kind==0 else 0x210f324)
    admission.append(dict(kind=kind,state=state,condition=condition,stock=stock,species=species,remaining=get(inventory+offset,2),commands=list(calls)))
timeline=[]
for previous,elapsed,ended in itertools.product([1,4,5,18],[0,23,24,48,59,60,61],[0,1]):
    params=dict(state=20,timeline=True,iconEnded=ended);reset();put(actor+10,previous,1);put(actor+0x10,elapsed,2);put(actor+0x3f4,9)
    result=run(0x211be5c)
    timeline.append(dict(previous=previous,elapsed=elapsed,iconEnded=ended,result=result,nextElapsed=get(actor+0x10,2),calls=list(calls)))
# 0211CD60 loads e001_ikusei; 02111230 binds it at actor+23C. Only
# durations/modes are retained. No animation cells, paths or art enter runtime.
d=bytes(rom.files[rom.filenames.idOf('common/e001_ikusei.nanr')]);seq,frames,_=struct.unpack_from('<III',d,28)
icons=[]
for i in [3,4]:
    count,loop,_,mode,off=struct.unpack_from('<HHIII',d,24+seq+i*16)
    durations=[struct.unpack_from('<H',d,24+frames+off+j*8+4)[0] for j in range(count)]
    icons.append(dict(sequence=i,mode=mode,loopStart=loop,durations=durations))
# The original medicine writer precedes the previous state's exit callback.
# This checks the composition, including healthy targets, early wake-up and a
# full eater's affection/fatigue writes. The body has no graphics callbacks.
vectors=json.loads(Path('docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json').read_text(encoding='utf-8'))['individualVectors']
species_base=int.from_bytes(ram[0x113368:0x11336c],'little')
exits=[]
for species,previous,kind,condition,roll in itertools.product([8,27,71,135,181,211],[4,5],range(2),[0,1],[0,102]):
    params=dict(state=previous,timeline=True,roll=roll);reset();p=vectors[species]['after']
    for k,v in p['fields'].items():put(record+int(k,16),v)
    for k,n in {'03c':1,'03d':1,'044':1,'046':2,'194':2}.items():put(record+int(k,16),p['narrowFields'][k],n)
    put(record+0x134,condition);put(record+0x138,condition);put(record+0x17c,0);put(record+0x178,120);put(record+8,100)
    put(actor+0x118,species_base+species*132);put(actor+0x3c,scene);put(actor+0x46c,0x26+species%16);put(actor+0x47c,0x66+species%16)
    # Exact normal-mode probability pointers at the constructor's literals.
    put(actor+0x3e4,int.from_bytes(ram[0x111808:0x11180c],'little'));put(actor+0x3e8,record+0x134)
    put(actor+0x3ec,int.from_bytes(ram[0x11180c:0x111810],'little'));put(actor+0x3f0,record+0x138)
    before={**p,'fields':{k:get(record+int(k,16)) for k in p['fields']}}
    u.reg_write(UC_ARM_REG_R1,kind);next_state=run(0x2116348)
    run(0x21182b4 if previous==4 else 0x21188c4)
    after={**p,'fields':{k:get(record+int(k,16)) for k in p['fields']}}
    exits.append(dict(species=species,previous=previous,kind=kind,condition=condition,roll=roll,poolSlot=species%16,before=before,after=after,nextState=next_state,calls=list(calls)))
out=dict(classification='BOUNDED_NATIVE_REPLAY',romSha256=sha,ramSha256=hashlib.sha256(ram).hexdigest(),
    exclusions=['scene navigation and stylus actor hit selection','command queue dispatch','graphics and sound'],admission=admission,timeline=timeline,icons=icons,exits=exits)
Path(a.out).write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
print(f'PASS: {len(admission)} original admission cases, {len(timeline)} reaction boundaries, {len(icons)} icon timelines, {len(exits)} composed state exits')
