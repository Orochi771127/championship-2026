"""Build functional Hunt inputs from the hash-locked original ARM9.

No emulator checkpoint, research receipt, encounter result, ATR/ESC, art or
RNG state is an input. Numeric columns follow the already CPU-checked Hunt
constructor, candidate expansion and return/history consumers. Field geometry
and actor registration are deliberately separate unresolved providers.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
BASE = 0x02000000


def build(path):
    raw = Path(path).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SHA, 'Unexpected original ROM'
    arm = bytes(decompress(NintendoDSRom(raw).arm9))
    # The ancestry pointer array is C++ static-initialized, not file data.
    # Execute its original straight-line initializer (718 instructions, no
    # calls) in fresh zeroed scratch memory. No player RAM is imported.
    cpu = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    cpu.mem_map(BASE, 0x800000)
    cpu.mem_write(BASE, arm)
    cpu.reg_write(UC_ARM_REG_SP, 0x027E0000)
    cpu.reg_write(UC_ARM_REG_LR, 0x027F0000)
    cpu.emu_start(0x02098804, 0x027F0000, count=1000)
    assert cpu.reg_read(UC_ARM_REG_PC) == 0x027F0000

    def read(address, fmt):
        size = struct.calcsize(fmt)
        assert BASE <= address <= BASE + len(arm) - size, hex(address)
        return struct.unpack_from(fmt, arm, address - BASE)[0]

    word = lambda a: read(a, '<I')
    half = lambda a: read(a, '<H')
    byte = lambda a: read(a, '<B')

    def name(address):
        chars = []
        while len(chars) < 32:
            unit = half(address + len(chars) * 2)
            if not unit:
                return bytes().join(struct.pack('<H', n) for n in chars).decode('utf-16-le')
            chars.append(unit)
        raise ValueError('Unterminated native name')

    species = []
    ancestry_base = word(0x02062DA4)
    for i in range(228):
        at = 0x020C1374 + i * 0x84
        generation = word(at + 0x0c)
        ancestors = []
        if 1 < generation < 6 or i == 173:
            ptr = int.from_bytes(cpu.mem_read(ancestry_base + i * 12 - 0x58, 4), 'little')
            count = word(ptr)
            assert count < 100
            ancestors = [word(ptr + 4 + j * 4) for j in range(count)]
        species.append({
            'speciesIndex': i, 'generation': generation, 'attribute': word(at + 0x10),
            'baseName': name(word(at + 8)), 'field1c': byte(at + 0x1c), 'field1e': byte(at + 0x1e),
            'field20': half(at + 0x20), 'field22': half(at + 0x22),
            'movementBase': read(at + 0x2c, '<f'),
            'rungs': [half(at + o) for o in [0x30, 0x32, 0x34, 0x36]]
                + [byte(at + o) for o in [0x38, 0x39, 0x3c, 0x3d, 0x3e, 0x3f, 0x40]],
            'aiSelectors': [word(at + 0x48), word(at + 0x4c)],
            'aiPairs': [[word(at + o), word(at + o + 4)] for o in [0x50, 0x58, 0x60]],
            'ancestors': ancestors})

    catalogs = []
    for biome in range(16):
        ptr = word(0x020A1358 + biome * 4)
        count = half(ptr)
        assert 0 < count <= 256
        packed = [half(ptr + 2 + j * 2) for j in range(count)]
        # The return writer really uses 0x700, not the usual species mask.
        catalogs.append([{'speciesIndex': n & 0xfff, 'releaseMatchValue': n & 0x700} for n in packed])

    # OVL0 0211A578..588: native Hunt index * 4 + calendar season.
    # Only the 32 regular day/night entries; tutorial registration is different.
    encounters = []
    for index in range(32):
        seasons = []
        for season in range(4):
            ptr = word(0x020CC500 + (index * 4 + season) * 4)
            base_count, count = half(ptr), half(ptr + 2)
            assert 1 <= base_count <= 24 and 0 < count <= 256
            entries = []
            for j in range(count):
                packed = half(ptr + 4 + j * 2)
                species_id, weight = packed & 0xfff, (packed >> 12) & 7
                assert any(e['speciesIndex'] == species_id for e in catalogs[index // 2])
                entries.append({'speciesIndex': species_id, 'weight': weight})
            seasons.append({'baseCount': base_count, 'entries': entries})
        encounters.append(seasons)
    return {'schemaVersion': 1, 'contract': 'HUNT_ENTRY_SOURCES.v1',
            'romSha256': SHA, 'defaultHistoryName': name(0x020C89D4),
            'species': species, 'catalogs': catalogs, 'encounters': encounters}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rom', required=True)
    parser.add_argument('--check', action='store_true', help='Verify deterministic output without writing')
    parser.add_argument('--out', default=str(Path(__file__).resolve().parents[1] /
        'src/data/championship/catalogs/hunt-entry.r1.json'))
    args = parser.parse_args()
    document = build(args.rom)
    text = json.dumps(document, ensure_ascii=False, indent=2) + '\n'
    output = Path(args.out)
    if args.check:
        assert output.read_bytes() == text.encode('utf-8'), 'Functional catalog differs from source rebuild'
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(text, encoding='utf-8', newline='\n')
    print(json.dumps({'species': len(document['species']), 'biomes': len(document['catalogs']),
        'seasonalTables': sum(map(len, document['encounters'])),
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
