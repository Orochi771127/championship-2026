"""Execute ARM9 02061BB4 over previously CPU-checked individual inputs.

Only numeric receipt hashes leave the emulator. Uninitialized record padding
is deliberately filled with a sentinel and is never exported as player data.
"""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--rom',required=True)
    ap.add_argument('--out',required=True)
    ap.add_argument('--inputs',default='docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json')
    args=ap.parse_args()
    raw=Path(args.rom).read_bytes()
    sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw)
    inputs=Path(args.inputs).read_bytes()
    vectors=json.loads(inputs)['individualVectors']
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM)
    u.mem_map(0x02000000,0x800000)
    u.mem_write(rom.arm9RamAddress,bytes(decompress(rom.arm9)))
    manager,pool,source,stop=0x02500000,0x02501000,0x02510000,0x027f0000
    def put(at,n):u.mem_write(at,struct.pack('<I',n&0xffffffff))
    def read(at):return struct.unpack('<I',u.mem_read(at,4))[0]
    narrow={'03c':1,'03d':1,'044':1,'046':2,'194':2}
    rows=[]
    for vector in vectors:
        v=vector['after']
        for slot in [0,7,15]:
            u.mem_write(pool,bytes(16*0x1cc));u.mem_write(source,bytes([0xa5])*0x1c8)
            for k,n in v['fields'].items():put(source+int(k,16),n)
            for k,size in narrow.items():u.mem_write(source+int(k,16),v['narrowFields'][k].to_bytes(size,'little'))
            u.mem_write(source+0x2c,v['name'].encode('utf-16-le')+bytes(12-len(v['name'].encode('utf-16-le'))))
            put(manager+8,pool);put(manager+4,slot)
            for i in range(slot):put(pool+i*0x1cc,1)
            u.reg_write(UC_ARM_REG_R0,manager);u.reg_write(UC_ARM_REG_R1,source)
            u.reg_write(UC_ARM_REG_SP,0x027e0000);u.reg_write(UC_ARM_REG_LR,stop)
            u.emu_start(0x02061bb4,stop,count=3000)
            assert u.reg_read(UC_ARM_REG_PC)==stop and u.reg_read(UC_ARM_REG_R0)==slot
            assert read(manager+4)==slot+1 and read(pool+slot*0x1cc)==1
            dest=pool+slot*0x1cc+4
            actual=[read(dest+int(k,16)) for k in sorted(v['fields'])]
            assert actual==[v['fields'][k] for k in sorted(v['fields'])]
            small=[int.from_bytes(u.mem_read(dest+int(k,16),size),'little') for k,size in narrow.items()]
            assert small==list(v['narrowFields'].values())
            name=bytes(u.mem_read(dest+0x2c,len(v['name'].encode('utf-16-le'))))
            assert name==v['name'].encode('utf-16-le')
            digest=hashlib.sha256(struct.pack('<'+'I'*(len(actual)+len(small)),*(actual+small))+name).hexdigest()
            rows.append(dict(speciesIndex=vector['speciesIndex'],slot=slot,profileSha256=digest))
    result=dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,
        inputSha256=hashlib.sha256(inputs).hexdigest(),routine='ARM9:02061BB4',cases=rows,
        scope='228 CPU-generated species inputs x first free slots 0/7/15; known fields and UTF16 name preserved; no gameplay or hardware save claim')
    Path(args.out).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'PASS: {len(rows)} original-CPU individual Home copies')

if __name__=='__main__':main()
