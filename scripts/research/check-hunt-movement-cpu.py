"""Controlled ARM instruction probes, separate from untouched DeSmuME replay.

These write synthetic inputs only in a fresh Unicorn scratch machine. They are
arithmetic/branch tests, not claims that those cases happened in the real hunt.
"""
import argparse
import hashlib
import json
import struct
import zlib
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--state', required=True)
    p.add_argument('--out', required=True)
    args = p.parse_args()
    raw = Path(args.state).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == '3b1a13a0e517722f094d0a6454f773a3b2f55b6f0b0994d4788447b5650940ae'
    data = zlib.decompress(raw[32:])
    offset = data.index(struct.pack('<5I', 4, 8, 24, 60, 400)) - 0xC8A4C
    ram = data[offset:offset + 0x400000]
    assert len(ram) == 0x400000
    machine = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    machine.mem_map(0x02000000, 0x800000)
    machine.mem_write(0x02000000, ram)
    def get(a): return struct.unpack('<I', machine.mem_read(a, 4))[0]
    def put(a, n): machine.mem_write(a, struct.pack('<I', n & 0xFFFFFFFF))
    def vec(a): return list(struct.unpack('<3i', machine.mem_read(a, 12)))
    def putvec(a, v): machine.mem_write(a, struct.pack('<3i', *v))
    wild = get(get(get(0x0210AA1C) + 12 + 7 * 4) + 0x704)
    ai, actor = wild + 0x73C, get(wild + 0x34)
    attr = get(get(0x0210AA1C) + 8)
    direction_cases = []
    for flags in [0, 0x20, 0x40, 0x60]:
        for low in range(12):
            for before in [[0, 1, 0], [-3100, 1700, 0]]:
                putvec(actor + 0x24, [16 * 4096, 16 * 4096, 0])
                put(ai + 0x1A0, 0)
                putvec(ai + 0x60, before)
                value = flags | low
                machine.mem_write(get(attr + 8) + 2 * get(attr) + 2, bytes([value]))
                machine.reg_write(UC_ARM_REG_SP, 0x027FF000)
                machine.reg_write(UC_ARM_REG_R0, ai)
                machine.reg_write(UC_ARM_REG_R1, 3)
                machine.emu_start(0x0210D8B4, 0x0210DEEC, count=1000)
                assert machine.reg_read(UC_ARM_REG_PC) == 0x0210DEEC, 'Direction probe exhausted instruction budget'
                direction_cases.append({'attribute': value, 'before': before, 'after': vec(ai + 0x60)})
    grid, bytes_address = 0x02500000, 0x02501000
    for a, v in [(grid, 2), (grid + 4, 2), (grid + 8, bytes_address)]: put(a, v)
    reads = []
    for wrap in [False, True]:
        put(grid + 0x10, int(wrap))
        for values in [[0, 1, 2, 4], [3, 6, 7, 128]]:
            machine.mem_write(bytes_address, bytes(values))
            for x, y in [(0, 0), (1, 0), (0, 1), (1, 1), (-1, 0), (2, 1), (1, -1), (0, 2)]:
                result = {'bytes': values, 'wrap': wrap, 'tile': [x, y]}
                for name, address in [('attribute', 0x02088048), ('terrain', 0x0207C9E8)]:
                    machine.reg_write(UC_ARM_REG_SP, 0x027FF000)
                    machine.reg_write(UC_ARM_REG_LR, 0x027FE000)
                    for register, value in [(UC_ARM_REG_R0, grid), (UC_ARM_REG_R1, x), (UC_ARM_REG_R2, y)]:
                        machine.reg_write(register, value & 0xFFFFFFFF)
                    machine.emu_start(address, 0x027FE000, count=1000)
                    assert machine.reg_read(UC_ARM_REG_PC) == 0x027FE000, 'Grid probe exhausted instruction budget'
                    result[name] = machine.reg_read(UC_ARM_REG_R0)
                reads.append(result)
    output = {'status': 'CONTROLLED_CPU_PROBES_NOT_LIVE_GAMEPLAY',
              'stateSha256': hashlib.sha256(raw).hexdigest(),
              'limits': 'Synthetic direction/grid inputs in isolated Unicorn memory; no DeSmuME or player save writes.',
              'directionCases': direction_cases, 'gridCases': reads}
    with Path(args.out).open('w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(output, indent=2) + '\n')
    print(json.dumps({'directions': len(direction_cases), 'gridCases': len(reads)}))


if __name__ == '__main__':
    main()
