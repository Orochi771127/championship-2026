#!/usr/bin/env python3
"""Build the faithful 4x baseline for the original care items (common/i000_item).

Reads the decoded research pack, never the ROM itself, and writes deterministic
4x nearest-neighbour cells plus the geometry and sequence facts the runtime
needs. Roles are this repo's reading of the sequence table, recorded as such:
the ROM states the sequences and cells, not the words "meat" or "waste".

Owner directive 2026-09-02 (docs/coordination/OWNER_DIRECTION.md) permits
decoded original pixels as game materials.
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

PACK = Path("R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK")
SRC = PACK / "08_FULL_FAMILY_CONVERSION/common/i000_item"
OUT = Path(__file__).resolve().parent.parent / "docs/art/production/care/faithful-hd4x"
EXPECTED_ROM_SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
SCALE = 4

# sequenceId -> (role, amount). Singles are the four remaining amounts; the
# two-frame sequences are one identity played as two poses.
ROLES = {
    0: ("meat", 0), 1: ("meat", 1), 2: ("meat", 2), 3: ("meat", 3),
    4: ("meat-rot", None),
    5: ("protein", 0), 6: ("protein", 1), 7: ("protein", 2), 8: ("protein", 3),
    9: ("protein-rot", None), 10: ("waste", None), 11: ("broom", None),
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(check: bool) -> int:
    prov = json.loads((PACK / "00_METADATA/FULL_DECONSTRUCTION_PROVENANCE.json").read_text(encoding="utf-8"))
    if prov.get("source_rom_sha256") != EXPECTED_ROM_SHA:
        raise SystemExit(f"CARE_FAITHFUL: UNEXPECTED_SOURCE_ROM:{prov.get('source_rom_sha256')}")
    anim = json.loads((SRC / "animations.json").read_text(encoding="utf-8"))
    cells = {c["cellIndex"]: c for c in json.loads((SRC / "cells.json").read_text(encoding="utf-8"))["cells"]}
    if not check:
        OUT.mkdir(parents=True, exist_ok=True)

    entries: list[dict] = []
    for seq in anim["sequences"]:
        role_amount = ROLES.get(seq["sequenceId"])
        if role_amount is None:
            continue
        role, amount = role_amount
        for frame in seq["frames"]:
            pose = frame["frameIndex"] if amount is None else amount
            name = f"{role}-{pose}.png"
            cell = cells[frame["cellId"]]
            bounds = cell["bounds"]
            width = bounds["maxXExclusive"] - bounds["minX"]
            height = bounds["maxYExclusive"] - bounds["minY"]
            image = Image.open(SRC / "cells" / f"cell-{frame['cellId']:03d}.png").convert("RGBA")
            if image.size != (width, height):
                raise SystemExit(f"CARE_FAITHFUL: CELL_BOUNDS_MISMATCH:{frame['cellId']}:{image.size}!={(width, height)}")
            dest = OUT / name
            if not check:
                image.resize((width * SCALE, height * SCALE), Image.NEAREST).save(dest)
            entries.append({
                "file": name,
                "role": role,
                "pose": pose,
                "sequenceId": seq["sequenceId"],
                "cellId": frame["cellId"],
                "rawDurationTicks": frame["rawDurationTicks"],
                "nativeWidth": width,
                "nativeHeight": height,
                # Sprite origin inside the image, in native pixels.
                "nativeAnchorX": -bounds["minX"],
                "nativeAnchorY": -bounds["minY"],
                "sha256": sha(dest) if dest.exists() else None,
            })

    entries.sort(key=lambda entry: (entry["role"], entry["pose"]))
    manifest = {
        "schemaVersion": 1,
        "id": "care-faithful-hd4x",
        "sourceResource": "common/i000_item",
        "sourceRomSha256": EXPECTED_ROM_SHA,
        "researchPack": "YDIJ_PRIVATE_ROM_ART_PACK (not readable by the game)",
        "scale": SCALE,
        "filter": "nearest",
        "timingSemantics": anim["timingSemantics"],
        "roleEvidence": "ROLE_NAMES_ARE_THIS_REPO_READING_OF_THE_SEQUENCE_TABLE",
        "poseEvidence": "ROM_VERIFIED_SEQUENCE_AND_CELL_AND_TICKS",
        "cells": entries,
    }
    path = OUT / "manifest.json"
    if check:
        current = json.loads(path.read_text(encoding="utf-8"))
        drift = [entry["file"] for entry in current["cells"] if sha(OUT / entry["file"]) != entry["sha256"]]
        if drift or {entry["file"] for entry in current["cells"]} != {entry["file"] for entry in entries}:
            raise SystemExit(f"CARE_FAITHFUL: DRIFT:{drift}")
        print(f"care faithful hd4x check ok: {len(current['cells'])} cells")
        return 0
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} faithful 4x care cells from {manifest['sourceResource']}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--check" in sys.argv))
