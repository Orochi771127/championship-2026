"""Replay native encounter creation from two real DeSmuME states.

ROM/state bytes stay outside runtime. Requires ndspy, capstone and unicorn.
The field state supplies loaded map/context resources; RNG comes from the
pre-entry state. No RNG result, species or HP is injected into the constructor.
"""
import argparse
import hashlib
import json
import struct
import zlib
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3, UC_ARM_REG_R4, UC_ARM_REG_R8, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rom', required=True)
    parser.add_argument('--before', required=True)
    parser.add_argument('--field', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    raw = Path(args.rom).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom = NintendoDSRom(raw)
    arm = bytes(decompress(rom.arm9))
    overlays = rom.loadArm9Overlays()

    def state(path, overlay):
        blob = Path(path).read_bytes()
        data = zlib.decompress(blob[32:])
        fingerprint = struct.pack('<5I', 4, 8, 24, 60, 400)
        hit = data.find(fingerprint)
        assert hit >= 0 and data.find(fingerprint, hit + 1) == -1
        offset = hit - 0xC8A4C
        ram = data[offset:offset + 0x400000]
        assert len(ram) == 0x400000
        assert ram[0x1000:0x1200] == arm[0x1000:0x1200]
        ovl = overlays[overlay]
        start = ovl.ramAddress - 0x02000000
        assert ram[start:start + 64] == bytes(ovl.data[:64])
        return ram, {'fileName': Path(path).name, 'sha256': hashlib.sha256(blob).hexdigest(),
                     'mainRamSha256': hashlib.sha256(ram).hexdigest(), 'mainRamOffset': offset, 'overlay': overlay}

    before, before_info = state(args.before, 18)
    field, field_info = state(args.field, 0)
    def word(ram, address): return struct.unpack_from('<I', ram, address - 0x02000000)[0]
    def half(ram, address): return struct.unpack_from('<H', ram, address - 0x02000000)[0]
    def rng_state(ram):
        return {'seeds': [word(ram, 0x02104D20 + i * 4) for i in range(217)],
                'cursors': [word(ram, 0x02105084 + i * 4) for i in range(217)]}

    machine = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    machine.mem_map(0x02000000, 0x800000)
    machine.mem_write(0x02000000, field)
    def get(address): return struct.unpack('<I', machine.mem_read(address, 4))[0]
    def put(address, value): machine.mem_write(address, struct.pack('<I', value & 0xffffffff))
    def reg(register): return machine.reg_read(register)
    def ret(value=0):
        machine.reg_write(UC_ARM_REG_R0, value)
        machine.reg_write(UC_ARM_REG_PC, reg(UC_ARM_REG_LR))
    scratch = 0x02500000
    phase, selected_index = 'spawn', 0
    calls, rolls, candidates, boundaries = [], [], [], set()
    for address in [0x02104D20, 0x02105084]:
        machine.mem_write(address, before[address - 0x02000000:address - 0x02000000 + 217 * 4])

    def hook(uc, address, size, data):
        nonlocal scratch
        if phase == 'release' and address == 0x02091390:
            boundaries.add('result_list_selected_index_input')
            ret(selected_index)
        elif phase == 'release' and address in [0x02090D78, 0x0205DB48]:
            boundaries.add('result_list_visual_row_refresh_excluded')
            ret(0x02510000)
        elif address == 0x02050604:
            size = reg(UC_ARM_REG_R0)
            assert 0 < size < 0x10000
            start = scratch
            scratch += (size + 31) & ~31
            boundaries.add('isolated_heap_allocation_for_candidate_arrays')
            ret(start)
        elif address == 0x02050610:
            boundaries.add('isolated_heap_free_noop')
            ret()
        elif address == 0x02062C28:
            boundaries.add('post_constructor_update_excluded_from_spawn_HP_claim')
            ret()
        elif address == 0x020431D4:
            channel = reg(UC_ARM_REG_R0)
            assert channel < 217
            cursor = get(0x02105084 + channel * 4)
            index = 0 if cursor >= 103 else cursor
            seed = get(0x02104D20 + channel * 4)
            # Observation only: original ARM roll executes without interception.
            rolls.append({'channel': channel, 'cursorBefore': cursor, 'seed': seed,
                          'expectedValue': (seed + get(0x020BD23C + index * 4)) % 103})
        elif address == 0x02062100:
            calls.append({'speciesIndex': reg(UC_ARM_REG_R2), 'destination': hex(reg(UC_ARM_REG_R0))})
        elif address == 0x0211A680:
            count, buffer = reg(UC_ARM_REG_R0), reg(UC_ARM_REG_R4)
            candidates.extend(struct.unpack('<' + 'H' * count, machine.mem_read(buffer, count * 2)))

    machine.hook_add(UC_HOOK_CODE, hook)
    put(0x0212ABE4 + 0x68, 0)
    machine.reg_write(UC_ARM_REG_SP, 0x027E0000)
    machine.reg_write(UC_ARM_REG_LR, 0x027F0000)
    machine.emu_start(0x0211A568, 0x0211AA44, count=3000000)
    assert reg(UC_ARM_REG_PC) == 0x0211AA44
    count, pool = word(field, 0x0212ABE4 + 0x68), word(field, 0x0212ABE4 + 0x108)
    assert 0 < count <= 24 and len(calls) == count and get(0x0212ABE4 + 0x68) == count
    manager = word(field, 0x0210AA1C)
    rows = []
    hp_rolls = [roll for roll in rolls if roll['channel'] == 0xB7]
    assert len(hp_rolls) == count
    for i in range(count):
        record = pool + i * 0x1C8
        species, hp = get(record), get(record + 0x50)
        assert species == word(field, record) == calls[i]['speciesIndex']
        assert hp == get(record + 0x58) == word(field, record + 0x50) == word(field, record + 0x58)
        object_base = word(field, manager + 0xC + i * 4)
        wild = word(field, object_base + 0x704)
        assert word(field, object_base + 0x6F4) == 2
        assert word(field, wild + 0x110) == record
        actor = word(field, wild + 0x34)
        species_at = 0x020C1374 + species * 0x84
        rung = half(field, species_at + 0x30)
        rows.append({'wildIndex': i, 'speciesIndex': species, 'speciesId': f'species-{species:03d}',
                     'sourceAddress': hex(record), 'wildAddress': hex(wild), 'actorAddress': hex(actor),
                     'sourceHp': hp, 'wildHp': word(field, wild + 0x4E8), 'maxHp': word(field, wild + 0x4EC),
                     'hpInitialization': {'baseHp': half(field, 0x020CA008 + rung * 16),
                                          'nextRungHp': half(field, 0x020CA008 + min(24, rung + 1) * 16),
                                          'randomB7': hp_rolls[i]['expectedValue']},
                     'positionQ12': [word(field, actor + 0x24), word(field, actor + 0x28)],
                     'aiState': field[wild + 0x73C + 8 - 0x02000000],
                     'gCost': field[species_at + 0x1D - 0x02000000]})
    post_rng = {'seeds': [get(0x02104D20 + i * 4) for i in range(217)],
                'cursors': [get(0x02105084 + i * 4) for i in range(217)]}
    assert post_rng['cursors'][0xB7] == word(field, 0x02105084 + 0xB7 * 4)
    p = word(field, 0x020FBA08)
    # Confirmed result release, ARM9 type=3: card rows precede Home rows.
    # Run the actual compaction writer for first/middle/last and equal-species
    # records. The only UI substitutes are the selected row and row refresh.
    phase = 'release'
    release_vectors = []
    card_address = 0x02520000
    ui = 0x02530000
    for selected_index in [0, 1, 2]:
        machine.mem_write(0x02000000, field)
        put(p + 0x20, card_address)
        put(p + 0x24, 3)
        source_indices = [1, 3, 7]  # species13 HP230, species13 HP220, species10 HP210
        original = [field[pool + i * 0x1C8 - 0x02000000:pool + (i + 1) * 0x1C8 - 0x02000000] for i in source_indices]
        machine.mem_write(card_address, b''.join(original))
        machine.reg_write(UC_ARM_REG_SP, 0x027E0000)
        machine.reg_write(UC_ARM_REG_R8, ui)
        machine.emu_start(0x02059AD0, 0x02059C30, count=1000000)
        assert reg(UC_ARM_REG_PC) == 0x02059C30 and get(p + 0x24) == 2
        expected = original[:selected_index] + original[selected_index + 1:]
        assert bytes(machine.mem_read(card_address, 2 * 0x1C8)) == b''.join(expected)
        release_vectors.append({'selectedIndex': selected_index, 'before': [{'speciesIndex': rows[i]['speciesIndex'], 'hp': rows[i]['sourceHp']} for i in source_indices],
                                'after': [{'speciesIndex': get(card_address + i * 0x1C8), 'hp': get(card_address + i * 0x1C8 + 0x50)} for i in range(2)]})
    receipt = {'status': 'LIVE_STATE_SPAWN_ORDER_AND_HP_REPLAY_PASS_NOT_TOUCH_PARITY', 'romSha256': sha,
               'before': before_info, 'field': field_info, 'nativeGateIndex': word(field, p + 0x10),
               'entry': 'OVL0:0211A568', 'stop': 'OVL0:0211AA44 before actor registration',
               'rngBefore': rng_state(before), 'rngAfterConstructorReplay': post_rng, 'rngObservedField': rng_state(field),
               'candidateSpecies': candidates, 'constructorCalls': calls, 'rngCalls': rolls,
               'wildRecords': rows, 'cardReleaseVectors': release_vectors, 'controlledBoundaries': sorted(boundaries),
               'excluded': ['map transition resource loading', 'post-constructor individual updates',
                            'actor creation and initial position RNG', 'wild AI and tool input', 'live touch playthrough']}
    Path(args.out).write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': receipt['status'], 'gate': receipt['nativeGateIndex'], 'records': len(rows),
                      'rngCalls': len(rolls), 'hpB7Cursor': [rng_state(before)['cursors'][183], post_rng['cursors'][183]]}))

if __name__ == '__main__':
    main()
