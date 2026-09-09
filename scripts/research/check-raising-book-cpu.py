"""Hatching's actual encyclopedia registration (02116A20, old species -1)."""
import argparse,hashlib,json,struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc,UC_ARCH_ARM,UC_MODE_ARM
from unicorn.arm_const import *

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--rom',required=True);ap.add_argument('--out',required=True);ap.add_argument('--catalog',required=True)
    a=ap.parse_args();raw=Path(a.rom).read_bytes();sha=hashlib.sha256(raw).hexdigest()
    assert sha=='8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom=NintendoDSRom(raw);ov=rom.loadArm9Overlays()[18]
    u=Uc(UC_ARCH_ARM,UC_MODE_ARM);u.mem_map(0x2000000,0x800000)
    u.mem_write(rom.arm9RamAddress,bytes(decompress(rom.arm9)));u.mem_write(ov.ramAddress,bytes(ov.data))
    def get(at):return int.from_bytes(u.mem_read(at,4),'little')
    def put(at,v):u.mem_write(at,(v&0xffffffff).to_bytes(4,'little'))
    actor,game,player,stop=0x2500000,0x2501000,0x2502000,0x27f0000
    put(0x20fba08,game);put(game+4,player)
    table=get(0x2116b44);order=[get(table+i*8) for i in range(216)]
    assert len(set(order))==216 and set(order)==set(range(8,224))
    cases=[]
    for species in range(228):
        u.mem_write(player,bytes(0x2000));put(actor+0x464,123)
        for r,v in [(UC_ARM_REG_R0,actor),(UC_ARM_REG_R1,0xffffffff),(UC_ARM_REG_R2,species),(UC_ARM_REG_R3,0),(UC_ARM_REG_SP,0x27e0000),(UC_ARM_REG_LR,stop)]:u.reg_write(r,v)
        u.emu_start(0x2116a20,stop,count=10000);assert u.reg_read(UC_ARM_REG_PC)==stop
        flags=list(u.mem_read(player+0x4ee,216));assert all(n in [0,1] for n in flags)
        cases.append(dict(species=species,registeredOrdinals=[i for i,n in enumerate(flags) if n],afterActor464=get(actor+0x464)))
    Path(a.out).write_text(json.dumps(dict(classification='RESEARCH_ONLY',runtimeEligible=False,romSha256=sha,regularSpeciesOrder=order,cases=cases),separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
    Path(a.catalog).write_text('// Regular encyclopedia order read by the original 02116A20 registration scan.\nexport const NATIVE_REGULAR_BOOK_SPECIES = Object.freeze('+json.dumps(order,separators=(',',':'))+');\n',encoding='utf-8',newline='\n')
    print('PASS: 228 original registration calls; 216 distinct regular species')

if __name__=='__main__':main()
