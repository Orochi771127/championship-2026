"""Compare bounded animation primitives against original ARM9/OVL0 code.

Synthetic frame banks are explicit CPU inputs. No ROM bytes or graphics are
exported. This proves the selectors/player, not a normal gameplay host.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn.arm_const import UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_SP, UC_ARM_REG_LR, UC_ARM_REG_PC


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--rom', required=True)
    p.add_argument('--out', required=True)
    args = p.parse_args()
    raw = Path(args.rom).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
    rom = NintendoDSRom(raw)
    arm, ovl = bytes(decompress(rom.arm9)), rom.loadArm9Overlays()[0]
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x400000)
    u.mem_write(0x02000000, arm)
    u.mem_write(ovl.ramAddress, bytes(ovl.data))
    W, A, S, F = 0x02300000, 0x02301000, 0x02302000, 0x02303000
    STOP, STACK = 0x023F0000, 0x023E0000
    def put(a, v): u.mem_write(a, struct.pack('<I', v & 0xffffffff))
    def word(a): return struct.unpack('<I', u.mem_read(a, 4))[0]
    def run(pc, r0, r1=0, end=STOP):
        for r, v in [(UC_ARM_REG_R0, r0), (UC_ARM_REG_R1, r1), (UC_ARM_REG_SP, STACK), (UC_ARM_REG_LR, STOP)]:
            u.reg_write(r, v)
        u.emu_start(pc, end, count=100000)
        assert u.reg_read(UC_ARM_REG_PC) == end
    selectors = []
    put(W + 0x34, A)
    for flags in range(8):
        values = [(flags >> bit) & 1 for bit in range(3)]
        for offset, value in zip([0x10C, 0x334, 0x40C], values): put(W + offset, value)
        for bound in [0, 1]:
            put(W + 0x118, bound)
            for request in range(40):
                run(0x0210C048, W, request, 0x02047984)
                assert u.reg_read(UC_ARM_REG_R0) == A
                selectors.append({'request': request, 'bound': bound, 'overrideFlags': values,
                                  'sequenceId': u.reg_read(UC_ARM_REG_R1)})
    players = []
    for mode in [1, 2]:
        for durations in [[1], [2, 3], [1, 2, 3, 4], [31, 22]]:
            for loop_start in range(len(durations)):
                for delta in [2048, 4096, 8192, 24576]:
                    u.mem_write(A, bytes(0x100))
                    u.mem_write(S, struct.pack('<HHIII', len(durations), loop_start, 65536, mode, F))
                    for i, duration in enumerate(durations):
                        u.mem_write(F + i * 8, struct.pack('<IHH', 0x02304000 + i * 4, duration, 0xBEEF))
                        put(0x02304000 + i * 4, i)
                    put(A + 0x14, 4096)
                    put(A + 0xC, 1)
                    run(0x0202E438, A, S)
                    samples = []
                    for tick in range(1, 130):
                        run(0x0202E188, A, delta)
                        samples.append({'tick': tick, 'frameIndex': (word(A) - F) // 8,
                                        'elapsedQ12': word(A + 0x10), 'active': word(A + 0xC)})
                    players.append({'mode': mode, 'durations': durations, 'loopStartFrame': loop_start,
                                    'deltaQ12': delta, 'samples': samples})
    out = {'romSha256': sha, 'arm9Sha256': hashlib.sha256(arm).hexdigest(),
           'overlay': {'index': 0, 'sha256': hashlib.sha256(ovl.data).hexdigest()},
           'status': 'BOUNDED_ORIGINAL_CPU_ANIMATION_PRIMITIVES',
           'executed': ['OVL0:0210C048->ARM9:02047984', 'ARM9:0202E438', 'ARM9:0202E188'],
           'boundaries': ['synthetic actor and NANR memory', 'no rendering or gameplay host'],
           'selectors': selectors, 'players': players}
    with Path(args.out).open('w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(out, indent=2) + '\n')
    print(json.dumps({'selectors': len(selectors), 'playerCases': len(players),
                      'playerSteps': sum(len(p['samples']) for p in players)}))


if __name__ == '__main__': main()
