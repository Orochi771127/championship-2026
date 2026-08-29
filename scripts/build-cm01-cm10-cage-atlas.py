#!/usr/bin/env python3
"""Build the deterministic, non-runtime CM01-CM10 Cage authoring atlas pack."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import tempfile
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


REPO = Path(__file__).resolve().parents[1]
PACK_ROOT = REPO / "docs/art/production/cage/cm01-cm10"
SOURCE_ROOT = PACK_ROOT / "packages"
OUTPUT_ROOT = PACK_ROOT / "atlas-pack"
FIELD_IDS = [f"field_cm{i:02d}_01" for i in range(1, 11)]
SAMPLE_ROLES = ["NW", "N", "NE", "W", "CENTER", "E", "SW", "S", "SE"]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def checker(size: tuple[int, int], step: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, (246, 246, 242, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(226, 228, 224, 255))
    return image


def contain(image: Image.Image, size: tuple[int, int], padding: int = 8, bottom_anchor: bool = True) -> Image.Image:
    bounds = image.getchannel("A").getbbox()
    if not bounds:
        return Image.new("RGBA", size, (0, 0, 0, 0))
    crop = image.crop(bounds)
    scale = min((size[0] - padding * 2) / crop.width, (size[1] - padding * 2) / crop.height, 1.0)
    if scale < 1:
        crop = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - crop.width) // 2
    y = size[1] - padding - crop.height if bottom_anchor else (size[1] - crop.height) // 2
    canvas.alpha_composite(crop, (x, y))
    return canvas


def seamless_material(core: Image.Image) -> Image.Image:
    """Create a repeatable material swatch; this is not a gameplay tile."""
    bounds = core.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Core field has no visible pixels")
    left, top, right, bottom = bounds
    center_x = (left + right) // 2
    center_y = top + round((bottom - top) * 0.48)
    radius = max(16, min(40, (right - left) // 6, (bottom - top) // 6))
    patch = core.crop((center_x - radius, center_y - radius, center_x + radius, center_y + radius))
    patch = patch.resize((64, 64), Image.Resampling.LANCZOS)
    tile = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    tile.alpha_composite(patch, (0, 0))
    tile.alpha_composite(ImageOps.mirror(patch), (64, 0))
    tile.alpha_composite(ImageOps.flip(patch), (0, 64))
    tile.alpha_composite(ImageOps.flip(ImageOps.mirror(patch)), (64, 64))
    return tile


def edge_equality(tile: Image.Image) -> dict[str, bool]:
    width, height = tile.size
    return {
        "leftRight": tile.crop((0, 0, 1, height)).tobytes() == tile.crop((width - 1, 0, width, height)).tobytes(),
        "topBottom": tile.crop((0, 0, width, 1)).tobytes() == tile.crop((0, height - 1, width, height)).tobytes(),
    }


def repeat_preview(tile: Image.Image) -> Image.Image:
    preview = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    for y in range(3):
        for x in range(3):
            preview.alpha_composite(tile, (x * 128, y * 128))
    return preview


def visual_sample_atlas(core: Image.Image) -> tuple[Image.Image, list[dict]]:
    """Create nine visual sampling crops; these are explicitly not runtime tile roles."""
    bounds = core.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Core field has no visible pixels")
    left, top, right, bottom = bounds
    atlas = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    records = []
    for index, role in enumerate(SAMPLE_ROLES):
        column, row = index % 3, index // 3
        x0 = round(left + column * (right - left) / 3)
        x1 = round(left + (column + 1) * (right - left) / 3)
        y0 = round(top + row * (bottom - top) / 3)
        y1 = round(top + (row + 1) * (bottom - top) / 3)
        sample = contain(core.crop((x0, y0, x1, y1)), (128, 128), padding=4, bottom_anchor=False)
        atlas.alpha_composite(sample, (column * 128, row * 128))
        records.append({"role": role, "cell": index, "sourceBounds": [x0, y0, x1, y1], "authority": "VISUAL_SAMPLE_ONLY"})
    return atlas, records


def connected_components(mask: Image.Image) -> list[tuple[int, int, int, int]]:
    source = mask.load()
    width, height = mask.size
    visited: set[tuple[int, int]] = set()
    boxes = []
    for start_y in range(height):
        for start_x in range(width):
            if source[start_x, start_y] == 0 or (start_x, start_y) in visited:
                continue
            queue = deque([(start_x, start_y)])
            points = []
            while queue:
                x, y = queue.popleft()
                if (x, y) in visited or source[x, y] == 0:
                    continue
                visited.add((x, y))
                points.append((x, y))
                if x:
                    queue.append((x - 1, y))
                if x + 1 < width:
                    queue.append((x + 1, y))
                if y:
                    queue.append((x, y - 1))
                if y + 1 < height:
                    queue.append((x, y + 1))
            if len(points) >= 24:
                xs = [point[0] for point in points]
                ys = [point[1] for point in points]
                boxes.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1))
    return sorted(boxes, key=lambda box: (box[1], box[0]))


def split_object_groups(bundle: Image.Image) -> list[Image.Image]:
    # A three-pixel grouping radius joins small detached highlights/shadows while
    # keeping neighbouring authored props as independent raw art groups.
    grouped_mask = bundle.getchannel("A").filter(ImageFilter.MaxFilter(3)).point(lambda value: 255 if value else 0)
    groups = []
    for left, top, right, bottom in connected_components(grouped_mask):
        padded = (max(0, left - 4), max(0, top - 4), min(bundle.width, right + 4), min(bundle.height, bottom + 4))
        crop = bundle.crop(padded)
        if crop.getchannel("A").getbbox() and sum(crop.getchannel("A").histogram()[1:]) >= 24:
            groups.append(crop)
    return groups or [bundle]


def object_atlas(groups: list[Image.Image]) -> tuple[Image.Image, list[dict], list[Image.Image]]:
    cells = [contain(group, (128, 128), padding=8) for group in groups]
    columns = 4
    rows = max(1, math.ceil(len(cells) / columns))
    atlas = Image.new("RGBA", (columns * 128, rows * 128), (0, 0, 0, 0))
    records = []
    for index, cell in enumerate(cells):
        column, row = index % columns, index // columns
        atlas.alpha_composite(cell, (column * 128, row * 128))
        records.append({
            "objectId": f"RAW_OBJECT_{index + 1:02d}",
            "cell": index,
            "anchor": {"x": column * 128 + 64, "y": row * 128 + 120, "policy": "BOTTOM_CENTER"},
            "semanticIdentity": "UNASSIGNED_REQUIRES_ART_DIRECTION",
        })
    return atlas, records, cells


def staging_preview(core: Image.Image, cells: list[Image.Image]) -> Image.Image:
    """Make a visual composition check with deliberately non-authoritative positions."""
    preview = core.copy()
    positions = [(118, 250), (192, 226), (268, 256)]
    for cell, (anchor_x, anchor_y) in zip(cells[:3], positions):
        item = contain(cell, (88, 88), padding=4)
        preview.alpha_composite(item, (anchor_x - 44, anchor_y - 84))
    return preview


def contact_sheet(images: list[Image.Image], output: Path, cell_size: tuple[int, int]) -> None:
    sheet = checker((cell_size[0] * 5, cell_size[1] * 2))
    for index, image in enumerate(images):
        normalized = contain(image, cell_size, padding=8, bottom_anchor=False)
        sheet.alpha_composite(normalized, ((index % 5) * cell_size[0], (index // 5) * cell_size[1]))
    sheet.convert("RGB").save(output, optimize=True)


def build(output_root: Path) -> None:
    if output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True)
    source_manifest = json.loads((SOURCE_ROOT / "manifest.json").read_text(encoding="utf-8"))
    records = []
    material_contacts = []
    seam_contacts = []
    sample_contacts = []
    object_contacts = []
    staging_contacts = []

    for field in source_manifest["fields"]:
        field_id = field["fieldId"]
        field_dir = output_root / field_id
        object_dir = field_dir / "objects"
        object_dir.mkdir(parents=True)
        core_path = SOURCE_ROOT / field["coreField"]["file"]
        bundle_path = SOURCE_ROOT / field["objectBundle"]["file"]
        core = Image.open(core_path).convert("RGBA")
        bundle = Image.open(bundle_path).convert("RGBA")

        material = seamless_material(core)
        seam_qa = repeat_preview(material)
        samples, sample_records = visual_sample_atlas(core)
        groups = split_object_groups(bundle)
        objects, object_records, object_cells = object_atlas(groups)
        staging = staging_preview(core, object_cells)

        files = {
            "materialTile": (field_dir / "material-tile.png", material),
            "materialSeamQa": (field_dir / "material-seam-qa.png", seam_qa),
            "visualEdgeCornerSamples": (field_dir / "visual-edge-corner-samples.png", samples),
            "objectAtlas": (field_dir / "object-atlas.png", objects),
            "artStagingPreview": (field_dir / "art-staging-preview.png", staging),
        }
        for path, image in files.values():
            image.save(path, optimize=True)
        for index, cell in enumerate(object_cells):
            cell.save(object_dir / f"raw-object-{index + 1:02d}.png", optimize=True)

        edge_test = edge_equality(material)
        if not all(edge_test.values()):
            raise ValueError(f"{field_id} material swatch failed edge equality")
        records.append({
            "assetId": f"art:cage:{field_id}:authoring-atlas-v1",
            "fieldId": field_id,
            "nameEn": field["nameEn"],
            "originalStructure": field["originalStructure"],
            "source": {
                "coreField": {"file": f"../packages/{field['coreField']['file']}", "sha256": sha256(core_path)},
                "objectBundle": {"file": f"../packages/{field['objectBundle']['file']}", "sha256": sha256(bundle_path)},
            },
            "materialTile": {"file": str(files["materialTile"][0].relative_to(output_root)).replace("\\", "/"), "sha256": sha256(files["materialTile"][0]), "role": "SEAMLESS_MATERIAL_SWATCH_NOT_GAMEPLAY_TILE", "edgeEquality": edge_test},
            "materialSeamQa": {"file": str(files["materialSeamQa"][0].relative_to(output_root)).replace("\\", "/"), "sha256": sha256(files["materialSeamQa"][0]), "repeat": "3x3"},
            "visualEdgeCornerSamples": {"file": str(files["visualEdgeCornerSamples"][0].relative_to(output_root)).replace("\\", "/"), "sha256": sha256(files["visualEdgeCornerSamples"][0]), "samples": sample_records, "runtimeTileAuthority": False},
            "objectAtlas": {"file": str(files["objectAtlas"][0].relative_to(output_root)).replace("\\", "/"), "sha256": sha256(files["objectAtlas"][0]), "count": len(object_records), "objects": object_records, "placementAuthority": "NONE"},
            "artStagingPreview": {"file": str(files["artStagingPreview"][0].relative_to(output_root)).replace("\\", "/"), "sha256": sha256(files["artStagingPreview"][0]), "placementPolicy": "NON_AUTHORITATIVE_ART_STAGING_ONLY"},
            "productionStatus": "OWNER_VISUAL_REVIEW_PENDING",
            "runtimeEligible": False,
            "shippingReady": False,
        })
        material_contacts.append(material)
        seam_contacts.append(seam_qa)
        sample_contacts.append(samples)
        object_contacts.append(objects)
        staging_contacts.append(staging)

    contact_sheet(material_contacts, output_root / "contact-material-tiles.png", (192, 192))
    contact_sheet(seam_contacts, output_root / "contact-material-seam-qa.png", (256, 256))
    contact_sheet(sample_contacts, output_root / "contact-edge-corner-samples.png", (256, 256))
    contact_sheet(object_contacts, output_root / "contact-object-atlases.png", (256, 256))
    contact_sheet(staging_contacts, output_root / "contact-art-staging-previews.png", (384, 320))
    manifest = {
        "schemaVersion": 1,
        "batch": "ART_A3_CAGE_CM01_CM10_AUTHORING_ATLAS_V1",
        "fieldCount": len(records),
        "sourceManifest": {"file": "../packages/manifest.json", "sha256": sha256(SOURCE_ROOT / "manifest.json")},
        "authorityBoundary": {
            "materialTiles": "SEAMLESS_VISUAL_SWATCHES_ONLY_NOT_GAMEPLAY_TILES",
            "edgeCornerSamples": "VISUAL_SAMPLING_ONLY_NOT_NATIVE_TILE_ROLES",
            "objectIds": "RAW_ART_GROUPS_WITHOUT_INFERRED_SEMANTICS",
            "staging": "NON_AUTHORITATIVE_ART_STAGING_ONLY",
            "atrColRaisingCollisionPlacement": "EXTERNAL_NOT_INFERRED",
        },
        "palettePolicy": source_manifest["palettePolicy"],
        "humanApproved": False,
        "runtimeEligible": False,
        "shippingReady": False,
        "fields": records,
        "qa": {
            "allMaterialEdgesPixelEqual": all(all(field["materialTile"]["edgeEquality"].values()) for field in records),
            "objectAtlasesUseStableBottomCenterAnchors": True,
            "stagingPlacementUsedAsGameplayAuthority": False,
            "gameplaySemanticsInferred": False,
        },
    }
    (output_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def tree_hashes(root: Path) -> dict[str, str]:
    return {str(path.relative_to(root)).replace("\\", "/"): sha256(path) for path in sorted(root.rglob("*")) if path.is_file()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-determinism", action="store_true")
    args = parser.parse_args()
    build(OUTPUT_ROOT)
    if args.verify_determinism:
        with tempfile.TemporaryDirectory() as temp:
            second = Path(temp) / "atlas-pack"
            build(second)
            if tree_hashes(OUTPUT_ROOT) != tree_hashes(second):
                raise SystemExit("CM01-CM10 Cage authoring atlas determinism check failed")
        print(f"Deterministic CM01-CM10 authoring atlas passed: {len(tree_hashes(OUTPUT_ROOT))} files")


if __name__ == "__main__":
    main()
