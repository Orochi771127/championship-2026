"""Shared geometry for the wide battle canvases (Owner 2026-11-15: every arena, drawn wider).

Each arena's play area is the live picture (native 416x272, 1664x1088 at 4x).  Its canvas is
native 864x560 (world 3456x2240) with the play area at native (224,144): scenery nobody can
walk on, above and below for a portrait phone and far to both sides for a phone held sideways.

Everything is authored in **base pixels**: the play-area picture's own pixel grid, so (0, 0)
is its top-left corner and the canvas spans X -896..2560, Y -576..1664.  Screen and ground
share that grid; height lifts a point up the screen by LIFT pixels per world unit (locked
52 degree orthographic camera, 16 native pixels per unit).

Pure Python: imported by plain Python (ground painting, compose) and by Blender (props).
"""
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
METADATA = 'assets/production/public-runtime/metadata/battle-original.v1.json'
OUT_ROOT = 'assets/production/battle/original-opus-canvas-r1/fields'

SCALE = 4
NATIVE_CANVAS = (864, 560)
NATIVE_OFFSET = (224, 144)
BASE_W, BASE_H = 1664, 1088
OX, OY = NATIVE_OFFSET[0] * SCALE, NATIVE_OFFSET[1] * SCALE
CANVAS_W, CANVAS_H = NATIVE_CANVAS[0] * SCALE, NATIVE_CANVAS[1] * SCALE
X0, Y0, X1, Y1 = -OX, -OY, CANVAS_W - OX, CANVAS_H - OY

ELEVATION = math.radians(52)
SIN_E, COS_E = math.sin(ELEVATION), math.cos(ELEVATION)
UNIT = 16
LIFT = COS_E * UNIT * SCALE          # base pixels a point rises per world unit of height (39.40)

# The sun of the R1 arenas; the play-area pictures' own shadows agree with it
# (a shadow falls 21 px right and 24 px down per world unit of height).
SUN_FROM = (80.0, -40.0, 18.0)       # native x, native y, world z
SUN_AT = (175.0, 70.0)
SHADOW_PER_UNIT = (21.1, 24.4)


def hash01(*keys):
    """Deterministic 0..1 value (a string seed, so it does not depend on PYTHONHASHSEED)."""
    return random.Random(repr(keys)).random()


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def field_record(field_id):
    """The live arena record: its picture and ambient layers (public runtime metadata)."""
    manifest = json.loads((ROOT / METADATA).read_text(encoding='utf8'))
    for field in manifest['fields']:
        if field['fieldId'] == field_id:
            return field
    raise KeyError(field_id)


def arena_module(field_id):
    import importlib
    import sys
    here = str(Path(__file__).resolve().parent)
    if here not in sys.path:
        sys.path.insert(0, here)
    return importlib.import_module(f'arenas.{field_id}')


def scatter(seed, count, keepout, spacing, bounds=None, tries=40):
    """Positions in the ring, at least ``spacing`` apart and outside the ``keepout`` rectangle (base pixels)."""
    x0, y0, x1, y1 = bounds or (X0, Y0, X1, Y1)
    out = []
    for k in range(count * tries):
        if len(out) >= count:
            break
        x = x0 + hash01(seed, k, 'x') * (x1 - x0)
        y = y0 + hash01(seed, k, 'y') * (y1 - y0)
        if keepout[0] < x < keepout[2] and keepout[1] < y < keepout[3]:
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < spacing ** 2 for px, py in out):
            continue
        out.append((x, y))
    return out
