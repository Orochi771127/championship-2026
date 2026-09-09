#!/usr/bin/env python3
"""Transcribe the 36 CageDefinition records, names and effects included.

The 2026-09-05 handoff used +0x28/+0x2C relative to the NAME COLUMN, thereby
reading the next cage. OVL15 0x0210C42C..0x0210C45C instead reads
0x020C8CDC + index*40 and 0x020C8CE0 + index*40 directly. Cage 0 is AKICHI
(vacant lot, defence up, recommended 2); cage 1 is the running track.

THE TABLE
---------
ARM9 name-column base 0x020C8CDC, stride 40, 36 definitions:

    +0x00  name         494..533, with gaps
    +0x04  description  name index + 40
    -0x1C  field pointer (parallel column base 0x020C8CC0)

Definition 35 is Waiting Room (521/561). The adjacent visual record 36 is
Lid (522/562), outside the definition and shop catalogs. All 35 shop itemIndex
values are independently joined to the ShopItemTable's name/description IDs.
The +40 name-to-description relationship alone cannot detect a one-row shift.

WHAT THE DESCRIPTION CARRIES
----------------------------
The cartridge states each cage's effect and its recommended occupancy in the
description text itself, e.g. "HP UP" then "DIGIMON SHUUYOUSUU 6". So the channel
and the capacity are read, not inferred. What the text does NOT give is the
magnitude -- how much a tick moves the stat -- and this builder does not invent it.

Tick magnitudes remain UNKNOWN_REQUIRES_TRACE. The earlier negative argument
about a speed slot used the same wrong row/column base and is not evidence.

    python scripts/build-cage-definitions.py --rom <YDIJ.nds> [--check]
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import re
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))

from ydij_text_bank import parse_bank, plain  # noqa: E402

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs"

ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
TABLE_ADDRESS = 0x020C8CDC
STRIDE = 40
RECORD_COUNT = 36
NAME_OFFSET, DESC_OFFSET = 0x00, 0x04
FIELD_POINTER_OFFSET = -0x1C

# Every record's description string sits exactly 40 entries after its name string.
NAME_TO_DESCRIPTION_GAP = 40

# Waiting Room is a definition with an empty description; Lid is not a definition.
CHROME_RECORDS = {35}

STAT_UP = {
    "ＨＰアップ": "HP",
    "ＴＰアップ": "TP",
    "こうげきアップ": "ATTACK",
    "ぼうぎょアップ": "DEFENSE",
    "すばやさアップ": "SPEED",
    "かしこさアップ": "WISDOM",
    "バトルすうアップ": "BATTLE_COUNT",
}
FAMILY_UP = re.compile(r"^(.+?)ぞくせいアップ$")
RESIST_UP = re.compile(r"^(.+?)たいせいアップ$")
RECOVER = "ＨＰ　ストレス　かいふく"
AUTO_CARE = "じどうでエサとウンチ"

CAPACITY = re.compile(r"しゅうようすう(\d+)")

# Index witnesses from the OVL15 columns AND independent shop itemIndex join.
CONTROL = {
    0: ("あきち", "DEFENSE", 2), 1: ("うんどうじょう", "HP", 6),
    15: ("ミニほけんしつ", "HP_AND_STRESS", 2), 23: ("おてら", "WISDOM", 2),
    30: ("ミニジム", "ATTACK", 2), 34: ("どうくつ", "やみ", 2),
    35: ("ひかえしつ", None, None),
}


def arm9_image(rom: bytes) -> tuple[bytes, int]:
    offset = struct.unpack_from("<I", rom, 0x20)[0]
    base = struct.unpack_from("<I", rom, 0x28)[0]
    size = struct.unpack_from("<I", rom, 0x2C)[0]
    return rom[offset:offset + size], base


def read_effect(lines: list[str]) -> dict:
    """Classify the effect line. Unrecognised text is reported, never dropped."""
    for line in lines:
        text = line.strip()
        if not text:
            continue
        if text in STAT_UP:
            return {"kind": "STAT_UP", "target": STAT_UP[text]}
        if text == RECOVER:
            return {"kind": "RECOVER", "target": "HP_AND_STRESS"}
        family = FAMILY_UP.match(text)
        if family:
            return {"kind": "FAMILY_UP", "target": family.group(1)}
        resist = RESIST_UP.match(text)
        if resist:
            return {"kind": "RESIST_UP", "target": resist.group(1).rstrip("の")}
    if any(AUTO_CARE in line for line in lines):
        return {"kind": "AUTO_CARE", "target": "FOOD_AND_DROPPINGS"}
    return {"kind": "UNCLASSIFIED", "target": None}


def build_records(image: bytes, base: int, entries: list[str]) -> list[dict]:
    table = TABLE_ADDRESS - base
    records, names, descs = [], [], []
    for index in range(RECORD_COUNT):
        offset = table + index * STRIDE
        name_index = struct.unpack_from("<i", image, offset + NAME_OFFSET)[0]
        desc_index = struct.unpack_from("<i", image, offset + DESC_OFFSET)[0]
        names.append(name_index)
        descs.append(desc_index)

        name = plain(entries[name_index]).strip()
        description = plain(entries[desc_index])
        lines = description.split(chr(10))
        capacity = CAPACITY.search(description)
        field_pointer = struct.unpack_from("<I", image, offset + FIELD_POINTER_OFFSET)[0] - base
        if not 0 <= field_pointer < len(image):
            raise SystemExit(f"cage {index}: field pointer outside ARM9")
        field_end = image.find(b"\0", field_pointer)
        field_id = image[field_pointer:field_end].decode("ascii")
        if not re.fullmatch(r"field_cm\d{2}_01", field_id):
            raise SystemExit(f"cage {index}: invalid field id {field_id}")

        record = {
            "cageIndex": index,
            "name": name,
            "fieldId": field_id,
            "nameStringIndex": name_index,
            "descriptionStringIndex": desc_index,
            "description": description,
            "capacity": int(capacity.group(1)) if capacity else None,
            "effect": read_effect(lines) if index not in CHROME_RECORDS
                      else {"kind": "NONE", "target": None},
            "playerFacing": index not in CHROME_RECORDS,
        }
        records.append(record)

    # Pair coherence is necessary but NOT sufficient: a whole-row shift passes.
    for index, (name_index, desc_index) in enumerate(zip(names, descs)):
        if desc_index - name_index != NAME_TO_DESCRIPTION_GAP:
            raise SystemExit(
                f"cage {index}: description index is {desc_index - name_index} past the name "
                f"index, not {NAME_TO_DESCRIPTION_GAP}; the table base or stride is wrong"
            )
    if len(set(names)) != RECORD_COUNT:
        raise SystemExit("two cages share a name string; the stride is wrong")

    # Independent table: ARM9 ShopItemTable, stride 56, category 3, itemIndex.
    shop_indices = set()
    for shop_index in range(118):
        row = struct.unpack_from("<14I", image, 0x020E0248 - base + shop_index * 56)
        if row[0] != 3:
            continue
        cage_index = row[2]
        if cage_index in shop_indices or not 0 <= cage_index < 35:
            raise SystemExit("invalid or duplicate shop cage index")
        shop_indices.add(cage_index)
        record = records[cage_index]
        if (record["nameStringIndex"], record["descriptionStringIndex"]) != row[9:11]:
            raise SystemExit(f"SHOP_CAGE_TEXT_MISMATCH: shop {shop_index}, cage {cage_index}")
        record["shopRecordIndex"] = shop_index
    if shop_indices != set(range(35)):
        raise SystemExit("shop must reference exactly cage indices 0..34")
    records[35]["shopRecordIndex"] = None

    for index, (want_name, want_target, want_capacity) in CONTROL.items():
        got = records[index]
        if got["name"] != want_name or got["effect"]["target"] != want_target \
                or got["capacity"] != want_capacity:
            raise SystemExit(
                f"control failed for cage {index}: expected {want_name}/{want_target}/{want_capacity}, "
                f"got {got['name']}/{got['effect']['target']}/{got['capacity']}"
            )

    unclassified = [r["cageIndex"] for r in records if r["effect"]["kind"] == "UNCLASSIFIED"]
    if unclassified:
        raise SystemExit(f"cages {unclassified} have an effect line this build cannot read")
    return records


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rom", required=True, type=Path)
    parser.add_argument("--nitrofs", type=Path, help="Optional extraction, must byte-match the ROM bank")
    parser.add_argument("--check", action="store_true", help="Verify the catalog without writing")
    args = parser.parse_args()

    rom = args.rom.read_bytes()
    if hashlib.sha256(rom).hexdigest() != ROM_SHA256:
        raise SystemExit("ROM sha256 does not match")
    # Reuse the existing read-only FAT/FNT reader; no extracted bank is trusted.
    rom_reader = importlib.import_module("build-rom-art-census").Rom(rom)
    bank = next(row for row in rom_reader.files() if row["path"] == "/ui/txt/txt_list_txt.dat")
    raw_bank = rom[bank["offset"]:bank["offset"] + bank["size"]]
    if args.nitrofs and (args.nitrofs / "ui/txt/txt_list_txt.dat").read_bytes() != raw_bank:
        raise SystemExit("extracted text bank does not match ROM")
    image, base = arm9_image(rom)
    records = build_records(image, base, parse_bank(raw_bank))

    payload = {
        "schemaVersion": 1,
        "authority": "CHAMPIONSHIP_2026_PRODUCT",
        "catalogKind": "championship:2026:catalog:cage-definitions",
        "sourceEvidence": "ROM_VERIFIED",
        "language": "ja",
        "rom": {"sha256": ROM_SHA256},
        "table": {"module": "arm9", "address": "0x020C8CDC", "stride": STRIDE, "recordCount": RECORD_COUNT},
        "stringColumns": {"name": "0x00", "description": "0x04"},
        "fieldPointerColumn": {"address": "0x020C8CC0", "offsetFromNameColumn": "-0x1C", "stride": STRIDE},
        "textBankSha256": hashlib.sha256(raw_bank).hexdigest(),
        "identityCrosscheck": "OVL15_INDEXED_TEXT_READER_AND_ALL_35_SHOP_ITEM_INDICES",
        "magnitudeEvidence": "UNKNOWN_REQUIRES_TRACE",
        "magnitudeNote": (
            "The cartridge states WHICH stat each cage moves and the recommended occupancy, "
            "but does not establish HOW MUCH a tick moves it. Magnitudes require their own "
            "reader/writer trace; neither table layout nor a visual match supplies them."
        ),
        "recordCount": RECORD_COUNT,
        "records": records,
    }

    out = OUT_DIR / "cage-definitions.r1.json"
    serialized = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if out.read_text(encoding="utf-8") != serialized:
            raise SystemExit("CAGE_CATALOG_OUT_OF_DATE")
        print("CAGE_CATALOG_ROM_CHECK_PASS: 36 definitions, 35 independent shop joins")
        return 0
    out.write_text(serialized, encoding="utf-8", newline="\n")
    facing = sum(1 for r in records if r["playerFacing"])
    print(f"wrote {out} ({RECORD_COUNT} records, {facing} player-facing)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
