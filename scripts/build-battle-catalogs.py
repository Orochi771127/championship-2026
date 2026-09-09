#!/usr/bin/env python3
"""Transcribe the six original battle tables out of the retail ROM into product catalogs.

Every number here is read back out of the cartridge image on each run. Nothing is
copied from a research pack, and no field is named unless a read site was traced;
untraced fields keep their byte offset as their name.

The ROM is evidence, not a repository asset. Point the script at it with --rom or
the YDIJ_ROM environment variable. The generated JSON is what gets committed, so
CI never needs the cartridge.

    python scripts/build-battle-catalogs.py --rom /path/to/YDIJ.nds
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


class Arm9:
    """The ARM9 static module, addressed by its load-time RAM address.

    The header carries the ROM offset, the RAM base and the size, so no file
    offset is hard-coded. This image is stored uncompressed, which is what the
    move-table probe in main() checks before anything is transcribed.
    """

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

    def u32(self, ram: int) -> int:
        return struct.unpack_from("<I", self.bytes(ram, 4), 0)[0]

    def ascii_at(self, ram: int, limit: int = 64) -> str:
        raw = self.bytes(ram, limit)
        end = raw.find(b"\0")
        if end < 0:
            raise SystemExit("unterminated string at 0x%08X" % ram)
        return raw[:end].decode("ascii")


# Widths are the ones the traced load instructions use. Where nothing was traced
# the width is the widest little-endian unit whose high bytes are constant zero
# across the whole table; every such field says so in its fieldMap entry.
READERS = {
    "u8": lambda rec, off: rec[off],
    "s8": lambda rec, off: struct.unpack_from("<b", rec, off)[0],
    "u16": lambda rec, off: struct.unpack_from("<H", rec, off)[0],
    "u32": lambda rec, off: struct.unpack_from("<I", rec, off)[0],
    "s32": lambda rec, off: struct.unpack_from("<i", rec, off)[0],
}

# --- table definitions -------------------------------------------------------
# A field is (offset, width, name, readSite). readSite is the ROM address of a
# load that proves the width and, where the surrounding code says so, the
# meaning. None means no read site was traced, so the name is the byte offset.

MOVES = {
    "key": "battle-moves",
    "catalogKind": "championship:2026:catalog:battle-moves",
    "ramBase": 0x020CFF9C,
    "stride": 0x68,
    "count": 596,
    "recordCountEvidence": (
        "OVL19:0x02113DFC cmp r2,#0x254 / blo walks the table with the same "
        "0x68 stride the MLA at 0x02113DCC forms"
    ),
    "boundaryEvidence": [
        "the UTF-16LE move-name pool ends at 0x020CFF98, four zero bytes below the base",
        "0x020CFF9C is the MLA addend at OVL19:0x0211134C, 0x021113C4, 0x02114500, 0x02115BA4",
        "record 595 ends at 0x020D9A9C, where the ASCII run '%s/%s.nsbca' begins",
    ],
    "fields": [
        (0x00, "u32", "speciesId", "OVL19:0x02113DD4 ldr r4,[r7,r6], compared against combatant +0x00"),
        (0x04, "u32", "namePointer", "OVL19:0x0211C2D8 ldr; every value lands in the UTF-16LE pool below the base"),
        (0x08, "u16", "field08", "OVL19:0x0211CAC0 ldrh"),
        (0x0A, "u8", "field0A", None),
        (0x0B, "u8", "field0B", None),
        (0x0C, "u32", "field0C", "OVL19:0x02113EE8 ldr; ==2 admits the record to the 3-slot list at combatant +0xD8"),
        (0x10, "u32", "field10", "OVL19:0x02116D94 ldr; 0..3 pick a four-arm jump calling 0x02112820 with 8..11"),
        (0x14, "u32", "field14", "OVL19:0x02114E50 ldr"),
        (0x18, "u32", "field18", None),
        (0x1C, "u32", "pointer1C", "OVL19:0x0211C1B8 ldr; a battle-script entry address, not a code pointer -- all 595 non-null values land inside the OVL19 bytecode blob 0x021204A0..0x0212FDA4, across 3 distinct entries"),
        (0x20, "s8", "field20", "OVL19:0x0211C52C ldrsb"),
        (0x21, "s8", "field21", "OVL19:0x0211C53C ldrsb"),
        (0x22, "u8", "field22", "OVL19:0x0211C514 ldrb"),
        (0x23, "u8", "field23", None),
        (0x24, "u16", "field24", "OVL19:0x0211A0B4 ldrh; the high byte indexes a per-battle counter array"),
        (0x26, "u16", "field26", None),
        (0x28, "u32", "pointer28", "OVL19:0x0211A0FC ldr, compared against two script addresses; a battle-script entry address, 31 distinct, all inside the bytecode blob. Many are odd, which reads like a Thumb pointer but is not: the bytecode is a byte stream and its routines are unaligned"),
        (0x2C, "s8", "field2C", "OVL19:0x0211CAF0 ldrsb"),
        (0x2D, "s8", "field2D", "OVL19:0x0211CB00 ldrsb"),
        (0x2E, "u16", "field2E", "OVL19:0x0211CB10 ldrh"),
        (0x30, "u16", "field30", "OVL19:0x0211A0CC ldrh; high byte indexes the same array as +0x24"),
        (0x32, "s8", "field32", "OVL19:0x0211CB2C ldrsb"),
        (0x33, "s8", "field33", "OVL19:0x0211CB3C ldrsb"),
        (0x34, "u16", "field34", "OVL19:0x0211CB4C ldrh"),
        (0x36, "u16", "field36", "OVL19:0x0211A0E4 ldrh; high byte indexes the same array as +0x24"),
        (0x38, "u16", "field38", "OVL19:0x0211CADC ldrh"),
        (0x3A, "u16", "field3A", None),
        (0x3C, "u32", "pointer3C", "OVL19:0x0211C900 ldr; a battle-script entry address, 2 distinct, all inside the bytecode blob"),
        (0x40, "s8", "field40", "OVL19:0x0211C8E0 ldrsb"),
        (0x41, "s8", "field41", "OVL19:0x0211C8F0 ldrsb"),
        (0x42, "u8", "field42", None),
        (0x43, "s8", "field43", "OVL19:0x0211C8CC ldrsb"),
        (0x44, "u16", "field44", "OVL19:0x0211C3C8 ldrh"),
        (0x46, "s8", "field46", "OVL19:0x02114DDC ldrsb"),
        (0x47, "u8", "field47", None),
        (0x48, "u16", "actionCost", "OVL19:0x0211C244 ldrh, the charge subtracted from combatant +0x54"),
        (0x4A, "u16", "power", "OVL19:0x02114BB8 ldrh, the multiplicand of the damage term"),
        (0x4C, "u16", "field4C", "OVL19:0x0211C5E0 ldrh"),
        (0x4E, "u16", "field4E", "OVL19:0x0211C5C4 ldrh"),
        (0x50, "u32", "kind", "OVL19:0x0211C76C ldr; sub #2 / cmp #1 / bhi admits only 2 and 3 to the contact walk"),
        (0x54, "u32", "targetMode", "OVL19:0x0211C77C ldr; 0 or 1 selects the single-target walk"),
        (0x58, "u32", "elementSelect", "OVL19:0x02114A68 ldr; cmp #5 / addls pc gates a six-arm jump"),
        (0x5C, "u32", "statusCode", "OVL19:0x021152E4 ldr"),
        (0x60, "u32", "field60", "OVL19:0x0211E500 ldr"),
        (0x64, "u32", "field64", "OVL19:0x02114D8C ldr"),
    ],
}

ARENAS = {
    "key": "battle-arenas",
    "catalogKind": "championship:2026:catalog:battle-arenas",
    "ramBase": 0x020CC148,
    "stride": 0x18,
    "count": 11,
    "recordCountEvidence": (
        "11 records of 0x18 exactly fill 0x020CC148..0x020CC250, between the end of "
        "the ASCII asset-name pool and the next object, whose base 0x020CC250 is "
        "itself a literal at ARM9:0x020A1370"
    ),
    "boundaryEvidence": [
        "the ASCII pool ends with 'field_bm00_00_common' terminated at 0x020CC144",
        "OVL2:0x0210C0B4 holds the record base 0x020CC148",
        "OVL19:0x0210CC40..0x0210CC78 hold base+0x04..base+0x14, the per-field base form",
        "the object at 0x020CC250 is u16 data and is referenced as its own base at ARM9:0x020A1370",
    ],
    "fields": [
        (0x00, "ascii", "identifier", "OVL2:0x0210C0B4 holds the record base; each value is a distinct BATTLE_* token"),
        (0x04, "ascii", "string04", "OVL19:0x0210CC40 holds base+0x04"),
        (0x08, "ascii", "string08", "OVL19:0x0210CC48 holds base+0x08"),
        (0x0C, "ascii", "string0C", "OVL19:0x0210CC58 holds base+0x0C"),
        (0x10, "ascii", "string10", "OVL19:0x0210CC68 holds base+0x10"),
        (0x14, "u32", "field14", "OVL19:0x0210CC78 holds base+0x14"),
    ],
}

ELIGIBILITY = {
    "key": "battle-eligibility",
    "catalogKind": "championship:2026:catalog:battle-eligibility",
    # The record base is 0x020CC8D4, not the 0x020CC8F4 the brief carried:
    # ARM9 0x020923A8..0x02092414 copies this record field by field out of a
    # literal pool holding &record[0].field for every field, and the lowest of
    # those is 0x020CC8D4. 0x020CC8F4 is that record's +0x20 column.
    "ramBase": 0x020CC8D4,
    "stride": 0x28,
    "count": 46,
    "recordCountEvidence": (
        "46 records of 0x28 end at 0x020CD004, exactly the base of the title-event "
        "table; a 47th would overrun it"
    ),
    "boundaryEvidence": [
        "the word at 0x020CC8D0 is the C string '/' loaded at ARM9:0x02087E64, so the table cannot start lower",
        "ARM9:0x02092428..0x0209244C is a literal pool of per-field bases whose lowest entry is 0x020CC8D4",
        "the last record ends at 0x020CD004, the title-event base held at ARM9:0x020892AC",
    ],
    "fields": [
        (0x00, "u32", "field00", "ARM9:0x020923A8 copy of base+0x00"),
        (0x04, "u32", "field04", "ARM9:0x020923B4 copy of base+0x04"),
        (0x08, "u32", "field08", "ARM9:0x020923C0 copy of base+0x08"),
        (0x0C, "u32", "field0C", "ARM9:0x020923CC copy of base+0x0C"),
        (0x10, "s32", "field10", "ARM9:0x020923D8 copy of base+0x10"),
        (0x14, "u8", "field14", "ARM9:0x020923E4 ldrb of base+0x14"),
        (0x15, "u8", "field15", "ARM9:0x020923F4 ldrb of base+0x15"),
        (0x16, "u16", "field16", None),
        (0x18, "s32", "field18", "ARM9:0x02092400 copy of base+0x18"),
        (0x1C, "u32", "field1C", "ARM9:0x02092408 copy of base+0x1C"),
        (0x20, "u32", "field20", "ARM9:0x02092410 copy of base+0x20"),
        (0x24, "u32", "field24", None),
    ],
}

TITLE_EVENTS = {
    "key": "battle-title-events",
    "catalogKind": "championship:2026:catalog:battle-title-events",
    "ramBase": 0x020CD004,
    "stride": 0x28,
    "count": 62,
    "recordCountEvidence": (
        "the +0x08 column is a permutation of 0..61 -- every value once, with 12 "
        "and 51 swapped -- so the table is exactly 62 long; ARM9:0x02089294 walks "
        "it at stride 0x28 while the index is below 0x3D, which is why the last "
        "record is the one that scan never reaches"
    ),
    "boundaryEvidence": [
        "ARM9:0x020892AC, OVL1:0x0210BE60 and OVL8:0x0210D470 all hold the base 0x020CD004",
        "the +0x08 column holds each of 0..61 exactly once",
        "the object at 0x020CD9B4 is a plain u32 run 0,1,2,... and does not match the record shape",
    ],
    "fields": [
        (0x00, "u32", "field00", "ARM9:0x020892AC holds the record base"),
        (0x04, "u32", "field04", "ARM9:0x02080770 holds base+0x04"),
        (0x08, "u32", "field08", "ARM9:0x02089250 base; the column is a permutation of 0..61"),
        (0x0C, "s32", "field0C", None),
        (0x10, "u32", "field10", "ARM9:0x02089280 ldr, compared against half a counter"),
        (0x14, "u32", "field14", "ARM9:0x0208926C ldr"),
        (0x18, "u32", "field18", "ARM9:0x02089274 ldr"),
        (0x1C, "u32", "field1C", None),
        (0x20, "u32", "field20", None),
        (0x24, "u32", "field24", None),
    ],
}

OPPONENT_TEAMS = {
    "key": "battle-opponent-teams",
    "catalogKind": "championship:2026:catalog:battle-opponent-teams",
    # 0x020ED2E4 is the +0x0C column, not the record base. OVL10's literal pool
    # at 0x02110A78..0x02110A8C holds 0x020ED2D8, 0x020ED2DC, 0x020ED2E0 and
    # 0x020ED2E4 as consecutive per-field bases, and 0x020ED2D8 is the lowest.
    "ramBase": 0x020ED2D8,
    "stride": 0x14,
    "count": 152,
    "recordCountEvidence": (
        "the +0x00/+0x04/+0x08 columns flatten to exactly 0..455 in order, one per "
        "battle-preset record; the +0x0C column is 0x323..0x3BA and +0x10 is "
        "0x3BB..0x452, both unbroken, and record 152 breaks all three"
    ),
    "boundaryEvidence": [
        "OVL10:0x02110A4C indexes with r2 = index*0x14 from base+0x0C",
        "OVL10:0x02110A78..0x02110A8C hold base+0x00 through base+0x0C",
        "the record after the last breaks the +0x0C run at 0x3BA and the +0x00 run at 455",
    ],
    "fields": [
        (0x00, "u32", "field00", "OVL10:0x02110A78 holds base+0x00"),
        (0x04, "u32", "field04", "OVL10:0x02110A7C holds base+0x04"),
        (0x08, "u32", "field08", "OVL10:0x02110A80 holds base+0x08"),
        (0x0C, "u32", "field0C", "OVL10:0x02110A4C ldr r1,[r1,r2] with r2 = index*0x14"),
        (0x10, "u32", "field10", None),
    ],
}

PRESETS = {
    "key": "battle-presets",
    "catalogKind": "championship:2026:catalog:battle-presets",
    "ramBase": 0x020E39D8,
    "stride": 0x44,
    "count": 456,
    "recordCountEvidence": (
        "the opponent-team table names exactly 456 record indices, 0..455 with no "
        "repeat; the +0x04 column rises to 150 across those 456 and then jumps to "
        "1152 in the record after the last"
    ),
    "boundaryEvidence": [
        "ARM9:0x02088EF4 mla r2,ip,#0x44,0x020E39D8 forms the record address",
        "the UTF-16LE name pool ends immediately below the base",
        "record 456 breaks the +0x04 run by 1002",
    ],
    "fields": [
        (0x00, "u32", "field00", "ARM9:0x02088EF4 mla r2,ip,#0x44,base"),
        (0x04, "u32", "field04", "ARM9:0x02088E98 holds base+0x04"),
        (0x08, "u32", "namePointer", "points into the UTF-16LE pool below the base"),
        (0x0C, "u16", "field0C", "ARM9:0x02088EF8 ldrh, summed over a caller-supplied index list"),
        (0x0E, "u16", "field0E", None),
        (0x10, "u32", "field10", None),
        (0x14, "u32", "field14", None),
        (0x18, "u32", "field18", None),
        (0x1C, "s32", "field1C", None),
        (0x20, "u32", "field20", None),
        (0x24, "u32", "field24", None),
        (0x28, "u32", "field28", None),
        (0x2C, "u32", "field2C", None),
        (0x30, "u32", "field30", None),
        (0x34, "u32", "field34", None),
        (0x38, "u32", "field38", None),
        (0x3C, "u8", "field3C", None),
        (0x3D, "u8", "field3D", None),
        (0x3E, "u8", "field3E", None),
        (0x3F, "u8", "field3F", None),
        (0x40, "u8", "field40", None),
        (0x41, "u8", "field41", None),
        (0x42, "u8", "field42", None),
        (0x43, "u8", "field43", None),
    ],
}

TABLES = [MOVES, ARENAS, ELIGIBILITY, TITLE_EVENTS, OPPONENT_TEAMS, PRESETS]


def read_records(arm9: Arm9, spec: dict) -> list[dict]:
    base, stride, count = spec["ramBase"], spec["stride"], spec["count"]
    out = []
    for index in range(count):
        raw = arm9.bytes(base + index * stride, stride)
        record = {"recordIndex": index}
        for offset, width, name, _site in spec["fields"]:
            if width == "ascii":
                pointer = struct.unpack_from("<I", raw, offset)[0]
                record[name] = arm9.ascii_at(pointer) if pointer else ""
            else:
                record[name] = READERS[width](raw, offset)
        out.append(record)
    return out


def build_field_map(spec: dict, records: list[dict]) -> tuple[list[dict], set[str]]:
    """Declare every field. A field with one value across the table is declared
    with that constant instead of repeating it on all N records."""
    field_map, constant_names = [], set()
    for offset, width, name, site in spec["fields"]:
        values = {record[name] for record in records}
        entry = {
            "offset": offset,
            "offsetHex": "0x%02X" % offset,
            "name": name,
            "width": width,
            "readSite": site,
            # An untraced column gets NO_TRACED_READ_SITE, not a claim about its
            # bytes. The old default said CONSTANT_ZERO_PADDING for every untraced
            # column without ever checking, which was false for at least two of
            # them: title-event field0C carries -1 (0xFFFFFFFF) in 15 records and
            # field20 exceeds 16 bits in 24. A label the build never verifies must
            # not sound like a measurement.
            "widthEvidence": "TRACED_LOAD" if site else "NO_TRACED_READ_SITE",
        }
        if len(values) == 1:
            entry["constantValue"] = records[0][name]
            constant_names.add(name)
        else:
            entry["distinctValues"] = len(values)
        field_map.append(entry)
    return field_map, constant_names


def check(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit("convergence check failed: " + message)


def verify(arm9: Arm9, spec: dict, records: list[dict]) -> None:
    key, base, stride, count = spec["key"], spec["ramBase"], spec["stride"], spec["count"]
    end = base + stride * count

    if key == "battle-moves":
        check(arm9.u32(base - 4) == 0, "the word below the move base is name-pool padding")
        check(records[-1]["speciesId"] == 223, "the last move record belongs to species 223")
        check(max(r["speciesId"] for r in records) == 223, "species ids stop at 223")
        check(arm9.bytes(end, 11) == b"%s/%s.nsbca", "the ASCII run follows the last move record")
        pool_low = min(r["namePointer"] for r in records)
        check(all(pool_low <= r["namePointer"] < base for r in records),
              "every move name pointer lands in the pool below the base")
    elif key == "battle-arenas":
        check(end == 0x020CC250, "the arena table ends where the next object begins")
        check(all(r["identifier"].startswith("BATTLE_") for r in records),
              "every arena identifier is a BATTLE_* token")
        check(len({r["identifier"] for r in records}) == count, "arena identifiers are distinct")
    elif key == "battle-eligibility":
        check(end == 0x020CD004, "the eligibility table ends at the title-event base")
        check([r["field20"] for r in records[:45]] == list(range(0x453, 0x453 + 45)),
              "the +0x20 column is an unbroken 0x453..0x47F run over the first 45 records")
        check(records[45]["field20"] == 0x461, "the last record repeats the id 0x461")
    elif key == "battle-title-events":
        check(sorted(r["field08"] for r in records) == list(range(count)),
              "the +0x08 column holds each of 0..61 exactly once")
        check([r["field08"] for r in records if r["field08"] != r["recordIndex"]] == [51, 12],
              "the only records off the diagonal are 12 and 51, which swap")
        check([arm9.u32(end + 4 * i) for i in range(10)] == list(range(10)),
              "the object after the table is a plain 0,1,2,... u32 run")
        check(records[61]["field24"] == 0, "the last title record carries no +0x24 value")
    elif key == "battle-opponent-teams":
        flat = [r[name] for r in records for name in ("field00", "field04", "field08")]
        check(flat == list(range(456)), "the three index columns flatten to 0..455 in order")
        check([r["field0C"] for r in records] == list(range(0x323, 0x323 + count)),
              "the +0x0C column is unbroken")
        check([r["field10"] for r in records] == list(range(0x3BB, 0x3BB + count)),
              "the +0x10 column is unbroken")
        after = struct.unpack_from("<I", arm9.bytes(end + 0x0C, 4), 0)[0]
        check(after != 0x323 + count, "the record after the last breaks the +0x0C run")
    elif key == "battle-presets":
        column = [r["field04"] for r in records]
        check(all(a <= b for a, b in zip(column, column[1:])), "the +0x04 column never decreases")
        check(column[-1] == 150, "the +0x04 column reaches 150 at the last record")
        check(struct.unpack_from("<I", arm9.bytes(end + 4, 4), 0)[0] == 1152,
              "the record after the last breaks the +0x04 run")


def build(arm9: Arm9, spec: dict) -> dict:
    records = read_records(arm9, spec)
    verify(arm9, spec, records)
    field_map, constant_names = build_field_map(spec, records)
    trimmed = [
        {name: value for name, value in record.items() if name not in constant_names}
        for record in records
    ]
    return {
        "schemaVersion": 1,
        "authority": AUTHORITY,
        "catalogKind": spec["catalogKind"],
        "sourceEvidence": SOURCE_EVIDENCE,
        "nameEvidence": NAME_EVIDENCE,
        "rom": {"sha256": ROM_SHA256, "title": ROM_TITLE.decode(), "code": ROM_CODE.decode()},
        "table": {
            "module": "arm9",
            "ramBase": "0x%08X" % spec["ramBase"],
            "ramEnd": "0x%08X" % (spec["ramBase"] + spec["stride"] * spec["count"]),
            "stride": spec["stride"],
            "recordCountEvidence": spec["recordCountEvidence"],
            "boundaryEvidence": spec["boundaryEvidence"],
        },
        "fieldMap": field_map,
        "recordCount": spec["count"],
        "records": trimmed,
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
        raise SystemExit("ROM sha256 %s is not the transcribed cartridge %s" % (digest, ROM_SHA256))
    if data[0x00:0x0C] != ROM_TITLE or data[0x0C:0x10] != ROM_CODE:
        raise SystemExit("header title/code is not DIGIMONCHAMP / YDIJ")

    arm9 = Arm9(data)
    # The image is stored uncompressed, so a RAM address maps straight onto it.
    # If that ever stopped being true this probe would not find record 595.
    probe = struct.unpack_from("<I", arm9.bytes(0x020CFF9C + 595 * 0x68, 4), 0)[0]
    if probe != 223:
        raise SystemExit("the ARM9 image does not decode: move record 595 read %d, not 223" % probe)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for spec in TABLES:
        payload = build(arm9, spec)
        target = out_dir / ("%s.r1.json" % spec["key"])
        with target.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(payload, indent=2, ensure_ascii=True) + "\n")
        print("%-22s %4d records  %s" % (spec["key"], payload["recordCount"], target.name))
    return 0


if __name__ == "__main__":
    sys.exit(main())
