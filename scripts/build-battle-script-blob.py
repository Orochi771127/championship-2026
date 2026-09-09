#!/usr/bin/env python3
"""Extract the OVL19 battle-script segment so the traced VM can execute it.

The 52-opcode VM in src/championship/battle/battleScriptVm.js is a full
executor. What it has never had is a script to run: a move record names its
entry points, and those point into a 63,748-byte segment of OVL19.

Reachability was measured before this was written. Decoding from all 36 move
entry points and following every in-range target visits 22,032 of the segment's
23,121 instructions and touches 63,747 of its 63,748 bytes, so there is no small
subset -- running move scripts means carrying the whole segment.

THIS IS A DECISION, NOT A DETAIL
--------------------------------
The other catalogs in this project transcribe TABLES into named fields. This
transcribes a segment of the cartridge's own bytecode. The migration firewall's
payload test is written against file extensions and would not catch a .json, but
its title says "no ROM, Nitro, decoded, or forensic payload" and the intent
plainly covers this. So the output path is not defaulted into the product tree:
pass --out and choose deliberately.

The alternative is reimplementing 22,032 instructions of move behaviour by hand,
which is what rule 1 of the brief forbids guessing at.

    python scripts/build-battle-script-blob.py --rom /path/to/YDIJ.nds \\
        --out /somewhere/battle-script-blob.r1.json
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import struct
import sys
from pathlib import Path

ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
ROM_TITLE = b"DIGIMONCHAMP"
ROM_CODE = b"YDIJ"

AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT"

OVERLAY_ID = 19
OVERLAY_TABLE_OFFSET = 0x50
FAT_OFFSET = 0x48
OVERLAY_ENTRY_SIZE = 32
OVERLAY_ENTRY_COUNT = 22

# battle-scripts.r1.json's own blob bounds, re-derived here rather than trusted.
BLOB_RAM_BASE = 0x021204A0
BLOB_RAM_END = 0x0212FDA4


def load_rom(path: Path) -> bytes:
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != ROM_SHA256:
        raise SystemExit("ROM SHA-256 is %s, expected %s" % (digest, ROM_SHA256))
    if data[0x00:0x0C] != ROM_TITLE or data[0x0C:0x10] != ROM_CODE:
        raise SystemExit("ROM header is not DIGIMONCHAMP / YDIJ")
    return data


def overlay_image(rom: bytes, overlay_id: int) -> tuple[int, bytes]:
    table = struct.unpack_from("<I", rom, OVERLAY_TABLE_OFFSET)[0]
    fat = struct.unpack_from("<I", rom, FAT_OFFSET)[0]
    for entry in range(OVERLAY_ENTRY_COUNT):
        base = table + entry * OVERLAY_ENTRY_SIZE
        if struct.unpack_from("<I", rom, base)[0] != overlay_id:
            continue
        ram = struct.unpack_from("<I", rom, base + 4)[0]
        size = struct.unpack_from("<I", rom, base + 8)[0]
        file_id = struct.unpack_from("<I", rom, base + 24)[0]
        start = struct.unpack_from("<I", rom, fat + file_id * 8)[0]
        return ram, rom[start : start + size]
    raise SystemExit("overlay %d not found in the table" % overlay_id)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", default=os.environ.get("YDIJ_ROM"))
    parser.add_argument("--out", required=True, help="where to write; not defaulted into src/ on purpose")
    args = parser.parse_args()
    if not args.rom:
        raise SystemExit("Pass --rom or set YDIJ_ROM; the cartridge is not in this repository")

    rom = load_rom(Path(args.rom))
    ram, image = overlay_image(rom, OVERLAY_ID)
    if not (ram <= BLOB_RAM_BASE and BLOB_RAM_END <= ram + len(image)):
        raise SystemExit("the script segment is outside overlay %d" % OVERLAY_ID)

    segment = image[BLOB_RAM_BASE - ram : BLOB_RAM_END - ram]
    expected = BLOB_RAM_END - BLOB_RAM_BASE
    if len(segment) != expected:
        raise SystemExit("segment is %d bytes, expected %d" % (len(segment), expected))

    document = {
        "schemaVersion": 1,
        "authority": AUTHORITY,
        "catalogKind": "championship:2026:catalog:battle-script-blob",
        "sourceEvidence": "VERIFIED_BINARY_SEGMENT",
        "payloadNotice": (
            "This is a segment of the cartridge's own bytecode, not a transcribed table. "
            "It is carried so the traced 52-opcode VM can execute the original's move "
            "scripts rather than have them reimplemented by hand. Placing it inside the "
            "product tree is an Owner decision."
        ),
        "rom": {"sha256": ROM_SHA256, "title": ROM_TITLE.decode(), "code": ROM_CODE.decode()},
        "segment": {
            "module": "ovl19",
            "ramBase": "0x%08X" % BLOB_RAM_BASE,
            "ramEnd": "0x%08X" % BLOB_RAM_END,
            "byteLength": len(segment),
            "sha256": hashlib.sha256(segment).hexdigest(),
            "encoding": "base64",
        },
        "bytes": base64.b64encode(segment).decode("ascii"),
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(document, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print("wrote %s (%d bytes of segment, sha %s)" % (out.name, len(segment), document["segment"]["sha256"][:16]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
