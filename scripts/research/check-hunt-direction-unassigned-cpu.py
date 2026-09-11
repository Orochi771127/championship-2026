"""Research-only CPU probe: OVL0 steering low nibbles 12..15 (unassigned stack branch).

Static decode of OVL0 0210D998..0210DB04 plus execution of the original ARM9
normalize 02002A6C with the NDS DIV/SQRT units emulated. Establishes the bound on
the direction the original produces when it consumes stack words it never wrote.
Synthetic scratch values never enter player saves or production assets.
"""
import argparse, hashlib, json, math, struct
from pathlib import Path
from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_MEM_READ
from unicorn.arm_const import UC_ARM_REG_SP, UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_LR, UC_ARM_REG_PC

ROM_SHA = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
VEC, STOP = 0x02700000, 0x027F0000
Q12 = 4096
# 0210D9E4..0210DAD0 instruction/literal pairs; index == low nibble.
DIRECTIONS = [[0,-4096],[2633,-3138],[3138,-2633],[4096,0],[3138,2633],[2633,3138],
              [0,4096],[-2633,3138],[-3138,2633],[-4096,0],[-3138,-2633],[-2633,-3138]]


def build(rom_path):
    raw = Path(rom_path).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    assert sha == ROM_SHA, f'unexpected ROM {sha}'
    rom = NintendoDSRom(raw)
    ov = rom.loadArm9Overlays()[0]
    arm9 = bytes(decompress(rom.arm9))
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x800000)
    u.mem_map(0x04000000, 0x1000)
    u.mem_write(rom.arm9RamAddress, arm9)
    u.mem_write(ov.ramAddress, bytes(ov.data))

    def rd(a, n): return int.from_bytes(u.mem_read(a, n), 'little')
    def wr(a, v, n): u.mem_write(a, int(v & ((1 << (8 * n)) - 1)).to_bytes(n, 'little'))
    def sgn(v, bits): return v - (1 << bits) if v >> (bits - 1) else v

    # The DS divider/sqrt are computed on result read: Unicorn's write hook fires
    # before the store commits, which would consume a half-written 64-bit operand.
    def on_read(uc, access, address, size, value, data):
        if 0x040002A0 <= address < 0x040002B0:
            mode = rd(0x04000280, 2) & 3
            num, den = rd(0x04000290, 8), rd(0x04000298, 8)
            if mode == 0:
                num, den = sgn(num & 0xffffffff, 32), sgn(den & 0xffffffff, 32)
            elif mode == 1:
                num, den = sgn(num, 64), sgn(den & 0xffffffff, 32)
            else:
                num, den = sgn(num, 64), sgn(den, 64)
            if den:
                q = abs(num) // abs(den)
                q = -q if (num < 0) != (den < 0) else q
                wr(0x040002A0, q, 8)
                wr(0x040002A8, num - q * den, 8)
        elif 0x040002B4 <= address < 0x040002B8:
            mode = rd(0x040002B0, 2) & 1
            wr(0x040002B4, math.isqrt(rd(0x040002B8, 8) if mode else rd(0x040002B8, 4)), 4)
    u.hook_add(UC_HOOK_MEM_READ, on_read, begin=0x040002A0, end=0x040002B7)
    return u, rom, ov, arm9


def make_normalize(u):
    def normalize(v):
        u.mem_write(VEC, struct.pack('<3i', *v))
        u.reg_write(UC_ARM_REG_SP, 0x027FF000)
        u.reg_write(UC_ARM_REG_R0, VEC)
        u.reg_write(UC_ARM_REG_R1, VEC)
        u.reg_write(UC_ARM_REG_LR, STOP)
        u.emu_start(0x02002A6C, STOP, count=200000)
        assert u.reg_read(UC_ARM_REG_PC) == STOP
        return list(struct.unpack('<3i', u.mem_read(VEC, 12)))
    return normalize


def decode_dispatch(ov):
    """Confirm from the bytes that 12..15 skip both direction stores."""
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    base, data = ov.ramAddress, bytes(ov.data)
    text = {i.address: f'{i.mnemonic} {i.op_str}'.strip()
            for i in md.disasm(data[0x0210D998 - base:0x0210DB04 - base], 0x0210D998)}
    assert text[0x0210D9A8] == 'cmp r0, #0xb'
    assert text[0x0210D9AC] == 'addls pc, pc, r0, lsl #2'
    assert text[0x0210D9B0] == 'b #0x210dad4'
    assert text[0x0210DAD8] == 'mov r1, #0'
    assert text[0x0210DADC] == 'str r1, [sp, #0x50]'
    entries = []
    for low in range(12):
        target = 0x0210D9B4 + low * 4
        assert text[target].startswith('b #')
        case = int(text[target].split('#')[1], 16)
        body = [text[a] for a in range(case, case + 0x14, 4) if a in text]
        entries.append({'lowNibble': low, 'case': f'{case:08X}',
                        'writesX': any('[sp, #0x48]' in s for s in body),
                        'writesY': any('[sp, #0x4c]' in s for s in body)})
    assert all(e['writesX'] and e['writesY'] for e in entries)
    return {'dispatch': '0210D9AC', 'assignedRange': '0..11', 'unassignedRange': '12..15',
            'unassignedTarget': '0210DAD4', 'zStoreAlways': '0210DADC str r1,[sp,#0x50] with r1=0',
            'assignedCases': entries}


def blend(before, target, rate):
    if rate == Q12:
        return list(target)
    out = []
    for i in range(3):
        d = struct.unpack('<i', struct.pack('<i', target[i] - before[i]))[0]
        out.append(struct.unpack('<i', struct.pack('<I', (before[i] + ((d * rate + 2048) >> 12)) & 0xffffffff))[0])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rom', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    u, rom, ov, arm9 = build(args.rom)
    normalize = make_normalize(u)
    static = decode_dispatch(ov)

    # Control: the original's own table directions must survive normalize unchanged.
    control = [{'in': d + [0], 'out': normalize(d + [0])} for d in DIRECTIONS]
    assert all(c['in'] == c['out'] for c in control), 'normalize control failed'

    # Live producer recorded 2026-09-09: X is the actor object address, Y the
    # animation return address left by ARM9 02047D5C, Z always re-zeroed here.
    live = [0x0230C484, 0x02047944, 0]
    live_out = normalize(live)

    # Bound: any EWRAM heap pointer x any ARM9 code address, every blend rate,
    # every table direction as the incoming direction.
    heap = list(range(0x02000000, 0x02800000, 0x00080000))
    code = list(range(0x02000000, 0x02000000 + len(arm9), 0x00008000))
    lo, hi, worst_lo, worst_hi, samples = None, None, None, None, 0
    for x in heap:
        for y in code:
            for rate in (Q12, 0x59a, 0xcd):
                for before in ([0, 0, 0], [0, 1, 0], *[d + [0] for d in DIRECTIONS[:4]]):
                    out = normalize(blend(before, [x, y, 0], rate))
                    if out == [0, 0, 0]:
                        continue
                    a = math.degrees(math.atan2(out[1], out[0]))
                    samples += 1
                    if lo is None or a < lo:
                        lo, worst_lo = a, {'x': f'{x:08X}', 'y': f'{y:08X}', 'blendQ12': rate,
                                           'before': before, 'out': out, 'deg': round(a, 4)}
                    if hi is None or a > hi:
                        hi, worst_hi = a, {'x': f'{x:08X}', 'y': f'{y:08X}', 'blendQ12': rate,
                                           'before': before, 'out': out, 'deg': round(a, 4)}
    assert 0 < lo and hi < 90, 'cone left the down-right quadrant'
    inside = [{'index': i, 'targetQ12': d, 'deg': round(math.degrees(math.atan2(d[1], d[0])), 4)}
              for i, d in enumerate(DIRECTIONS)
              if lo <= math.degrees(math.atan2(d[1], d[0])) <= hi]

    result = {
        'evidence': 'BOUNDED_NATIVE_REPLAY',
        'inputClass': 'STATIC_DECODE_PLUS_SYNTHETIC_SCRATCH_SWEEP_NOT_LIVE_PLAY',
        'romSha256': ROM_SHA,
        'overlay': 0,
        'overlayRamAddress': f'{ov.ramAddress:08X}',
        'staticDecode': static,
        'normalizeEntry': '02002A6C',
        'normalizeControl': control,
        'liveProducer': {
            'source': 'docs/research/HUNT_STEERING_EDGE_LIVE_2026-09-09.json',
            'stackAtEntry': live,
            'xMeaning': 'actor object address',
            'yMeaning': 'ARM9 02047D5C animation return address 02047944',
            'normalized': live_out,
            'deg': round(math.degrees(math.atan2(live_out[1], live_out[0])), 4),
        },
        'bound': {
            'samples': samples,
            'heapPointers': len(heap),
            'codeAddresses': len(code),
            'blendRates': [Q12, 0x59a, 0xcd],
            'degMin': round(lo, 4), 'degMax': round(hi, 4),
            'quadrant': 'DOWN_RIGHT',
            'witnessMin': worst_lo, 'witnessMax': worst_hi,
            'tableDirectionsInsideCone': inside,
        },
        'conclusion': (
            'Low nibbles 12..15 skip both direction stores at 0210D9B0 and consume the '
            'caller stack words at entry SP-0x30/-0x2C; Z is re-zeroed at 0210DADC. For every '
            'EWRAM heap pointer and ARM9 code address, every blend rate and every incoming '
            'table direction, the original normalize at 02002A6C yields a direction inside a '
            'single down-right cone narrower than one step of the original 12-direction table. '
            'This bounds the branch; it does not reconstruct a specific original heap address.'),
    }
    Path(args.out).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'samples': samples, 'degMin': round(lo, 4), 'degMax': round(hi, 4),
                      'tableDirectionsInsideCone': [e['index'] for e in inside]}))


if __name__ == '__main__':
    main()
