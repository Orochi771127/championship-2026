"""Bounded disassembly of the owner's hash-locked Hunt ROM, research only."""
import argparse
import hashlib
import re
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM

ROM_SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
DEFAULT_ROM = 'R:/Projects/Championship2026/_archive/hunt-history-2026-09-06/ui3/original.nds'

def load_rom(path=DEFAULT_ROM):
    raw = Path(path).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == ROM_SHA
    rom = NintendoDSRom(raw)
    return rom, bytes(decompress(rom.arm9)), rom.loadArm9Overlays([0])[0]

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('start', type=lambda x: int(x, 16))
    parser.add_argument('end', type=lambda x: int(x, 16))
    parser.add_argument('--rom', default=DEFAULT_ROM)
    parser.add_argument('--arm9', action='store_true')
    args = parser.parse_args()
    rom, arm, overlay = load_rom(args.rom)
    base, code = (0x02000000, arm) if args.arm9 else (overlay.ramAddress, bytes(overlay.data))
    assert 0 <= args.start-base < args.end-base <= len(code)
    decoder = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    decoder.skipdata = True
    for ins in decoder.disasm(code[args.start-base:args.end-base], args.start):
        match = re.search(r'\[pc, #(-?0x[0-9a-f]+|-?\d+)\]', ins.op_str)
        note = ''
        if match and ins.mnemonic.startswith('ldr'):
            at = ins.address + 8 + int(match[1], 0) - base
            if 0 <= at <= len(code) - 4:
                note = f' ; literal=0x{struct.unpack_from("<I", code, at)[0]:08X}'
        print(f'{ins.address:08X} {ins.mnemonic:8} {ins.op_str}{note}')
