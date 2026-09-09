#!/usr/bin/env python3
"""Transcribe the cartridge's in-game help out of nitrofs/ui/txt/help_text_txt.dat.

WHAT THE FILE CONTAINS, AND HOW THAT WAS ESTABLISHED
-----------------------------------------------------
The bank declares 168 entries. They are TWO parallel blocks of 84: entry i is a
title, and entry i + 84 is that title's body. The pairing is not assumed -- it is
what the text says when you line the halves up:

    title  5 ROPE          body  89 describes the rope hunting tool
    title  6 SHOT          body  90 describes the shot tool
    title 12 TIME          body  96 "one Digital World day is about ten real
                                     minutes ... eight days make a season, four
                                     seasons make a year"

Body 96 is the entry this project already cited for the clock cascade, and it
lands on the TIME title under this split, which is the cross-check that the offset
of 84 is right rather than merely plausible.

Sixteen titles carry the literal body "n/a". Those are section headings: the game
lists them but there is nothing to read. The remaining 68 are real topics. That
distinction comes from the file, not from reading the Japanese.

WHAT IS NOT IN THE FILE, AND IS THEREFORE NOT INVENTED HERE
-----------------------------------------------------------
Which heading owns which topics. The bank stores the headings and the topics as
separate runs and carries no parent link, and no grouping table was found in ARM9
or in either overlay that names the bank (OVL5 holds the resource descriptor,
OVL16 holds the loader pointer). So this catalog emits the ROM's own order and
marks each entry as a heading or a topic. It does not build a tree it cannot
prove.

    python scripts/build-help-catalog.py --nitrofs /path/to/unpacked/nitrofs
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

EXPECTED_ENTRIES = 168
HEADING_BODY = "n/a"

# The entry this project already cites for the clock cascade, used here as a
# positive control: if the split ever stops landing it under the TIME title, the
# build must fail rather than emit a quietly re-numbered catalog.
CONTROL_BODY_INDEX = 96
CONTROL_BODY_FRAGMENT = "8"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nitrofs", required=True, type=Path)
    args = parser.parse_args()

    bank_path = args.nitrofs / "ui" / "txt" / "help_text_txt.dat"
    if not bank_path.is_file():
        raise SystemExit(f"no help bank at {bank_path}")
    raw = bank_path.read_bytes()
    entries = parse_bank(raw)

    if len(entries) != EXPECTED_ENTRIES:
        raise SystemExit(f"expected {EXPECTED_ENTRIES} entries, found {len(entries)}")
    if len(entries) % 2:
        raise SystemExit("the bank does not split into two equal halves")

    half = len(entries) // 2
    titles = entries[:half]
    bodies = entries[half:]

    # Positive control on the split.
    control = plain(bodies[CONTROL_BODY_INDEX - half])
    if CONTROL_BODY_FRAGMENT not in control:
        raise SystemExit(
            f"entry {CONTROL_BODY_INDEX} does not read as the day-length text; "
            "the title/body split is not where this script thinks it is"
        )

    # A title block that is really a title block carries no markup.
    for index, title in enumerate(titles):
        if ESCAPE in title or LITERAL_LINE_BREAK in title or not title.strip():
            raise SystemExit(f"title {index} carries markup or is blank; the split is wrong")

    records = []
    for index, title in enumerate(titles):
        body_raw = bodies[index]
        is_heading = body_raw == HEADING_BODY
        records.append({
            "entryIndex": index,
            "titleStringIndex": index,
            "bodyStringIndex": index + half,
            "title": title,
            "kind": "heading" if is_heading else "topic",
            "body": None if is_heading else plain(body_raw),
            "bodyRaw": None if is_heading else body_raw,
        })

    headings = sum(1 for record in records if record["kind"] == "heading")
    topics = len(records) - headings

    payload = {
        "schemaVersion": 1,
        "authority": AUTHORITY,
        "catalogKind": "championship:2026:catalog:help-text",
        "sourceEvidence": "ROM_VERIFIED",
        "language": "ja",
        "languageNote": (
            "The cartridge under study is the Japanese YDIJ release. The research footage "
            "is the English release, a different build, so its labels are not evidence for "
            "this ROM's string table. No translation is invented here."
        ),
        "source": {
            "file": "nitrofs/ui/txt/help_text_txt.dat",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "encoding": "utf-16-le entries, raw 3C 3E 0A terminator",
            "entryCount": len(entries),
        },
        "split": {
            "titles": {"start": 0, "count": half},
            "bodies": {"start": half, "count": half},
            "rule": "body index = title index + 84",
            "control": (
                f"entry {CONTROL_BODY_INDEX} is the day-length text and pairs with the TIME title, "
                "which is the check that the offset is right"
            ),
        },
        "groupingEvidence": "UNKNOWN_REQUIRES_TRACE",
        "groupingNote": (
            "The bank stores headings and topics as separate runs and carries no parent link. "
            "No grouping table was found in ARM9, in OVL5 (the help resource descriptor) or in "
            "OVL16 (which holds the loader pointer). Entries are therefore emitted in the ROM's "
            "own order and marked heading or topic; no tree is asserted."
        ),
        "headingCount": headings,
        "topicCount": topics,
        "recordCount": len(records),
        "records": records,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "help-text.r1.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} ({headings} headings, {topics} topics)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
