#!/usr/bin/env python3
"""Transcribe the Japanese species names out of the cartridge text bank.

THE MAPPING, AND WHY IT IS READ RATHER THAN GUESSED
----------------------------------------------------
txt_list_txt.dat holds a run of Digimon names starting at entry 41. Lining it up
against the transcribed species table gives a constant offset of 33:

    species   8  ZURUMON   ->  entry  41  ZURUMON in katakana
    species  14  BOTAMON   ->  entry  47
    species  21  KOROMON   ->  entry  54
    species 100  DARCMON   ->  entry 133

Entry 54 is the name the game printed on screen when the Owner's creature evolved,
which is the observation that fixed the offset rather than merely suggesting it.

THE BLOCK IS EXACTLY 216 LONG, AND THAT IS CORROBORATED
--------------------------------------------------------
Species 0..7 are the eggs and have no individual name; the offset would land them
on the stat-name list instead. Species 224..227 fall past the end of the name run
and would land on the kana charts used by the name-entry keyboard. So the run
covers species 8..223 -- 216 entries.

databaseCatalog.js independently records the encyclopedia as 224 slots = 8 eggs
plus 216 regular. The name block being exactly 216 long is a second, unrelated
witness to the same split.

THE BUILD REFUSES RATHER THAN GUESSES
-------------------------------------
Every name in the block must be kana or kanji. If the offset ever moves, entries
land on ASCII stat names or on the kana charts, both of which fail this test, so a
wrong offset stops the build instead of emitting plausible-looking text.

    python scripts/build-species-names.py --nitrofs /path/to/unpacked/nitrofs
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))

from ydij_text_bank import parse_bank, plain  # noqa: E402

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs"
SPECIES_CATALOG = OUT_DIR / "creature-species.r1.json"

NAME_OFFSET = 33
FIRST_NAMED_SPECIES = 8
NAMED_SPECIES_COUNT = 216      # species 8..223

# The six stat labels sit immediately before the name run; transcribed here
# because the training messages substitute them and the order is the stat order.
STAT_NAME_START = 35
STAT_NAME_COUNT = 6

JAPANESE = re.compile(r"^[぀-ゟ゠-ヿ一-鿿！-｠ー・]+$")

# Controls the check: these are what a wrong offset would land on.
CONTROL_SPECIES = {8: "ズルモン", 21: "コロモン", 100: "ダルクモン"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nitrofs", required=True, type=Path)
    args = parser.parse_args()

    bank_path = args.nitrofs / "ui" / "txt" / "txt_list_txt.dat"
    raw = bank_path.read_bytes()
    entries = parse_bank(raw)

    species = json.loads(SPECIES_CATALOG.read_text(encoding="utf-8"))["records"]

    stat_names = [plain(entries[STAT_NAME_START + i]).strip() for i in range(STAT_NAME_COUNT)]
    if stat_names[0] != "HP" or stat_names[1] != "TP":
        raise SystemExit(f"the stat block does not start with HP/TP: {stat_names}")

    records = []
    for index in range(FIRST_NAMED_SPECIES, FIRST_NAMED_SPECIES + NAMED_SPECIES_COUNT):
        name = plain(entries[index + NAME_OFFSET]).strip()
        if not JAPANESE.match(name):
            raise SystemExit(
                f"species {index} maps to {name!r}, which is not a Japanese name; "
                "the offset is wrong"
            )
        records.append({
            "recordIndex": index,
            "identifier": species[index]["identifier"],
            "nameStringIndex": index + NAME_OFFSET,
            "name": name,
        })

    for index, expected in CONTROL_SPECIES.items():
        actual = next(r["name"] for r in records if r["recordIndex"] == index)
        if actual != expected:
            raise SystemExit(f"control failed: species {index} should be {expected}, got {actual}")

    payload = {
        "schemaVersion": 1,
        "authority": "CHAMPIONSHIP_2026_PRODUCT",
        "catalogKind": "championship:2026:catalog:species-names",
        "sourceEvidence": "ROM_VERIFIED",
        "language": "ja",
        "source": {
            "file": "nitrofs/ui/txt/txt_list_txt.dat",
            "sha256": hashlib.sha256(raw).hexdigest(),
        },
        "mapping": {
            "rule": "text entry index = species record index + 33",
            "coverage": f"species {FIRST_NAMED_SPECIES}..{FIRST_NAMED_SPECIES + NAMED_SPECIES_COUNT - 1}",
            "excluded": (
                "species 0..7 are the eggs and carry no individual name; species 224..227 fall "
                "past the run and would land on the name-entry kana charts"
            ),
            "corroboration": (
                "the run is exactly 216 long, and databaseCatalog.js independently records the "
                "encyclopedia as 224 slots = 8 eggs plus 216 regular"
            ),
        },
        # The six stat labels, in the order the bank stores them. That order is the
        # game's own stat order, and the training messages substitute from it.
        "statNames": stat_names,
        "statNameStringStart": STAT_NAME_START,
        "recordCount": len(records),
        "records": records,
    }

    out = OUT_DIR / "species-names.r1.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(records)} names, stats: {', '.join(stat_names)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
