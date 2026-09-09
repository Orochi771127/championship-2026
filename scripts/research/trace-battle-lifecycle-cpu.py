"""R7 original CPU oracle: cell contact, scoped child release and SDK DIV_FX.

Peripheral divide-by-zero behavior is cross-checked with DeSmuME MMU.cpp
execdiv (official upstream); ARM9 postprocessing executes unmodified.
"""
import argparse, hashlib, json, random, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_MEM_READ, UC_HOOK_CODE
from unicorn.arm_const import *

p=argparse.ArgumentParser();p.add_argument('--rom',required=True);p.add_argument('--out',required=True);args=p.parse_args()
raw=Path(args.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
rom=NintendoDSRom(raw);arm=bytes(decompress(rom.arm9));ovl=rom.loadArm9Overlays()[19]
u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x400000);u.mem_map(0x4000000,0x1000)
u.mem_write(0x2000000,arm);u.mem_write(ovl.ramAddress,bytes(ovl.data))
base=0x2300000;stop=0x23f0000;stack=0x23e0000
def word(a,v):u.mem_write(a,struct.pack('<I',v&0xffffffff))
def read(a):return int.from_bytes(u.mem_read(a,4),'little')
def signed(v):return (v&0x7fffffff)-(v&0x80000000)
def run(pc,values):
    for reg,v in zip([UC_ARM_REG_R0,UC_ARM_REG_R1,UC_ARM_REG_R2,UC_ARM_REG_R3],values):u.reg_write(reg,v&0xffffffff)
    u.reg_write(UC_ARM_REG_SP,stack);u.reg_write(UC_ARM_REG_LR,stop);u.emu_start(pc,stop,count=50000)
    assert u.reg_read(UC_ARM_REG_PC)==stop
    return signed(u.reg_read(UC_ARM_REG_R0))
def divider(uc,access,address,size,value,data):
    if 0x40002a0<=address<0x40002b0:
        n=int.from_bytes(u.mem_read(0x4000290,8),'little',signed=True)
        d=int.from_bytes(u.mem_read(0x4000298,4),'little',signed=True)
        q=(1 if n<0 else -1) if d==0 else (abs(n)//abs(d))*(-1 if (n<0)!=(d<0) else 1)
        u.mem_write(0x40002a0,(q&0xffffffffffffffff).to_bytes(8,'little'))
u.hook_add(UC_HOOK_MEM_READ,divider,begin=0x40002a0,end=0x40002af)
divisions=[]
for a in [-2147483648,-4096,-1,0,1,4096,2147483647]:
 for b in [0,-1,1,4096]:divisions.append({'a':a,'b':b,'result':run(0x2002738,[a,b])})
rng=random.Random(7);contacts=[]
for i in range(512):
    boxes=[];points=[]
    for j in range(2):
        lx,ly=rng.randrange(-64,0),rng.randrange(-64,0)
        boxes.append({'lowX':lx,'lowY':ly,'highX':rng.randrange(0,65),'highY':rng.randrange(0,65)})
        points.append([rng.randrange(-128,129)*4096,rng.randrange(-128,129)*4096,rng.randrange(0,65)*4096])
    for j,box in enumerate(boxes):
        u.mem_write(base+j*0x20,struct.pack('<hhhh',box['highX'],box['highY'],box['lowX'],box['lowY']))
        for k,v in enumerate(points[j]):word(base+0x40+j*0x20+k*4,v)
    contacts.append({'boxes':boxes,'points':points,'result':run(0x211b9a4,[base,base+0x40,base+0x20,base+0x60])})
releases=[]
for selected in range(5):
    u.mem_write(base,bytes(0x8000));vms=[base+0xec]+[base+0x2a0+i*0x1b4 for i in range(4)]
    for i in range(24):
        actor=base+0x1000+i*0x100
        word(base+0x24+i*4,actor);word(base+0x84+i*4,vms[i%5]);u.mem_write(actor+0x5b,b'\1')
        if i<4:word(base+0x970+i*4,actor)
    run(0x211cd80,[base,vms[selected]])
    releases.append({'vmIndex':selected,'handles':[read(base+0x24+i*4) for i in range(24)],
      'owners':[read(base+0x84+i*4) for i in range(24)],'bindings':[read(base+0x970+i*4) for i in range(4)],
      'active':[u.mem_read(base+0x1000+i*0x100+0x5b,1)[0] for i in range(24)]})
impacts=[]
for name in ['hitspark_small','hitspark_big','s_impact_s','s_impact_b','earth_hit']:
    file_id=rom.filenames.idOf('battle/'+name+'.nsbca');data=bytes(rom.files[file_id]);at=data.find(b'J\x00AC')
    assert at>=0
    count=struct.unpack_from('<H',data,at+4)[0]
    wrapper=base;animation=base+0x100;resource=base+0x200
    word(wrapper,animation);word(wrapper+0xc,4096);word(wrapper+0x10,0)
    word(animation,0);word(animation+8,resource);u.mem_write(resource+4,struct.pack('<H',count))
    checks=[]
    for frame in range(count+2):
        checks.append({'frame':frame,'finished':run(0x208af28,[wrapper])})
        run(0x208ae6c,[wrapper,4096])
    impacts.append({'name':name,'fileId':file_id,'sha256':hashlib.sha256(data).hexdigest(),'frameCount':count,'checks':checks})
selection=[]
def intercept_spawn(uc,address,size,data):
    selection.append({'type':uc.reg_read(UC_ARM_REG_R1)})
    uc.reg_write(UC_ARM_REG_R0,0x1234);uc.reg_write(UC_ARM_REG_PC,uc.reg_read(UC_ARM_REG_LR))
hook=u.hook_add(UC_HOOK_CODE,intercept_spawn,begin=0x211adec,end=0x211adec)
for secondary in [False,True]:
 for species in [0,71,72,133,227]:
    action=base;owner=base+0x1000;target=base+0x2000;stats=base+0x3000;offset=base+0x4000
    word(action+0xe4,owner);word(owner+0x10,stats);word(target+0x10,stats);word(stats,species)
    run(0x211af60 if secondary else 0x211af20,[base+0x5000,action,target,offset])
    selection[-1].update({'secondary':secondary,'species':species})
u.hook_del(hook)
out={'romSha256':sha,'overlaySha256':hashlib.sha256(bytes(ovl.data)).hexdigest(),
 'scope':'Original CPU helpers with controlled memory and documented divider peripheral',
 'dividerReference':'https://github.com/TASEmulators/desmume/blob/master/desmume/src/MMU.cpp#L1037',
 'divisions':divisions,'contacts':contacts,'releases':releases,'impactAnimations':impacts,'impactSelections':selection}
Path(args.out).write_text(json.dumps(out,separators=(',',':')),encoding='utf-8')
print(json.dumps({'divisions':len(divisions),'contacts':len(contacts),'releases':len(releases),'impactFamilies':len(impacts),'impactSelections':len(selection)}))
