"""Independent original candidate consumer for every regular field/season.

Controlled modifier inputs in zeroed Unicorn memory. No player save or
generated runtime catalog is read. Only functional outputs enter the receipt.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC, UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R4, UC_ARM_REG_R5


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--rom', required=True)
    p.add_argument('--out', required=True)
    args = p.parse_args()
    raw = Path(args.rom).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom = NintendoDSRom(raw)
    cpu = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    cpu.mem_map(0x02000000, 0x800000)
    cpu.mem_write(0x02000000, bytes(decompress(rom.arm9)))
    overlay = rom.loadArm9Overlays()[0]
    cpu.mem_write(overlay.ramAddress, bytes(overlay.data))
    word = lambda a: int.from_bytes(cpu.mem_read(a, 4), 'little')
    half = lambda a: int.from_bytes(cpu.mem_read(a, 2), 'little')
    put = lambda a, v: cpu.mem_write(a, struct.pack('<I', v))
    # Getter 02056D74 reads this owner pointer. Only its native index is used.
    player, out = 0x02500000, 0x02600000
    put(0x020FBA08, player)
    put(0x0210AA94 + 0x34, 8)
    put(0x0210AA94 + 0x38, 1)
    counts = []
    for i in range(16):
        counts.append(half(word(0x020A1358 + i * 4)))
        put(0x020CC4C0 + i * 4, 0x02510000 + i * 0x100)

    def hook(uc, a, size, _):
        if a == 0x020431D4:
            raise AssertionError('Candidate sources must not draw RNG')
        if a == 0x02050604:
            assert cpu.reg_read(UC_ARM_REG_R0) <= 512
            cpu.reg_write(UC_ARM_REG_R0, 0x025F0000)
            cpu.reg_write(UC_ARM_REG_PC, cpu.reg_read(UC_ARM_REG_LR))
        elif a == 0x02050610:
            assert cpu.reg_read(UC_ARM_REG_R0) == 0x025F0000
            cpu.reg_write(UC_ARM_REG_PC, cpu.reg_read(UC_ARM_REG_LR))
    cpu.hook_add(UC_HOOK_CODE, hook)
    cases = []
    for field in range(32):
        put(player + 0x10, field)
        for season in range(4):
            put(0x0210AA98, season * 8)
            cpu.reg_write(UC_ARM_REG_R0, season)
            cpu.reg_write(UC_ARM_REG_R4, field)
            cpu.reg_write(UC_ARM_REG_SP, 0x027D0000)
            cpu.emu_start(0x0211A57C, 0x0211A58C, count=10)
            assert cpu.reg_read(UC_ARM_REG_PC) == 0x0211A58C
            selected = cpu.reg_read(UC_ARM_REG_R5)
            for value in [0, 1, 2, 7, 15]:
                cpu.mem_write(0x02510000 + (field // 2) * 0x100, bytes([value]) * counts[field // 2])
                cpu.reg_write(UC_ARM_REG_R0, selected)
                cpu.reg_write(UC_ARM_REG_R1, out)
                cpu.reg_write(UC_ARM_REG_SP, 0x027D0000)
                cpu.reg_write(UC_ARM_REG_LR, 0x027F0000)
                cpu.emu_start(0x0211B8E4, 0x027F0000, count=100000)
                assert cpu.reg_read(UC_ARM_REG_PC) == 0x027F0000
                n = cpu.reg_read(UC_ARM_REG_R0)
                assert n < 1024
                cases.append({'nativeHuntIndex': field, 'season': season, 'modifier': value,
                    'baseCount': half(selected), 'candidates': [half(out + i * 2) for i in range(n)]})
    receipt = {'classification': 'RESEARCH_ONLY', 'runtimeEligible': False,
        'romSha256': sha, 'controlled': 'native owner index, calendar and uniform modifier bytes in isolated CPU; bounded scratch allocator/free shim',
        'excluded': ['normal entry', 'terrain', 'actor registration', 'generated runtime catalog'],
        'cases': cases}
    Path(args.out).write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'cases': len(cases), 'status': 'ORIGINAL_CANDIDATE_CONSUMER_COMPLETE'}))


if __name__ == '__main__':
    main()
