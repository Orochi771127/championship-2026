#!/usr/bin/env python3
"""Transcribe the channel RNG: the 103-entry table and the header that owns it.

ARM9 0x020431D4 is the roll; ARM9 0x02043240 is the seeder. The header at
0x020BD230 holds the channel count and the two array pointers, and it is the
only way to reach either array -- a whole-image scan finds the seed pointer
0x02104D20 and the cursor pointer 0x02105084 nowhere except inside that header,
so nothing outside these two functions can perturb the generator.

The ROM is evidence, not a repository asset. Point the script at it with --rom
or the YDIJ_ROM environment variable.

    python scripts/build-rng-channel-catalog.py --rom /path/to/YDIJ.nds
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import sys
from collections import Counter
from pathlib import Path

ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
ROM_TITLE = b"DIGIMONCHAMP"
ROM_CODE = b"YDIJ"

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs"
OUT_NAME = "rng-channels.r1.json"

HEADER = 0x020BD230
TABLE = 0x020BD23C
MODULUS = 0x67  # cmp r1,#0x67 at 0x020431EC bounds the cursor
MAGIC = 0x13E22CBD
MAGIC_SHIFT = 3


class Arm9:
    def __init__(self, data):
        self.rom = struct.unpack_from("<I", data, 0x20)[0]
        self.ram = struct.unpack_from("<I", data, 0x28)[0]
        self.size = struct.unpack_from("<I", data, 0x2C)[0]
        self.buf = data[self.rom:self.rom + self.size]

    def u32(self, ram):
        start = ram - self.ram
        if start < 0 or start + 4 > len(self.buf):
            raise SystemExit("0x%08X is outside the ARM9 image" % ram)
        return struct.unpack_from("<I", self.buf, start)[0]

    def find_u32(self, value):
        pattern = struct.pack("<I", value)
        out, at = [], 0
        while True:
            at = self.buf.find(pattern, at)
            if at < 0:
                return out
            if at % 4 == 0:
                out.append(self.ram + at)
            at += 1


def build(arm9):
    channel_count = arm9.u32(HEADER)
    cursor_array = arm9.u32(HEADER + 4)
    seed_array = arm9.u32(HEADER + 8)
    table = [arm9.u32(TABLE + index * 4) for index in range(MODULUS)]

    # Neither array pointer may appear anywhere but in the header, or something
    # outside the two traced functions could be writing the generator's state.
    for name, pointer in (("cursor", cursor_array), ("seed", seed_array)):
        sites = arm9.find_u32(pointer)
        expected = [HEADER + (4 if name == "cursor" else 8)]
        if sites != expected:
            raise SystemExit("the %s array pointer is reachable from %s, not just the header"
                             % (name, ["0x%08X" % site for site in sites]))
    if seed_array + channel_count * 4 != cursor_array:
        raise SystemExit("the seed and cursor arrays are not adjacent")

    counts = Counter(table)
    missing = [value for value in range(MODULUS) if value not in counts]
    duplicated = sorted(value for value, count in counts.items() if count > 1)
    if len(table) != MODULUS:
        raise SystemExit("the table is not %d entries" % MODULUS)
    if max(table) >= MODULUS:
        raise SystemExit("a table entry is not a residue")

    # The word one past the reachable table is still a residue, and the one
    # after that is not. The cursor bound, not the data, is what ends the table.
    first_past = arm9.u32(TABLE + MODULUS * 4)
    second_past = arm9.u32(TABLE + (MODULUS + 1) * 4)
    if first_past >= MODULUS or second_past < MODULUS:
        raise SystemExit("the boundary past the table does not read as expected")

    return {
        "schemaVersion": 1,
        "authority": "CHAMPIONSHIP_2026_PRODUCT",
        "catalogKind": "championship:2026:catalog:rng-channels",
        "sourceEvidence": "VERIFIED_BINARY_STRUCTURE",
        "rom": {"sha256": ROM_SHA256, "title": ROM_TITLE.decode(), "code": ROM_CODE.decode()},
        "generator": {
            "rollSite": "ARM9:0x020431D4",
            "seedSite": "ARM9:0x02043240",
            "headerBase": "0x%08X" % HEADER,
            "channelCount": channel_count,
            "cursorArray": "0x%08X" % cursor_array,
            "seedArray": "0x%08X" % seed_array,
            "modulus": MODULUS,
            "divisionMagic": "0x%08X" % MAGIC,
            "divisionShift": MAGIC_SHIFT,
            "rollFormula": (
                "roll(channel) = (seed[channel] + table[cursor[channel]]) % 103, with a "
                "signed truncating remainder built from smull by 0x13E22CBD and asr #3. "
                "The cursor resets to 0 on entry when it has reached 103 and is then "
                "post-incremented; the seed is never written, so one channel is a fixed "
                "cycle of period 103."
            ),
            "seedFormula": (
                "seed[0] = master, cursor[0] = master % 103. For each channel 1..216 the "
                "seeder rolls channel 0 twice: the first roll accumulates into the seed "
                "running total and the second into the cursor running total, then "
                "seed[ch] = the seed total and cursor[ch] = the cursor total % 103."
            ),
            "stateIsolationEvidence": (
                "the seed pointer 0x%08X and the cursor pointer 0x%08X each occur exactly "
                "once in the whole ARM9 image, inside the header, so only the roll and the "
                "seeder can touch the arrays" % (seed_array, cursor_array)
            ),
            "seedingCallSites": [
                {"site": "ARM9:0x02000C90", "master": "0", "note":
                 "boot; a master of 0 takes the clock path at 0x0201034C, which is "
                 "environmental and not reproducible from the ROM"},
                {"site": "ARM9:0x0206AD6C", "master": "loaded from a struct at +0x0C",
                 "note": "a stored master seed; the struct is not traced"},
                {"site": "OVL9:0x021775DC", "master": "0x14",
                 "note": "a hard-coded constant, so this reseed is fully reproducible"},
            ],
        },
        "table": {
            "ramBase": "0x%08X" % TABLE,
            "ramEnd": "0x%08X" % (TABLE + MODULUS * 4),
            "entryCount": MODULUS,
            "boundaryEvidence": (
                "the cursor bound `cmp r1,#0x67` at ARM9:0x020431EC is what ends the table: "
                "the word at 0x%08X is %d, still a residue and never read, and the word "
                "after it is 0x%08X, which is not"
                % (TABLE + MODULUS * 4, first_past, second_past)
            ),
            "entries": table,
        },
        "distribution": {
            "distinctValues": len(counts),
            "valuesNeverInTable": missing,
            "valuesTwiceInTable": duplicated,
            "note": (
                "the table is not a permutation of 0..102, so a roll is not uniform. Over "
                "one full 103-roll cycle a threshold test `roll < T` hits exactly T times "
                "only where the shifted duplicates and gaps fall above T; elsewhere it is "
                "off by one. Which thresholds those are depends on the channel's seed."
            ),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", default=os.environ.get("YDIJ_ROM"),
                        help="path to the retail YDIJ cartridge image (or set YDIJ_ROM)")
    parser.add_argument("--out", default=str(OUT_DIR), help="catalog output directory")
    args = parser.parse_args()

    if not args.rom:
        parser.error("no ROM given: pass --rom PATH or set YDIJ_ROM. The ROM is "
                     "evidence and is never stored in this repository.")
    rom_path = Path(args.rom)
    if not rom_path.is_file():
        parser.error("ROM not found: %s" % rom_path)

    data = rom_path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != ROM_SHA256:
        raise SystemExit("ROM sha256 %s is not the transcribed cartridge" % digest)
    if data[0x00:0x0C] != ROM_TITLE or data[0x0C:0x10] != ROM_CODE:
        raise SystemExit("header title/code is not DIGIMONCHAMP / YDIJ")

    payload = build(Arm9(data))
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / OUT_NAME
    with target.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(payload, indent=2, ensure_ascii=True) + "\n")
    print("%d channels, %d-entry table, %d distinct values -> %s"
          % (payload["generator"]["channelCount"], payload["table"]["entryCount"],
             payload["distribution"]["distinctValues"], target.name))
    return 0


if __name__ == "__main__":
    sys.exit(main())
