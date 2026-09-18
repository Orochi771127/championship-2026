#!/usr/bin/env python3
"""Rebuild the animated Cage fields' second flattened frame from this repo.

`build-cage-faithful-hd40.py` needs the read-only original payload and the O3-B
archive, neither of which lives here. Everything this needs is committed: each
animated field's decoded BSAR sheet and its static composite. So the flattened
frames can be rebuilt, and checked in CI, without the ROM.

The composition rule is `scripts/lib/cage_animation.py`, the same function the
full build uses. Frame 0 must come out exactly as it already ships; this refuses
to write anything if it does not, because that would mean the rule had started
moving pixels the Owner already approved.

    python scripts/rebuild-cage-animated-frames.py
    python scripts/rebuild-cage-animated-frames.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.cage_animation import (
    BOUND_CELL_SEMANTICS, COMPOSITION_EVIDENCE, COMPOSITION_ORDER,
    animation_bound_cells, compose_animated_field_frames,
)

REPO = Path(__file__).resolve().parents[1]
BASELINE = REPO / "docs/art/production/cage/faithful-hd40"
MANIFEST = BASELINE / "manifest.json"
SCALE = 4
ANIMATED_FIELDS = {"field_cm07_01", "field_cm09_01", "field_cm21_01", "field_cm39_01"}


def fail(message: str) -> None:
    raise SystemExit(f"CHAMPIONSHIP_CAGE_ANIMATED_FRAMES: {message}")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, optimize=True)


def rebuild(check: bool) -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    changed: list[str] = []
    pending = []
    seen = set()

    for entry in manifest["fields"]:
        animation = entry.get("animatedLayer") or {}
        if animation.get("status") != "PRESENT_VERIFIED_ROM_DECODED":
            continue
        field_id = entry["fieldId"]
        if field_id not in ANIMATED_FIELDS or field_id in seen:
            fail(f"UNEXPECTED_ANIMATED_FIELD:{field_id}")
        seen.add(field_id)
        field_dir = BASELINE / "fields" / field_id

        # Validate source bytes before deriving anything. A changed decode must
        # not silently redefine the reference when checking a stale output.
        records = [entry["nativeOriginal"], *animation["layerFrames"], {
            "file": entry["exactStaticAssembly"]["staticCompositeFile"],
            "sha256": entry["exactStaticAssembly"]["staticCompositeSha256"],
        }]
        for record in records:
            if sha256_file(BASELINE / record["file"]) != record["sha256"]:
                fail(f"SOURCE_HASH_MISMATCH:{field_id}:{record['file']}")
        static_clean = Image.open(field_dir / "static-composite-native.png").convert("RGBA")
        layers = [
            Image.open(BASELINE / frame["file"]).convert("RGBA")
            for frame in animation["layerFrames"]
        ]
        if len(layers) != 2 or animation["frameCount"] != 2:
            fail(f"FRAME_COUNT_MISMATCH:{field_id}")

        frames = compose_animated_field_frames(static_clean, layers)
        bound = animation_bound_cells(static_clean, layers[0])

        shipped_first = Image.open(field_dir / "native-original.png").convert("RGBA")
        if frames[0].tobytes() != shipped_first.tobytes():
            fail(f"FIRST_FRAME_WOULD_CHANGE:{field_id}")

        native_out = field_dir / "native-composite-frame-01.png"
        hd_out = field_dir / "faithful-hd4x-frame-01.png"
        hd = frames[1].resize((frames[1].width * SCALE, frames[1].height * SCALE), Image.Resampling.NEAREST)
        moving = sum(frames[0].getpixel((x, y)) != frames[1].getpixel((x, y))
                     for y in range(frames[0].height) for x in range(frames[0].width))
        if moving == 0:
            fail(f"DECLARED_ANIMATION_HAS_NO_MOVING_PIXELS:{field_id}")
        if frames[0].getchannel("A").tobytes() != frames[1].getchannel("A").tobytes():
            fail(f"ANIMATION_CHANGES_GROUND_ALPHA:{field_id}")

        if check:
            if Image.open(native_out).convert("RGBA").tobytes() != frames[1].tobytes():
                changed.append(f"{field_id}: {native_out.name} is stale")
            if Image.open(hd_out).convert("RGBA").tobytes() != hd.tobytes():
                changed.append(f"{field_id}: {hd_out.name} is stale")
            if animation.get("compositionOrder") != COMPOSITION_ORDER:
                changed.append(f"{field_id}: manifest compositionOrder is stale")
            if animation.get("animationBoundCoreCells") != [list(cell) for cell in bound]:
                changed.append(f"{field_id}: manifest animationBoundCoreCells is stale")
            if animation.get("animationBoundCellSemantics") != BOUND_CELL_SEMANTICS:
                changed.append(f"{field_id}: manifest animationBoundCellSemantics is stale")
            if animation.get("compositionEvidence") != COMPOSITION_EVIDENCE:
                changed.append(f"{field_id}: manifest compositionEvidence is stale")
            for key, output in [("alternateCompositeFrame", native_out), ("alternateFaithfulHd4xFrame", hd_out)]:
                record = animation.get(key, {})
                if record.get("file") != output.relative_to(BASELINE).as_posix() or record.get("sha256") != sha256_file(output):
                    changed.append(f"{field_id}: {key} file/hash is stale")
            print(f"{field_id}: {len(bound)} pixel-matched cells, {moving} moving native pixels")
            continue

        pending.append((animation, field_id, frames[1], hd, native_out, hd_out, bound, moving))

    if seen != ANIMATED_FIELDS:
        fail(f"ANIMATED_FIELD_SET_MISMATCH:{sorted(seen)}")

    # All four fields must validate before the first output is changed.
    for animation, field_id, frame, hd, native_out, hd_out, bound, moving in pending:
        save_png(frame, native_out)
        save_png(hd, hd_out)
        animation["compositionOrder"] = COMPOSITION_ORDER
        animation["animationBoundCoreCells"] = [list(cell) for cell in bound]
        animation["animationBoundCellSemantics"] = BOUND_CELL_SEMANTICS
        animation["compositionEvidence"] = COMPOSITION_EVIDENCE
        animation["alternateCompositeFrame"] = {
            "file": f"fields/{field_id}/{native_out.name}",
            "sha256": sha256_file(native_out),
        }
        animation["alternateFaithfulHd4xFrame"] = {
            "file": f"fields/{field_id}/{hd_out.name}",
            "sha256": sha256_file(hd_out),
            "scale": SCALE,
            "filter": "NEAREST",
        }
        print(f"{field_id}: {len(bound)} pixel-matched cells, {moving} moving native pixels")

    if check:
        for line in changed:
            print(line)
        if changed:
            print("Run: python scripts/rebuild-cage-animated-frames.py")
            return 1
        print("Animated Cage frames match the composition rule.")
        return 0

    # Bytes, not write_text: the approved hashes are taken over LF files and
    # Windows text mode would silently rewrite every line ending.
    MANIFEST.write_bytes(f"{json.dumps(manifest, indent=2, ensure_ascii=False)}\n".encode("utf-8"))
    print(f"Rebuilt animated frames in {BASELINE.relative_to(REPO)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify without writing")
    return rebuild(parser.parse_args().check)


if __name__ == "__main__":
    raise SystemExit(main())
