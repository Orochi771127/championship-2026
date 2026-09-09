"""Execute original form merge on all species, with rebirth boundary variations."""
import argparse,hashlib,json,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM
from unicorn.arm_const import *

def main():
    ap=argparse.ArgumentParser()
    for k in ['rom','out']:ap.add_argument('--'+k,required=True)
    a=ap.parse_args();raw=Path(a.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
    u.mem_write(rom.arm9RamAddress,bytes(decompress(rom.arm9)))
    inputs=json.loads(Path('docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json').read_text(encoding='utf-8'))['individualVectors']
    manager,pool,dest,source,stop=0x2500000,0x2501000,0x2501004,0x2510000,0x27f0000
    narrow={'03c':1,'03d':1,'044':1,'046':2,'194':2}
    def put(at,v,n=4):u.mem_write(at,(v&((1<<(8*n))-1)).to_bytes(n,'little'))
    def profile(at,p):
        u.mem_write(at,bytes(0x1c8))
        for k,v in p['fields'].items():put(at+int(k,16),v)
        for k,n in narrow.items():put(at+int(k,16),p['narrowFields'][k],n)
        u.mem_write(at+0x2c,p['name'].encode('utf-16-le')+bytes(12-len(p['name'])*2))
    def read(at,template):
        return dict(fields={k:int.from_bytes(u.mem_read(at+int(k,16),4),'little') for k in template['fields']},
                    narrowFields={k:int.from_bytes(u.mem_read(at+int(k,16),n),'little') for k,n in narrow.items()},
                    name=bytes(u.mem_read(at+0x2c,12)).decode('utf-16-le').split('\0')[0])
    rows=[]
    for i,row in enumerate(inputs):
        target=(i+14)%228
        for cycles in [0,1,6,19,20,98,99,100]:
            before=row['after'];new=inputs[target]['after']
            u.mem_write(pool,bytes(16*0x1cc));put(manager+8,pool);put(manager+4,1);put(pool,1)
            profile(dest,before);profile(source,new);put(dest+0x3c,cycles,1)
            for r,v in [(UC_ARM_REG_R0,manager),(UC_ARM_REG_R1,dest),(UC_ARM_REG_R2,source),
                        (UC_ARM_REG_SP,0x27e0000),(UC_ARM_REG_LR,stop)]:u.reg_write(r,v)
            u.emu_start(0x2062da8,stop,count=10000);assert u.reg_read(UC_ARM_REG_PC)==stop
            rows.append(dict(sourceIndex=i,targetIndex=target,cycles=cycles,after=read(dest,new)))
    Path(a.out).write_text(json.dumps(dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,cases=rows),separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    print(f'PASS: {len(rows)} original form merges')

if __name__=='__main__':main()
