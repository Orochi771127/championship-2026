"""Controlled ARM probes for range sampling and spawn terrain repair.

This uses an isolated Unicorn copy, with synthetic RNG/grid inputs. It is not
the untouched DeSmuME normal-entry receipt and cannot authorize a fixed spawn.
"""
import argparse
import hashlib
import json
import struct
import zlib
from pathlib import Path
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--state', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    raw = Path(args.state).read_bytes()
    state_sha = hashlib.sha256(raw).hexdigest()
    assert state_sha == '3b1a13a0e517722f094d0a6454f773a3b2f55b6f0b0994d4788447b5650940ae'
    data = zlib.decompress(raw[32:])
    fingerprint = struct.pack('<5I', 4, 8, 24, 60, 400)
    offset = data.index(fingerprint) - 0xC8A4C
    assert data.find(fingerprint, offset + 0xC8A4C + 1) == -1
    ram = data[offset:offset + 0x400000]
    machine = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    machine.mem_map(0x02000000, 0x800000)
    machine.mem_write(0x02000000, ram)
    get = lambda a: struct.unpack('<I', machine.mem_read(a, 4))[0]
    put = lambda a, n: machine.mem_write(a, struct.pack('<I', n & 0xFFFFFFFF))
    reg = machine.reg_read
    stop, grid, cells, xy = 0x027FE000, 0x02500000, 0x02501000, 0x02508000
    draws, channels, queries = [], [], []

    def hook(uc, address, size, user):
        if address == 0x020431D4:
            channels.append(reg(UC_ARM_REG_R0))
            machine.reg_write(UC_ARM_REG_R0, draws[len(channels) - 1])
            machine.reg_write(UC_ARM_REG_PC, reg(UC_ARM_REG_LR))
        if address == 0x0207C930:
            queries.append([reg(UC_ARM_REG_R1), reg(UC_ARM_REG_R2)])

    machine.hook_add(UC_HOOK_CODE, hook)

    def execute(entry, r0, r1, r2=0):
        for register, value in [(UC_ARM_REG_SP, 0x027FF000), (UC_ARM_REG_LR, stop),
                                (UC_ARM_REG_R0, r0), (UC_ARM_REG_R1, r1), (UC_ARM_REG_R2, r2)]:
            machine.reg_write(register, value & 0xFFFFFFFF)
        machine.emu_start(entry, stop, count=100000)
        assert reg(UC_ARM_REG_PC) == stop, 'Probe did not return'
        return reg(UC_ARM_REG_R0)

    ranges = []
    for bound in [1, 2, 32, 1024, 32767]:
        for parity in [0, 1]:
            for value in range(103):
                draws, channels = [parity, value], []
                result = execute(0x0210B5E4, 0, bound)
                assert channels == [0, 0xB2 if parity == 0 else 0xB3]
                ranges.append({'range': bound, 'draws': draws, 'channels': channels, 'value': result})

    put(get(0x0210AA1C) + 4, grid)
    repairs = []
    cases = [(6, 6, [2, 2], opens) for opens in [
        [[2, 2]], [[3, 2], [1, 2]], [[2, 3], [2, 1]],
        [[3, 3], [3, 1], [1, 3], [1, 1]], [[0, 2]], [[2, 0]], [],
    ]] + [(6, 6, [1, 1], [[3, 4]]), (6, 6, [0, 0], [[1, 0]]),
          (128, 128, [2, 2], [[52, 2]]), (128, 128, [2, 2], [[53, 2]])]
    for width, height, before, open_tiles in cases:
        for a, n in [(grid, width), (grid + 4, height), (grid + 8, cells), (grid + 0x10, 0),
                     (xy, before[0]), (xy + 4, before[1])]: put(a, n)
        values = bytearray([1]) * (width * height)
        for x, y in open_tiles: values[y * width + x] = 0
        machine.mem_write(cells, bytes(values))
        queries = []
        radius = execute(0x0210C408, 0, xy, xy + 4)
        repairs.append({'width': width, 'height': height, 'before': before, 'openTiles': open_tiles,
                        'radius': radius, 'after': [get(xy), get(xy + 4)], 'queries': queries})
    out = {'status': 'CONTROLLED_CPU_PROBES_NOT_LIVE_GAMEPLAY', 'stateSha256': state_sha,
           'rangeCases': ranges, 'repairCases': repairs}
    with Path(args.out).open('w', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(out, indent=2) + '\n')
    print(json.dumps({'ranges': len(ranges), 'repairs': len(repairs)}))


if __name__ == '__main__':
    main()
