#!/usr/bin/env python3
"""Transcribe the 62 title-match names and descriptions out of the cartridge text bank.

WHY THIS IS A SEPARATE BUILDER
------------------------------
build-battle-catalogs.py reads the ARM9 static image straight out of the .nds.
The strings do not live there: they live in the NitroFS file ui/txt/txt_list_txt.dat.
This script takes the extracted nitrofs directory, the same way
trace-battle-field-objects.py already does.

WHAT MAKES THE INDICES 675 AND 737 EVIDENCE RATHER THAN A GUESS
---------------------------------------------------------------
The title table at ARM9 0x020CD004 carries two u32 columns:

    field00  675..736  contiguous, 62 distinct
    field04  737..798  contiguous, 62 distinct

and field04 - field00 is exactly 62 for every one of the 62 records. Two parallel
62-entry blocks, back to back, in a bank whose own header declares 1568 entries.
field00 == 675 + recordIndex, so the record's position in the block IS its index.

FILE FORMAT
-----------
A short ASCII header, "utf-16<>\n" then the entry count then "<>\n", followed by
the entries. Each entry is UTF-16LE and is terminated by the three RAW ASCII bytes
3C 3E 0A -- the terminator is not itself UTF-16, which is why a naive decode of the
whole file loses alignment after the first entry.

Inside an entry, 0x1B is an escape introducing one style code unit, and a line break
is written as the two literal characters backslash and n.

THE BUILD REFUSES RATHER THAN GUESSES
-------------------------------------
If the separator count disagrees with the header, or a name in the 675 block carries
an escape or a line break, the block is not what this script thinks it is and the
build stops. A wrong offset must fail loudly, not emit plausible-looking text.

    python scripts/build-title-event-strings.py --nitrofs /path/to/unpacked/nitrofs
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))

from ydij_text_bank import ESCAPE, LITERAL_LINE_BREAK, parse_bank, plain  # noqa: E402

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs"

AUTHORITY = "CHAMPIONSHIP_2026_PRODUCT"

NAME_BLOCK_START = 675
DESCRIPTION_BLOCK_START = 737
RECORD_COUNT = 62


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nitrofs", required=True, type=Path)
    args = parser.parse_args()

    bank_path = args.nitrofs / "ui" / "txt" / "txt_list_txt.dat"
    if not bank_path.is_file():
        raise SystemExit(f"no text bank at {bank_path}")
    raw = bank_path.read_bytes()
    entries = parse_bank(raw)

    names = entries[NAME_BLOCK_START:NAME_BLOCK_START + RECORD_COUNT]
    descriptions = entries[DESCRIPTION_BLOCK_START:DESCRIPTION_BLOCK_START + RECORD_COUNT]
    if len(names) != RECORD_COUNT or len(descriptions) != RECORD_COUNT:
        raise SystemExit("the bank is too short to hold both blocks")

    # A name block that is really a name block has no markup in it.
    for index, name in enumerate(names):
        if ESCAPE in name or LITERAL_LINE_BREAK in name or not name.strip():
            raise SystemExit(
                f"name {NAME_BLOCK_START + index} carries markup or is blank; "
                "the 675 block is not the name block"
            )

    records = [
        {
            "recordIndex": index,
            "nameStringIndex": NAME_BLOCK_START + index,
            "descriptionStringIndex": DESCRIPTION_BLOCK_START + index,
            "name": names[index],
            "description": plain(descriptions[index]),
            "descriptionRaw": descriptions[index],
        }
        for index in range(RECORD_COUNT)
    ]

    payload = {
        "schemaVersion": 1,
        "authority": AUTHORITY,
        "catalogKind": "championship:2026:catalog:battle-title-event-strings",
        "sourceEvidence": "ROM_VERIFIED",
        "language": "ja",
        "languageNote": (
            "The cartridge under study is the Japanese YDIJ release, so these are the "
            "Japanese names the ROM itself carries. The gameplay footage in the research "
            "set is the English release, which is a different build; its English labels "
            "are NOT evidence for this ROM's string indices and no translation is invented here."
        ),
        "source": {
            "file": "nitrofs/ui/txt/txt_list_txt.dat",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "encoding": "utf-16-le entries, raw 3C 3E 0A terminator",
            "entryCount": len(entries),
        },
        "blocks": {
            "name": {"start": NAME_BLOCK_START, "count": RECORD_COUNT, "column": "field00"},
            "description": {"start": DESCRIPTION_BLOCK_START, "count": RECORD_COUNT, "column": "field04"},
        },
        "indexEvidence": (
            "battle-title-events field00 runs 675..736 contiguously and field04 runs "
            "737..798 contiguously, with field04 - field00 == 62 for all 62 records"
        ),
        "recordCount": RECORD_COUNT,
        "records": records,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "battle-title-event-strings.r1.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} ({RECORD_COUNT} names, {RECORD_COUNT} descriptions)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
