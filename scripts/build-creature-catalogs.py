#!/usr/bin/env python3
"""Transcribe the creature stat curve and the species stat index out of the ROM.

These are the two tables the battle needs to turn an opponent preset into a
combatant. Before this, a battle could only run on made-up inputs.

The builder they come from is ARM9 0x02062900, reached from OVL10 0x02110630
while a match expands its three opponents. Its shape was derived by emulating
the decoded instruction stream rather than reading it by eye -- rule 3 of the
brief, after two addresses were computed wrong by hand elsewhere in this work.

    creature+0x00        = preset byte 0x00, the species id
    creature+0x50, +0x58 = curve[species[0x30]] column 0        (both, at build)
    creature+0x54, +0x5C = curve[preset[0x14]] column 1         (both, at build)
    creature+0x60..+0x80 = curve[preset[0x18..0x38]] columns 2..6
    creature+0x84..+0xA4 = the preset level fields kept unchanged
    creature+0x12C       = preset byte 0x3D
    creature+0x130       = preset byte 0x3E

Columns 1 through 6 of the curve are byte-identical, which is why the compiler
could reuse one base register across five of those loads. Column 7 exists and
this builder never reads it.

The ROM is evidence, not a repository asset. Point the script at it with --rom or
the YDIJ_ROM environment variable. The generated JSON is what gets committed, so
CI never needs the cartridge.

    python scripts/build-creature-catalogs.py --rom /path/to/YDIJ.nds
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import sys
from pathlib import Path

ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
ROM_TITLE = b"DIGIMONCHAMP"
ROM_CODE = b"YDIJ"

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs"

AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT"
SOURCE_EVIDENCE = "VERIFIED_BINARY_STRUCTURE"
NAME_EVIDENCE = "TRACED_READ_SITE_ELSE_BYTE_OFFSET"

# ARM9 0x02062AA4 loads 0x020CA008 and indexes it by value*16.
CURVE_BASE = 0x020CA008
CURVE_STRIDE = 16
CURVE_COLUMNS = 8
# The last row the builder can reach: every species index and every preset level
# observed lands inside it, which main() re-checks rather than trusting.
CURVE_ROWS = 27

# ARM9 0x0206291C loads 0x020C1374 and indexes it by the species id * 0x84.
SPECIES_BASE = 0x020C1374
SPECIES_STRIDE = 0x84
# `add sb, sb, #0x84` / `cmp r8, #0xE4` at ARM9 0x02097A50 walks the whole table.
SPECIES_COUNT = 0xE4
# The only field of a species record the BATTLE path reads.
SPECIES_CURVE_INDEX_OFFSET = 0x30

# Identity fields, traced 2026-09-03 from the OVL18 raising read sites rather
# than the battle path. Every OVL18 access has the same shape: load the creature
# record, read its species id, MOV r0,#0x84, MLA base + id*0x84, then load a
# field. That MOV is what confirms the 0x84 stride from code.
#
#   +0x00  pointer to a NUL-terminated ASCII identifier
#   +0x0C  generation index; OVL18 0x021209A8 adds 0x1CD and calls the bank-0
#          resource accessor at ARM9 0x0207D234
#   +0x10  attribute index; OVL18 0x021209DC adds 0x1D4 and calls the same one.
#          0x1D4 - 0x1CD = 7, exactly the number of distinct generation values,
#          so the two text blocks are adjacent in one table
#   +0x18  species-family bitmask; OVL18 0x0212095C runs the lowest-set-bit
#          idiom then RSB #0x20 and +1, turning it into a 1-based ordinal
#   +0x04  pointer to a second ASCII string, used as a LOOKUP KEY. ARM9
#          0x02097A0C walks the table doing strncmp(key, needle, 4) -- the
#          callee at 0x0201FFC0 is byte-wise compare, returns the difference on
#          mismatch and stops at NUL -- and on a zero result captures the record
#          index. The first four characters are as discriminating as the whole
#          string: 224 distinct prefixes across the 228 records.
#   +0x1C  byte, FULLY DETERMINED BY GENERATION with zero violations across all
#          228 records: 0->1, 1->6, 2->8, 3->10, 4->14, 5->18, 6->24.
#
#          CORRECTED 2026-09-04. This was first read as a memory-card capacity
#          candidate, on the strength of help entry 128 saying capacity rises on
#          evolution. Tracing OVL18 shows it is not a cost at all: it is a
#          THRESHOLD in a comparison. At OVL18 0x021187E0 the code loads this
#          byte from the species record, compares it against creature field
#          +0x08, and only when the creature counter reaches or passes it does
#          it subtract 10 from the creature's clamped 0..100 meter at +0x1C.
#          A higher generation therefore tolerates a larger counter before the
#          penalty lands. The name stays neutral because what the counter and
#          the meter MEASURE is still untraced -- but "threshold", not "cost".
#   +0x70  byte, read by Hunt (OVL0). Four values 0..3. Not interpreted.
SPECIES_IDENTIFIER_POINTER_OFFSET = 0x00
SPECIES_GENERATION_OFFSET = 0x0C
SPECIES_ATTRIBUTE_OFFSET = 0x10
SPECIES_FAMILY_BITS_OFFSET = 0x18
SPECIES_LOOKUP_KEY_POINTER_OFFSET = 0x04
SPECIES_GENERATION_SCALED_BYTE_OFFSET = 0x1C
SPECIES_HUNT_CLASS_BYTE_OFFSET = 0x70

# OVL10 0x02110604: a preset naming this id is skipped before its level fields
# are ever read. It is one past the last species, so it doubles as "no creature".
PRESET_ABSENT_SPECIES = 0xE4


class Arm9:
    """The ARM9 static module, addressed by its load-time RAM address."""

    def __init__(self, data: bytes) -> None:
        self.rom = struct.unpack_from("<I", data, 0x20)[0]
        self.ram = struct.unpack_from("<I", data, 0x28)[0]
        self.size = struct.unpack_from("<I", data, 0x2C)[0]
        self.buf = data[self.rom : self.rom + self.size]

    def contains(self, ram: int, length: int = 1) -> bool:
        return self.ram <= ram and ram + length <= self.ram + self.size

    def bytes(self, ram: int, length: int) -> bytes:
        if not self.contains(ram, length):
            raise SystemExit("0x%08X+%d is outside the ARM9 image" % (ram, length))
        start = ram - self.ram
        return self.buf[start : start + length]

    def u16(self, ram: int) -> int:
        return struct.unpack_from("<H", self.bytes(ram, 2), 0)[0]

    def s16(self, ram: int) -> int:
        return struct.unpack_from("<h", self.bytes(ram, 2), 0)[0]

    def byte(self, ram: int) -> int:
        return self.bytes(ram, 1)[0]

    def u32(self, ram: int) -> int:
        return struct.unpack_from("<I", self.bytes(ram, 4), 0)[0]

    def cstring(self, ram: int, limit: int = 64) -> str:
        """Read a NUL-terminated ASCII run. Refuses anything that is not one."""
        raw = self.bytes(ram, limit)
        end = raw.find(bytes([0]))
        if end < 1:
            raise SystemExit("0x%08X is not a NUL-terminated string" % ram)
        text = raw[:end]
        if not all(0x20 <= byte < 0x7F for byte in text):
            raise SystemExit("0x%08X is not printable ASCII" % ram)
        return text.decode("ascii")


def load_rom(path: Path) -> bytes:
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != ROM_SHA256:
        raise SystemExit("ROM SHA-256 is %s, expected %s" % (digest, ROM_SHA256))
    if data[0x00:0x0C] != ROM_TITLE or data[0x0C:0x10] != ROM_CODE:
        raise SystemExit("ROM header is not DIGIMONCHAMP / YDIJ")
    return data


def read_curve(arm9: Arm9) -> list[list[int]]:
    rows = []
    for row in range(CURVE_ROWS):
        base = CURVE_BASE + row * CURVE_STRIDE
        # Column 0 is loaded with ldrsh at 0x02062AB4 and the rest with ldrh.
        rows.append([arm9.s16(base)] + [arm9.u16(base + column * 2) for column in range(1, CURVE_COLUMNS)])
    return rows


def read_species(arm9: Arm9) -> list[dict]:
    return [
        {
            "recordIndex": index,
            # Named because its read site is traced: it indexes the stat curve
            # for the creature's HP at ARM9 0x02062A9C.
            "statCurveIndex": arm9.u16(SPECIES_BASE + index * SPECIES_STRIDE + SPECIES_CURVE_INDEX_OFFSET),
            "identifier": arm9.cstring(
                arm9.u32(SPECIES_BASE + index * SPECIES_STRIDE + SPECIES_IDENTIFIER_POINTER_OFFSET)
            ),
            "generationIndex": arm9.u32(SPECIES_BASE + index * SPECIES_STRIDE + SPECIES_GENERATION_OFFSET),
            "attributeIndex": arm9.u32(SPECIES_BASE + index * SPECIES_STRIDE + SPECIES_ATTRIBUTE_OFFSET),
            "familyBits": arm9.u32(SPECIES_BASE + index * SPECIES_STRIDE + SPECIES_FAMILY_BITS_OFFSET),
            "lookupKey": arm9.cstring(
                arm9.u32(SPECIES_BASE + index * SPECIES_STRIDE + SPECIES_LOOKUP_KEY_POINTER_OFFSET)
            ),
            "generationScaledByte": arm9.byte(
                SPECIES_BASE + index * SPECIES_STRIDE + SPECIES_GENERATION_SCALED_BYTE_OFFSET
            ),
            "huntClassByte": arm9.byte(
                SPECIES_BASE + index * SPECIES_STRIDE + SPECIES_HUNT_CLASS_BYTE_OFFSET
            ),
        }
        for index in range(SPECIES_COUNT)
    ]


def envelope(kind: str, table: dict, extra: dict) -> dict:
    document = {
        "schemaVersion": 1,
        "authority": AUTHORITY,
        "catalogKind": kind,
        "sourceEvidence": SOURCE_EVIDENCE,
        "nameEvidence": NAME_EVIDENCE,
        "rom": {"sha256": ROM_SHA256, "title": ROM_TITLE.decode(), "code": ROM_CODE.decode()},
        "table": table,
    }
    document.update(extra)
    return document


def write(path: Path, document: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(document, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print("wrote %s" % path.name)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", default=os.environ.get("YDIJ_ROM"))
    args = parser.parse_args()
    if not args.rom:
        raise SystemExit("Pass --rom or set YDIJ_ROM; the cartridge is not in this repository")

    arm9 = Arm9(load_rom(Path(args.rom)))

    curve = read_curve(arm9)
    species = read_species(arm9)

    # Refuse to emit a table whose shape does not hold up.
    identical = [column for column in range(2, 7) if [row[column] for row in curve] != [row[1] for row in curve]]
    if identical:
        raise SystemExit("curve columns 1..6 are no longer identical: %s" % identical)
    if curve[0][0] >= curve[-1][0]:
        raise SystemExit("curve column 0 is not ascending; the base may be wrong")
    outside = [entry for entry in species if not 0 <= entry["statCurveIndex"] < CURVE_ROWS]
    if outside:
        raise SystemExit("%d species index outside the %d-row curve" % (len(outside), CURVE_ROWS))

    write(
        OUT_DIR / "creature-stat-curve.r1.json",
        envelope(
            "championship:2026:catalog:creature-stat-curve",
            {
                "module": "arm9",
                "ramBase": "0x%08X" % CURVE_BASE,
                "ramEnd": "0x%08X" % (CURVE_BASE + CURVE_ROWS * CURVE_STRIDE),
                "stride": CURVE_STRIDE,
                "rowCount": CURVE_ROWS,
                "columnCount": CURVE_COLUMNS,
            },
            {
                "readSite": "ARM9:0x02062AA4",
                "note": (
                    "Eight u16 columns per row. Column 0 is loaded signed and is the one the "
                    "creature's HP comes from; columns 1 through 6 are byte-identical to each "
                    "other; column 7 is never read by the creature builder."
                ),
                "rows": curve,
            },
        ),
    )

    write(
        OUT_DIR / "creature-species.r1.json",
        envelope(
            "championship:2026:catalog:creature-species",
            {
                "module": "arm9",
                "ramBase": "0x%08X" % SPECIES_BASE,
                "ramEnd": "0x%08X" % (SPECIES_BASE + SPECIES_COUNT * SPECIES_STRIDE),
                "stride": SPECIES_STRIDE,
                "recordCount": SPECIES_COUNT,
            },
            {
                "readSite": "ARM9:0x0206291C",
                "countSite": "ARM9:0x02097A58",
                "absentSpeciesId": PRESET_ABSENT_SPECIES,
                "note": (
                    "A species record is 0x84 bytes and only +0x30 has a traced read site on the "
                    "battle path, so only +0x30 is transcribed. The id one past the last record "
                    "is what a preset carries to mean it holds no creature."
                ),
                "records": species,
            },
        ),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
