#!/usr/bin/env python3
"""Emit the geometry constraint a battle background must satisfy.

Background generation currently runs blind to the shared ring layer, so nothing
stops it painting an arena floor smaller than the ring encloses. That is how four
of the six canonical standing slots ended up on scenery in R5 — BM10 put two of
them on the spectator tiers.

This derives, from the shared layer itself:

  * the six canonical standing slots, as pixel and normalised boxes;
  * the arena interior — the region enclosed by the rail, flood-filled — which the
    background must paint as continuous combat floor;
  * `floorTopY`, the highest row the floor has to reach.

It writes a JSON constraint plus a coverage mask PNG that can be handed to the
image generator as an inpaint/region constraint, and that
`validate-battle-composite-integrity.py` checks after the fact.

Inputs are the project's own created shared layer, not ROM data, so both outputs
belong in the repository.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

MIN_SLOT_PIXELS = 400


def flood_interior(alpha: np.ndarray) -> np.ndarray:
    """Region enclosed by the rail, reached from the centre without crossing it."""
    height, width = alpha.shape
    passable = alpha < 250
    seen = np.zeros(alpha.shape, bool)
    start = (height // 2, width // 2)
    if not passable[start]:
        raise SystemExit("centre pixel is opaque; cannot flood the arena interior")
    seen[start] = True
    queue = deque([start])
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < height and 0 <= nx < width and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def find_slots(alpha: np.ndarray) -> list[tuple[int, int, int, int]]:
    """The standing circles: soft strokes drawn inside the ring."""
    height, width = alpha.shape
    interior = np.zeros(alpha.shape, bool)
    interior[int(height * 0.32):int(height * 0.70), int(width * 0.19):int(width * 0.85)] = True
    candidate = (alpha > 0) & (alpha < 250) & interior
    seen = np.zeros(alpha.shape, bool)
    boxes: list[tuple[int, int, int, int]] = []
    for sy, sx in zip(*np.where(candidate)):
        if seen[sy, sx]:
            continue
        queue, pixels = deque([(sy, sx)]), []
        seen[sy, sx] = True
        while queue:
            y, x = queue.popleft()
            pixels.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < height and 0 <= nx < width and candidate[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        if len(pixels) >= MIN_SLOT_PIXELS:
            p = np.array(pixels)
            boxes.append((int(p[:, 1].min()), int(p[:, 0].min()), int(p[:, 1].max()), int(p[:, 0].max())))
    boxes.sort(key=lambda b: ((b[1] + b[3]) // 120, b[0]))
    return boxes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--shared-layer", type=Path,
        default=Path("docs/art/production/battle/human-paint-migration-r4/review/layers/field-bm00-00-shared-layer-human-paint.png"),
    )
    parser.add_argument("--out", type=Path, default=Path("docs/art/BATTLE_FIELD_GEOMETRY_CONSTRAINT.json"))
    parser.add_argument("--mask", type=Path, default=Path("docs/art/production/battle/field-floor-coverage-mask.png"))
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()

    alpha = np.array(Image.open(arguments.shared_layer).convert("RGBA"))[..., 3]
    height, width = alpha.shape
    interior = flood_interior(alpha)
    slots = find_slots(alpha)
    if len(slots) != 6:
        raise SystemExit(f"expected 6 standing slots, found {len(slots)}")

    ys, xs = np.where(interior)
    floor_top = int(ys.min())

    def box(b: tuple[int, int, int, int]) -> dict[str, Any]:
        x0, y0, x1, y1 = b
        return {
            "pixel": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
            "normalised": {
                "x0": round(x0 / width, 5), "y0": round(y0 / height, 5),
                "x1": round(x1 / width, 5), "y1": round(y1 / height, 5),
            },
        }

    constraint = {
        "schemaVersion": 1,
        "generator": "scripts/build-battle-field-geometry-constraint.py",
        "sharedLayer": str(arguments.shared_layer).replace("\\", "/"),
        "canvas": {"width": width, "height": height},
        "rule": (
            "The generated background must paint continuous, walkable combat floor across the whole "
            "arena interior, and in particular under all six standing slots. Scenery, walls, seating, "
            "water and terrain edges must stay outside the interior region."
        ),
        "arenaInterior": {
            "pixels": int(interior.sum()),
            "coverageOfFrame": round(float(interior.mean()), 4),
            "bbox": {"x0": int(xs.min()), "y0": int(ys.min()), "x1": int(xs.max()), "y1": int(ys.max())},
            "floorTopY": floor_top,
            "floorTopNormalised": round(floor_top / height, 5),
            "note": (
                "floorTopY is the highest row the floor must reach. A horizon, terrace edge or pitch "
                "boundary painted below this line leaves the back of the arena unfloored, which is the "
                "BM09 and BM10 failure."
            ),
        },
        "standingSlots": [{"slot": i, **box(b)} for i, b in enumerate(slots, start=1)],
        "coverageMask": str(arguments.mask).replace("\\", "/"),
        "verifiedBy": "scripts/validate-battle-composite-integrity.py (SLOTS check)",
    }

    rendered = json.dumps(constraint, ensure_ascii=False, indent=2) + "\n"
    mask_image = Image.fromarray((interior * 255).astype(np.uint8), mode="L")

    if arguments.check:
        stale = []
        if not arguments.out.is_file() or arguments.out.read_text(encoding="utf-8") != rendered:
            stale.append(str(arguments.out))
        if not arguments.mask.is_file() or np.any(np.array(Image.open(arguments.mask).convert("L")) != np.array(mask_image)):
            stale.append(str(arguments.mask))
        if stale:
            raise SystemExit("stale; run scripts/build-battle-field-geometry-constraint.py:\n  " + "\n  ".join(stale))
        print("Battle field geometry constraint is current.")
        return 0

    arguments.out.parent.mkdir(parents=True, exist_ok=True)
    with arguments.out.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(rendered)
    arguments.mask.parent.mkdir(parents=True, exist_ok=True)
    mask_image.save(arguments.mask)
    print(f"Wrote {arguments.out} and {arguments.mask}")
    print(f"  arena interior {interior.sum()} px ({100 * interior.mean():.1f}% of frame), floorTopY={floor_top}")
    for entry in constraint["standingSlots"]:
        p = entry["pixel"]
        print(f"  slot {entry['slot']}  x {p['x0']:4d}-{p['x1']:4d}  y {p['y0']:4d}-{p['y1']:4d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
