#!/usr/bin/env python3
"""Build faithful 4x baselines for original sprite families.

Reads the decoded research pack, never the ROM itself, and writes deterministic
4x nearest-neighbour cells plus the geometry and sequence facts the runtime
needs. Role names are this repo's reading of each sequence table, recorded as
such: the ROM states sequences and cells, not the words "meat" or "hand".

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
CONVERSION = PACK / "08_FULL_FAMILY_CONVERSION"
ROOT = Path(__file__).resolve().parent.parent
EXPECTED_ROM_SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
SCALE = 4

FAMILIES = {
    # Care items. Single-frame sequences are the four remaining amounts; the
    # two-frame sequences are one identity played as two poses.
    "care": {
        "resource": "common/i000_item",
        "out": "docs/art/production/care/faithful-hd4x",
        "roles": {
            0: ("meat", 0), 1: ("meat", 1), 2: ("meat", 2), 3: ("meat", 3),
            4: ("meat-rot", None),
            5: ("protein", 0), 6: ("protein", 1), 7: ("protein", 2), 8: ("protein", 3),
            9: ("protein-rot", None), 10: ("waste", None), 11: ("broom", None),
        },
        "counts": {"meat": 4, "protein": 4, "meat-rot": 2, "protein-rot": 2, "waste": 2, "broom": 2},
    },
    # Toolbar icons. These two sequences are icon banks addressed by frame, not
    # animations: the same ten icons in two tints. Frame 0 of each bank is blank.
    "toolbar": {
        "resource": "ui/UI_Icon_training",
        "out": "docs/art/production/toolbar/faithful-hd4x",
        "banks": {0: "lit", 1: "dim"},
        "icons": {1: "hand", 2: "feed", 3: "protein", 4: "clean",
                  5: "woundMedicine", 6: "medicine", 7: "manage"},
        "counts": {f"{name}-{bank}": 1 for name in
                   ["hand", "feed", "protein", "clean", "woundMedicine", "medicine", "manage"]
                   for bank in ["lit", "dim"]},
    },
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(resource: str):
    src = CONVERSION / resource
    anim = json.loads((src / "animations.json").read_text(encoding="utf-8"))
    cells = {c["cellIndex"]: c for c in json.loads((src / "cells.json").read_text(encoding="utf-8"))["cells"]}
    return src, anim, cells


def emit(src: Path, cells: dict, cell_id: int, name: str, out: Path, check: bool) -> dict:
    cell = cells[cell_id]
    bounds = cell["bounds"]
    width = bounds["maxXExclusive"] - bounds["minX"]
    height = bounds["maxYExclusive"] - bounds["minY"]
    image = Image.open(src / "cells" / f"cell-{cell_id:03d}.png").convert("RGBA")
    if image.size != (width, height):
        raise SystemExit(f"FAITHFUL: CELL_BOUNDS_MISMATCH:{cell_id}:{image.size}!={(width, height)}")
    dest = out / name
    if not check:
        image.resize((width * SCALE, height * SCALE), Image.NEAREST).save(dest)
    return {
        "file": name, "cellId": cell_id,
        "nativeWidth": width, "nativeHeight": height,
        # Sprite origin inside the image, in native pixels.
        "nativeAnchorX": -bounds["minX"], "nativeAnchorY": -bounds["minY"],
        "sha256": sha(dest) if dest.exists() else None,
    }


def build_care(family: dict, src: Path, anim: dict, cells: dict, out: Path, check: bool) -> list[dict]:
    entries = []
    for seq in anim["sequences"]:
        role_amount = family["roles"].get(seq["sequenceId"])
        if role_amount is None:
            continue
        role, amount = role_amount
        for frame in seq["frames"]:
            pose = frame["frameIndex"] if amount is None else amount
            entry = emit(src, cells, frame["cellId"], f"{role}-{pose}.png", out, check)
            entry.update(role=role, pose=pose, sequenceId=seq["sequenceId"],
                         rawDurationTicks=frame["rawDurationTicks"])
            entries.append(entry)
    return entries


def build_toolbar(family: dict, src: Path, anim: dict, cells: dict, out: Path, check: bool) -> list[dict]:
    entries = []
    for seq in anim["sequences"]:
        bank = family["banks"].get(seq["sequenceId"])
        if bank is None:
            continue
        for frame in seq["frames"]:
            icon = family["icons"].get(frame["frameIndex"])
            if icon is None:
                continue
            entry = emit(src, cells, frame["cellId"], f"{icon}-{bank}.png", out, check)
            entry.update(role=f"{icon}-{bank}", pose=0, sequenceId=seq["sequenceId"],
                         rawDurationTicks=frame["rawDurationTicks"])
            entries.append(entry)
    return entries


BUILDERS = {"care": build_care, "toolbar": build_toolbar}


def main(argv: list[str]) -> int:
    check = "--check" in argv
    wanted = [a for a in argv[1:] if not a.startswith("--")] or list(FAMILIES)
    prov = json.loads((PACK / "00_METADATA/FULL_DECONSTRUCTION_PROVENANCE.json").read_text(encoding="utf-8"))
    if prov.get("source_rom_sha256") != EXPECTED_ROM_SHA:
        raise SystemExit(f"FAITHFUL: UNEXPECTED_SOURCE_ROM:{prov.get('source_rom_sha256')}")

    for key in wanted:
        family = FAMILIES[key]
        out = ROOT / family["out"]
        if not check:
            out.mkdir(parents=True, exist_ok=True)
        src, anim, cells = load(family["resource"])
        entries = BUILDERS[key](family, src, anim, cells, out, check)
        counts: dict[str, int] = {}
        for entry in entries:
            counts[entry["role"]] = counts.get(entry["role"], 0) + 1
        if counts != family["counts"]:
            raise SystemExit(f"FAITHFUL: ROLE_COUNTS:{key}:{counts}!={family['counts']}")
        entries.sort(key=lambda entry: entry["file"])
        manifest = {
            "schemaVersion": 1, "id": f"{key}-faithful-hd4x",
            "sourceResource": family["resource"], "sourceRomSha256": EXPECTED_ROM_SHA,
            "researchPack": "YDIJ_PRIVATE_ROM_ART_PACK (not readable by the game)",
            "scale": SCALE, "filter": "nearest", "timingSemantics": anim["timingSemantics"],
            "roleEvidence": "ROLE_NAMES_ARE_THIS_REPO_READING_OF_THE_SEQUENCE_TABLE",
            "poseEvidence": "ROM_VERIFIED_SEQUENCE_AND_CELL_AND_TICKS",
            "cells": entries,
        }
        path = out / "manifest.json"
        if check:
            current = json.loads(path.read_text(encoding="utf-8"))
            drift = [e["file"] for e in current["cells"] if sha(out / e["file"]) != e["sha256"]]
            if drift or {e["file"] for e in current["cells"]} != {e["file"] for e in entries}:
                raise SystemExit(f"FAITHFUL: DRIFT:{key}:{drift}")
            print(f"{key} faithful hd4x check ok: {len(current['cells'])} cells")
            continue
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {len(entries)} faithful 4x {key} cells from {family['resource']}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
