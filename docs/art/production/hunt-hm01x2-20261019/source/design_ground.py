"""HM01x2 ground-class design (own layout; the original only taught the vocabulary: dirt fields,
gravel, lush tall grass, clover, small rocks). Owner 2026-10-19: do not copy the original's shapes.

Logic of the design:
  * worn dirt trails follow the routes creatures and players would wear in: between the three cave
    mouths, the tram stop, the lake shore and the map exits (least-cost paths with a meander noise,
    so they curve naturally around cliffs and water), 2-3 tiles wide;
  * where trails meet, they open into trodden clearings; two clearings have gravel cores;
  * lush tall grass grows in the lee of cliffs and forest edges (not on trails);
  * clover grows on the damp ground near water;
  * small rocks lie along trail edges and in clearings.
Writes ../out/hm01x2-ground-classes.npy (0 grass, 1 dirt, 2 gravel, 3 tall grass, 4 clover),
../out/hm01x2-ground-decor.json (rocks) and ground-classes.png.
"""
import heapq, json, math
import numpy as np
from PIL import Image

T = np.load('../out/hm01x2-terrain.npy'); H, W = T.shape
OPEN, BLOCK, WATER = 0, 1, 2
rng = np.random.default_rng(20261019)


def noise(x, y, s, f=1.0):
    return (math.sin(x * .37 * f + s) * .5 + math.sin(y * .29 * f + s * 1.7) * .5 + math.sin((x + y) * .19 * f + s * 2.3) * .4
            + math.sin((x - y) * .11 * f + s * 3.1) * .3)


def dist_to(mask):
    from collections import deque
    d = np.full((H, W), 1e9); q = deque()
    for y, x in zip(*np.nonzero(mask)): d[y, x] = 0; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and d[yy, xx] > d[y, x] + 1: d[yy, xx] = d[y, x] + 1; q.append((yy, xx))
    return d


d_block, d_water = dist_to(T == BLOCK), dist_to(T == WATER)
wobble = np.array([[noise(x, y, 4.0, .6) for x in range(W)] for y in range(H)])
cost = 1.0 + 1.6 * (wobble - wobble.min()) / (np.ptp(wobble)) + 7.0 * (d_block < 3) + 3.0 * (d_block < 5) + 3.0 * (d_water < 3)
cost[T == WATER] = 25.0


def path(a, b):
    dist = {a: 0.0}; prev = {}; pq = [(0.0, a)]
    while pq:
        c, u = heapq.heappop(pq)
        if u == b: break
        if c > dist.get(u, 1e18): continue
        x, y = u
        for dx, dy, k in ((1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.41), (1, -1, 1.41), (-1, 1, 1.41), (-1, -1, 1.41)):
            v = (x + dx, y + dy)
            if not (0 <= v[0] < W and 0 <= v[1] < H) or T[v[1], v[0]] == BLOCK: continue
            nc = c + k * cost[v[1], v[0]]
            if nc < dist.get(v, 1e18): dist[v] = nc; prev[v] = u; heapq.heappush(pq, (nc, v))
    out = [b]
    while out[-1] != a: out.append(prev[out[-1]])
    return out[::-1]


cls = np.zeros((H, W), np.uint8)
# key places: cave mouths, tram stop, lake shore landing, exits (east, south)
P = {'caveN': (35, 13), 'caveC': (79, 68), 'caveS': (79, 165), 'tram': (140, 156), 'shore': (110, 34),
     'exitE': (175, 54), 'exitS': (116, 175), 'west': (8, 60), 'pond': (150, 112)}
# snap each key place to the nearest open tile of the main meadow
from collections import deque
seen = np.zeros((H, W), bool); comp = []
for y0, x0 in zip(*np.nonzero(T != BLOCK)):
    if seen[y0, x0]: continue
    q = deque([(y0, x0)]); seen[y0, x0] = True; cells = []
    while q:
        y, x = q.popleft(); cells.append((x, y))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and T[yy, xx] != BLOCK and not seen[yy, xx]: seen[yy, xx] = True; q.append((yy, xx))
    comp.append(cells)
main = set(max(comp, key=len))
for k, (x, y) in P.items():
    if (x, y) not in main or T[y, x] != OPEN:
        P[k] = min((c for c in main if T[c[1], c[0]] == OPEN), key=lambda c: (c[0] - x) ** 2 + (c[1] - y) ** 2)
routes = [('caveN', 'caveC'), ('caveC', 'pond'), ('pond', 'exitE'), ('caveC', 'caveS'), ('caveS', 'tram'), ('tram', 'exitS')]
trail = np.zeros((H, W), bool)
for a, b in routes:
    for x, y in path(P[a], P[b]):
        r = 1.1 + .9 * max(0.0, noise(x, y, 9.0, .5))
        for yy in range(int(y - 2), int(y + 3)):
            for xx in range(int(x - 2), int(x + 3)):
                if 0 <= yy < H and 0 <= xx < W and (xx - x) ** 2 + (yy - y) ** 2 <= r * r: trail[yy, xx] = True
# clearings: at the junction near the central cave, beside the tram, at the south cave and the lake path
clearings = [((36, 84), 13, 8, True), ((150, 138), 10, 6, True), ((79, 78), 6, 4, False), ((96, 30), 6, 3, False), ((66, 158), 5, 3, False)]
for (cx, cy), rx, ry, gravel in clearings:
    for y in range(cy - ry - 3, cy + ry + 4):
        for x in range(cx - rx - 3, cx + rx + 4):
            if 0 <= y < H and 0 <= x < W and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + .3 * noise(x, y, cx * .1):
                trail[y, x] = True
                if gravel and ((x - cx) / (rx * .5)) ** 2 + ((y - cy) / (ry * .45)) ** 2 <= 1 + .3 * noise(x, y, cy * .1): cls[y, x] = 2
cls[trail & (cls == 0)] = 1
# tall grass in the lee of cliffs/forest (1-3 tiles out), patchy
for y in range(H):
    for x in range(W):
        if T[y, x] != OPEN or cls[y, x]: continue
        if 1 <= d_block[y, x] <= 3 and noise(x, y, 17.0, 1.4) > .35: cls[y, x] = 3
        elif 1 <= d_water[y, x] <= 3 and noise(x, y, 23.0, 1.6) > .55: cls[y, x] = 4
cls[T != OPEN] = 0
# rocks: trail edges, clearings, a few loose on the lawn
rocks = []
edge = [(x, y) for y, x in zip(*np.nonzero((cls == 1))) if any(0 <= y + dy < H and 0 <= x + dx < W and cls[y + dy, x + dx] == 0 and T[y + dy, x + dx] == 0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
for i in rng.choice(len(edge), 26, replace=False):
    x, y = edge[i]; rocks.append([x * 8 + 4.0, y * 8 + 6.0, int(rng.integers(6, 13))])
lawn = [(x, y) for y, x in zip(*np.nonzero((cls == 0) & (T == OPEN) & (d_block > 2)))]
for i in rng.choice(len(lawn), 14, replace=False):
    x, y = lawn[i]; rocks.append([x * 8 + 4.0, y * 8 + 6.0, int(rng.integers(5, 10))])
np.save('../out/hm01x2-ground-classes.npy', cls)
counts = {str(k): int((cls == k).sum()) for k in range(5)}
json.dump({'rocks': rocks, 'design': 'own layout (trails between caves/tram/shore/exits, clearings, lee tall grass, damp clover)',
           'counts': counts}, open('../out/hm01x2-ground-decor.json', 'w'), indent=0)
img = np.zeros((H, W, 3), np.uint8); img[T == 1] = (40, 70, 40); img[T == 2] = (60, 120, 220); img[T == 0] = (130, 190, 90)
for k, c in ((1, (150, 100, 60)), (2, (170, 170, 160)), (3, (40, 120, 40)), (4, (180, 230, 140))): img[cls == k] = c
for x, y, s in rocks: img[int(y // 8), int(x // 8)] = (90, 90, 255)
Image.fromarray(img).resize((W * 4, H * 4), Image.NEAREST).save('ground-classes.png')
walk = int((T == OPEN).sum())
print(counts, {k: round(v / walk, 3) for k, v in counts.items()}, 'rocks', len(rocks))
