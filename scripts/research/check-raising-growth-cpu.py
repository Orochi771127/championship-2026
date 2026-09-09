"""Execute OVL18's complete 02114A10 growth writer with explicit scene inputs.

The zero-peer scenarios below isolate individual effects. Social peer writes
and actor state selection remain separately declared, not emulated by guesses.
"""
import argparse,hashlib,itertools,json,random
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm_const import *

def main():
    ap=argparse.ArgumentParser()
    for k in ['rom','ram','out']:ap.add_argument('--'+k,required=True)
    a=ap.parse_args();raw=Path(a.rom).read_bytes();ram=Path(a.ram).read_bytes()
    sha=hashlib.sha256(raw).hexdigest();assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);ov=rom.loadArm9Overlays()[18]
    assert ram[ov.ramAddress-0x2000000:ov.ramAddress-0x2000000+64]==bytes(ov.data[:64])
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
    actor,record,species,stop=0x22e2d40,0x21e7f84,0x20c1e48,0x27f0000
    offsets=[0,4,8,12,16,20,24,0x1c,0x20,0x24,0x28,0x38,0x40,0x48,0x4c]+list(range(0x50,0x194,4))+list(range(0x198,0x1c8,4))
    narrow={0x3c:1,0x3d:1,0x44:1,0x46:2,0x194:2}
    actor_offsets=[0x404,0x408,0x40c,0x410,0x414,0x418,0x41c,0x428,0x430,0x45c,0x460,0x470]
    params={};calls=[]
    def get(at,n=4):return int.from_bytes(u.mem_read(at,n),'little')
    def put(at,v,n=4):u.mem_write(at,(v&((1<<(n*8))-1)).to_bytes(n,'little'))
    def reg(r):return u.reg_read(r)
    def finish(v=0):u.reg_write(UC_ARM_REG_R0,v&0xffffffff);u.reg_write(UC_ARM_REG_PC,reg(UC_ARM_REG_LR))
    def project():return dict(fields={f'{k:03x}':get(record+k) for k in offsets},narrowFields={f'{k:03x}':get(record+k,n) for k,n in narrow.items()},name=bytes(u.mem_read(record+0x2c,12)).decode('utf-16-le').split('\0')[0])
    def apject():return {f'{k:03x}':get(actor+k) for k in actor_offsets}
    def hook(_,at,size,user):
        if at in [0x2043860,0x20034f4,0x2044100]:finish(0)
        elif at in [0x210e4dc,0x207bc7c]:finish(1)
        elif at==0x207bc9c:finish(params['mode'])
        elif at==0x207bccc:finish(params['minute'])
        elif at==0x204ff78:finish(params['ranchSize'])
        elif at in [0x2050010,0x2050018,0x2050020,0x204fd7c]:finish(0x2500000)
        elif at==0x204fd74:finish(0)
        elif at==0x20431d4:calls.append(dict(kind='rng',channel=reg(UC_ARM_REG_R0)));finish(params['roll'])
        elif at==0x203ea30:calls.append(dict(kind='audio',id=reg(UC_ARM_REG_R0)));finish()
        elif at in [0x207e67c,0x207d068,0x2120364,0x207e750]:finish()
    u.hook_add(UC_HOOK_CODE,hook)
    prng=random.Random(20260908);cases=[]
    for i in range(768):
        u.mem_write(0x2000000,ram);u.mem_write(0x2500000,bytes(0x2000));put(0x2500034,0x2500000)
        calls=[];state=[1,4,5,6,8][i%5];delta=i%3
        params=dict(mode=[1,2,3][i%3],minute=i%1440,ranchSize=[1,2,3,5][i%4],roll=i%102)
        put(actor+8,state,1);put(actor+0xe,0,1)
        for at in actor_offsets:put(actor+at,0)
        for at in [0x408,0x410,0x414,0x418,0x430]:put(actor+at,prng.randrange(2))
        put(actor+0x40c,1);put(actor+0x428,[60,1440,5760,23040][i%4]);put(actor+0x470,0x36)
        put(actor+0x460,prng.choice([0,11,12,23,24,25]));put(actor+0x234,2,1);put(actor+0x238,0x2501000)
        effects=[dict(interval=7,kind=2,delta=-1),dict(interval=11,kind=3,delta=1)]
        for j,e in enumerate(effects):
            base=0x2501000+j*12;put(base,e['interval']);put(base+4,e['kind'],1);put(base+8,e['delta'])
        generation=[0,1,2,3,4,5,6][i%7];put(species+0xc,generation);put(species+0x1c,8,1)
        for at in range(0x170,0x1bc,4):put(record+at,prng.choice([0,29,30,59,60,119,120,239,240,599,600,1440,23040]))
        for at in [0x134,0x138,0x13c]:put(record+at,prng.randrange(2))
        put(record+8,[0,2,8][i%3]);put(record+0x18,i%8);put(record+0x1c,[0,89,90,99,100][i%5]);put(record+0x20,i%101)
        put(record+0x50,[1,40,399,400][i%4]);put(record+0x58,400)
        before=project();actorBefore=apject();basePointer=get(0x21153b0);baseUnit=get(basePointer)
        for r,v in [(UC_ARM_REG_R0,actor),(UC_ARM_REG_R1,delta),(UC_ARM_REG_SP,0x27e0000),(UC_ARM_REG_LR,stop)]:u.reg_write(r,v)
        u.emu_start(0x2114a10,stop,count=200000)
        assert reg(UC_ARM_REG_PC)==stop,hex(reg(UC_ARM_REG_PC))
        cases.append(dict(input=dict(**params,state=state,ageDelta=delta,generation=generation,baseUnit=baseUnit,effects=effects),before=before,actorBefore=actorBefore,after=project(),actorAfter=apject(),calls=calls))
    Path(a.out).write_text(json.dumps(dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,ramSha256=hashlib.sha256(ram).hexdigest(),
        exclusions=['zero actual peer list; peer-to-peer writes require another oracle','state selection and movement are caller responsibilities','UI and audio side effects logged, not rendered'],cases=cases),separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(f'PASS: {len(cases)} complete original growth calls')

if __name__=='__main__':main()
