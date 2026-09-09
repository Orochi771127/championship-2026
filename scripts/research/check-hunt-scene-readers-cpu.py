"""Compare every regular initial field cell with actual ARM9 reader execution.
Only hashes/counts and outside-reader results are exported, never raw grids.
"""
import argparse, hashlib, json, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

def main():
    p=argparse.ArgumentParser(); p.add_argument('--rom',required=True); p.add_argument('--out',required=True); a=p.parse_args()
    raw=Path(a.rom).read_bytes(); sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw); arm=bytes(decompress(rom.arm9))
    cpu=Uc(UC_ARCH_ARM,UC_MODE_ARM); cpu.mem_map(0x02000000,0x800000); cpu.mem_write(0x02000000,arm)
    grid, payload, stop=0x02600000,0x02601000,0x027f0000
    put=lambda a,v:cpu.mem_write(a,struct.pack('<I',v))
    def run(pc,x,y):
        for r,v in [(UC_ARM_REG_R0,grid),(UC_ARM_REG_R1,x),(UC_ARM_REG_R2,y),(UC_ARM_REG_SP,0x027d0000),(UC_ARM_REG_LR,stop)]: cpu.reg_write(r,v&0xffffffff)
        cpu.emu_start(pc,stop,count=1000)
        assert cpu.reg_read(UC_ARM_REG_PC)==stop
        return cpu.reg_read(UC_ARM_REG_R0)
    catalog=json.loads((Path(__file__).resolve().parents[2]/'src/data/championship/catalogs/hunt-scene.r1.json').read_text())
    results=[]
    for field_id, env in catalog['environments'].items():
        width,height=env['width'],env['height']; row={'fieldId':field_id,'cells':width*height}
        for ext,pc,header in [('atr',0x0207c9e8,16),('esc',0x02088048,5)]:
            src=bytes(rom.files[rom.filenames.idOf('field/'+field_id+'.'+ext)])[header:]
            assert len(src)==width*height
            # Execute the original constructor, then install the loaded file's
            # dimensions and data pointer. Constructor supplies wrap=false.
            run(0x0207c828,0,0)
            for at,v in [(grid,width),(grid+4,height),(grid+8,payload)]:put(at,v)
            cpu.mem_write(payload,src)
            actual=bytes(run(pc,x,y) for y in range(height) for x in range(width))
            if ext=='atr':
                expected=bytes(value for count,value in env['terrainRuns'] for _ in range(count))
                assert actual==expected
            else:
                assert actual==src  # independent row/column/data-offset proof
            row[ext+'ReaderSha256']=hashlib.sha256(actual).hexdigest()
            row[ext+'Outside']=[run(pc,x,y) for x,y in [(-1,0),(0,-1),(width,0),(0,height)]]
        results.append(row)
        print(field_id,flush=True)
    result={'status':'CONTROLLED_ORIGINAL_CPU_ALL_INITIAL_CELLS','runtimeEligible':False,'romSha256':sha,
        'terrainReader':'0207C9E8','directionReader':'02088048','constructor':'0207C828',
        'limits':'Initial immutable field sources only; dynamic controller lifecycle and unknown steering branches remain open.', 'fields':results}
    Path(a.out).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'fields':len(results),'readerCalls':sum(x['cells']*2+8 for x in results)}))
if __name__=='__main__':main()
