"""Story field producer (OWNER_APPROVED_ADAPTATION 2026-10-29): builds one
original 3-D location for the Data Area story mode in Blender, exports it as a
GLB and writes its gameplay data beside it.

  blender -b --factory-startup --python scripts/build-story-field.py -- --field habitat [--preview]

Output (assets/production/story/fields-v1/<field>/):
  scene.glb      the modelled location (Y-up glTF; 1 unit = 1 m)
  field.json     walk grid (walkability + ground height per cell), anchors
                 (spawn, NPC posts, triggers, exits) and the camera framing
  .tmp/story-fields/<field>-preview.png   a quick look from the game camera (--preview only;
                 kept out of the runtime assets)

Walkability lives in data, not in the picture: the same masks that shape the
terrain are written to the walk grid, so the model and the grid always agree.
Everything is modelled here from primitives; no reference art is read.
"""
import bpy, bmesh, json, math, sys, hashlib
from pathlib import Path
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "assets" / "production" / "story" / "fields-v1"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FIELD = argv[argv.index("--field") + 1] if "--field" in argv else "habitat"
PREVIEW = "--preview" in argv

CELL = 0.5          # walk grid cell (m)


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
HALF = 12.0         # the location spans -HALF..HALF on x and y (Blender, z up)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, rough=0.85, emit=None, strength=1.0, alpha=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha is not None:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.surface_render_method = "BLENDED"
    return mat


def hexrgb(value):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def link(obj, collection):
    collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------------------
# The habitat: a floating meadow island in the data sea.
# ---------------------------------------------------------------------------
class Habitat:
    """The partner habitat: a sunny meadow island with three ground levels (meadow,
    terrace, lookout), a ramp, stone stairs, a stream with a wooden bridge, a pond,
    a dirt path to the warp gate and a few glowing data crystals."""
    name = "habitat"
    palette = {"grassA": "#86c46a", "grassB": "#62a653", "grassC": "#a8d67e", "path": "#e2bd84", "pathEdge": "#c99d63",
               "cliffA": "#a0734a", "cliffB": "#87603d", "cliffC": "#6d4b30", "water": "#4fb7e8", "stone": "#bfc4c9", "stair": "#cfc6b4"}
    path_points = [(7.8, -8.6), (6.2, -7.7), (2.8, -7.5), (1.6, -5.4), (0.6, -1.6), (1.4, 2.4), (3.8, 5.6), (5.6, 7.8)]
    stream_points = [(4.6, -5.6), (4.5, -6.8), (4.4, -8.2), (4.7, -9.4), (5.0, -10.2)]
    bridge = (4.45, -7.62, 1.35, 0.85)  # centre x, y, half-length along x (the crossing), half-width along y

    # masks and distances -----------------------------------------------------------
    def island(self, x, y):
        r = 10.6 + 0.7 * noise.noise(Vector((x * 0.18, y * 0.18, 3.1)))
        return r - (abs(x) ** 3.2 + abs(y) ** 3.2) ** (1 / 3.2)

    def terrace_distance(self, x, y):
        d = math.sqrt(((x + 4.2) / 5.4) ** 2 + ((y - 4.6) / 4.6) ** 2)
        return (1 - d) * 4.6

    def upper_distance(self, x, y):
        d = math.sqrt(((x + 5.9) / 2.5) ** 2 + ((y - 6.5) / 2.0) ** 2)
        return (1 - d) * 2.0

    def pond_distance(self, x, y):
        d = math.sqrt(((x - 4.4) / 3.0) ** 2 + ((y + 3.6) / 2.2) ** 2)
        return (1 - d) * 2.2

    @staticmethod
    def polyline_distance(points, x, y):
        best = 99
        for (ax, ay), (bx, by) in zip(points, points[1:]):
            vx, vy = bx - ax, by - ay
            t = max(0, min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)))
            best = min(best, math.hypot(x - ax - t * vx, y - ay - t * vy))
        return best

    def path_distance(self, x, y):
        return self.polyline_distance(self.path_points, x, y)

    def stream_distance(self, x, y):
        return self.polyline_distance(self.stream_points, x, y)

    def terrace(self, x, y):
        return self.terrace_distance(x, y) > 0

    def ramp(self, x, y):
        return -2.6 < x < -0.6 and -0.2 < y < 2.2

    def stairs(self, x, y):
        return -5.4 < x < -3.6 and 2.9 < y < 4.95

    def on_bridge(self, x, y):
        cx, cy, half_len, half_w = self.bridge
        return abs(x - cx) <= half_len and abs(y - cy) <= half_w * 0.62

    def pond(self, x, y):
        return self.pond_distance(x, y) > 0

    def water(self, x, y):
        return self.pond_distance(x, y) > -0.05 or self.stream_distance(x, y) < 0.62

    # heights ------------------------------------------------------------------------
    def height(self, x, y):
        """Terrain surface: smooth contour-following cliffs, stepped stairs, sunken water."""
        top = 1.2 * smoothstep(-0.05, 0.22, self.terrace_distance(x, y))
        if self.ramp(x, y):
            # The ramp cuts through the terrace edge: a straight incline that blends
            # into whatever is beside it (meadow below, terrace cliff above).
            side = min(x + 2.6, -0.6 - x)
            incline = 1.2 * max(0.0, min(1.0, (y + 0.2) / 2.2))
            top = top + (incline - top) * smoothstep(-0.05, 0.25, side)
        if self.terrace(x, y) and not self.ramp(x, y):
            top = max(top, 1.2 + 1.2 * smoothstep(-0.05, 0.2, self.upper_distance(x, y)))
        if self.stairs(x, y):
            step = math.floor(max(0.0, min(0.999, (y - 2.9) / 2.0)) * 8)
            top = max(top, 1.2 + 0.15 * (step + 1))
        top -= 0.45 * smoothstep(-0.1, 0.35, self.pond_distance(x, y))
        top -= 0.4 * smoothstep(0.75, 0.35, self.stream_distance(x, y))
        return -3.2 + (top + 3.2) * smoothstep(-0.05, 0.3, self.island(x, y))

    def walk_height(self, x, y):
        return 0.16 if self.on_bridge(x, y) else self.height(x, y)

    # props: (kind, x, y, scale)
    props = [
        ("tree", -7.0, 5.0, 1.15), ("tree", -2.0, 7.6, 1.0), ("tree", -7.8, 1.4, 0.95), ("tree", 7.6, 2.0, 1.1),
        ("tree", -6.8, -5.8, 1.05), ("tree", 8.4, -6.2, 0.9), ("pine", -8.6, -2.8, 1.0), ("pine", 6.6, 6.0, 0.95),
        ("pine", -0.6, -9.2, 0.85), ("pine", 8.6, -2.4, 0.9),
        ("bush", -1.2, 6.0, 0.6), ("bush", 6.8, 4.4, 0.55), ("bush", -4.6, -2.8, 0.6), ("bush", 1.4, -8.2, 0.5), ("bush", -3.0, 2.6, 0.5),
        ("rock", 7.2, -1.2, 0.55), ("rock", 2.8, -2.0, 0.4), ("rock", -8.2, -1.0, 0.5), ("rock", 6.0, -9.6, 0.5),
        ("crystal", -6.8, 7.4, 1.0), ("crystal", -4.6, 7.6, 0.7), ("crystal", -7.4, 6.0, 0.6),
        ("nest", -2.0, 4.6, 1.0), ("sign", 0.4, -8.0, 0.0), ("gate", 5.9, 8.2, 0.0),
    ]
    fences = [((-9.4, -3.6), (-9.0, 2.4)), ((-3.6, -9.4), (0.0, -9.8)), ((8.8, -3.4), (9.2, 1.0))]
    flowers = [(-3.2, -6.0), (-2.2, -4.6), (-5.6, -4.2), (0.2, -5.6), (7.0, -6.2), (-8.4, 3.0), (-1.6, 3.8),
               (-5.0, 3.6), (3.0, 0.6), (8.0, 4.0), (-1.4, -7.8), (4.0, 3.4), (-6.0, 6.6), (2.6, -3.0)]

    anchors = {
        "spawn": {"at": (0.8, -3.2), "face": "left"},
        "npc_moon": {"at": (-3.6, -4.4), "face": "right"},
        "npc_bell": {"at": (6.4, -0.2), "face": "left"},
        "gift": {"at": (-2.4, -6.6), "kind": "trigger", "size": (1.6, 1.6)},
        "nest": {"at": (-2.0, 4.6), "kind": "inspect", "size": (2.4, 2.2)},
        "lookout": {"at": (-5.6, 6.3), "kind": "inspect", "size": (2.0, 1.6)},
        "gate": {"at": (5.9, 8.2), "kind": "exit", "size": (2.4, 1.8), "arrive": (5.0, 6.6)},
        "sign": {"at": (0.4, -8.0), "kind": "inspect", "size": (1.6, 1.6)},
    }

    def blocked(self, x, y):
        for kind, px, py, r in self.props:
            if kind in ("tree", "pine", "rock", "bush", "crystal") and math.hypot(x - px, y - py) < r * 0.72 + 0.18:
                return True
            if kind == "sign" and math.hypot(x - px, y - py) < 0.35:
                return True
            if kind == "gate" and abs(y - py) < 0.4 and 0.9 < abs(x - px) < 1.6:
                return True
        for (ax, ay), (bx, by) in self.fences:
            if self.polyline_distance([(ax, ay), (bx, by)], x, y) < 0.3:
                return True
        return False

    def walkable(self, x, y):
        """Walkable = on the island, not water (except the bridge deck), gentle slope
        to every neighbour (cliffs block, ramps / stairs / bridge pass), not a prop."""
        if self.island(x, y) < 0.7 or self.blocked(x, y):
            return False
        if self.on_bridge(x, y):
            return True
        if self.water(x, y):
            return False
        h = self.walk_height(x, y)
        for dx, dy in ((0.4, 0), (-0.4, 0), (0, 0.4), (0, -0.4)):
            if abs(self.walk_height(x + dx, y + dy) - h) > 0.34:
                return False
        return True

    def extras(self, m, col):
        field = self
        # The wooden bridge over the stream: deck planks, two rails with posts.
        cx, cy, half_len, half_w = field.bridge
        for k in range(9):
            px = cx - half_len + (k + 0.5) * (2 * half_len / 9)
            add_mesh(f"bridge_plank_{k}", box(2 * half_len / 9 * 0.86, half_w * 2, 0.1), m["plank"] if k % 2 else m["plankDark"], col, (px, cy, 0.06))
        for side in (-1, 1):
            ry = cy + side * half_w * 0.95
            for k in range(3):
                px = cx - half_len + k * half_len
                add_mesh(f"bridge_post_{side}_{k}", box(0.12, 0.12, 0.6), m["wood"], col, (px, ry, 0.06))
            add_mesh(f"bridge_rail_{side}", box(2 * half_len, 0.08, 0.08), m["wood"], col, (cx, ry, 0.56))
        # The stream: a water ribbon along its line, just under the banks.
        ribbon = bmesh.new()
        pts = field.stream_points
        left, right = [], []
        for i, (px, py) in enumerate(pts):
            ax, ay = pts[max(0, i - 1)]; bx, by = pts[min(len(pts) - 1, i + 1)]
            tx, ty = bx - ax, by - ay; n = math.hypot(tx, ty) or 1
            nx, ny = -ty / n * 0.62, tx / n * 0.62
            left.append(ribbon.verts.new((px + nx, py + ny, -0.16))); right.append(ribbon.verts.new((px - nx, py - ny, -0.16)))
        for i in range(len(pts) - 1):
            ribbon.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
        add_mesh("stream_water", ribbon, m["water"], col)
        # Where the stream leaves the island it falls down the cliff into the data sea.
        (ex, ey), (fx, fy) = pts[-2], pts[-1]
        tx, ty = fx - ex, fy - ey; n = math.hypot(tx, ty) or 1
        nx, ny = -ty / n * 0.62, tx / n * 0.62
        fall = bmesh.new()
        a = fall.verts.new((fx + nx, fy + ny, -0.16)); b = fall.verts.new((fx - nx, fy - ny, -0.16))
        c = fall.verts.new((fx - nx + tx / n * 0.5, fy - ny + ty / n * 0.5, -3.1)); d = fall.verts.new((fx + nx + tx / n * 0.5, fy + ny + ty / n * 0.5, -3.1))
        fall.faces.new((a, b, c, d))
        add_mesh("stream_fall", fall, material("waterfall", hexrgb("#bfeeff"), rough=0.1, emit=hexrgb("#7fd8ff"), strength=0.4, alpha=0.75), col)
        # The pond surface and the glint of the gift.
        bm = bmesh.new()
        bmesh.ops.create_circle(bm, cap_ends=True, segments=28, radius=1.0)
        bmesh.ops.scale(bm, vec=(3.0, 2.2, 1), verts=bm.verts)
        add_mesh("pond_water", bm, m["water"], col, (4.4, -3.6, -0.12))
        gx, gy = field.anchors["gift"]["at"]
        gem = bmesh.new()
        bmesh.ops.create_cone(gem, cap_ends=True, segments=4, radius1=0.18, radius2=0.0, depth=0.36)
        add_mesh("gift_glint", gem, m["glow"], col, (gx, gy, field.height(gx, gy) + 0.25))


    def ambient(self, x, y):
        """Vertex-colour AO: darker at cliff feet and under tree crowns (0..1 shade)."""
        h = self.height(x, y)
        shade = 0.0
        for dx, dy in ((0.6, 0), (-0.6, 0), (0, 0.6), (0, -0.6)):
            if self.height(x + dx, y + dy) - h > 0.5:
                shade = max(shade, 0.32)
        for kind, px, py, r in self.props:
            if kind in ("tree", "pine"):
                d = math.hypot(x - px, y - py)
                if d < 1.7 * r:
                    shade = max(shade, 0.28 * (1 - d / (1.7 * r)))
        return shade


class Plaza:
    """The local tournament plaza: a paved court on a floating island with a centre
    battle ring, a raised registration platform (terminal, stairs), tiered stands,
    faction banners, lamps, an arrival warp pad, the arena archway and one flower on
    the east lane (the rival's heavy partner steps round it)."""
    name = "plaza"
    face_colors = True
    palette = {"grassA": "#86c46a", "grassB": "#62a653", "grassC": "#a8d67e", "path": "#e2bd84", "pathEdge": "#c99d63",
               "cliffA": "#a6957d", "cliffB": "#8d7d67", "cliffC": "#736552", "water": "#4fb7e8", "stone": "#bfc4c9", "stair": "#cfc6b4",
               "tileA": "#e6dfcf", "tileB": "#d6cdb9", "grout": "#a99f8a", "ring": "#e8543c", "ringIn": "#f3e9d2", "deck": "#9fb0c8", "deckB": "#8a9bb5", "wood": "#b07a46"}
    ring = (0.6, -1.4, 3.2)

    def island(self, x, y):
        r = 10.5 + 0.35 * noise.noise(Vector((x * 0.16, y * 0.16, 8.1)))
        return r - (abs(x) ** 3.6 + abs(y) ** 3.6) ** (1 / 3.6)

    def court(self, x, y):
        return self.island(x, y) > 1.4

    def platform(self, x, y):
        return -6.6 < x < -1.4 and 4.0 < y < 7.8

    def stairs(self, x, y):
        return -4.9 < x < -3.1 and 3.0 < y < 4.0

    def stands(self, x, y):
        return -9.8 < x < -7.2 and -6.2 < y < 3.2

    def path_distance(self, x, y):
        return 99

    def height(self, x, y):
        top = 0.0
        if self.platform(x, y):
            top = 0.6
        if self.stairs(x, y):
            top = 0.15 * (math.floor(max(0.0, min(0.999, (y - 3.0) / 1.0)) * 4) + 1)
        if self.stands(x, y):
            top = 1.5 if x < -9.0 else 1.0 if x < -8.2 else 0.5
        return -3.2 + (top + 3.2) * smoothstep(-0.05, 0.3, self.island(x, y))

    def walk_height(self, x, y):
        return self.height(x, y)

    props = [
        ("terminal", -4.0, 6.6, 1.0), ("banner_lumen", -6.2, 7.4, 1.0), ("banner_iron", -2.0, 7.4, 1.0), ("banner_lotus", 1.6, 8.0, 1.0),
        ("lamp", -6.0, -7.0, 1.0), ("lamp", 6.8, -6.6, 1.0), ("lamp", 6.6, 3.6, 1.0), ("lamp", -0.8, 3.4, 1.0),
        ("archway", 5.4, 7.0, 1.0), ("warppad", 2.0, -7.6, 1.0), ("crate", 7.6, -3.8, 1.0), ("crate", 8.2, -4.6, 0.8),
        ("kiosk", 7.2, 1.8, 1.0), ("flowerbig", 4.8, -1.2, 1.0), ("tree", -7.8, 6.6, 1.0), ("tree", 8.4, 5.6, 0.95),
        ("pine", -1.0, -9.0, 0.85), ("bush", 3.6, 8.4, 0.55), ("bush", -8.6, -7.2, 0.55),
    ]
    fences = []
    flowers = [(-8.6, 5.0), (8.6, 2.8), (-3.0, -8.8), (4.6, -8.8), (8.8, -7.2)]

    anchors = {
        "spawn": {"at": (2.0, -6.4), "face": "left"},
        "terminal": {"at": (-4.0, 5.5), "kind": "inspect", "size": (2.4, 1.6)},
        "sign_spot": {"at": (-4.0, 5.4)},
        "registrar": {"at": (-2.4, 5.6), "face": "left"},
        "flower": {"at": (4.8, -1.2), "kind": "prop"},
        "rival_enter": {"at": (8.4, -1.6)},
        "rival_stop": {"at": (2.6, -1.0), "face": "left"},
        "duel": {"at": (-1.6, -1.6), "face": "right"},
        "stands": {"at": (-6.6, -1.4), "kind": "inspect", "size": (1.4, 4.0)},
        "arena": {"at": (5.4, 6.4), "kind": "exit", "size": (3.2, 1.4), "arrive": (5.4, 5.4)},
    }

    def blocked(self, x, y):
        radii = {"terminal": 1.0, "lamp": 0.35, "banner_lumen": 0.3, "banner_iron": 0.3, "banner_lotus": 0.3, "crate": 0.6, "kiosk": 1.2,
                 "flowerbig": 0.35, "tree": 0.9, "pine": 0.8, "bush": 0.55, "warppad": 0.0}
        for kind, px, py, sc in self.props:
            r = radii.get(kind)
            if r and math.hypot(x - px, y - py) < r * sc:
                return True
            if kind == "archway" and abs(y - py) < 0.55 and 1.8 < abs(x - px) < 2.6:
                return True
        return False

    def walkable(self, x, y):
        if self.island(x, y) < 0.7 or self.blocked(x, y) or self.stands(x, y):
            return False
        h = self.height(x, y)
        for dx, dy in ((0.4, 0), (-0.4, 0), (0, 0.4), (0, -0.4)):
            if abs(self.height(x + dx, y + dy) - h) > 0.34:
                return False
        return True

    def ambient(self, x, y):
        h = self.height(x, y)
        for dx, dy in ((0.6, 0), (-0.6, 0), (0, 0.6), (0, -0.6)):
            if self.height(x + dx, y + dy) - h > 0.4:
                return 0.28
        return 0.0

    def surface(self, p, x, y, z, spread):
        P = {k: hexrgb(v) for k, v in self.palette.items()}
        shade = self.ambient(x, y)
        if self.stands(x, y):
            return mix(P["wood"], (0.05, 0.03, 0.02), 0.25 if int((x + 10) / 0.8) % 2 else 0.0)
        if self.stairs(x, y) or (self.platform(x, y) and z > 0.5):
            tile = (int(math.floor(x)) + int(math.floor(y))) % 2
            return mix(P["deck"] if tile else P["deckB"], (0.02, 0.03, 0.06), shade)
        if not self.court(x, y):
            v = noise.noise(Vector((x * 0.3, y * 0.3, 1.0)))
            return mix(P["grassB"], P["grassC"], smoothstep(-0.5, 0.6, v))
        cx, cy, r = self.ring
        d = math.hypot(x - cx, y - cy)
        if r - 0.22 < d < r + 0.05:
            return P["ring"]
        if d < 0.9:
            return P["ring"] if d > 0.7 else P["ringIn"]
        tx, ty = x / 1.5, y / 1.5
        fx, fy = tx - math.floor(tx), ty - math.floor(ty)
        if min(fx, fy) < 0.17:
            base = P["grout"]
        else:
            base = P["tileA"] if (int(math.floor(tx)) + int(math.floor(ty))) % 2 else P["tileB"]
        if d < r:
            base = mix(base, P["ringIn"], 0.35)
        return mix(base, (0.02, 0.02, 0.02), shade)


FIELDS = {"habitat": Habitat, "plaza": Plaza}


# ---------------------------------------------------------------------------
# geometry builders
# ---------------------------------------------------------------------------
def build_terrain(field, col):
    """A heightfield with flat-shaded faces, vertex coloured: grass, path, cliffs."""
    p = {k: hexrgb(v) for k, v in field.palette.items()}
    step = 0.25
    n = int(HALF * 2 / step)
    mesh = bpy.data.meshes.new("terrain")
    bm = bmesh.new()
    verts = {}
    for j in range(n + 1):
        for i in range(n + 1):
            x, y = -HALF + i * step, -HALF + j * step
            verts[i, j] = bm.verts.new((x, y, field.height(x, y)))
    color_layer = bm.loops.layers.color.new("Col")
    for j in range(n):
        for i in range(n):
            q = [verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]]
            zs = [v.co.z for v in q]
            if max(zs) < -3.0:
                continue  # open sea: drawn by the runtime's data sea
            face = bm.faces.new(q)
            spread = max(zs) - min(zs)
            if getattr(field, "face_colors", False):
                # Crisp per-face colour (paving, painted lines): one colour from the face centre.
                cx, cy = -HALF + (i + 0.5) * step, -HALF + (j + 0.5) * step
                c = ground_color(field, p, cx, cy, sum(zs) / 4, spread)
                for loop in face.loops:
                    loop[color_layer] = (*c, 1)
                continue
            for loop in face.loops:
                loop[color_layer] = (*ground_color(field, p, loop.vert.co.x, loop.vert.co.y, loop.vert.co.z, spread), 1)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = False
    obj = bpy.data.objects.new("terrain", mesh)
    obj.data.materials.append(material("terrain", (1, 1, 1), rough=0.95))
    mat = obj.data.materials[0]
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    links.new(attr.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    return link(obj, col)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def ground_color(field, p, x, y, z, spread):
    """Grass with soft patches, a blended dirt path, banded earth on steep faces."""
    if hasattr(field, "surface") and (spread <= 0.32 or field.island(x, y) > 0.6):
        color = field.surface(p, x, y, z, spread)
        if color is not None:
            return color
    if spread > 0.32:
        band = (z + 4.0) * 1.6 + 0.3 * noise.noise(Vector((x * 0.8, y * 0.8, 5.0)))
        k = band - math.floor(band)
        return mix(p["cliffB"], p["cliffA"] if int(band) % 2 else p["cliffC"], k)
    if field.stairs(x, y) and z > 1.15:
        return mix(p["stair"], p["stone"], 0.3 if int((y - 2.9) / 0.25) % 2 else 0.0)
    v = noise.noise(Vector((x * 0.3, y * 0.3, 1.0))) + 0.35 * noise.noise(Vector((x * 1.1, y * 1.1, 4.0)))
    grass = mix(p["grassB"], p["grassC"], smoothstep(-0.5, 0.6, v))
    grass = mix(grass, p["grassA"], 0.35)
    best = field.path_distance(x, y)
    dirt = mix(p["path"], p["pathEdge"], smoothstep(0.4, 0.95, best))
    color = mix(dirt, grass, smoothstep(0.85, 1.15, best + 0.12 * noise.noise(Vector((x * 0.9, y * 0.9, 7.0)))))
    if z < -0.1 and field.island(x, y) > 0.5:
        color = mix(color, p["stone"], smoothstep(-0.1, -0.35, z))
    shade = field.ambient(x, y)
    return mix(color, (0.02, 0.05, 0.03), shade)


def add_mesh(name, bm, mat, col, location=(0, 0, 0), smooth=False):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.data.materials.append(mat)
    return link(obj, col)


def cylinder(r1, r2, h, seg=8):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, h / 2))
    return bm


def ico(r, sub=1, squash=1.0, seed=0.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    for v in bm.verts:
        v.co.z *= squash
        v.co += v.co.normalized() * 0.12 * r * noise.noise(v.co * 2.1 + Vector((seed, seed, seed)))
    return bm


def box(sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, sz / 2))
    return bm


def build_props(field, col):
    m = {
        "trunk": material("trunk", hexrgb("#7a5534")), "leafA": material("leafA", hexrgb("#3f9a46")), "leafB": material("leafB", hexrgb("#57b64c")),
        "bush": material("bush", hexrgb("#4ea845")), "rock": material("rock", hexrgb("#a7abb3"), rough=0.7), "rockDark": material("rockDark", hexrgb("#83878f")),
        "wood": material("wood", hexrgb("#b07a46")), "hay": material("hay", hexrgb("#e6c66a")), "sign": material("signboard", hexrgb("#d9a866")),
        "gate": material("gateFrame", hexrgb("#dfe9f5"), rough=0.4), "gateRing": material("gateRing", hexrgb("#3fd8ff"), emit=hexrgb("#3fd8ff"), strength=1.1, alpha=0.85),
        "petalA": material("petalA", hexrgb("#ff8fc8")), "petalB": material("petalB", hexrgb("#fff27a")), "petalC": material("petalC", hexrgb("#9fd8ff")),
        "water": material("water", hexrgb(field.palette["water"]), rough=0.15, alpha=0.82), "stem": material("stem", hexrgb("#3f9a46")),
        "glow": material("giftGlow", hexrgb("#9feeff"), emit=hexrgb("#9feeff"), strength=1.6),
        "pine": material("pine", hexrgb("#2f7d4a")), "crystal": material("dataCrystal", hexrgb("#7fe6ff"), rough=0.2, emit=hexrgb("#3fc8ff"), strength=0.9),
        "plank": material("plank", hexrgb("#c08a52")), "plankDark": material("plankDark", hexrgb("#8f6236")),
        "metal": material("metal", hexrgb("#3c4a78"), rough=0.4), "screen": material("screen", hexrgb("#3fd8ff"), emit=hexrgb("#3fd8ff"), strength=1.2),
        "trim": material("trim", hexrgb("#dfe9f5"), rough=0.35), "lampGlow": material("lampGlow", hexrgb("#fff2c4"), emit=hexrgb("#ffe7a0"), strength=2.0),
        "archStone": material("archStone", hexrgb("#d9d2c2"), rough=0.8), "kiosk": material("kiosk", hexrgb("#ff8a5c")), "kioskRoof": material("kioskRoof", hexrgb("#fff2e0")),
    }
    for idx, (kind, x, y, s) in enumerate(field.props):
        z = field.height(x, y)
        if kind == "tree":
            add_mesh(f"tree_trunk_{idx}", cylinder(0.22 * s, 0.16 * s, 1.5 * s, 7), m["trunk"], col, (x, y, z))
            add_mesh(f"tree_crown_{idx}", ico(1.15 * s, 1, 0.85, idx), m["leafA"], col, (x, y, z + 1.95 * s))
            add_mesh(f"tree_top_{idx}", ico(0.75 * s, 1, 0.9, idx + 9), m["leafB"], col, (x + 0.2 * s, y - 0.25 * s, z + 2.6 * s))
        elif kind == "pine":
            add_mesh(f"pine_trunk_{idx}", cylinder(0.18 * s, 0.14 * s, 0.9 * s, 6), m["trunk"], col, (x, y, z))
            for k, (r, h, off) in enumerate(((1.05, 1.5, 0.7), (0.8, 1.3, 1.5), (0.5, 1.1, 2.25))):
                add_mesh(f"pine_cone_{idx}_{k}", cylinder(r * s, 0.05, h * s, 8), m["pine"], col, (x, y, z + off * s))
        elif kind == "crystal":
            gem = bmesh.new()
            bmesh.ops.create_cone(gem, cap_ends=True, segments=6, radius1=0.32 * s, radius2=0.0, depth=1.3 * s)
            bmesh.ops.translate(gem, verts=gem.verts, vec=(0, 0, 0.65 * s))
            base = bmesh.new()
            bmesh.ops.create_cone(base, cap_ends=True, segments=6, radius1=0.32 * s, radius2=0.0, depth=0.5 * s)
            bmesh.ops.rotate(base, verts=base.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(math.radians(180), 3, "X"))
            add_mesh(f"crystal_{idx}", gem, m["crystal"], col, (x, y, z + 0.2))
            add_mesh(f"crystal_base_{idx}", base, m["crystal"], col, (x, y, z + 0.2))
        elif kind == "terminal":
            add_mesh(f"terminal_base_{idx}", box(1.6, 0.8, 0.9), m["metal"], col, (x, y, z))
            screen = box(1.4, 0.12, 0.85)
            obj = add_mesh(f"terminal_screen_{idx}", screen, m["screen"], col, (x, y + 0.1, z + 0.95))
            obj.rotation_euler = (math.radians(-18), 0, 0)
            add_mesh(f"terminal_cap_{idx}", box(1.7, 0.9, 0.08), m["trim"], col, (x, y, z + 0.9))
        elif kind.startswith("banner_"):
            colors = {"banner_lumen": ("#2fd18b", "#ffd36a"), "banner_iron": ("#2a2f3a", "#3ab8ff"), "banner_lotus": ("#4a2366", "#e6e9f5")}[kind]
            add_mesh(f"banner_pole_{idx}", cylinder(0.07, 0.06, 3.2, 6), m["trim"], col, (x, y, z))
            add_mesh(f"banner_cloth_{idx}", box(0.9, 0.06, 1.4), material(f"banner_{idx}", hexrgb(colors[0])), col, (x + 0.48, y, z + 1.6))
            add_mesh(f"banner_edge_{idx}", box(0.92, 0.07, 0.12), material(f"bannerEdge_{idx}", hexrgb(colors[1]), emit=hexrgb(colors[1]), strength=0.6), col, (x + 0.48, y, z + 2.92))
        elif kind == "lamp":
            add_mesh(f"lamp_post_{idx}", cylinder(0.09, 0.07, 2.4, 6), m["trim"], col, (x, y, z))
            add_mesh(f"lamp_head_{idx}", ico(0.22, 1, 1.0, idx), m["lampGlow"], col, (x, y, z + 2.5))
        elif kind == "archway":
            for side in (-1, 1):
                add_mesh(f"arch_pillar_{side}", box(0.7, 0.7, 4.0), m["archStone"], col, (x + side * 2.2, y, z))
            add_mesh("arch_beam", box(5.2, 0.9, 0.7), m["archStone"], col, (x, y, z + 4.0))
            add_mesh("arch_plate", box(3.0, 0.1, 0.7), m["screen"], col, (x, y - 0.5, z + 4.05))
        elif kind == "warppad":
            pad = bmesh.new(); bmesh.ops.create_cone(pad, cap_ends=True, segments=24, radius1=1.4, radius2=1.3, depth=0.16)
            add_mesh(f"warppad_{idx}", pad, m["trim"], col, (x, y, z + 0.08))
            ring = bmesh.new(); bmesh.ops.create_cone(ring, cap_ends=True, segments=24, radius1=1.0, radius2=1.0, depth=0.04)
            add_mesh(f"warppad_glow_{idx}", ring, m["gateRing"], col, (x, y, z + 0.18))
        elif kind == "crate":
            add_mesh(f"crate_{idx}", box(0.8 * s, 0.8 * s, 0.7 * s), m["plank"], col, (x, y, z))
        elif kind == "kiosk":
            add_mesh(f"kiosk_body_{idx}", box(1.8, 1.2, 1.6), m["kiosk"], col, (x, y, z))
            add_mesh(f"kiosk_roof_{idx}", box(2.2, 1.6, 0.18), m["kioskRoof"], col, (x, y, z + 1.7))
        elif kind == "flowerbig":
            add_mesh(f"flowerbig_stem_{idx}", cylinder(0.07, 0.05, 0.85, 5), m["stem"], col, (x, y, z))
            add_mesh(f"flowerbig_leaf_{idx}", ico(0.16, 0, 0.35, 4), m["leafB"], col, (x + 0.14, y, z + 0.32))
            for k in range(6):
                a = k * math.tau / 6
                add_mesh(f"flowerbig_petal_{idx}_{k}", ico(0.22, 0, 0.6, k), m["petalA"], col, (x + 0.26 * math.cos(a), y + 0.26 * math.sin(a), z + 0.92))
            add_mesh(f"flowerbig_core_{idx}", ico(0.17, 0, 0.8, 9), m["petalB"], col, (x, y, z + 0.95))
        elif kind == "bush":
            add_mesh(f"bush_{idx}", ico(0.62 * s, 1, 0.7, idx), m["bush"], col, (x, y, z + 0.32 * s))
        elif kind == "rock":
            add_mesh(f"rock_{idx}", ico(0.55 * s, 1, 0.62, idx), m["rock"], col, (x, y, z + 0.18 * s))
            add_mesh(f"rock_b_{idx}", ico(0.3 * s, 0, 0.7, idx + 3), m["rockDark"], col, (x + 0.45 * s, y - 0.2 * s, z + 0.1))
        elif kind == "nest":
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=1.05, radius2=0.8, depth=0.32)
            add_mesh("nest", bm, m["hay"], col, (x, y, z + 0.16))
        elif kind == "sign":
            add_mesh("sign_post", box(0.12, 0.12, 0.9), m["wood"], col, (x, y, z))
            add_mesh("sign_board", box(0.95, 0.1, 0.55), m["sign"], col, (x, y, z + 0.75))
        elif kind == "gate":
            for side in (-1, 1):
                add_mesh(f"gate_pillar_{side}", box(0.38, 0.38, 2.6), m["gate"], col, (x + side * 1.25, y, z))
            add_mesh("gate_lintel", box(3.0, 0.42, 0.34), m["gate"], col, (x, y, z + 2.6))
            bm = bmesh.new()
            bmesh.ops.create_circle(bm, cap_ends=True, segments=24, radius=1.0)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(math.radians(90), 3, "X"))
            add_mesh("gate_ring", bm, m["gateRing"], col, (x, y, z + 1.35))
    for idx, ((ax, ay), (bx, by)) in enumerate(field.fences):
        length = math.hypot(bx - ax, by - ay)
        count = max(2, int(length / 1.2) + 1)
        for k in range(count):
            t = k / (count - 1)
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            add_mesh(f"fence_post_{idx}_{k}", box(0.16, 0.16, 0.8), m["wood"], col, (px, py, field.height(px, py)))
        angle = math.atan2(by - ay, bx - ax)
        for rail_z in (0.35, 0.65):
            rail = box(length, 0.08, 0.08)
            obj = add_mesh(f"fence_rail_{idx}_{rail_z}", rail, m["wood"], col, ((ax + bx) / 2, (ay + by) / 2, field.height((ax + bx) / 2, (ay + by) / 2) + rail_z))
            obj.rotation_euler = (0, 0, angle)
    petals = (m["petalA"], m["petalB"], m["petalC"])
    for idx, (fx, fy) in enumerate(field.flowers):
        z = field.height(fx, fy)
        for k in range(5):
            a = k * 1.3 + idx
            px, py = fx + 0.35 * math.cos(a), fy + 0.35 * math.sin(a)
            add_mesh(f"flower_stem_{idx}_{k}", cylinder(0.03, 0.02, 0.28, 4), m["stem"], col, (px, py, z))
            add_mesh(f"flower_head_{idx}_{k}", ico(0.11, 0, 0.8, k), petals[(idx + k) % 3], col, (px, py, z + 0.3))
    if hasattr(field, "extras"):
        field.extras(m, col)

def walk_grid(field):
    cols = rows = int(HALF * 2 / CELL)
    walk, heights = [], []
    for r in range(rows):
        for c in range(cols):
            x, y = -HALF + (c + 0.5) * CELL, -HALF + (r + 0.5) * CELL
            walk.append("1" if field.walkable(x, y) else "0")
            heights.append(round(field.walk_height(x, y) if field.island(x, y) > 0 else -3.2, 2))
    return {"cell": CELL, "cols": cols, "rows": rows, "origin": [-HALF, -HALF], "walk": "".join(walk), "height": heights,
            "axes": "x east, y north (Blender); glTF x = x, glTF z = -y, up = height"}


def anchors(field):
    out = {}
    for key, spec in field.anchors.items():
        x, y = spec["at"]
        entry = {"x": x, "y": y, "z": field.walk_height(x, y), "kind": spec.get("kind", "post")}
        for extra in ("face", "size", "arrive"):
            if extra in spec:
                entry[extra] = spec[extra]
        assert spec.get("kind") in ("trigger", "exit", "inspect", "prop") or field.walkable(x, y), f"anchor {key} stands on a blocked cell"
        out[key] = entry
    return out


def preview(path):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 900, 1300
    world = bpy.data.worlds.new("world"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*hexrgb("#0c1b54"), 1)
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.2
    sun.rotation_euler = (math.radians(40), math.radians(10), math.radians(-30)); scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); cam.data.type = "ORTHO"; cam.data.ortho_scale = 26
    elev, azim = math.radians(52), math.radians(45)
    d = 40
    cam.location = (d * math.cos(elev) * math.sin(azim), -d * math.cos(elev) * math.cos(azim), d * math.sin(elev))
    direction = Vector((0, 0, 0)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam); scene.camera = cam
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    field = FIELDS[FIELD]()
    clear()
    col = bpy.data.collections.new(FIELD)
    bpy.context.scene.collection.children.link(col)
    build_terrain(field, col)
    build_props(field, col)
    out = OUT_ROOT / FIELD
    out.mkdir(parents=True, exist_ok=True)
    for obj in bpy.data.objects:
        obj.select_set(obj.name in col.objects)
    glb = out / "scene.glb"
    kwargs = dict(filepath=str(glb), export_format="GLB", use_selection=True, export_yup=True, export_cameras=False, export_lights=False, export_apply=True)
    try:
        bpy.ops.export_scene.gltf(**kwargs, export_vertex_color="ACTIVE")
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)
    data = {"schema": "STORY_FIELD.v1", "field": FIELD, "status": "LOCAL_INTEGRATION_CANDIDATE", "origin": "ORIGINAL_BLENDER_PRIMITIVES",
            "camera": {"elevationDegrees": 52, "azimuthDegrees": 45, "viewWidth": 13.0},
            "sea": {"height": -3.2, "color": "#0c1b54", "grid": "#7ff3ff"},
            "walk": walk_grid(field), "anchors": anchors(field),
            "glb": {"file": "scene.glb", "bytes": glb.stat().st_size, "sha256": hashlib.sha256(glb.read_bytes()).hexdigest()}}
    (out / "field.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8", newline="\n")
    if PREVIEW:
        (ROOT / ".tmp" / "story-fields").mkdir(parents=True, exist_ok=True)
        preview(ROOT / ".tmp" / "story-fields" / f"{FIELD}-preview.png")
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in col.objects if o.type == "MESH")
    print(json.dumps({"field": FIELD, "glbBytes": glb.stat().st_size, "triangles": tris, "walkable": data["walk"]["walk"].count("1")}))


main()
