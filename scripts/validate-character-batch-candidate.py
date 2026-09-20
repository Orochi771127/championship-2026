"""Validate a review-only original-character sprite bank and build QA sheets.

This validator never promotes art into the default runtime.  It proves the
candidate preserves the extracted donor motion contract, canonical/alias cell
mapping, native 64x64 geometry, binary alpha, and restraint palette boundary.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "docs/art/production/characters/appearance-refresh-v1"
JOBS = PACK / "sheet-jobs-v1"
GENERATED = PACK / "generated/entities"
DONOR = PACK / "donor-review-v1"
GOLD = {(89, 65, 29, 255), (193, 139, 38, 255), (250, 208, 101, 255)}

spec = importlib.util.spec_from_file_location("sheet_jobs", ROOT / "scripts/character-sheet-job.py")
J = importlib.util.module_from_spec(spec)
spec.loader.exec_module(J)
P = J.P


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_bound(observation):
    value = observation.lower()
    return ("restrain" in value or "binding" in value) and "pre-restraint" not in value


def is_special(key, observation):
    if not key.startswith("main/"):
        return False
    text = (observation or "").lower()
    return (
        "special-color" in text
        or "black silhouette" in text
        or "white evolution silhouette" in text
        or "stone-gray" in text
    )


def review_sheet(source, bank, keys, destination, scale=8, columns=4):
    panel_w = 64 * scale
    panel_h = panel_w + 32
    rows = max(1, (len(keys) + columns - 1) // columns)
    canvas = Image.new("RGBA", (columns * panel_w, rows * panel_h), (35, 49, 63, 255))
    draw = ImageDraw.Draw(canvas)
    for index, key in enumerate(keys):
        cell = Image.open(source / bank["cells"][key]["image"]).convert("RGBA")
        x = index % columns * panel_w
        y = index // columns * panel_h
        canvas.alpha_composite(cell.resize((panel_w, panel_w), Image.Resampling.NEAREST), (x, y))
        draw.text((x + 6, y + panel_w + 6), key, fill=(235, 240, 246, 255))
    canvas.save(destination)


def validate(entity, candidate, review_name):
    source = JOBS / entity / candidate
    destination = JOBS / entity / review_name
    destination.mkdir(parents=True, exist_ok=True)
    bank = read(source / "bank.json")
    receipt = read(source / "receipt.json")
    contract = read(GENERATED / entity / "motion-contract.json")
    inventory = read(DONOR / entity / "inventory.json")
    donor_review = read(DONOR / entity / "review.json")

    if bank["entityId"] != entity or bank["sourceOrigin"] != inventory["sourceOrigin"]:
        raise ValueError("ENTITY_OR_ORIGIN_DRIFT")
    if bank["unexpectedOccupiedPanels"]:
        raise ValueError("UNEXPECTED_OCCUPIED_PANELS")
    source_unexpected = bank.get("sourceUnexpectedOccupiedPanels", [])
    ignored_out_of_manifest = bank.get("ignoredOutOfManifestPanels", [])
    if source_unexpected != ignored_out_of_manifest:
        raise ValueError("OUT_OF_MANIFEST_PANEL_PROVENANCE_DRIFT")
    if any(not isinstance(panel, int) or panel < 0 for panel in source_unexpected):
        raise ValueError("INVALID_OUT_OF_MANIFEST_PANEL_PROVENANCE")

    expected_sequences = [
        {"side": side, "sequence": sequence, "available": True, "missing": []}
        for side, side_contract in contract["sides"].items()
        for sequence in side_contract["sequences"]
    ]
    if bank["sequences"] != expected_sequences:
        raise ValueError("MOTION_CONTRACT_DRIFT")

    explicit_bound = {key for key, observation in donor_review["cellObservations"].items() if is_bound(observation or "")}
    bound_canonicals = {bank["cells"][key]["canonical"] for key in explicit_bound}
    bound_keys = {
        key for key, record in bank["cells"].items()
        if key in explicit_bound or record["canonical"] in bound_canonicals
    }
    alpha_values = set()
    canonical = set()
    side_counts = {"main": 0, "sub": 0}
    bound_missing = []
    normal_gold = []
    for key, record in bank["cells"].items():
        side_counts[key.split("/", 1)[0]] += 1
        canonical.add(record["canonical"])
        path = source / record["image"]
        image = Image.open(path).convert("RGBA")
        if image.size != (64, 64) or digest(path) != record["sha256"]:
            raise ValueError("CELL_SIZE_OR_HASH_DRIFT " + key)
        alpha_values.update(image.getchannel("A").get_flattened_data())
        master_record = bank["cells"][record["canonical"]]
        master = Image.open(source / master_record["image"]).convert("RGBA")
        expected = Image.new("RGBA", (64, 64))
        expected.alpha_composite(master, tuple(record["translation"]))
        if expected.tobytes() != image.tobytes():
            raise ValueError("CANONICAL_TRANSLATION_DRIFT " + key)
        pixels = set(image.get_flattened_data())
        observation = donor_review["cellObservations"].get(key, "") or ""
        if key in bound_keys and not pixels.intersection(GOLD):
            bound_missing.append(key)
        if key not in bound_keys and pixels.intersection(GOLD):
            normal_gold.append(key)

    if alpha_values - {0, 255}:
        raise ValueError("NON_BINARY_ALPHA")
    if bound_missing or normal_gold:
        raise ValueError(f"RESTRAINT_PALETTE_DRIFT missing={bound_missing} leaked={normal_gold}")
    for relative, expected_hash in receipt["files"].items():
        if digest(source / relative) != expected_hash:
            raise ValueError("RECEIPT_DRIFT " + relative)

    observations = donor_review["cellObservations"]
    main_keys = sorted(key for key in bank["cells"] if key.startswith("main/"))
    groups = {
        "normal": [key for key in main_keys if key not in bound_keys and not is_special(key, observations.get(key, ""))],
        "bound": [key for key in main_keys if key in bound_keys],
        "special": [key for key in main_keys if is_special(key, observations.get(key, ""))],
    }
    for name, keys in groups.items():
        review_sheet(source, bank, keys, destination / f"{name}-visual-review-8x.png")

    cell_reviews = read(source / "cell-review.json")
    deltas = [
        [record["candidateVisibleBounds"][index] - record["sourceVisibleBounds"][index] for index in range(4)]
        for record in cell_reviews
    ]
    ticks = sum(
        frame["ticks"]
        for side in contract["sides"].values()
        for sequence in side["sequences"]
        for frame in sequence["frames"]
    )
    report = {
        "entityId": entity,
        "candidate": candidate,
        "status": "PASS_CANDIDATE_STRUCTURAL_VALIDATION",
        "nativeCanvas": [64, 64],
        "sourceOrigin": bank["sourceOrigin"],
        "cellCounts": side_counts,
        "canonicalMasters": len(canonical),
        "sequenceCount": len(bank["sequences"]),
        "browserTicks": ticks,
        "binaryAlphaValues": sorted(alpha_values),
        "aliasMapping": "PASS_EXACT_CANONICAL_TRANSLATION",
        "motionContract": "PASS_BYTE_EQUIVALENT_SEQUENCE_RECORDS",
        "restraintPaletteBoundary": "PASS_GOLD_ONLY_REVIEWED_BOUND_RANGE",
        "normalization": bank.get("normalization"),
        "repairNormalizations": bank.get("repairNormalizations", []),
        "deterministicAnchorCorrections": bank.get("deterministicAnchorCorrections", []),
        "bboxDeltaRange": {
            "min": [min(delta[index] for delta in deltas) for index in range(4)],
            "max": [max(delta[index] for delta in deltas) for index in range(4)],
        },
        "perCellResize": False,
        "bboxRecenter": False,
        "sourceUnexpectedOccupiedPanels": source_unexpected,
        "ignoredOutOfManifestPanels": ignored_out_of_manifest,
    }
    (destination / "structural-validation.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("entity")
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--review", required=True)
    args = parser.parse_args()
    validate(args.entity, args.candidate, args.review)
