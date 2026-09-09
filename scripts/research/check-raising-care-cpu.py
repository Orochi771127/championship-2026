"""CPU oracle for original Raising food, medicine, condition and starter writers.

Runs private ROM code against a private live RAM snapshot. Only input/output
numbers are exported; visual/audio calls are intercepted and declared below.
"""
import argparse, hashlib, itertools, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

def main():
    ap=argparse.ArgumentParser()
    for k in ['rom','ram','out']: ap.add_argument('--'+k,required=True)
    ap.add_argument('--feast',action='store_true')
    a=ap.parse_args(); raw=Path(a.rom).read_bytes(); ram=Path(a.ram).read_bytes()
    sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);ov=rom.loadArm9Overlays()[18]
    assert ram[0x1000:0x1100]==bytes(decompress(rom.arm9))[0x1000:0x1100]
    assert ram[ov.ramAddress-0x2000000:ov.ramAddress-0x2000000+64]==bytes(ov.data[:64])
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
    actor,record,species,food,data=0x22e2d40,0x21e7f84,0x20c1e48,0x22835a8,0x21c62c0
    stop=0x27f0000; frame=1; roll=0; calls=[]; mode='care'; scratch=0x2500000; starter=None
    offsets=[0,4,8,12,16,20,24,0x1c,0x20,0x24,0x28,0x38,0x40,0x48,0x4c]+list(range(0x50,0x194,4))+list(range(0x198,0x1c8,4))
    narrow={0x3c:1,0x3d:1,0x44:1,0x46:2,0x194:2}
    def get(at,n=4):return int.from_bytes(u.mem_read(at,n),'little')
    def put(at,v,n=4):u.mem_write(at,(v&((1<<(n*8))-1)).to_bytes(n,'little'))
    def reg(r):return u.reg_read(r)
    def finish(n=0):u.reg_write(UC_ARM_REG_R0,n&0xffffffff);u.reg_write(UC_ARM_REG_PC,reg(UC_ARM_REG_LR))
    def project(at):
        name=bytes(u.mem_read(at+0x2c,12)).decode('utf-16-le').split('\0')[0]
        return dict(fields={f'{k:03x}':get(at+k) for k in offsets},narrowFields={f'{k:03x}':get(at+k,n) for k,n in narrow.items()},name=name)
    def hook(_,at,size,user):
        nonlocal scratch,starter
        if mode=='feast' and at==0x210e2bc:
            calls.append(dict(kind=reg(UC_ARM_REG_R2),heightQ12=reg(UC_ARM_REG_R3)));finish();return
        if mode=='feast' and at==0x210d580:u.reg_write(UC_ARM_REG_PC,stop);return
        if at==0x2044100:finish(0) # no pending interrupt command
        elif at==0x202e364:finish(frame) # native animation frame supplied by caller
        elif at==0x203ea30: calls.append(dict(kind='audio',id=reg(UC_ARM_REG_R0)));finish()
        elif at==0x210bc4c: # despawn's observable food-present write; graphics excluded
            put(data+0x18,0);finish()
        elif at==0x210beac: calls.append(dict(kind='unregister'));finish()
        elif at==0x21156b4: calls.append(dict(kind='reaction',id=reg(UC_ARM_REG_R1)));finish(0x1234)
        elif at==0x20431d4 and mode=='care': calls.append(dict(kind='rng',channel=reg(UC_ARM_REG_R0)));finish(roll)
        elif at==0x2050604:
            value=scratch;scratch+=(reg(UC_ARM_REG_R0)+31)&~31;finish(value)
        elif at==0x2050610:finish()
        elif at==0x2061bb4 and mode=='starter':starter=project(reg(UC_ARM_REG_R1));finish(0)
        elif at==0x27f1000:finish() # food visual vtable update
    u.hook_add(UC_HOOK_CODE,hook)
    def reset():
        nonlocal calls,scratch
        calls=[];scratch=0x2500000;u.mem_write(0x2000000,ram)
        u.mem_write(0x2500000,bytes(0x20000));u.mem_write(0x27df000,bytes(0x2000))
        u.reg_write(UC_ARM_REG_SP,0x27e0000);u.reg_write(UC_ARM_REG_LR,stop)
    def run(at,r0=actor,r1=0,r2=0):
        for r,v in [(UC_ARM_REG_R0,r0),(UC_ARM_REG_R1,r1),(UC_ARM_REG_R2,r2)]:u.reg_write(r,v&0xffffffff)
        u.emu_start(at,stop,count=200000);assert reg(UC_ARM_REG_PC)==stop,hex(reg(UC_ARM_REG_PC))
        return reg(UC_ARM_REG_R0)
    bites=[]
    for generation,kind,remaining,progress,hp in itertools.product(range(7),range(4) if a.feast else range(2),[1,4,16,32] if a.feast else [1,4,16],[0,3],[99,400]):
        protein=kind==1
        reset();put(actor+0xe,1,1);put(actor+0x10,0,2);put(actor+0x184,food);put(food+0x3c,data)
        put(food,0x27f2000);put(0x27f2020,0x27f1000)
        for i in range(4):put(food+0x1f4+i*4,0)
        put(species+0xc,generation);put(species+0x1c,8,1)
        for k,v in {8:7,0xc:5,0x1c:9,0x40:99,0x50:hp,0x58:400,0x170:12,0x174:25}.items():put(record+k,v)
        put(record+0x194,progress,2);put(record+0x46,15,2);put(record+0x44,4,1)
        put(data+0x10,remaining);put(data+0x14,100);put(data+0x18,1);put(data+0x1c,kind)
        before=project(record);result=run(0x211837c);after=project(record)
        bites.append(dict(input=dict(generation=generation,protein=protein,**({'kind':kind} if a.feast else {}),remaining=remaining,progress=progress,hp=hp),before=before,after=after,remaining=get(data+0x10),present=get(data+0x18),result=result,calls=calls))
    if a.feast:
        plans=[];mode='feast'
        for value in range(6):
            reset();root=get(0x20fba08);put(root+0xc8,value);u.reg_write(UC_ARM_REG_R4,actor)
            run(0x210d31c)
            plans.append(dict(value=value,calls=calls,remaining=get(root+0xc8)))
        Path(a.out).write_text(json.dumps(dict(classification='BOUNDED_NATIVE_REPLAY',romSha256=sha,
            exclusions=['graphics, sound and special food slot constructor; provided animation frame'],bites=bites,feasts=plans),separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
        print(f'PASS: {len(bites)} food bites and {len(plans)} feast producers');return
    conditions=[]
    for kind,delta,value in itertools.product(range(6),[-200,-1,0,1,200],[0,99,999]):
        reset()
        for off in [8,0x50,0x1c,0x20,0x24]:put(record+off,min(value,400) if off==0x50 else value)
        put(record+0x58,400);put(species+0x1c,8,1)
        before=project(record);run(0x211490c,r1=kind,r2=delta)
        conditions.append(dict(kind=kind,delta=delta,before=before,after=project(record)))
    medicines=[]
    for kind,generation,roll,condition in itertools.product([0,1],range(7),[0,19,49,79,99],[0,1]):
        reset();put(species+0xc,generation);put(record+0x134,condition);put(record+0x138,condition)
        before=project(record);result=run(0x2116348,r1=kind)
        medicines.append(dict(kind=kind,generation=generation,roll=roll,condition=condition,before=before,after=project(record),result=result,calls=calls,
                              success=get(actor+0x3f8),reaction=get(actor+0x3f4)))
    reset();mode='starter'
    starterRng={k:[get(at+i*4) for i in range(217)] for k,at in [('seeds',0x2104d20),('cursors',0x2105084)]}
    run(0x206178c,r0=get(0x210aa18));assert starter
    out=dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,ramSha256=hashlib.sha256(ram).hexdigest(),
             exclusions=['UI/audio/graphics/lifecycle stubs','medicine inventory caller','ground placement and approach','animation tick scheduler'],
             bites=bites,conditions=conditions,medicines=medicines,starter=starter,starterRng=starterRng)
    Path(a.out).write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(f'PASS: {len(bites)} bites, {len(conditions)} condition deltas, {len(medicines)} medicine cases, original starter')

if __name__=='__main__':main()
