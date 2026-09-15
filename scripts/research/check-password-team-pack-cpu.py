"""Re-verify PASSWORD_TEAM_PACK_CPU_2026-09-15.json against the original encoder.

Each receipt vector is written into a 0x44-byte team struct and 0x1C8-byte
native individuals, then the hash-locked YDIJ ARM9 runs PROFILE_PACK
(0209338C) per member and ENCODE (020950B8) for the team. Only allocation,
free and the Nintendo DS hardware divider are host hooks, as in
check-password-battle-cpu.py; the text banks are written directly instead of
running CODEC_INIT, which reads them through the text system.
"""
import importlib.util
import json
from pathlib import Path

from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_LR, UC_ARM_REG_PC, UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_SP

from hunt_original_probe import load_rom, ROM_SHA

ENCODE, PROFILE_PACK = 0x020950B8, 0x0209338C
MALLOC, FREE, DIVIDE = 0x02050604, 0x02050610, 0x020957F0
REPO = Path(__file__).resolve().parents[2]
RECEIPT = REPO / 'docs' / 'research' / 'PASSWORD_TEAM_PACK_CPU_2026-09-15.json'


def text_banks(rom):
    spec = importlib.util.spec_from_file_location('championship_text_bank', REPO / 'scripts' / 'build-tutorial-steps.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, chunks = module.read_bank(rom)
    return [module.decode(chunks[index]) for index in range(0x10B, 0x111)]


def main():
    receipt = json.loads(RECEIPT.read_text(encoding='utf-8'))
    assert receipt['romSha256'] == ROM_SHA
    rom, arm, _ = load_rom()
    banks = text_banks(rom)
    alphabet = ''.join(sorted(''.join(banks[:4]), key=ord))
    canonical, alternates = banks[5], banks[4]

    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x00800000)
    u.mem_write(0x02000000, arm)
    codec, team, compact = 0x02400000, 0x02401000, 0x02402000
    individuals = [0x02403000 + index * 0x200 for index in range(3)]
    heap = [0x02500000]

    def get(address, size=4):
        return int.from_bytes(u.mem_read(address, size), 'little')

    def put(address, value, size=4):
        u.mem_write(address, (value & ((1 << (size * 8)) - 1)).to_bytes(size, 'little'))

    def hook(_u, pc, _size, _data):
        if pc == MALLOC:
            size = u.reg_read(UC_ARM_REG_R0)
            result = heap[0]
            heap[0] = (heap[0] + size + 15) & ~15
            u.mem_write(result, bytes(size))
            u.reg_write(UC_ARM_REG_R0, result)
            u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))
        elif pc == FREE:
            u.reg_write(UC_ARM_REG_PC, u.reg_read(UC_ARM_REG_LR))
        elif pc == DIVIDE:
            bigint, divisor = u.reg_read(UC_ARM_REG_R0), u.reg_read(UC_ARM_REG_R1)
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
        u.emu_start(pc, 0x027F0000, count=5_000_000)
        assert u.reg_read(UC_ARM_REG_PC) == 0x027F0000

    def utf16(text):
        return text.encode('utf-16-le') + b'\0\0'

    for number, vector in enumerate(receipt['vectors']):
        heap[0] = 0x02500000
        u.mem_write(codec, bytes(0x530))
        u.mem_write(codec + 0x000, utf16(canonical))
        u.mem_write(codec + 0x07A, utf16(alternates))
        u.mem_write(codec + 0x0F4, utf16(alphabet))
        put(codec + 0x4F4, len(alphabet))
        u.mem_write(team, bytes(0x100))
        mask = 0
        for slot, member in enumerate(vector['members']):
            put(team + 0x24 + slot * 4, 1)
            if not member:
                continue
            mask |= 1 << slot
            at = individuals[slot]
            u.mem_write(at, bytes(0x1C8))
            for key, value in member['fields'].items():
                put(at + int(key, 16), value)
            put(at + 0x044, member['narrow044'], 1)
            put(team + 0x14 + slot * 4, at)
            put(team + 0x24 + slot * 4, member['extra'])
            u.mem_write(compact, bytes(0x38))
            call(PROFILE_PACK, compact, at)
            assert [get(compact + offset) for offset in range(0, 0x38, 4)] == member['compact'], (number, slot)
        put(team + 0x3C, mask)
        put(team + 0x40, vector['teamField'], 1)
        call(ENCODE, codec, team)
        password = bytes(u.mem_read(codec + 0x4F8, 46)).decode('utf-16-le').split('\0', 1)[0]
        assert password == vector['password'], (number, password, vector['password'])
    print(json.dumps({'verified': len(receipt['vectors'])}))


if __name__ == '__main__':
    main()
