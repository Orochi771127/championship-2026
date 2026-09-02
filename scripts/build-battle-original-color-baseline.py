#!/usr/bin/env python3
"""Derive per-field colour statistics for the original battle fields from the ROM.

Emits two aggregate scalars per field — area-weighted mean luminance and mean
saturation — so a rebuild can be checked against the original's actual colour
character instead of against taste.

Rights boundary: this writes **only aggregate statistics**. No palette entries,
tile data, indices or pixels are stored, and two scalars per field cannot
reconstruct any of them. That keeps the output in the same citable-metadata class
as `ROM_ART_CENSUS.json` under `research/original-evidence/README.md`.

The measurement decodes each field's NCGR tile payload through its own NCLR
palette, so it is area-weighted over authored art rather than counting each
palette slot once (a palette-only average over-weights colours used on a handful
of pixels).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import sys
from pathlib import Path
from typing import Any

import numpy as np

EXPECTED_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
DEFAULT_ROM = Path.home() / "Downloads" / f"{EXPECTED_ROM_SHA256}.nds"

# The eleven code-traced battle fields, plus the shared common layer they composite.
FIELDS = {
    "bm00": "BATTLE_SHARED_COMMON_LAYER",
    "bm01": "BATTLE_NORMAL",
    "bm02": "BATTLE_GRASS",
    "bm03": "BATTLE_VOLCANO",
    "bm04": "BATTLE_ISLAND",
    "bm05": "BATTLE_SOUTHPOLE",
    "bm06": "BATTLE_DESERT",
    "bm07": "BATTLE_CYBERSPACE",
    "bm08": "BATTLE_HELL",
    "bm09": "BATTLE_COLOSSEUM",
    "bm10": "BATTLE_STADIUM",
    "bm11": "BATTLE_DOMESTADIUM",
}
# Original UI/HUD payloads, sampled to characterise the interface palette.
UI_PALETTES = [
    ("/battle/battle_obj_main.nclr", "battle_obj_main"),
    ("/battle/battle_sub_bar.nclr", "battle_sub_bar"),
    ("/battle/battle_bg_sub.nclr", "battle_bg_sub"),
    ("/training/training_main.nclr", "training_main"),
    ("/database/zukan_bg2_sub.nclr", "zukan_bg2_sub"),
    ("/title_menu/title_bg_main.nclr", "title_bg_main"),
    ("/title_menu/start_back_bg_main.nclr", "start_back_bg_main"),
    ("/title_menu/game_moji_main.nclr", "game_moji_main"),
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Rom:
    def __init__(self, payload: bytes) -> None:
        self.d = payload
        self.files: dict[str, tuple[int, int]] = {}
        fnt = self.u32(0x40)
        fat, fat_size = self.u32(0x48), self.u32(0x4C)

        def walk(dir_id: int, path: str) -> None:
            entry = fnt + (dir_id & 0xFFF) * 8
            cursor = fnt + self.u32(entry)
            file_id = self.u16(entry + 4)
            while True:
                kind = self.d[cursor]
                cursor += 1
                if kind == 0:
                    return
                length = kind & 0x7F
                name = self.d[cursor:cursor + length].decode("shift_jis", "replace")
                cursor += length
                if kind < 0x80:
                    start = self.u32(fat + file_id * 8)
                    end = self.u32(fat + file_id * 8 + 4)
                    self.files[f"{path}/{name}"] = (start, end)
                    file_id += 1
                else:
                    child = self.u16(cursor)
                    cursor += 2
                    walk(child, f"{path}/{name}")

        walk(0xF000, "")

    def u16(self, o: int) -> int:
        return struct.unpack_from("<H", self.d, o)[0]

    def u32(self, o: int) -> int:
        return struct.unpack_from("<I", self.d, o)[0]

    def palette(self, path: str) -> np.ndarray | None:
        """Decode an NCLR's BGR555 entries to RGB."""
        span = self.files.get(path)
        if not span or self.d[span[0]:span[0] + 4] != b"RLCN":
            return None
        base = span[0]
        size = self.u32(base + 0x20)
        raw = struct.unpack_from(f"<{size // 2}H", self.d, base + 0x28)
        return np.array(
            [[(v & 31) * 255 // 31, ((v >> 5) & 31) * 255 // 31, ((v >> 10) & 31) * 255 // 31] for v in raw],
            dtype=np.uint8,
        )

    def indices(self, path: str) -> np.ndarray | None:
        """Decode an NCGR/NCBR CHAR payload to palette indices."""
        span = self.files.get(path)
        if not span or self.d[span[0]:span[0] + 4] != b"RGCN":
            return None
        base = span[0]
        depth = self.u32(base + 0x1C)          # 3 = 4bpp, 4 = 8bpp
        size = self.u32(base + 0x28)
        raw = np.frombuffer(self.d, np.uint8, size, base + 0x30)
        if depth == 3:
            return np.stack([raw & 0xF, raw >> 4], axis=1).ravel()
        return raw


def colour_stats(rgb: np.ndarray) -> tuple[float, float]:
    """Area-weighted mean luminance and mean HSV-style saturation, both 0-255 / 0-100."""
    rgb = rgb.astype(np.float64)
    high = rgb.max(axis=1)
    low = rgb.min(axis=1)
    saturation = np.where(high > 0, (high - low) / np.maximum(high, 1), 0.0) * 100.0
    luminance = rgb @ [0.2126, 0.7152, 0.0722]
    return float(luminance.mean()), float(saturation.mean())


def build(rom_path: Path) -> dict[str, Any]:
    digest = sha256_file(rom_path)
    if digest != EXPECTED_ROM_SHA256:
        raise SystemExit(f"ROM SHA-256 mismatch.\n  expected {EXPECTED_ROM_SHA256}\n  found    {digest}")
    rom = Rom(rom_path.read_bytes())

    fields: dict[str, Any] = {}
    for field, function in FIELDS.items():
        stem = f"field_{field}_00_common" if field == "bm00" else f"field_{field}_01"
        palette = rom.palette(f"/field/{stem}.nclr")
        indices = rom.indices(f"/field/{stem}.ncgr")
        if palette is None or indices is None:
            continue
        indices = indices[indices < len(palette)]
        luminance, saturation = colour_stats(palette[indices])
        fields[field] = {
            "originalFunction": function,
            "meanLuminance": round(luminance, 2),
            "meanSaturationPercent": round(saturation, 2),
            "sourceStem": stem,
        }

    interface = {}
    for path, label in UI_PALETTES:
        palette = rom.palette(path)
        if palette is None:
            continue
        used = palette[palette.sum(axis=1) > 0]
        if not len(used):
            continue
        luminance, saturation = colour_stats(used)
        interface[label] = {
            "meanLuminance": round(luminance, 2),
            "meanSaturationPercent": round(saturation, 2),
            "usedColours": int(len(used)),
        }

    field_values = list(fields.values())
    return {
        "schemaVersion": 1,
        "generator": "scripts/build-battle-original-color-baseline.py",
        "authority": "ROM_BINARY_GROUND_TRUTH",
        "rightsNote": (
            "Aggregate statistics only — two scalars per field. No palette entries, tile data, "
            "indices or pixels are stored, and these values cannot reconstruct any."
        ),
        "romSha256": digest,
        "method": (
            "Each field's NCGR tile payload decoded through its own NCLR palette, then averaged "
            "per pixel so the result is area-weighted over authored art."
        ),
        "fields": dict(sorted(fields.items())),
        "interfacePalettes": dict(sorted(interface.items())),
        "aggregate": {
            "meanLuminance": round(float(np.mean([f["meanLuminance"] for f in field_values])), 2),
            "meanSaturationPercent": round(float(np.mean([f["meanSaturationPercent"] for f in field_values])), 2),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rom", type=Path, default=Path(os.environ.get("CHAMPIONSHIP_YDIJ_ROM", DEFAULT_ROM)))
    parser.add_argument("--out", type=Path, default=Path("docs/art/BATTLE_FIELD_ORIGINAL_COLOR_BASELINE.json"))
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()

    if not arguments.rom.is_file():
        raise SystemExit(
            f"ROM not found: {arguments.rom}\n"
            "Pass --rom or set CHAMPIONSHIP_YDIJ_ROM. This script is opt-in; the ROM never enters the repository."
        )

    rendered = json.dumps(build(arguments.rom), ensure_ascii=False, indent=2) + "\n"
    if arguments.check:
        if not arguments.out.is_file() or arguments.out.read_text(encoding="utf-8") != rendered:
            raise SystemExit(f"{arguments.out} is stale; run scripts/build-battle-original-color-baseline.py")
        print(f"{arguments.out} matches the ROM.")
        return 0

    arguments.out.parent.mkdir(parents=True, exist_ok=True)
    with arguments.out.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(rendered)
    print(f"Wrote {arguments.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
