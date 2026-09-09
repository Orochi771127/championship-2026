#!/usr/bin/env python3
"""Trace BM04/BM08/BM11 field-object structure without exporting ROM pixels.

The output is deliberately metadata-only: source hashes, placement coordinates,
sequence bindings, raw frame ticks and cell bounds.  It is evidence for making
original-created replacements, never a runtime art source.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FIELD_ROOT = Path(
    r"R:\NEXUS LINK\原作\research-only\YDIJ_FULL_ROM_DECONSTRUCTION_2026-08-29"
    r"\unpacked\nitrofs\field"
)
OUTPUT = ROOT / "docs" / "research" / "BATTLE_BM04_BM08_BM11_OBJECT_TRACE_2026-09-02.json"
PLATFORM_HZ = 59.8260982880808
FIELDS = {
    "field_bm04_01": {
        "hashes": {
            "nanr": "E249EA53970594AB88021C4D4D63294CC8AA164CC14CAF02C21B684A58614C37",
            "ncbr": "75E8B5EE3F3E4A3DA394757E5D8E41C6DCE09912CF3E6B42FAE6D2684A6534A4",
            "ncer": "37D39CBA5DF731CF946DA4F4D7A7494467DBA746A189679CF88ADC1AB1D297EC",
            "nclr": "A96DC367308B71EEA91D03E7A863146C154EFE08F363EC8748F774F82C73AC3F",
            "opm": "5F493829461B98EF2FAA622554961C8CEEF86152F973CE0A0ADC0E27180B60E7",
        },
    },
    "field_bm08_01": {
        "hashes": {
            "nanr": "ADF4AEC0A530CE12463E99A727E8784302D37921A05FBC3B299AC507E2CF6E05",
            "ncbr": "97673A00F2F35600FFC1F9A6B01F1D549F91474927DCADC298FD458D983A5307",
            "ncer": "2CD0E0825B243B8A8A16E555931B0E5B0E250E240C278F4B48F72F37C3167F78",
            "nclr": "281EAB6F1F9283E81AACC8E1CC792A23C88EB14D68E7F5EF0FC11ABF9A6D3491",
            "opm": "58558903CCC2123BE66C1F77E58F77EF0C1E83AAC16230430A17011847C3F78C",
        },
    },
    "field_bm11_01": {
        "hashes": {
            "nanr": "6018C5EC55253763FF453F74522BB809E51CCC6262E4FB53EEF8DF73F1BEBD43",
            "ncbr": "8C1D451A7B0D38963433A9ECA0E39C9162C01BF1A629A5D420380D475C33FCCE",
            "ncer": "652B9D19C0EFA3AEB581BB37C11B812E77AF56F9B158A5BD33862FD3F542881C",
            "nclr": "3EA4DC62DB54B183F4BA2B3994E25B71CC3EDA45F05C1E3CDE82A73A108BAE42",
            "opm": "C12800921240885F4F012F51EEC1A553CE4FBD30A38F293849D173FAE75266FE",
        },
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest().upper()
    return digest


def load_parsers():
    scripts = str(ROOT / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    source = ROOT / "scripts" / "build-cage-faithful-hd40.py"
    spec = importlib.util.spec_from_file_location("championship_cage_parser", source)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    from lib.ydij_map_formats import parse_ncer
    return module.parse_opm, module.parse_nanr, parse_ncer


def build_trace(field_root: Path) -> dict:
    parse_opm, parse_nanr, parse_ncer = load_parsers()
    fields = []
    for field_id, contract in FIELDS.items():
        base = field_root / f"{field_id}_obj"
        sources = {}
        for extension, expected_hash in contract["hashes"].items():
            path = base.with_suffix(f".{extension}")
            if not path.is_file():
                raise SystemExit(f"Missing research source: {path}")
            observed_hash = sha256(path)
            if observed_hash != expected_hash:
                raise SystemExit(f"Research source drift: {path.name} {observed_hash}")
            sources[extension] = {"fileName": path.name, "sha256": observed_hash}

        opm = parse_opm(base.with_suffix(".opm"))
        nanr = parse_nanr(base.with_suffix(".nanr"))
        ncer = parse_ncer(base.with_suffix(".ncer"))
        sequences = {item["sequenceId"]: item for item in nanr["sequences"]}
        cells = {item["cellIndex"]: item for item in ncer["cells"]}
        placements = []
        for placement in opm["placements"]:
            sequence = sequences[placement["sequenceId"]]
            frames = []
            for frame in sequence["frames"]:
                bounds = cells[frame["cellId"]]["bounds"]
                frames.append({
                    "frameIndex": frame["frameIndex"],
                    "cellId": frame["cellId"],
                    "rawDurationTicks": frame["rawDurationTicks"],
                    "previewDurationMs": frame["rawDurationTicks"] * 1000 / PLATFORM_HZ,
                    "bounds": bounds,
                })
            placements.append({
                "ordinal": placement["ordinal"],
                "sequenceId": placement["sequenceId"],
                "sourceX": placement["sourceX"],
                "sourceY": placement["sourceY"],
                "horizontalFlip": placement["horizontalFlip"],
                "verticalFlip": placement["verticalFlip"],
                "rawFlags": placement["rawFlags"],
                "frames": frames,
            })
        fields.append({
            "fieldId": field_id,
            "nativeCanvas": [416, 272],
            "sourceFiles": sources,
            "placementCount": opm["placementCount"],
            "cellCount": ncer["cellCount"],
            "sequenceCount": nanr["sequenceCount"],
            "totalFrameCount": nanr["totalFrameCount"],
            "placements": placements,
        })
    return {
        "schemaVersion": 1,
        "traceId": "BATTLE-BM04-BM08-BM11-FIELD-OBJECTS-2026-09-02",
        "result": "OBJECT_PLACEMENT_AND_FRAME_STRUCTURE_CLOSED_FOR_ORIGINAL_CREATED_REPLACEMENT",
        "authority": "VERIFIED_RAW_OPMD_TO_NANR_TO_NCER_METADATA",
        "timingEvidence": "RAW_NANR_TICKS_PLUS_HIGH_CONFIDENCE_PLATFORM_FRAME_CLOCK_CROSSCHECK",
        "previewClockHz": PLATFORM_HZ,
        "semanticLimit": "PRESENTATION_STRUCTURE_ONLY_NO_GAMEPLAY_MEANING",
        "dataBoundary": "METADATA_ONLY_NO_PIXEL_PALETTE_TILE_OR_NITRO_PAYLOAD",
        "fields": fields,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--field-root", type=Path, default=DEFAULT_FIELD_ROOT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    payload = json.dumps(build_trace(args.field_root), indent=2) + "\n"
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != payload:
            raise SystemExit("Battle object trace is missing or stale")
        print(f"PASS {OUTPUT.relative_to(ROOT)}")
        return
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(payload, encoding="utf-8")
    print(f"WROTE {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
