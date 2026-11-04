"""Shared layout for the two gachapon-only cage maps (Owner 2026-11-03).

Everything is in the field's own native pixels (8 px tiles), the space the walk data and
productFieldTileOrigin use. Both maps take the waiting room's footprint (shape 10, mask 15):
two hexes on the top row and two on the row below, shifted half a hex right.

World units on the ground: u = nx / 16 (screen right), w = ny / (16 sin 52) (toward the camera).
"""
import math

S52 = math.sin(math.radians(52))
FIELD_W, FIELD_H = 240, 200            # 30 x 25 tiles
TILES_W, TILES_H = FIELD_W // 8, FIELD_H // 8
CELLS = [(0, 24), (96, 24), (48, 112), (144, 112)]   # top-left of each hex's side band
CENTERS = {'A': (48, 56), 'B': (144, 56), 'C': (96, 144), 'D': (192, 144)}
PLAZA = (120, 100)                       # the middle of the B/C shared edge = the shape's centroid


def hex_poly(ox, oy):
    return [(ox + 48, oy - 24), (ox + 96, oy), (ox + 96, oy + 64), (ox + 48, oy + 88), (ox, oy + 64), (ox, oy)]


def outline():
    """The union's boundary, one loop in screen-clockwise order (native y down)."""
    count, directed = {}, {}
    for ox, oy in CELLS:
        p = hex_poly(ox, oy)
        for i in range(6):
            a, b = p[i], p[(i + 1) % 6]
            key = frozenset((a, b))
            count[key] = count.get(key, 0) + 1
            directed[key] = (a, b)
    nxt = {}
    for key, n in count.items():
        if n == 1:
            a, b = directed[key]
            nxt[a] = b
    start = min(nxt, key=lambda q: (q[1], q[0]))
    loop, cur = [start], nxt[start]
    while cur != start:
        loop.append(cur)
        cur = nxt[cur]
    return loop


def outer_edges():
    pts = outline()
    return [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]


def to_world(nx, ny):
    return (nx / 16.0, ny / (16.0 * S52))


def from_world(u, w):
    return (u * 16.0, w * 16.0 * S52)


def point_in_poly(x, y, poly):
    inside = False
    for i in range(len(poly)):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            inside = not inside
    return inside


def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def rim_distance(nx, ny):
    """World-unit distance from a native point to the outer outline (positive inside)."""
    p = to_world(nx, ny)
    d = min(seg_dist(p, to_world(*a), to_world(*b)) for a, b in outer_edges())
    return d if point_in_poly(nx, ny, outline()) else -d


# Obstacles in world units around a native centre. 'circle': r; 'rect': half extents hu, hw (u across, w depth).
LAYOUTS = {
    'ROYAL_RANCH': {
        'obstacles': [
            {'id': 'palace', 'kind': 'rect', 'c': (144, 30), 'hu': 2.05, 'hw': 1.0, 'tall': True},
            {'id': 'feeder-pavilion', 'kind': 'circle', 'c': (46, 40), 'r': 1.3, 'tall': True},
            {'id': 'fountain', 'kind': 'circle', 'c': PLAZA, 'r': 1.45},
            {'id': 'cleaner-kiosk', 'kind': 'rect', 'c': (219, 128), 'hu': 0.62, 'hw': 0.5},
        ],
        'rim': 0.42,
    },
    'STELLAR_ZOO': {
        'obstacles': [
            {'id': 'observatory', 'kind': 'circle', 'c': (150, 30), 'r': 1.25, 'tall': True},
            {'id': 'rocket-pad', 'kind': 'circle', 'c': (44, 38), 'r': 1.05, 'tall': True},
            {'id': 'nebula-pool', 'kind': 'circle', 'c': PLAZA, 'r': 1.55},
            {'id': 'nutrient-tower', 'kind': 'circle', 'c': (220, 128), 'r': 0.55},
        ],
        'rim': 0.42,
    },
}


def obstacle_hit(edition, nx, ny, pad=0.0):
    u, w = to_world(nx, ny)
    for o in LAYOUTS[edition]['obstacles']:
        cu, cw = to_world(*o['c'])
        if o['kind'] == 'circle' and math.hypot(u - cu, w - cw) < o['r'] + pad:
            return o['id']
        if o['kind'] == 'rect' and abs(u - cu) < o['hu'] + pad and abs(w - cw) < o['hw'] + pad:
            return o['id']
    return None


def behind_tall(edition, nx, ny):
    """Back-row buildings hide whatever stands behind them, so nobody walks there."""
    u, w = to_world(nx, ny)
    for o in LAYOUTS[edition]['obstacles']:
        if not o.get('tall'):
            continue
        cu, cw = to_world(*o['c'])
        half = o['r'] if o['kind'] == 'circle' else o['hu']
        if abs(u - cu) < half + 0.35 and w < cw:
            return True
    return False


def walk_tiles(edition):
    """30 x 25 booleans: a tile is walkable when its centre is inside the rim margin, clear of obstacles
    and of the ground hidden behind the back buildings; only the largest connected area is kept."""
    rim = LAYOUTS[edition]['rim']
    grid = [[rim_distance(tx * 8 + 4, ty * 8 + 4) >= rim and obstacle_hit(edition, tx * 8 + 4, ty * 8 + 4, 0.12) is None
             and not behind_tall(edition, tx * 8 + 4, ty * 8 + 4) for tx in range(TILES_W)] for ty in range(TILES_H)]
    # Drop slivers one tile wide (fewer than two walkable 4-neighbours), then keep the largest area.
    for _ in range(2):
        grid = [[grid[y][x] and sum(grid[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                                   if 0 <= x + dx < TILES_W and 0 <= y + dy < TILES_H) >= 2
                 for x in range(TILES_W)] for y in range(TILES_H)]
    seen, best = set(), set()
    for y in range(TILES_H):
        for x in range(TILES_W):
            if grid[y][x] and (x, y) not in seen:
                comp, stack = set(), [(x, y)]
                while stack:
                    c = stack.pop()
                    if c in comp:
                        continue
                    comp.add(c)
                    cx, cy = c
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        q = (cx + dx, cy + dy)
                        if 0 <= q[0] < TILES_W and 0 <= q[1] < TILES_H and grid[q[1]][q[0]] and q not in comp:
                            stack.append(q)
                seen |= comp
                if len(comp) > len(best):
                    best = comp
    return [[(x, y) in best for x in range(TILES_W)] for y in range(TILES_H)]
