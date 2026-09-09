#!/usr/bin/env python3
"""Trace BM03/BM04 Battle BSAR structure without importing ROM payloads.

The caller supplies the external extracted `nitrofs/field` directory. Output is
metadata only: verified hashes, full-field placement, frame counts and original
tick durations. No decoded pixel, palette, tile or Nitro payload is written.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "lib"))

from ydij_map_formats import decode_ncgr, parse_bsar  # noqa: E402


OUTPUT = ROOT / "docs" / "research" / "BATTLE_BM03_BM04_ANIMATION_TRACE_2026-09-02.json"
ROM_SHA256 = "8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1"
TICK_HZ = 33_513_982 / 6 / 355 / 263
EXPECTED = {
    "field_bm03_01": {
        "function": "BATTLE_VOLCANO",
        "bsa": "C0607A44D293F36EC1232FB66AA860EC002D9FF89B2004EB419EDB523A71EB67",
        "ncgr": "BAB81DDDF095FF48E1CC3623D87129763263622F0B3EA7A2AEF11E294B541D3F",
        "nclr": "D553EEA8EDC95EBEC1F7E5EA78DDC60C48EA5C02A3C512D8EDDAFE2D0A6D75AC",
        "ticks": [50, 50],
    },
    "field_bm04_01": {
        "function": "BATTLE_ISLAND",
        "bsa": "7072423CC88BE0B27683C94782EAF37197AEAFACC1B4BEBCB689FDFC44B296C9",
        "ncgr": "675721DE7FEA6793115E7F694B937777DA95294CE89DD1E846B032EC6623AF96",
        "nclr": "25FC6D70DDF5B22350925390B1A273CAC926CFF16133B3E0FA12DC6F11DA373F",
        "ticks": [20, 20],
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def build(field_root: Path) -> dict:
    fields = []
    for field_id, expected in EXPECTED.items():
        prefix = field_root / f"{field_id}_anim"
        paths = {ext: prefix.with_suffix(f".{ext}") for ext in ("bsa", "ncgr", "nclr")}
        for ext, path in paths.items():
            if not path.is_file():
                raise SystemExit(f"Missing external trace input: {path}")
            observed = sha256(path)
            if observed != expected[ext]:
                raise SystemExit(f"{path.name} hash mismatch: {observed}")

        animation = parse_bsar(paths["bsa"])
        tiles, graphics = decode_ncgr(paths["ncgr"])
        if [animation["width"], animation["height"]] != [52, 34]:
            raise SystemExit(f"{field_id} animation is not the full Battle field grid")
        if animation["frameCount"] != 2 or animation["frameDurationsRawTicks"] != expected["ticks"]:
            raise SystemExit(f"{field_id} frame timeline differs from expected trace")
        max_tiles = [
            max(symbol["frameTileEntries"][frame]["tileIndex"] for symbol in animation["symbols"])
            for frame in range(animation["frameCount"])
        ]
        if any(index >= len(tiles) for index in max_tiles):
            raise SystemExit(f"{field_id} BSAR references a missing animation tile")

        fields.append({
            "fieldId": field_id,
            "originalFunction": expected["function"],
            "sourceEvidence": "VERIFIED_ROM_PAYLOAD_HASH_AND_BSAR_STRUCTURE",
            "sourcePayloadHashes": {ext: expected[ext] for ext in ("bsa", "ncgr", "nclr")},
            "format": animation["format"],
            "version": animation["version"],
            "headerWords": [animation["unknownHeaderWord0"], animation["unknownHeaderWord2"]],
            "frameCount": animation["frameCount"],
            "frameDurationsRawTicks": animation["frameDurationsRawTicks"],
            "frameDurationsMs": [tick * 1000 / TICK_HZ for tick in animation["frameDurationsRawTicks"]],
            "timingEvidence": "VERIFIED_BINARY_PLUS_PLATFORM_VIDEO_CLOCK_ARM9_0x0204ED5C",
            "gridCells": [animation["width"], animation["height"]],
            "dimensionsPixels": [animation["width"] * 8, animation["height"] * 8],
            "originPixels": [0, 0],
            "placementEvidence": "HIGH_CONFIDENCE_CROSSCHECK_FULL_FIELD_GRID_EQUALS_BATTLE_ARENA",
            "symbolCount": animation["symbolCount"],
            "uniqueGridSymbols": len(set(animation["gridSymbols"])),
            "graphicsTileCount": graphics["tileCount"],
            "maximumReferencedTileByFrame": max_tiles,
            "compositionOrder": "ANIMATED_TERRAIN_BED_THEN_STATIC_TERRAIN_AND_OBJECTS_THEN_BM00_COMMON",
            "compositionEvidence": "HIGH_CONFIDENCE_CROSSCHECK_SHARED_BSAR_RENDERER_AND_ORIGINAL_VISUAL_REFERENCE",
            "semanticClaim": "FIELD_ANIMATION_ONLY_NO_GAMEPLAY_MEANING",
        })

    return {
        "schemaVersion": 1,
        "traceId": "BATTLE_BM03_BM04_ANIMATION_TRACE_2026_09_02",
        "romSha256": ROM_SHA256,
        "inputPolicy": "EXTERNAL_RESEARCH_ONLY_NO_PAYLOAD_WRITTEN",
        "timingClockHz": TICK_HZ,
        "genericUpdateCallSite": "ARM9_0x02083D1C_CALLS_0x0204ED5C_WITH_UPDATE_FLAG_1",
        "result": "PLACEMENT_TIMING_AND_COMPOSITION_CLOSED_FOR_ORIGINAL_CREATED_REPLACEMENT",
        "fields": fields,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--field-root", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    payload = json.dumps(build(args.field_root), indent=2) + "\n"
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != payload:
            raise SystemExit(f"{OUTPUT.relative_to(ROOT)} is stale; rerun trace")
        print("BM03/BM04 Battle animation trace metadata is current.")
        return
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(payload, encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with 2 verified Battle animation timelines.")


if __name__ == "__main__":
    main()
