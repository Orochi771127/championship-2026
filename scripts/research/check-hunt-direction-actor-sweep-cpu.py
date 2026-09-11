"""Research-only CPU probe: what the unassigned steering branch actually produces in play.

The 2026-09-10 probe bounded the branch by sweeping both stack words freely. The
live trace of 2026-09-09 showed they are not both free: the second word is the
ARM9 02047D5C animation return address, a constant, and only the first varies
because it is the wild actor's object address.

This sweeps that one remaining variable across every actor address main RAM can
hold, at the one blend rate the shipped maps reach, from every direction the
original's own table can leave the actor in, and reports the resulting cone.

Runs the original ARM9 normalize 02002A6C with the NDS DIV/SQRT units emulated.
Reads the ROM only; writes no production asset and no save.
"""
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

from ndspy.rom import NintendoDSRom
from ndspy.codeCompression import decompress
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_MEM_READ
from unicorn.arm_const import UC_ARM_REG_SP, UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_LR, UC_ARM_REG_PC

ROM_SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
VEC, STOP = 0x02700000, 0x027F0000
Q12 = 4096
# 0210D9E4..0210DAD0 instruction/literal pairs; index == low nibble.
DIRECTIONS = [[0, -4096], [2633, -3138], [3138, -2633], [4096, 0], [3138, 2633], [2633, 3138],
              [0, 4096], [-2633, 3138], [-3138, 2633], [-4096, 0], [-3138, -2633], [-2633, -3138]]
# Live trace 2026-09-09: the second word is this return address, every time.
LIVE_Y = 0x02047944
LIVE_X = 0x0230C484
# Shipped maps reach this branch only through attributes 0x0E, 0x0F and 0x8F.
MAP_BLEND = 0xCD
MAIN_RAM = (0x02000000, 0x02400000)


def build(rom_path):
    raw = Path(rom_path).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    if sha != ROM_SHA:
        raise SystemExit(f"unexpected ROM {sha}")
    rom = NintendoDSRom(raw)
    overlay = rom.loadArm9Overlays()[0]
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(0x02000000, 0x800000)
    u.mem_map(0x04000000, 0x1000)
    u.mem_write(rom.arm9RamAddress, bytes(decompress(rom.arm9)))
    u.mem_write(overlay.ramAddress, bytes(overlay.data))

    def rd(a, n):
        return int.from_bytes(u.mem_read(a, n), "little")

    def wr(a, v, n):
        u.mem_write(a, int(v & ((1 << (8 * n)) - 1)).to_bytes(n, "little"))

    def sgn(v, bits):
        return v - (1 << bits) if v >> (bits - 1) else v

    # The DS divider/sqrt compute on result read; a write hook would consume a
    # half-written 64-bit operand.
    def on_read(uc, access, address, size, value, data):
        if 0x040002A0 <= address < 0x040002B0:
            mode = rd(0x04000280, 2) & 3
            num, den = rd(0x04000290, 8), rd(0x04000298, 8)
            if mode == 0:
                num, den = sgn(num & 0xFFFFFFFF, 32), sgn(den & 0xFFFFFFFF, 32)
            elif mode == 1:
                num, den = sgn(num, 64), sgn(den & 0xFFFFFFFF, 32)
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
    return u


def make_normalize(u):
    def normalize(vector):
        u.mem_write(VEC, struct.pack("<3i", *vector))
        u.reg_write(UC_ARM_REG_SP, 0x027FF000)
        u.reg_write(UC_ARM_REG_R0, VEC)
        u.reg_write(UC_ARM_REG_R1, VEC)
        u.reg_write(UC_ARM_REG_LR, STOP)
        u.emu_start(0x02002A6C, STOP, count=200000)
        if u.reg_read(UC_ARM_REG_PC) != STOP:
            raise SystemExit("normalize did not return")
        return list(struct.unpack("<3i", u.mem_read(VEC, 12)))
    return normalize


def blend(before, target, rate):
    if rate == Q12:
        return list(target)
    out = []
    for i in range(3):
        delta = struct.unpack("<i", struct.pack("<i", target[i] - before[i]))[0]
        out.append(struct.unpack("<i", struct.pack("<I",
                   (before[i] + ((delta * rate + 2048) >> 12)) & 0xFFFFFFFF))[0])
    return out


def degrees(vector):
    return math.degrees(math.atan2(vector[1], vector[0]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rom", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--step", type=lambda s: int(s, 0), default=0x400,
                    help="actor address stride to sweep main RAM at")
    args = ap.parse_args()
    u = build(args.rom)
    normalize = make_normalize(u)

    control = [{"in": d + [0], "out": normalize(d + [0])} for d in DIRECTIONS]
    if any(c["in"] != c["out"] for c in control):
        raise SystemExit("normalize control failed")

    live = normalize([LIVE_X, LIVE_Y, 0])

    addresses = list(range(MAIN_RAM[0], MAIN_RAM[1], args.step))
    if LIVE_X not in addresses:
        addresses.append(LIVE_X)
    # The unassigned branch normalizes the two consumed words, then blends from
    # whatever direction the actor already had.
    targets = {address: normalize([address, LIVE_Y, 0]) for address in addresses}

    # What the branch decides to steer toward. The blend then carries the actor
    # 5% of the way there per update, so the steering target is the quantity the
    # substitute has to match; the blend itself is already exact.
    samples = 0
    lo = (999.0, None)
    hi = (-999.0, None)
    quadrants = set()
    for address, target in targets.items():
        deg = degrees(target)
        quadrants.add((target[0] >= 0, target[1] >= 0))
        samples += 1
        if deg < lo[0]:
            lo = (deg, {"actor": f"{address:08X}", "target": target})
        if deg > hi[0]:
            hi = (deg, {"actor": f"{address:08X}", "target": target})
    # One worked example that the blend on top of it is unchanged.
    blendExample = {"before": DIRECTIONS[4], "target": targets[LIVE_X],
                    "out": blend(DIRECTIONS[4] + [0], targets[LIVE_X], MAP_BLEND)}

    inside = [{"index": i, "targetQ12": d, "deg": round(degrees(d), 4)}
              for i, d in enumerate(DIRECTIONS) if lo[0] <= degrees(d) <= hi[0]]

    report = {
        "evidence": "BOUNDED_NATIVE_REPLAY_WITH_LIVE_CONSTANT",
        "inputClass": "ONE_FREE_WORD_SWEPT_OVER_ALL_OF_MAIN_RAM_SECOND_WORD_FIXED_BY_LIVE_TRACE",
        "romSha256": ROM_SHA,
        "liveProducer": {
            "source": "docs/research/HUNT_STEERING_EDGE_LIVE_2026-09-09.json",
            "xMeaning": "wild actor object address",
            "yMeaning": "ARM9 02047D5C animation return address",
            "yIsConstant": f"{LIVE_Y:08X}",
            "observedX": f"{LIVE_X:08X}",
            "observedNormalized": live,
            "observedDeg": round(degrees(live), 4),
        },
        "sweep": {
            "mainRam": [f"{MAIN_RAM[0]:08X}", f"{MAIN_RAM[1]:08X}"],
            "step": args.step,
            "actorAddresses": len(targets),
            "blendQ12": MAP_BLEND,
            "samples": samples,
            "degMin": round(lo[0], 4),
            "degMax": round(hi[0], 4),
            "spreadDeg": round(hi[0] - lo[0], 4),
            "quadrants": sorted(f"{'+' if x else '-'}x{'+' if y else '-'}y" for x, y in quadrants),
            "witnessMin": lo[1],
            "witnessMax": hi[1],
            "blendExample": blendExample,
        },
        "tableStepDeg": round(abs(degrees(DIRECTIONS[1]) - degrees(DIRECTIONS[0])), 4),
        "tableDirectionsInsideCone": inside,
        "limits": [
            "The second stack word is a constant only for the one live sequence recorded.",
            "Sweeping every main-RAM address bounds the branch; it does not predict which address a given encounter allocates.",
        ],
    }
    Path(args.out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("sweep", "tableStepDeg", "tableDirectionsInsideCone")}, indent=1))


if __name__ == "__main__":
    main()
