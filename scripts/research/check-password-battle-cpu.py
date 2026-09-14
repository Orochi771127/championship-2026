"""Replay the original password team codec and export its functional species bases.

The native codec is executed from the hash-locked YDIJ ARM9.  Only allocation,
free, and the Nintendo DS hardware divider are replaced by equivalent host
helpers so the original mixed-radix pack/unpack, checksum, and profile rebuild
instructions remain the code under test.
"""
import argparse
import hashlib
import importlib.util
import json
import struct
from pathlib import Path

from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import (
    UC_ARM_REG_LR, UC_ARM_REG_PC, UC_ARM_REG_R0, UC_ARM_REG_R1,
    UC_ARM_REG_SP,
)

from hunt_original_probe import load_rom, ROM_SHA


CODEC_INIT = 0x02094DB8
ENCODE = 0x020950B8
DECODE = 0x02095248
MALLOC = 0x02050604
FREE = 0x02050610
DIVIDE = 0x020957F0
SPECIES_BASE = 0x020C1374
SPECIES_STRIDE = 0x84
SPECIES_COUNT = 228
COMPACT_FIELDS = (
    (0x00, 228), (0x04, 8), (0x08, 5), (0x0C, 256), (0x10, 128),
    (0x14, 4), (0x18, 4), (0x1C, 4), (0x20, 4),
    (0x24, 7), (0x28, 7), (0x2C, 7), (0x30, 7), (0x34, 7),
)
BASE_FIELDS = (0x30, 0x32, 0x34, 0x36, 0x38, 0x39, 0x3C, 0x3D, 0x3E,
               0x3F, 0x40, 0x48, 0x4C, 0x50, 0x54, 0x58, 0x5C, 0x60, 0x64)


def text_banks(rom):
    module_path = Path(__file__).resolve().parents[1] / 'build-tutorial-steps.py'
    spec = importlib.util.spec_from_file_location('championship_text_bank', module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, chunks = module.read_bank(rom)
    return [module.decode(chunks[index]) for index in range(0x10B, 0x111)]


def utf16(text):
    return text.encode('utf-16-le') + b'\0\0'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    parser.add_argument('--catalog', required=True)
    args = parser.parse_args()

    rom, arm, _ = load_rom()
    banks = text_banks(rom)
    alphabet = ''.join(banks[:4])
    canonical, alternates = banks[5], banks[4]
    assert len(alphabet) == len(set(alphabet)) == 257
    alphabet = ''.join(sorted(alphabet, key=ord))
    assert alphabet[0] == '\u3041'
    assert len(canonical) == len(alternates) and len(canonical) < 61

    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x00800000)
    u.mem_write(0x02000000, arm)
    codec, team, decoded = 0x02400000, 0x02401000, 0x02402000
    individuals = [0x02403000 + index * 0x200 for index in range(3)]
    decoded_individuals = [0x02404000 + index * 0x200 for index in range(3)]
    heap_cursor = 0x02500000

    def get(address, size=4, signed=False):
        return int.from_bytes(u.mem_read(address, size), 'little', signed=signed)

    def put(address, value, size=4):
        u.mem_write(address, (value & ((1 << (size * 8)) - 1)).to_bytes(size, 'little'))

    def hook(_u, pc, _size, _data):
        nonlocal heap_cursor
        if pc == MALLOC:
            size = u.reg_read(UC_ARM_REG_R0)
            result = heap_cursor
            heap_cursor = (heap_cursor + size + 15) & ~15
            u.mem_write(result, bytes(size))
            u.reg_write(UC_ARM_REG_R0, result)
            u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))
        elif pc == FREE:
            u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))
        elif pc == DIVIDE:
            bigint = u.reg_read(UC_ARM_REG_R0)
            divisor = u.reg_read(UC_ARM_REG_R1)
            buffer_address, length = get(bigint), get(bigint + 4)
            value = int.from_bytes(u.mem_read(buffer_address, length), 'little')
            quotient, remainder = divmod(value, divisor)
            u.mem_write(buffer_address, quotient.to_bytes(length, 'little'))
            u.reg_write(UC_ARM_REG_R0, remainder)
            u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))

    u.hook_add(UC_HOOK_CODE, hook)

    def call(pc, *arguments):
        for register, value in zip((UC_ARM_REG_R0, UC_ARM_REG_R1), arguments):
            u.reg_write(register, value)
        u.reg_write(UC_ARM_REG_SP, 0x027E0000)
        u.reg_write(UC_ARM_REG_LR, 0x027F0000)
        u.emu_start(pc, 0x027F0000, count=2_000_000)
        assert u.reg_read(UC_ARM_REG_PC) == 0x027F0000
        return u.reg_read(UC_ARM_REG_R0)

    u.mem_write(codec, bytes(0x530))
    u.mem_write(codec + 0x000, utf16(canonical))
    u.mem_write(codec + 0x07A, utf16(alternates))
    u.mem_write(codec + 0x0F4, utf16(alphabet))
    put(codec + 0x4F4, len(alphabet))

    species = []
    for species_index in range(SPECIES_COUNT):
        at = SPECIES_BASE + species_index * SPECIES_STRIDE
        values = {}
        for offset in BASE_FIELDS:
            size = 2 if offset in (0x30, 0x32, 0x34, 0x36) else (4 if offset >= 0x48 else 1)
            values[f'{offset:02x}'] = get(at + offset, size)
        species.append({'speciesIndex': species_index, 'fields': values})

    hp_curve = 0x020CA008
    tp_curve = 0x020CA00A

    def initialize_team(address, member_addresses, species_ids, variant):
        u.mem_write(address, bytes(0x100))
        mask = (1 << len(species_ids)) - 1
        put(address + 0x3C, mask)
        put(address + 0x40, variant % 5, 1)
        for index in range(3):
            put(address + 0x14 + index * 4, member_addresses[index] if index < len(species_ids) else 0)
            put(address + 0x24 + index * 4, (variant + index) % 4)
        for index, species_id in enumerate(species_ids):
            at = member_addresses[index]
            u.mem_write(at, bytes(0x1C8))
            put(at + 0x004, 0xFFFFFFFF)
            for offset in range(0x140, 0x170, 4):
                put(at + offset, 228)
            put(at + 0x1B8, 0xFFFFFFFF)
            base = species[species_id]['fields']
            personality = variant % 4
            level = variant % 5
            hp_base = get(hp_curve + base['30'] * 16, 2)
            tp_base = get(tp_curve + base['32'] * 16, 2)
            values = {
                0x000: species_id, 0x018: personality,
                0x050: hp_base + (variant * 17 + index * 11) % 256 * 10,
                0x058: hp_base + (variant * 17 + index * 11) % 256 * 10,
                0x054: tp_base + (variant * 13 + index * 7) % 128,
                0x05C: tp_base + (variant * 13 + index * 7) % 128,
                0x084: base['34'] + (variant + index) % 4,
                0x088: base['36'] + (variant + index + 1) % 4,
                0x08C: base['38'] + (variant + index + 2) % 4,
                0x090: base['39'] + (variant + index + 3) % 4,
            }
            for stat_index, offset in enumerate(range(0x94, 0xA8, 4)):
                delta = ((variant + index + stat_index) % 7) - 3
                values[offset] = max(0, base[f'{0x3c + stat_index:02x}'] + delta)
            for offset, value in values.items():
                put(at + offset, value)
            put(at + 0x044, level * 10, 1)
            if personality == base['48']:
                source_pair = (base['50'], base['54'])
            elif personality == base['4c']:
                source_pair = (base['58'], base['5c'])
            else:
                source_pair = (base['60'], base['64'])
            put(at + 0x12C, source_pair[0])
            put(at + 0x130, source_pair[1])

    def read_password():
        raw = bytes(u.mem_read(codec + 0x4F8, 46))
        return raw.decode('utf-16-le').split('\0', 1)[0]

    def summary(address, count):
        output = {'mask': get(address + 0x3C), 'teamField': get(address + 0x40, 1), 'members': []}
        for index in range(count):
            at = get(address + 0x14 + index * 4)
            output['members'].append({
                'speciesIndex': get(at), 'personalityIndex': get(at + 0x18),
                'levelTens': get(at + 0x44, 1), 'maxHp': get(at + 0x58),
                'maxTp': get(at + 0x5C),
                'levels': [get(at + offset) for offset in range(0x84, 0xA8, 4)],
                'sources': [get(at + 0x12C), get(at + 0x130)],
                'extra': get(address + 0x24 + index * 4),
            })
        return output

    cases = ([8], [34, 72], [9, 136, 227], [20, 85, 187], [71, 143, 224])
    vectors = []
    for variant, ids in enumerate(cases):
        initialize_team(team, individuals, ids, variant)
        expected = summary(team, len(ids))
        call(ENCODE, codec, team)
        password = read_password()
        assert 0 < len(password) <= 22
        u.mem_write(decoded, bytes(0x100))
        initialize_team(decoded, decoded_individuals, ids, 0)
        u.mem_write(codec + 0x4F8, utf16(password).ljust(46, b'\0'))
        assert call(DECODE, codec, decoded) == 1
        actual = summary(decoded, len(ids))
        assert actual == expected, (expected, actual)
        vectors.append({'species': list(ids), 'password': password, 'decoded': actual})

    invalid = vectors[0]['password']
    replacement = alphabet[(alphabet.index(invalid[0]) + 1) % len(alphabet)]
    tampered = replacement + invalid[1:]
    u.mem_write(codec + 0x4F8, utf16(tampered).ljust(46, b'\0'))
    assert call(DECODE, codec, decoded) == 0

    catalog = {
        'version': 1,
        'evidence': 'BOUNDED_NATIVE_REPLAY',
        'recordCount': SPECIES_COUNT,
        'source': 'ARM9 020C1374, codec rebuild reads 02093750..0209388C',
        'records': species,
    }
    report = {
        'classification': 'BOUNDED_NATIVE_REPLAY', 'runtimeEligible': False,
        'romSha256': ROM_SHA,
        'sites': {
            'codecInit': 'ARM9 02094DB8..02094FBC',
            'encode': 'ARM9 020950B8..02095244',
            'decode': 'ARM9 02095248..02095428',
            'checksum': 'ARM9 020958DC..02095988',
            'profilePack': 'ARM9 0209338C..02093684',
            'profileRebuild': 'ARM9 02093724..02093890',
        },
        'alphabet': {
            'textBankIds': ['010B', '010C', '010D', '010E'],
            'length': len(alphabet),
            'sha256Utf16Le': hashlib.sha256(alphabet.encode('utf-16-le')).hexdigest(),
            'normalizationBankIds': {'canonical': '0110', 'alternates': '010F'},
        },
        'vectors': vectors,
        'tamperedPasswordRejected': True,
        'boundaries': [
            'Original ARM instructions perform packing, unpacking, checksum, and profile reconstruction.',
            'Host hooks replace allocation/free and the Nintendo DS hardware divider only.',
            'No menu, keyboard rendering, wireless transport, or complete battle is replayed.',
        ],
    }
    Path(args.catalog).write_text(json.dumps(catalog, separators=(',', ':')) + '\n', encoding='utf-8', newline='\n')
    Path(args.out).write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'vectors': len(vectors), 'alphabet': len(alphabet), 'species': len(species)}))


if __name__ == '__main__':
    main()
