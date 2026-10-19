"""HM01 Dyna Grassland - whole-map 2x rebuild grid (Owner direction 2026-10-19).

The original 128x128 functional layout stays at tile origin (0, 0): both caves and
their escape anchors (35,4)/(36,4) and (79,59)/(80,59), the lake, the ridges and the
spawn rules keep their coordinates (old->new mapping is the identity). The map grows to
180x180 tiles: the lake widens east with a grass islet, a stream runs from it to a reed
pond, an east grove and a winding ridge with two gaps, a third cave in a new southern
plateau, a tram-car knoll (the world-intrusion landmark, blocked footprint only), a
birch meadow, a south-west pool and forest edges with exits. Two openings are cut
through the original south forest belt so the old and new ground read as one meadow.

Terrain values: 0 open, 1 blocked, 2 water (walkable/swimmable).
Writes: <out>/hunt-hm01x2.review.json (expansion environments, day+night),
        <out>/hm01x2-terrain.npy, <out>/hm01x2-inventory.json, <out>/hm01x2-design.png,
        <out>/hm01x2-metrics.json
args: <hunt-scene.r1.json> <out_dir>
"""
import json, math, os, sys
from collections import deque
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
src = json.load(open(SRC, encoding='utf-8'))
W0 = H0 = 128
W = H = 180
ADAPT = 'OWNER_APPROVED_HUNT_EXPANSION_REVIEW_20261019'


def expand(runs, n):
    out = []
    for c, v in runs: out += [v] * c
    assert len(out) == n
    return np.array(out, dtype=np.int64)


def to_runs(a):
    flat = a.reshape(-1).tolist(); out = []; prev = None
    for v in flat:
        if out and v == prev: out[-1][0] += 1
        else: out.append([1, v]); prev = v
    return out


def noise(x, y, s):
    return (math.sin(x * .37 + s) * .5 + math.sin(y * .29 + s * 1.7) * .5 + math.sin((x + y) * .19 + s * 2.3) * .4)


def blob(t, cx, cy, rx, ry, v, seed=0, wob=.12, only=None):
    for y in range(max(0, int(cy - ry - 3)), min(H, int(cy + ry + 4))):
        for x in range(max(0, int(cx - rx - 3)), min(W, int(cx + rx + 4))):
            r = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if r <= 1 + wob * noise(x, y, seed) and (only is None or t[y, x] in only):
                t[y, x] = v


def stroke(t, pts, width, v, gaps=(), only=None):
    """Thick polyline through tile points; ``gaps`` are (f0, f1) fractions left open."""
    seg = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total = sum(seg); n = int(total * 3)
    for i in range(n + 1):
        f = i / n
        if any(a < f < b for a, b in gaps): continue
        d = f * total; k = 0
        while k < len(seg) - 1 and d > seg[k]: d -= seg[k]; k += 1
        (x0, y0), (x1, y1) = pts[k], pts[k + 1]
        u = d / seg[k] if seg[k] else 0
        x, y = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
        r = width / 2
        for yy in range(int(y - r - 1), int(y + r + 2)):
            for xx in range(int(x - r - 1), int(x + r + 2)):
                if 0 <= xx < W and 0 <= yy < H and (xx + .5 - x - .5) ** 2 + (yy + .5 - y - .5) ** 2 <= r * r:
                    if only is None or t[yy, xx] in only:
                        t[yy, xx] = v


def rect(t, x0, y0, x1, y1, v):
    t[y0:y1 + 1, x0:x1 + 1] = v


base = expand(src['environments']['field_hm01_01']['terrainRuns'], W0 * H0).reshape(H0, W0)
t = np.zeros((H, W), np.int64)
t[:H0, :W0] = base

# ---- original south forest belt: two openings so the meadow continues south
rect(t, 18, 118, 27, 127, 0)          # west opening (old belt 118..127)
rect(t, 76, 126, 81, 127, 0)          # the old notch at x 76..81 now runs through
# ---- the old wall row/column are no longer the map edge: restore ground where the
# interior continues (the original row 127 / column 127 were pure edge wall).
for x in range(W0):
    if base[126, x] != 1 and t[127, x] == 1: t[127, x] = 0
for y in range(H0):
    if base[y, 126] == 0 and base[y, 127] == 1: t[y, 127] = 0

# ---- east band (x 128..179) -------------------------------------------------
# lake widens east; shoreline recedes south-east in a soft curve
for y in range(0, 44):
    for x in range(W0, W):
        u = x - W0
        shore = 30 + 6 * math.sin(u * .11) - (u - 26) ** 2 * .006 + 1.5 * noise(x, y, 3)
        if y < shore: t[y, x] = 2
# grass islet with a tree clump in the lake
blob(t, 150, 11, 8, 4.5, 0, 5, .1, only=(2,))
blob(t, 151, 10, 3.2, 2.2, 1, 6, .05)
# north-east corner woodland
for y in range(0, 40):
    for x in range(168, W):
        if x - 168 > 4 + 3 * math.sin(y * .3) - (y - 20) ** 2 * .01 and t[y, x] == 2: t[y, x] = 1
# stream: lake -> reed pond, meandering, 3 tiles wide
pts = [(141, 30), (139, 40), (143, 50), (147, 60), (144, 70), (146, 80), (151, 90), (153, 98)]
stroke(t, pts, 4.0, 2)
blob(t, 156, 104, 9, 6, 2, 8, .14)                 # reed pond (capture space)
blob(t, 165, 108, 3, 2, 1, 9)                       # pond-side willow clump
# east grove
blob(t, 162, 62, 8, 12, 1, 10, .16)
# winding ridge with two gaps (a choice of channels, like the original's ridges)
stroke(t, [(133, 40), (136, 52), (134, 62), (137, 72), (135, 82), (138, 90)], 4.6, 1, gaps=((.30, .40), (.68, .78)), only=(0,))
# old forest masses that met the old east/south edge now end in rounded forest lobes
blob(t, 131, 116, 8, 14, 1, 21, .14, only=(0,))       # old south-east forest -> rounded east end
blob(t, 112, 130, 15, 5, 1, 22, .16, only=(0,))       # ... and its south lobe
blob(t, 60, 130, 10, 5, 1, 23, .14, only=(0,))        # old belt block x50..69
blob(t, 9, 131, 10, 6, 1, 24, .14, only=(0,))         # old south-west belt
blob(t, 38, 131, 12, 3.5, 1, 26, .08, only=(0,))         # old south belt x28..50: rounded bottom
blob(t, 131, 6, 4, 3, 1, 25, .1, only=(0,))           # old north-east island tip -> lake headland

# east forest edge with two exits
for y in range(H):
    if t[y, 176] != 2 and not (50 <= y <= 58 or 118 <= y <= 126):
        for x in range(176 - int(1.5 + 1.5 * math.sin(y * .23)), W):
            if t[y, x] == 0: t[y, x] = 1
# tree clumps and boulders scattered east
for (x, y, rx, ry) in ((140, 112, 2.5, 2), (168, 88, 3, 2.5), (134, 104, 1.5, 1.5), (160, 132, 2.5, 2), (170, 146, 2, 2)):
    blob(t, x, y, rx, ry, 1, int(x + y), .05)

# ---- south band (y 128..179) ------------------------------------------------
# south forest edge with two exits
for x in range(W):
    edge = 175 - int(1.5 + 2 * math.sin(x * .19) + noise(x, 0, 4))
    if not (40 <= x <= 48 or 112 <= x <= 120):
        for y in range(edge, H): t[y, x] = 1
# south-west woodland mass (joins the old west forest)
blob(t, 6, 150, 9, 16, 1, 11, .14)
rect(t, 0, 128, 3, 179, 1)
# south-west pool
blob(t, 28, 146, 7.5, 5, 2, 12, .16)
# new plateau with a cave (third escape anchor pair) facing the camera
blob(t, 80, 154, 15, 8, 1, 13, .10)
CAVE = (79, 156)                                     # anchor tiles (79,156)/(80,156)
for y in range(CAVE[1], 163):                         # 2-wide corridor down to the mouth
    t[y, 79] = t[y, 80] = 0
for y in range(CAVE[1] - 2, 163):
    for x in (77, 78, 81, 82): t[y, x] = 1
for x in range(77, 83): t[CAVE[1] - 1, x] = t[CAVE[1] - 2, x] = 1
# birch grove north of the plateau
blob(t, 104, 140, 7, 5, 1, 14, .2)
# tram-car knoll: the landmark footprint (22 x 5 tiles) on open meadow
CAR = (131, 146, 152, 150)
rect(t, *CAR, 1)
# station props beside the car (vending machine, mailbox, bench) as small blocked islands
PROPS = [('data-terminal', (126, 141, 129, 144)), ('circuit-cabinet', (155, 140, 158, 143)), ('bench', (138, 154, 143, 155)),
         ('stop-sign', (128, 152, 129, 153))]
for _, (x0, y0, x1, y1) in PROPS: rect(t, x0, y0, x1, y1, 1)
# meadow tree clumps and boulders south
for (x, y, rx, ry) in ((50, 138, 2.5, 2), (60, 166, 2, 1.5), (100, 162, 3, 2.5), (120, 136, 2, 1.5), (35, 165, 3, 2),
                       (145, 166, 3, 2.5), (165, 160, 2, 2), (18, 166, 2, 2)):
    blob(t, x, y, rx, ry, 1, int(x * 3 + y), .05)
# south meadow groves and a hedge of boulders, so the south reads as dense as the north
blob(t, 47, 156, 7, 5, 1, 31, .2)
blob(t, 150, 171, 7, 3, 1, 32, .2)
for k in range(5): blob(t, 58 + k * 4, 145 + (k % 2), 1.2, 1.0, 1, 40 + k, .0)
# a low ridge in the south-east with one gap
stroke(t, [(108, 168), (118, 160), (130, 162), (140, 158)], 3.4, 1, gaps=((.42, .55),), only=(0,))

# ---- cleanup: single-tile blocked specks and one-tile pinches -----------------
def neigh(a, y, x):
    return [a[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < H and 0 <= xx < W]
for _ in range(2):
    for y in range(H):
        for x in range(W):
            if y < H0 and x < W0 and (x < W0 - 2 and y < H0 - 2): continue   # never touch original interior
            n = neigh(t, y, x)
            if t[y, x] == 1 and sum(v == 1 for v in n) == 0: t[y, x] = 0
            if t[y, x] == 0 and sum(v == 1 for v in n) >= 3: t[y, x] = 1
# sealed pockets in the new ground (not reachable by anything) become solid
_lab, _sizes = None, None
def _fill_pockets():
    seen = np.zeros(t.shape, bool)
    for y0, x0 in zip(*np.nonzero(t != 1)):
        if seen[y0, x0]: continue
        q = deque([(y0, x0)]); seen[y0, x0] = True; cells = []
        while q:
            y, x = q.popleft(); cells.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and t[yy, xx] != 1 and not seen[yy, xx]: seen[yy, xx] = True; q.append((yy, xx))
        if len(cells) < 40 and all(y >= H0 - 1 or x >= W0 - 1 for y, x in cells):
            for y, x in cells: t[y, x] = 1
_fill_pockets()
# the original interior must be intact except the two belt openings
mask = np.ones((H0, W0), bool); mask[118:128, 18:28] = False; mask[126:128, 76:82] = False; mask[127, :] = False; mask[:, 127] = False
assert (t[:H0, :W0][mask] == base[mask]).all(), 'original interior changed'

# ---- direction palette and escape flags --------------------------------------
def build_env(field_id):
    env = src['environments'][field_id]
    pal = env['directionPalette']
    d0 = expand(env['directionRuns'], W0 * H0).reshape(H0, W0)
    fl = lambda i: (bool(pal[i].get('escapeAnchor')), bool(pal[i].get('escapeBoundary')))
    def common(kind, flags, region=None):
        ys, xs = np.nonzero((base == kind))
        c = [d0[y, x] for y, x in zip(ys, xs) if fl(d0[y, x]) == flags]
        if not c: return None
        v, n = np.unique(c, return_counts=True); return int(v[np.argmax(n)])
    plain = {k: common(k, (False, False)) for k in (0, 1, 2)}
    bnd = {k: common(k, (False, True)) for k in (0, 2)}
    anc = {k: common(k, (True, True)) for k in (0, 2)}
    def variant(i, anchor, boundary):
        want = {**pal[i], 'escapeAnchor': anchor, 'escapeBoundary': boundary}
        for j, p in enumerate(pal):
            if {**p, 'escapeAnchor': bool(p.get('escapeAnchor')), 'escapeBoundary': bool(p.get('escapeBoundary'))} == want: return j
        return None
    d = np.zeros((H, W), np.int64)
    d[:H0, :W0] = d0
    for y in range(H):
        for x in range(W):
            if y >= H0 or x >= W0: d[y, x] = plain[int(t[y, x])]
    # old east column / south row are interior now: clear boundary flags where the ground continues
    cleared = 0
    for y in range(H0):
        a, b = fl(d[y, W0 - 1])
        if b and t[y, W0] != 1:
            v = variant(d[y, W0 - 1], False, False)
            d[y, W0 - 1] = v if v is not None else plain[int(t[y, W0 - 1])]; cleared += 1
    for x in range(W0):
        a, b = fl(d[H0 - 1, x])
        if b and t[H0, x] != 1:
            v = variant(d[H0 - 1, x], False, False)
            d[H0 - 1, x] = v if v is not None else plain[int(t[H0 - 1, x])]; cleared += 1
    # new map edges: boundary flags on every open/water edge tile (like the original edges)
    newb = 0
    edge = [(0, x) for x in range(W0, W)] + [(y, W - 1) for y in range(H)] + [(H - 1, x) for x in range(W)] + [(y, 0) for y in range(H0, H)]
    for y, x in edge:
        k = int(t[y, x])
        if k != 1 and bnd.get(k) is not None: d[y, x] = bnd[k]; newb += 1
    # anchors on new edges, spaced like the original's (one per exit / every ~10 lake tiles)
    newa = []
    for y, x in [(0, 134), (0, 146), (0, 160), (54, W - 1), (122, W - 1), (H - 1, 44), (H - 1, 116), (18, W - 1), (30, W - 1)]:
        k = int(t[y, x])
        if k != 1 and anc.get(k) is not None: d[y, x] = anc[k]; newa.append((x, y))
    # interior cave anchors (third cave): same palette entry family as the original cave anchors
    cave_entry = int(d0[4, 35])
    for x in (CAVE[0], CAVE[0] + 1): d[CAVE[1], x] = cave_entry
    out = {k: v for k, v in env.items()}
    out.update(width=W, height=H, terrainRuns=to_runs(t), directionRuns=to_runs(d), adaptation=ADAPT,
               base={'widthTiles': W0, 'heightTiles': H0, 'originTile': [0, 0]})
    return out, d, pal, {'clearedOldEdgeFlags': cleared, 'newBoundaryTiles': newb, 'newEdgeAnchors': newa,
                          'caveAnchors': [[CAVE[0], CAVE[1]], [CAVE[0] + 1, CAVE[1]]]}


def components(open_, conn8=False):
    lab = np.zeros(open_.shape, int); sizes = []; n = 0
    steps = ((1, 0), (-1, 0), (0, 1), (0, -1)) + (((1, 1), (1, -1), (-1, 1), (-1, -1)) if conn8 else ())
    for y0, x0 in zip(*np.nonzero(open_)):
        if lab[y0, x0]: continue
        n += 1; q = deque([(y0, x0)]); lab[y0, x0] = n; s = 0
        while q:
            y, x = q.popleft(); s += 1
            for dy, dx in steps:
                yy, xx = y + dy, x + dx
                if 0 <= yy < open_.shape[0] and 0 <= xx < open_.shape[1] and open_[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; q.append((yy, xx))
        sizes.append(s)
    return lab, sizes


def metrics(g, tile_px=16):
    open_ = g != 1
    lab, sizes = components(open_)
    main = lab == (int(np.argmax(sizes)) + 1)
    a = tile_px * tile_px
    return {'frameTiles': int(g.size), 'frameWorldPx2': int(g.size * a), 'walkTiles': int((g == 0).sum()),
            'waterTiles': int((g == 2).sum()), 'blockedTiles': int((g == 1).sum()),
            'explorableUnionTiles': int(open_.sum()), 'mainComponentTiles': int(main.sum()),
            'mainComponentWalk': int((main & (g == 0)).sum()), 'mainComponentWater': int((main & (g == 2)).sum()),
            'components4': len(sizes), 'componentSizes': sorted(sizes)[::-1][:6]}


envs, stats = {}, {}
for fid in ('field_hm01_01', 'field_hm01_02'):
    envs[fid], d, pal, stats[fid] = build_env(fid)
before, after = metrics(base), metrics(t)
ratio = {k: round(after[k] / before[k], 3) for k in ('frameTiles', 'walkTiles', 'waterTiles', 'explorableUnionTiles', 'mainComponentTiles')}
doc = {'schemaVersion': 1, 'contract': 'HUNT_EXPANSION_REVIEW.v1', 'adaptation': ADAPT,
       'owner': 'Owner 2026-10-19: rebuild each hunt theme as one map with about twice the explorable area; keep functional structure.',
       'scope': 'LOCAL_REVIEW_ONLY', 'environments': envs}
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'hunt-hm01x2.review.json'), 'w', encoding='utf-8', newline='\n') as fh:
    json.dump(doc, fh, separators=(',', ':'))
np.save(os.path.join(OUT, 'hm01x2-terrain.npy'), t)
json.dump({'before': before, 'after': after, 'ratio': ratio, 'flags': stats, 'car': CAR, 'props': PROPS, 'cave': CAVE},
          open(os.path.join(OUT, 'hm01x2-metrics.json'), 'w'), indent=1)
img = np.zeros((H, W, 3), np.uint8)
img[t == 0] = (120, 186, 86); img[t == 1] = (38, 74, 40); img[t == 2] = (64, 128, 222)
pd = envs['field_hm01_01']
dd = expand(pd['directionRuns'], W * H).reshape(H, W); pal = pd['directionPalette']
img[np.vectorize(lambda i: bool(pal[i].get('escapeBoundary')))(dd)] = (255, 205, 0)
img[np.vectorize(lambda i: bool(pal[i].get('escapeAnchor')))(dd)] = (255, 0, 0)
x0, y0, x1, y1 = CAR; img[y0:y1 + 1, x0:x1 + 1] = (200, 90, 40)
img[:, W0] = np.minimum(255, img[:, W0].astype(int) + 40); img[H0, :] = np.minimum(255, img[H0, :].astype(int) + 40)
Image.fromarray(img).resize((W * 4, H * 4), Image.NEAREST).save(os.path.join(OUT, 'hm01x2-design.png'))
print(json.dumps({'before': before, 'after': after, 'ratio': ratio, 'flags': stats['field_hm01_01']}))
