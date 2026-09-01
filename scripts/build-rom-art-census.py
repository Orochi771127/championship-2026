#!/usr/bin/env python3
"""Derive the Championship art census directly from an owner-supplied YDIJ ROM.

The Art-A registry baselines were originally produced by scanning an extracted
research filesystem (`coverage.json` recorded `mode=filesystem`, `status=PARTIAL`).
That scan is extension-driven, so it silently drops payloads whose file name does
not end in a recognised art extension and it cannot see directories that were
never extracted. This script re-derives the same numbers from the ROM's own
FAT/FNT so the registry can be reconciled against the binary rather than against
another derived artifact.

Only structural metadata leaves this script: NitroFS names, sizes, four-character
format magics and counts. No pixels, palettes, tiles, cells or model geometry are
read out, so the emitted census stays citable metadata under the evidence
firewall (`research/original-evidence/README.md`).
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import struct
import sys
from pathlib import Path
from typing import Any

EXPECTED_ROM_SHA256 = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
DEFAULT_ROM = Path.home() / "Downloads" / f"{EXPECTED_ROM_SHA256}.nds"

# Four-character Nitro container magics that carry authored artwork. Nitro writes
# these reversed on disk (NCGR -> "RGCN"), which is why the extension-driven scan
# and a magic-driven scan can disagree on the same file.
ART_MAGICS = {
    "RGCN": "NCGR_OR_NCBR_GRAPHICS",
    "RLCN": "NCLR_PALETTE",
    "RNAN": "NANR_CELL_ANIMATION",
    "RECN": "NCER_CELL",
    "RCSN": "NSCR_TILEMAP",
    "NXSR": "NXR_SCENE_LAYOUT",
    "NBSR": "NBS_FIELD_TILEMAP",
    "OPMD": "OPM_OBJECT_PLACEMENT",
    "DATR": "ATR_FIELD_ATTRIBUTE",
    "BSAR": "BSA_FIELD_ANIMATION",
    "RTFN": "NFTR_FONT",
    "BMD0": "NSBMD_MODEL",
    "BTA0": "NSBTA_TEXTURE_ANIMATION",
    "BCA0": "NSBCA_JOINT_ANIMATION",
    "BMA0": "NSBMA_MATERIAL_ANIMATION",
    "BVA0": "NSBVA_VISIBILITY_ANIMATION",
}
MODEL_MAGICS = ("BMD0", "BTA0", "BCA0", "BMA0", "BVA0")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Rom:
    """Minimal read-only NitroFS reader: header, FAT and FNT only."""

    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def u16(self, offset: int) -> int:
        return struct.unpack_from("<H", self.payload, offset)[0]

    def u32(self, offset: int) -> int:
        return struct.unpack_from("<I", self.payload, offset)[0]

    def title(self) -> str:
        return self.payload[0x00:0x0C].decode("ascii", "replace").rstrip("\0")

    def game_code(self) -> str:
        return self.payload[0x0C:0x10].decode("ascii", "replace")

    def files(self) -> list[dict[str, Any]]:
        fnt_offset = self.u32(0x40)
        fat_offset, fat_size = self.u32(0x48), self.u32(0x4C)
        total = fat_size // 8

        names: dict[int, str] = {}

        def directory(dir_id: int) -> tuple[int, int]:
            entry = fnt_offset + (dir_id & 0xFFF) * 8
            return self.u32(entry), self.u16(entry + 4)

        def walk(dir_id: int, path: str) -> None:
            subtable, first_file = directory(dir_id)
            cursor = fnt_offset + subtable
            file_id = first_file
            while True:
                kind = self.payload[cursor]
                cursor += 1
                if kind == 0:
                    return
                length = kind & 0x7F
                name = self.payload[cursor:cursor + length].decode("shift_jis", "replace")
                cursor += length
                if kind < 0x80:
                    names[file_id] = f"{path}/{name}"
                    file_id += 1
                else:
                    child = self.u16(cursor)
                    cursor += 2
                    walk(child, f"{path}/{name}")

        walk(0xF000, "")

        entries = []
        for file_id in range(total):
            start = self.u32(fat_offset + file_id * 8)
            end = self.u32(fat_offset + file_id * 8 + 4)
            blob = self.payload[start:end]
            magic = blob[:4].decode("ascii", "replace") if len(blob) >= 4 else ""
            entries.append({
                "id": file_id,
                # ARM9 overlays occupy FAT slots but carry no FNT name.
                "path": names.get(file_id, f"<overlay:{file_id}>"),
                "offset": start,
                "size": end - start,
                "magic": magic,
                "sha256": hashlib.sha256(blob).hexdigest() if magic in MODEL_MAGICS else None,
            })
        return entries


def stem_of(path: str) -> str:
    return re.sub(r"\.[^.]+$", "", path.rsplit("/", 1)[-1])


def nanr_sequence_count(payload: bytes, offset: int) -> int | None:
    """Read the animation sequence count from a NANR's ABNK block.

    Layout: 0x00 "RNAN", 0x10 block magic "KNBA", 0x18 u16 sequence count. The
    count is the number of animation slots the entity actually defines, which is
    what the registry models as an animation contract.
    """
    if payload[offset:offset + 4] != b"RNAN" or payload[offset + 0x10:offset + 0x14] != b"KNBA":
        return None
    return struct.unpack_from("<H", payload, offset + 0x18)[0]


def build_census(rom_path: Path) -> dict[str, Any]:
    digest = sha256_file(rom_path)
    if digest != EXPECTED_ROM_SHA256:
        raise SystemExit(
            f"ROM SHA-256 mismatch.\n  expected {EXPECTED_ROM_SHA256}\n  found    {digest}"
        )
    rom = Rom(rom_path.read_bytes())
    entries = rom.files()
    art = [entry for entry in entries if entry["magic"] in ART_MAGICS]

    families: dict[tuple[str, str], list[dict[str, Any]]] = collections.defaultdict(list)
    for entry in art:
        directory = entry["path"].rsplit("/", 1)[0] or "/"
        families[(directory, stem_of(entry["path"]))].append(entry)

    def art_paths(pattern: str) -> list[str]:
        return sorted(entry["path"] for entry in art if re.search(pattern, entry["path"]))

    models = [entry for entry in art if entry["magic"] in MODEL_MAGICS]
    unique_models = {entry["sha256"] for entry in models}
    hunt_biomes = sorted({
        match.group(1)
        for entry in art
        if (match := re.search(r"/field/field_(hm\d+)_", entry["path"]))
    })
    # Biome ids group variants; the variant is the individually authored field.
    hunt_variants = sorted({
        match.group(1)
        for entry in art
        if (match := re.search(r"/field/field_(hm\d+_\d+)\.", entry["path"]))
    })
    battle_fields = sorted({
        match.group(1)
        for entry in art
        if (match := re.search(r"/field/field_(bm\d+)_", entry["path"]))
    })
    cage_environments = sorted({
        match.group(1)
        for entry in art
        if (match := re.search(r"/training/.*?(cm\d+)", entry["path"]))
    })

    def entity_ids(directory: str) -> list[str]:
        return sorted({
            match.group(1)
            for entry in art
            if entry["path"].startswith(directory)
            and (match := re.match(r"^([a-z]\d{3})_", entry["path"].rsplit("/", 1)[-1]))
        })

    gameplay_entities = entity_ids("/digimon/")
    database_entities = entity_ids("/db_digimon/")

    # Animation contracts are read from each tier's NANR sequence counts. The
    # regular-entity mode is the contract; eggs carry their own reduced count.
    def animation_slots(directory: str, infix: str) -> dict[str, Any]:
        counts = collections.Counter()
        for entry in art:
            if not entry["path"].startswith(directory) or entry["magic"] != "RNAN":
                continue
            if infix not in entry["path"].rsplit("/", 1)[-1]:
                continue
            sequences = nanr_sequence_count(rom.payload, entry["offset"])
            if sequences is not None:
                counts[sequences] += 1
        ranked = counts.most_common()
        return {
            "regularSlots": ranked[0][0] if ranked else 0,
            "regularEntities": ranked[0][1] if ranked else 0,
            "eggSlots": ranked[1][0] if len(ranked) > 1 else 0,
            "eggEntities": ranked[1][1] if len(ranked) > 1 else 0,
        }

    contracts = {
        "gameplayMain": animation_slots("/digimon/", "_main."),
        "gameplaySub": animation_slots("/digimon/", "_sub."),
        "databaseMain": animation_slots("/db_digimon/", "_db_main."),
        "databaseSub": animation_slots("/db_digimon/", "_db_sub."),
    }
    sprite_effects = sorted({
        stem for (directory, stem) in families
        if directory == "/common" and re.match(r"^(e\d{3}_|i\d{3}_|effect$|evolution$)", stem)
    })
    fonts = art_paths(r"\.NFTR$")

    return {
        "schemaVersion": 1,
        "generator": "scripts/build-rom-art-census.py",
        "authority": "ROM_BINARY_GROUND_TRUTH",
        "note": (
            "Structural metadata only: NitroFS names, sizes and format magics. "
            "Supersedes filesystem-scanned baselines, which were extension-driven and PARTIAL."
        ),
        "rom": {
            "title": rom.title(),
            "gameCode": rom.game_code(),
            "sha256": digest,
            "fatEntries": len(entries),
            "namedFiles": sum(1 for entry in entries if not entry["path"].startswith("<overlay:")),
            "arm9Overlays": sum(1 for entry in entries if entry["path"].startswith("<overlay:")),
        },
        "counts": {
            "artFiles": len(art),
            "artFamilies": len(families),
            "byMagic": dict(sorted(collections.Counter(entry["magic"] for entry in art).items())),
            "byDirectory": dict(sorted(collections.Counter(
                entry["path"].rsplit("/", 1)[0] or "/" for entry in art
            ).items())),
        },
        "baselines": {
            "nxrScenes": sum(1 for entry in art if entry["magic"] == "NXSR"),
            "entities": len(gameplay_entities),
            "entityFilesPerContract": (
                len([entry for entry in art if entry["path"].startswith("/digimon/")]) // max(len(gameplay_entities), 1)
            ),
            "mainAnimationSlots": contracts["gameplayMain"]["regularSlots"],
            "subAnimationSlots": contracts["gameplaySub"]["regularSlots"],
            "huntBiomes": len(hunt_biomes),
            "cageEnvironments": len(cage_environments),
            "battleFields": len([field for field in battle_fields if field != "bm00"]),
            "nitro3dFiles": len(models),
            "nitro3dUnique": len(unique_models),
        },
        "animationContracts": contracts,
        "tiers": {
            "characterGameplay": {
                "directory": "/digimon",
                "entities": len(gameplay_entities),
                "files": len([entry for entry in art if entry["path"].startswith("/digimon/")]),
            },
            "characterDatabase": {
                "directory": "/db_digimon",
                "entities": len(database_entities),
                "files": len([entry for entry in art if entry["path"].startswith("/db_digimon/")]),
            },
            "spriteEffects": {"directory": "/common", "families": len(sprite_effects)},
            "fonts": {"files": len(fonts), "paths": fonts},
            "huntBiomeIds": hunt_biomes,
            "huntFieldVariants": hunt_variants,
            # Distinct from the 16 biome nodes in gate_select/3D_worldMap_model.
            # That count is a Gate Select model fact and is unaffected by this census.
            "huntFieldVariantCount": len(hunt_variants),
            "battleFieldIds": battle_fields,
            "battleFieldSharedLayer": "field_bm00_00",
            "spriteEffectFamilies": sprite_effects,
        },
        "families": [
            {
                "directory": directory,
                "stem": stem,
                "files": sorted(
                    ({"name": entry["path"].rsplit("/", 1)[-1], "size": entry["size"], "magic": entry["magic"]}
                     for entry in entries_in_family),
                    key=lambda item: item["name"],
                ),
            }
            for (directory, stem), entries_in_family in sorted(families.items())
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rom", type=Path, default=Path(os.environ.get("CHAMPIONSHIP_YDIJ_ROM", DEFAULT_ROM)))
    parser.add_argument("--out", type=Path, default=Path("docs/art/ROM_ART_CENSUS.json"))
    parser.add_argument("--check", action="store_true", help="fail if the emitted census differs from --out")
    arguments = parser.parse_args()

    if not arguments.rom.is_file():
        raise SystemExit(
            f"ROM not found: {arguments.rom}\n"
            "Pass --rom or set CHAMPIONSHIP_YDIJ_ROM. This script is opt-in and reads an "
            "owner-supplied ROM that never enters the repository."
        )

    census = build_census(arguments.rom)
    rendered = json.dumps(census, ensure_ascii=False, indent=2, sort_keys=False) + "\n"

    if arguments.check:
        if not arguments.out.is_file() or arguments.out.read_text(encoding="utf-8") != rendered:
            raise SystemExit(f"{arguments.out} is stale; run scripts/build-rom-art-census.py")
        print(f"{arguments.out} matches the ROM.")
        return 0

    arguments.out.parent.mkdir(parents=True, exist_ok=True)
    with arguments.out.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(rendered)
    print(
        "ROM census: {files} art files in {families} families; "
        "{gameplay} gameplay + {database} database character entities; "
        "{hunt} hunt biomes; {models} Nitro 3D files ({unique} unique).".format(
            files=census["counts"]["artFiles"],
            families=census["counts"]["artFamilies"],
            gameplay=census["tiers"]["characterGameplay"]["entities"],
            database=census["tiers"]["characterDatabase"]["entities"],
            hunt=census["baselines"]["huntBiomes"],
            models=census["baselines"]["nitro3dFiles"],
            unique=census["baselines"]["nitro3dUnique"],
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
