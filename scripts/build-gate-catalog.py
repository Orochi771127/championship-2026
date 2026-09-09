#!/usr/bin/env python3
"""Transcribe the 17-record gate table out of ARM9, names and entrance fees included.

THE TABLE
---------
ARM9 0x020C9558, stride 36, 17 records. The columns this script transcribes:

    +0x00  u32   day field id
    +0x04  u32   night field id
    +0x08  ptr   C string: the biome NODE NAME, e.g. "Grass", "Volcano"
    +0x0C  u32   txt_list index of the display name  (574..590)
    +0x10  u32   txt_list index of a code string     (591..607)
    +0x18  u16   ENTRANCE FEE
    +0x1A  s16   signed, unnamed -- transcribed, not interpreted
    +0x1C  u32   unlock kind (0 initial, 1 rank, 2 battle result)
    +0x20  u32   rank threshold or 0-based battle record index

WHY +0x18 IS THE ENTRANCE FEE AND NOT MERELY A NUMBER DRAWN LIKE MONEY
-----------------------------------------------------------------------
OVL12 0x0210F82C closes it. It multiplies the gate index by 36, loads the u16 at
0x020C9570 (= table + 0x18), and then:

    0x0210F848  LDR   r0,[r1,#0x4c8]   ; the player's Bits
    0x0210F84C  CMP   r2,r0            ; fee vs Bits
    0x0210F850  BLS   0x0210F860       ; affordable -> go deduct
    0x0210F854  LDR   r0,[r3,#0xeb8]   ; not affordable: check the waiver flag
    0x0210F85C  BEQ   0x0210F8A0       ; flag clear -> REFUSE ENTRY
    ...
    0x0210F86C  CMP   r0,#0            ; flag clear?
    0x0210F870  LDREQ r0,[r1,#0x4c8]
    0x0210F874  SUBEQ r0,r0,r2         ; Bits -= fee
    0x0210F878  STREQ r0,[r1,#0x4c8]

So the value blocks entry when the player cannot afford it and is subtracted when
they can. A flag at +0xEB8 waives both. That is an entrance fee by behaviour, not
by resemblance.

THE INDEX-TO-BIOME MAPPING IS THE TABLE'S OWN
----------------------------------------------
The +0x08 C string is the biome node name, so no mapping has to be guessed: the
16 product biomes each appear exactly once in records 0..15. Record 16 is the
tutorial, which reuses the Grass field and costs nothing.

Independent corroboration: record 0 is Grass / DAINA-SOUGEN, and the English
release's footage shows that gate at an entrance fee of 0.

    python scripts/build-gate-catalog.py --rom <YDIJ.nds> --nitrofs <unpacked/nitrofs>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))

from ydij_text_bank import parse_bank, plain  # noqa: E402

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs"

ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
TABLE_ADDRESS = 0x020C9558
STRIDE = 36
RECORD_COUNT = 17
FEE_OFFSET = 0x18

# The 16 biome node names the product already carries, recovered from the MDL0
# name table. Every one must appear exactly once in records 0..15 or the mapping
# this script relies on is not what it thinks it is.
EXPECTED_BIOMES = {
    "Canyon", "Crag", "Damp", "Desert", "Factory", "Forest", "Grass", "Ice",
    "Jungle", "Mine", "Oasis", "Ruins", "Savanna", "Seaside", "Sewer", "Volcano",
}


def arm9_image(rom: bytes) -> tuple[bytes, int]:
    offset, base, size = struct.unpack_from("<I", rom, 0x20)[0], \
        struct.unpack_from("<I", rom, 0x28)[0], struct.unpack_from("<I", rom, 0x2C)[0]
    return rom[offset:offset + size], base


def cstring(image: bytes, base: int, address: int) -> str:
    start = address - base
    if start < 0 or start >= len(image):
        raise SystemExit(f"string pointer 0x{address:08X} is outside the ARM9 image")
    end = image.index(b"\x00", start)
    raw = image[start:end]
    if not raw or any(byte < 0x20 or byte > 0x7E for byte in raw):
        raise SystemExit(f"string at 0x{address:08X} is not printable; the pointer is wrong")
    return raw.decode("ascii")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rom", required=True, type=Path)
    parser.add_argument("--nitrofs", required=True, type=Path)
    args = parser.parse_args()

    rom = args.rom.read_bytes()
    digest = hashlib.sha256(rom).hexdigest()
    if digest != ROM_SHA256:
        raise SystemExit(f"ROM sha256 is {digest}, expected {ROM_SHA256}")
    image, base = arm9_image(rom)

    entries = parse_bank((args.nitrofs / "ui" / "txt" / "txt_list_txt.dat").read_bytes())

    table = TABLE_ADDRESS - base
    records = []
    for index in range(RECORD_COUNT):
        offset = table + index * STRIDE
        day, night, name_ptr, display_index, code_index = struct.unpack_from("<IIIII", image, offset)
        fee = struct.unpack_from("<H", image, offset + FEE_OFFSET)[0]
        signed = struct.unpack_from("<h", image, offset + FEE_OFFSET + 2)[0]
        unlock_kind, unlock_parameter = struct.unpack_from("<II", image, offset + 0x1C)
        records.append({
            "recordIndex": index,
            "biomeNodeName": cstring(image, base, name_ptr),
            "displayName": plain(entries[display_index]),
            "displayNameStringIndex": display_index,
            "codeString": plain(entries[code_index]),
            "entranceFeeBits": fee,
            "dayFieldId": day,
            "nightFieldId": night,
            # Signed, so not money. Transcribed under its byte offset, not named.
            "field1A": signed,
            "unlockKind": unlock_kind,
            "unlockParameter": unlock_parameter,
        })

    # Records 0..15 must cover the 16 product biomes exactly once.
    mapped = [record["biomeNodeName"] for record in records[:16]]
    if sorted(mapped) != sorted(EXPECTED_BIOMES):
        raise SystemExit(f"records 0..15 do not cover the 16 biomes exactly once: {sorted(mapped)}")
    if len(set(mapped)) != 16:
        raise SystemExit("a biome appears twice in records 0..15")

    payload = {
        "schemaVersion": 1,
        "authority": "CHAMPIONSHIP_2026_PRODUCT",
        "catalogKind": "championship:2026:catalog:gate-table",
        "sourceEvidence": "ROM_VERIFIED",
        "language": "ja",
        "rom": {"sha256": ROM_SHA256, "title": "DIGIMONCHAMP", "code": "YDIJ"},
        "table": {"module": "arm9", "address": "0x020C9558", "stride": STRIDE, "recordCount": RECORD_COUNT},
        "entranceFee": {
            "offsetHex": "0x18",
            "width": "u16",
            "evidence": "ROM_VERIFIED",
            "compareSite": "OVL12:0x0210F84C",
            "deductSite": "OVL12:0x0210F874",
            "walletOffset": "player+0x4C8",
            "waiverFlagOffset": "player+0xEB8",
            "waiverNote": (
                "A non-zero flag at +0xEB8 skips BOTH the affordability check and the "
                "deduction. What sets that flag is not traced, so this catalog records "
                "the flag's effect and does not model when it applies."
            ),
        },
        "mappingEvidence": (
            "The +0x08 column is a C string holding the biome node name, so the "
            "index-to-biome mapping is read, not inferred. Records 0..15 cover the 16 "
            "product biomes exactly once; record 16 is the tutorial and reuses Grass."
        ),
        "tutorialRecordIndex": 16,
        "recordCount": RECORD_COUNT,
        "records": records,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "gate-table.r1.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {out} ({RECORD_COUNT} records, fees {min(r['entranceFeeBits'] for r in records)}"
          f"..{max(r['entranceFeeBits'] for r in records)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
