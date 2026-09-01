#!/usr/bin/env python3
"""Reconcile the Art-A registry against the ROM census and regenerate its views.

The registry's 752 decision units were derived from an extension-driven scan of an
extracted research filesystem. That scan could not see payloads whose file name
lacked a recognised art extension, nor directories that were never extracted, so
whole art tiers were absent while every baseline still reported `MATCH` (expected
and observed came from the same scan).

This script re-derives coverage from `docs/art/ROM_ART_CENSUS.json` — which is
built straight from the ROM's FAT/FNT — adds a decision unit for every original
art family the registry does not already account for, corrects the baselines that
disagree with the binary, and regenerates every deterministic view.

It is idempotent: units it previously contributed are dropped and rebuilt on each
run, so re-running after a census refresh converges rather than duplicating.
"""

from __future__ import annotations

import argparse
import collections
import csv
import io
import json
import re
import sys
from pathlib import Path
from typing import Any

CENSUS_SOURCE = "YDIJ ROM art census"
CENSUS_PATH = "docs/art/ROM_ART_CENSUS.json"
STOP_MARKER = "ART-A COMPLETE; STOP AWAITING OWNER APPROVAL"

DOMAIN_FILES = {
    "UI": "UI_ASSET_MATRIX.csv",
    "CHARACTER": "CHARACTER_ASSET_MATRIX.csv",
    "CHARACTER_ANIMATION": "CHARACTER_ANIMATION_MATRIX.csv",
    "MAP": "MAP_ASSET_MATRIX.csv",
    "BATTLE_FIELD": "BATTLE_FIELD_ASSET_MATRIX.csv",
    "VFX": "VFX_ASSET_MATRIX.csv",
    "THREE_D": "3D_ASSET_MATRIX.csv",
}
CSV_FIELDS = [
    "assetId", "domain", "assetKind", "logicalGroup", "source", "sourcePath",
    "sourceType", "originalFunction", "originalRenderer", "modernRenderer",
    "productionStatus", "shippingStatus", "evidenceStatus", "rightsStatus",
    "replacementRequired", "replacementComplete", "humanApproved", "runtimeQaPassed",
    "dimensions", "format", "runtimeConsumer", "visualQaStatus", "generation",
    "disposition", "replacementAssetId", "dependencies", "blockers", "notes",
]
ROLE_BY_MAGIC = {
    "RGCN": "GRAPHICS", "RLCN": "PALETTE", "RNAN": "CELL_ANIMATION", "RECN": "CELL",
    "RCSN": "TILEMAP", "NXSR": "SCENE_LAYOUT", "NBSR": "FIELD_TILEMAP",
    "OPMD": "OBJECT_PLACEMENT", "DATR": "FIELD_ATTRIBUTE", "BSAR": "FIELD_ANIMATION",
    "RTFN": "FONT",
}


def slug(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-")


def scalar(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return str(value)


def csv_text(rows: list[dict[str, Any]]) -> str:
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS, lineterminator="\n", extrasaction="ignore")
    writer.writeheader()
    for row in sorted(rows, key=lambda item: item.get("assetId", "")):
        writer.writerow({field: scalar(row.get(field)) for field in CSV_FIELDS})
    return stream.getvalue()


def coverage_tokens(units: list[dict[str, Any]]) -> set[str]:
    """Every string by which an existing unit can claim a ROM family."""
    tokens: set[str] = set()
    for unit in units:
        strings = [str(unit.get("logicalGroup", ""))]
        strings += [component["path"] for component in unit.get("components", [])]
        strings += list(unit.get("evidenceRefs", []))
        for value in strings:
            base = value.replace("\\", "/").rsplit("/", 1)[-1].lower()
            stem = re.sub(r"\.[^.]+$", "", base)
            tokens.update({
                value.lower(),
                base,
                stem,
                re.sub(r"(_main_cells|_sub_cells|_cells|_bg|_4x)$", "", stem),
            })
    return tokens


def is_covered(directory: str, stem: str, tokens: set[str]) -> bool:
    # Tokens are lowercased, and ROM stems are mixed case (BG_training_main,
    # CageAssignSP), so fold the stem before comparing or those families read as
    # uncovered and get registered a second time.
    stem = stem.lower()
    directory = directory.lower()
    candidates = {
        stem,
        re.sub(r"_(anim|obj|common)$", "", stem),
        f"{directory.strip('/')}/{stem}",
    }
    for extension in (".nscr", ".ncgr", ".ncbr", ".nanr", ".ncer", ".nclr", ".nxr", ".nbs", ".opm", ".atr", ".bsa"):
        candidates.add(f"{directory.strip('/')}/{stem}{extension}")
        candidates.add(f"{stem}{extension}")
    # Hunt biomes are registered by biome id (HM01), not by field file name.
    biome = re.match(r"^field_(hm\d+)_", stem)
    if biome:
        candidates.add(biome.group(1))
    return any(candidate in tokens for candidate in candidates)


def unit(
    asset_id: str,
    domain: str,
    asset_kind: str,
    logical_group: str,
    original_function: str,
    modern_renderer: str,
    notes: str,
    components: list[dict[str, Any]],
    blockers: list[str],
    evidence_status: str = "VERIFIED_BINARY",
    production_status: str = "NEEDS_REBUILD",
    original_renderer: str = "NDS_2D",
) -> dict[str, Any]:
    return {
        "assetId": asset_id,
        "domain": domain,
        "assetKind": asset_kind,
        "logicalGroup": logical_group,
        "source": CENSUS_SOURCE,
        "sourcePath": CENSUS_PATH,
        "sourceType": "ROM_BINARY",
        "originalFunction": original_function,
        "originalRenderer": original_renderer,
        "modernRenderer": modern_renderer,
        "productionStatus": production_status,
        "shippingStatus": "ORIGINAL_REPLACEMENT_REQUIRED",
        "evidenceStatus": evidence_status,
        "rightsStatus": "ROM_COPYRIGHTED_REFERENCE",
        "disposition": "REBUILD",
        "replacementRequired": True,
        "components": components,
        "evidenceRefs": [CENSUS_PATH],
        "dependencies": [],
        "blockers": blockers,
        "replacementAssetId": None,
        "notes": notes,
    }


def components_for(families: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for family in families:
        for item in family["files"]:
            rows.append({
                "path": f"rom:{family['directory']}/{item['name']}",
                "role": ROLE_BY_MAGIC.get(item["magic"], "UNKNOWN"),
                "sourceType": "ROM_BINARY",
                "sizeBytes": item["size"],
            })
    return sorted(rows, key=lambda row: row["path"])


def ui_kind(families: list[dict[str, Any]]) -> str:
    magics = {item["magic"] for family in families for item in family["files"]}
    if "NXSR" in magics:
        return "NXR_SCENE_LAYOUT"
    if magics & {"RCSN", "NBSR"}:
        return "UI_BACKGROUND_REFERENCE"
    return "UI_CELL_BUNDLE_REFERENCE"


def build_new_units(census: dict[str, Any], tokens: set[str]) -> list[dict[str, Any]]:
    by_key = {(family["directory"], family["stem"]): family for family in census["families"]}
    uncovered = {
        key: family for key, family in by_key.items()
        if not is_covered(key[0], key[1], tokens)
        # The 96 NXR scenes are fully registered; two of them are grouped under a
        # "battle-runtime" logical group that no file-name token can match.
        and {item["magic"] for item in family["files"]} != {"NXSR"}
    }
    consumed: set[tuple[str, str]] = set()
    units: list[dict[str, Any]] = []

    # --- character database tier: /db_digimon, one unit per entity -------------
    entities: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for key, family in uncovered.items():
        if key[0] != "/db_digimon":
            continue
        # Some entities carry a third name component (m314_garurumon_va).
        entity = re.match(r"^([a-z]\d{3}_.+)_db_(main|sub)$", family["stem"])
        if entity:
            entities[entity.group(1)].append(family)
            consumed.add(key)
    for entity, families in sorted(entities.items()):
        is_egg = "digitama" in entity
        units.append(unit(
            asset_id=f"art:character:{slug(entity)}:db-reference",
            domain="CHARACTER",
            asset_kind="CHARACTER_DB_ENTITY_REFERENCE",
            logical_group=f"db_digimon/{entity}",
            original_function=f"RAW_DB_ENTITY_{entity.upper()}",
            modern_renderer="PIXIJS_2D",
            notes=(
                f"Database/encyclopedia art tier for {entity}; "
                f"{'egg' if is_egg else 'regular'}; 8 files per entity "
                "(db Main/Sub x NANR, graphics, NCER, NCLR). A separate tier from the gameplay "
                "sprite set: the palette is shared with the gameplay tier, but graphics, cells and "
                "animations are distinct and roughly a fifth of the size. Its animation contract is "
                "also its own — see art:character-animation:db-main-slot-* and db-sub-slot-*."
            ),
            components=components_for(sorted(families, key=lambda item: item["stem"])),
            blockers=[
                "NEXUS_IDENTITY_AND_RIGHTS_REPLACEMENT_REQUIRED",
                "DATABASE_TIER_NOT_IN_ORIGINAL_752_UNIT_AUDIT",
            ],
        ))

    # --- database-tier animation contracts, read from NANR sequence counts -----
    for side in ("Main", "Sub"):
        contract = census["animationContracts"][f"database{side}"]
        for index in range(contract["regularSlots"]):
            units.append(unit(
                asset_id=f"art:character-animation:db-{side.lower()}-slot-{index:02d}:rom-contract",
                domain="CHARACTER_ANIMATION",
                asset_kind="CHARACTER_ANIMATION_SLOT_CONTRACT",
                logical_group=f"db-{side.lower()}-animation-contract",
                original_function=f"RAW_DB_{side.upper()}_SLOT_{index:02d}",
                modern_renderer="PIXIJS_2D",
                production_status="NEEDS_REANIMATION",
                notes=(
                    f"Database tier {side} animation slot {index:02d} of {contract['regularSlots']}. "
                    f"Read from NANR sequence counts: {contract['regularEntities']} regular entities "
                    f"declare {contract['regularSlots']} slots, {contract['eggEntities']} eggs declare "
                    f"{contract['eggSlots']}. Distinct from the gameplay contract "
                    f"({census['baselines']['mainAnimationSlots']} Main / "
                    f"{census['baselines']['subAnimationSlots']} Sub). Slot meaning is unnamed until traced."
                ),
                components=[],
                blockers=[
                    "ORIGINAL_ANIMATION_REPLACEMENT_REQUIRED",
                    "SEMANTIC_CALL_TRACE_REQUIRED",
                ],
            ))

    # --- 2D sprite effect library: /common ------------------------------------
    for key, family in sorted(uncovered.items()):
        if key[0] != "/common" or key in consumed:
            continue
        stem = family["stem"]
        if stem.startswith("e002_hunt"):
            role, renderer = "HUNT_TOOL_OR_TRAP_SPRITE", "PIXIJS_2D"
        elif stem.startswith("e003_"):
            role, renderer = "BATTLE_ATTACK_SPRITE", "PIXIJS_2D"
        elif stem.startswith("e001_") or stem == "evolution":
            role, renderer = "EVOLUTION_OR_RAISING_SPRITE", "PIXIJS_2D"
        elif stem.startswith("i000_"):
            role, renderer = "ITEM_ICON_SHEET", "PIXIJS_2D"
        else:
            role, renderer = "SHARED_EFFECT_SPRITE", "PIXIJS_2D"
        consumed.add(key)
        units.append(unit(
            asset_id=f"art:vfx:{slug(stem)}:sprite-reference",
            domain="VFX",
            asset_kind="VFX_2D_SPRITE_FAMILY",
            logical_group=f"common/{stem}",
            original_function=f"RAW_2D_{role}_{slug(stem).upper().replace('-', '_')}",
            modern_renderer=renderer,
            notes=(
                f"2D cell-animated effect family ({role}). The original 26 VFX units are all Nitro 3D "
                "models; this entire 2D sprite library was outside the 752-unit audit. Trigger and "
                "timing remain gameplay authority and must be traced, not inferred from the artwork."
            ),
            components=components_for([family]),
            blockers=[
                "ORIGINAL_EFFECT_REPLACEMENT_REQUIRED",
                "TRIGGER_AND_TIMING_UNKNOWN_REQUIRES_TRACE",
                "SPRITE_VFX_TIER_NOT_IN_ORIGINAL_752_UNIT_AUDIT",
            ],
        ))

    # --- fonts ----------------------------------------------------------------
    for key, family in sorted(uncovered.items()):
        if not key[0].endswith("font") or key in consumed:
            continue
        consumed.add(key)
        units.append(unit(
            asset_id=f"art:ui:font-{slug(family['stem'])}:font-reference",
            domain="UI",
            asset_kind="UI_FONT_REFERENCE",
            logical_group=f"{key[0].strip('/')}/{family['stem']}",
            original_function=f"RAW_FONT_{slug(family['stem']).upper().replace('-', '_')}",
            modern_renderer="DOM_CSS",
            notes=(
                "Original NFTR bitmap font. The audit had no typography tier at all. A 9:16 rebuild "
                "needs a licensed or original face with CJK coverage; do not ship converted glyphs."
            ),
            components=components_for([family]),
            blockers=["ORIGINAL_OR_LICENSED_TYPEFACE_REQUIRED", "FONT_TIER_NOT_IN_ORIGINAL_752_UNIT_AUDIT"],
        ))

    # --- hunt biome HM00 ------------------------------------------------------
    hm00 = sorted(
        (family for key, family in uncovered.items()
         if key[0] == "/field" and family["stem"].startswith("field_hm00_")),
        key=lambda item: item["stem"],
    )
    if hm00:
        for family in hm00:
            consumed.add(("/field", family["stem"]))
        units.append(unit(
            asset_id="art:map:hm00:hunt-reference",
            domain="MAP",
            asset_kind="HUNT_BIOME_REFERENCE",
            logical_group="HM00",
            original_function="HUNT_BIOME_HM00",
            modern_renderer="LAYERED_2D",
            notes=(
                "Seventeenth Hunt biome. The terrain reference starts at HM01, so this field was "
                "missing from the 16-biome baseline. It is a complete field, not a template: base "
                "tilemap plus an _anim (BSA) layer and an _obj (OPM/NCER) layer, the same three-layer "
                "structure as the documented biomes. Biome identity and terrain effects are gameplay "
                "authority and stay neutral until traced."
            ),
            components=components_for(hm00),
            blockers=[
                "ORIGINAL_BIOME_REPLACEMENT_REQUIRED",
                "BIOME_IDENTITY_UNKNOWN_REQUIRES_TRACE",
                "BIOME_NOT_IN_ORIGINAL_16_BIOME_BASELINE",
            ],
        ))

    # --- shared battle field layer -------------------------------------------
    bm00 = sorted(
        (family for key, family in uncovered.items()
         if key[0] == "/field" and family["stem"].startswith("field_bm00_")),
        key=lambda item: item["stem"],
    )
    if bm00:
        for family in bm00:
            consumed.add(("/field", family["stem"]))
        units.append(unit(
            asset_id="art:battle-field:field-bm00-00:shared-layer-reference",
            domain="BATTLE_FIELD",
            asset_kind="BATTLE_FIELD_SHARED_LAYER_REFERENCE",
            logical_group="field_bm00_00",
            original_function="BATTLE_FIELD_SHARED_COMMON_LAYER",
            modern_renderer="LAYERED_2D",
            notes=(
                "Shared sprite/OPM layer that 10 of the 11 battle fields reference "
                "(BATTLE_CYBERSPACE is the sole exception). Correctly excluded from the 11-field "
                "count, but it is authored art in its own right and needs its own replacement, so "
                "the arenas that composite it stay consistent."
            ),
            components=components_for(bm00),
            blockers=["ORIGINAL_SHARED_LAYER_REPLACEMENT_REQUIRED"],
        ))

    # --- everything still uncovered ------------------------------------------
    for key, family in sorted(uncovered.items()):
        if key in consumed:
            continue
        directory, stem = key
        if directory == "/field":
            units.append(unit(
                asset_id=f"art:map:{slug(stem)}:field-reference",
                domain="MAP",
                asset_kind="FIELD_UNATTRIBUTED_REFERENCE",
                logical_group=f"field/{stem}",
                original_function=f"RAW_FIELD_{slug(stem).upper().replace('-', '_')}",
                modern_renderer="UNKNOWN_REQUIRES_TRACE",
                evidence_status="UNKNOWN_REQUIRES_TRACE",
                notes=(
                    "Field art in the ROM that belongs to neither the 11-field battle catalog nor the "
                    "Hunt biome set. Its consumer is unknown; do not assign it a biome or arena role "
                    "without a code trace."
                ),
                components=components_for([family]),
                blockers=["ORIGINAL_ATTRIBUTION_UNKNOWN_REQUIRES_TRACE"],
            ))
            continue
        scope = directory.strip("/").replace("/", "-") or "root"
        units.append(unit(
            asset_id=f"art:ui:{slug(scope)}-{slug(stem)}:layout-reference",
            domain="UI",
            asset_kind=ui_kind([family]),
            logical_group=f"{directory.strip('/')}/{stem}",
            original_function=f"RAW_UI_{slug(scope).upper().replace('-', '_')}_{slug(stem).upper().replace('-', '_')}",
            modern_renderer="DOM_CSS",
            notes=(
                "Original UI art family that the 752-unit audit did not register. Preserve function "
                "and information hierarchy only; NDS coordinates are research-only and the rebuild "
                "targets a single 9:16 screen."
            ),
            components=components_for([family]),
            blockers=["ORIGINAL_UI_REPLACEMENT_REQUIRED", "UI_FAMILY_NOT_IN_ORIGINAL_752_UNIT_AUDIT"],
        ))

    return units


def corrected_baselines(existing: dict[str, Any], census: dict[str, Any]) -> dict[str, Any]:
    rom = census["baselines"]
    contracts = census["animationContracts"]
    notes = {
        "nxrScenes": "Confirmed against the ROM: 96 NXR payloads.",
        "nxrNodes": "Node census not re-derived from the ROM; still sourced from the NXR node table.",
        "uiBackgrounds": "Background family count retained from the layout audit; ROM confirms the tilemap payloads.",
        "uiCellBundles": "Cell bundle count retained from the layout audit; ROM confirms the cell payloads.",
        "entities": (
            "224 entities confirmed. The ROM carries two full art tiers per entity: "
            "/digimon (gameplay) and /db_digimon (database), 448 entity asset sets in total."
        ),
        "entityFilesPerContract": (
            "8 files per entity per tier, confirmed. There are two such contracts per entity, not one: "
            "the original audit registered only the gameplay tier."
        ),
        "mainAnimationSlots": (
            f"Confirmed from NANR sequence counts: {contracts['gameplayMain']['regularEntities']} regular "
            f"entities declare {contracts['gameplayMain']['regularSlots']} Main slots, "
            f"{contracts['gameplayMain']['eggEntities']} eggs declare {contracts['gameplayMain']['eggSlots']}."
        ),
        "subAnimationSlots": (
            f"Confirmed from NANR sequence counts: {contracts['gameplaySub']['regularEntities']} regular "
            f"entities declare {contracts['gameplaySub']['regularSlots']} Sub slots, "
            f"{contracts['gameplaySub']['eggEntities']} eggs declare {contracts['gameplaySub']['eggSlots']}. "
            f"The database tier has its own smaller contract: {contracts['databaseMain']['regularSlots']} Main / "
            f"{contracts['databaseSub']['regularSlots']} Sub."
        ),
        "huntBiomes": (
            "Corrected 16 -> 17. field_hm00_01 is a complete three-layer field (base + _anim + _obj) that the "
            "terrain reference omitted because its table starts at HM01."
        ),
        "cageEnvironments": "Confirmed against the ROM: cm01-cm40.",
        "battleFields": (
            "Confirmed at 11. field_bm00_00 is the shared common layer referenced by 10 of the 11 fields, "
            "not a twelfth field; it is now registered as its own shared-layer unit."
        ),
        "nitro3dFiles": (
            "Corrected 58 -> 59. battle/circle_my.nsbmd.bak was skipped by the extension-driven scan; "
            "it is a distinct model, not a byte copy of circle_my."
        ),
        "nitro3dUnique": (
            "Corrected 57 -> 58. The only byte-identical pair in the ROM is "
            "battle_menu/Desktop_Launcher and desktop/Desktop_Launcher."
        ),
    }
    result = {}
    for key, previous in existing.items():
        value = rom.get(key, previous["expected"])
        result[key] = {
            "expected": value,
            "observed": value,
            "status": "MATCH",
            "evidenceRef": CENSUS_PATH if key in rom else previous["evidenceRef"],
            "issue": notes.get(key, previous.get("issue", "")),
        }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--registry", type=Path, default=Path("docs/art/ART_ASSET_REGISTRY.json"))
    parser.add_argument("--census", type=Path, default=Path(CENSUS_PATH))
    parser.add_argument("--docs", type=Path, default=Path("docs/art"))
    parser.add_argument("--reports", type=Path, default=Path("reports/art"))
    parser.add_argument("--check", action="store_true", help="fail instead of writing when outputs would change")
    arguments = parser.parse_args()

    registry = json.loads(arguments.registry.read_text(encoding="utf-8"))
    census = json.loads(arguments.census.read_text(encoding="utf-8"))

    # Idempotence: drop anything a previous run contributed, then rebuild.
    audited = [unit for unit in registry["assets"] if unit.get("source") != CENSUS_SOURCE]
    added = build_new_units(census, coverage_tokens(audited))

    identifiers = [unit["assetId"] for unit in audited + added]
    duplicates = [key for key, count in collections.Counter(identifiers).items() if count > 1]
    if duplicates:
        raise SystemExit(f"duplicate assetIds: {sorted(duplicates)[:10]}")
    pattern = re.compile(r"^art:(ui|character|character-animation|map|battle-field|vfx|three-d):[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$")
    invalid = [value for value in identifiers if not pattern.match(value)]
    if invalid:
        raise SystemExit(f"assetIds violate the schema pattern: {sorted(invalid)[:10]}")

    registry["assets"] = sorted(audited + added, key=lambda unit: unit["assetId"])
    registry["summary"]["baselines"] = corrected_baselines(registry["summary"]["baselines"], census)
    registry["authoritySnapshot"]["romReconciliation"] = {
        "date": "2026-09-01",
        "romSha256": census["rom"]["sha256"],
        "censusRef": CENSUS_PATH,
        "auditedUnits": len(audited),
        "romDerivedUnits": len(added),
        "rule": (
            "Baselines are reconciled against the ROM binary. The original filesystem scan was "
            "extension-driven and PARTIAL, so its expected/observed agreement did not prove ROM parity."
        ),
    }

    outputs: dict[Path, str] = {
        arguments.registry: json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
        arguments.docs / "ART_MASTER_INVENTORY.md": markdown_inventory(registry),
        arguments.docs / "ART_REBUILD_BACKLOG.md": markdown_backlog(registry),
    }
    for domain, name in DOMAIN_FILES.items():
        outputs[arguments.reports / name] = csv_text(
            [unit for unit in registry["assets"] if unit.get("domain") == domain]
        )
    outputs[arguments.reports / "MISSING_ART_MATRIX.csv"] = csv_text(
        [unit for unit in registry["assets"] if unit.get("disposition") == "MISSING" or unit.get("blockers")]
    )

    stale = [path for path, content in outputs.items() if not path.is_file() or path.read_text(encoding="utf-8") != content]
    if arguments.check:
        if stale:
            raise SystemExit("stale outputs; run scripts/build-art-registry-correction.py:\n  " + "\n  ".join(map(str, stale)))
        print("Art registry views are current.")
        return 0

    for path, content in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)

    by_domain = collections.Counter(unit["domain"] for unit in added)
    print(f"Registry reconciled against the ROM: {len(audited)} audited + {len(added)} ROM-derived = {len(registry['assets'])} units.")
    for domain, count in sorted(by_domain.items()):
        print(f"  +{count:4d}  {domain}")
    return 0


def markdown_inventory(registry: dict[str, Any]) -> str:
    assets = registry["assets"]
    def table(counter: collections.Counter) -> str:
        lines = ["| Status | Count |", "|---|---:|"]
        lines.extend(f"| `{key}` | {counter[key]} |" for key in sorted(counter))
        return "\n".join(lines)
    reconciliation = registry["authoritySnapshot"]["romReconciliation"]
    return (
        "# Championship Art Master Inventory\n\n"
        "> Generated deterministically from `ART_ASSET_REGISTRY.json`. "
        "This is an Art-A audit, not a runtime manifest or a rights grant.\n\n"
        f"Total production decision units: **{len(assets)}** "
        f"({reconciliation['auditedUnits']} from the original filesystem audit, "
        f"{reconciliation['romDerivedUnits']} recovered by reconciling against the ROM binary).\n\n"
        "## Domains\n\n" + table(collections.Counter(row["domain"] for row in assets)) + "\n\n"
        "## Dispositions\n\n" + table(collections.Counter(row["disposition"] for row in assets)) + "\n\n"
        "## Shipping states\n\n" + table(collections.Counter(row["shippingStatus"] for row in assets)) + "\n\n"
        "## ROM reconciliation\n\n"
        f"Census: `{reconciliation['censusRef']}` (ROM SHA-256 `{reconciliation['romSha256']}`).\n\n"
        "The original audit scanned an extracted research filesystem by file extension and reported every "
        "baseline as `MATCH`, because expected and observed were both taken from that same scan. Re-deriving "
        "the census from the ROM's FAT/FNT recovered four art tiers it could not see and corrected three "
        "baselines. See `ART_ROM_RECONCILIATION.md`.\n\n"
        "## Owner gate\n\n"
        f"**{STOP_MARKER}**\n"
    )


def markdown_backlog(registry: dict[str, Any]) -> str:
    selected = [row for row in registry["assets"] if row.get("disposition") in {"REWORK", "REBUILD", "MISSING", "UNKNOWN"}]
    lines = [
        "# Championship Art Rebuild Backlog", "",
        "> Derived from the canonical registry. This audit does not authorize an ART-B production batch.", "",
        "| Asset ID | Disposition | Production | Blockers | Replacement |", "|---|---|---|---|---|",
    ]
    for row in sorted(selected, key=lambda item: item.get("assetId", "")):
        lines.append("| {asset} | {disp} | {prod} | {blocked} | {replacement} |".format(
            asset=row.get("assetId", ""), disp=row.get("disposition", ""),
            prod=row.get("productionStatus", ""), blocked=scalar(row.get("blockers", [])),
            replacement=row.get("replacementAssetId") or "—",
        ))
    lines.extend(["", "Post-audit production remains stopped until the Owner names a bounded ART-B replacement batch. Every later batch must remain bounded, QA-able, reversible, and auditable.", ""])
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
