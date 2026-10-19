"""Shared-edge patches for same-theme large/small cage pairs (Owner 2026-10-19).

Each cage frame keeps its complete rim. For every rim joint (one per hex edge) this cuts a
small patch: the joint's visible pixels (full render vs the same render with the joints
hidden), dilated by one pixel and limited to the frame's own alpha, filled with the
joint-free pixels. At runtime a patch is drawn only while a paired cage's matching edge
lies on the same world segment, so separated cages show their full rim again.
args: <edges_dir> <repo> <review_tag> <fieldId,...>
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image

EDGES, REPO, TAG = sys.argv[1], sys.argv[2], sys.argv[3]
fids = sys.argv[4].split(',')
MANIFEST = f'assets/production/cage/polish-review-20261019/manifest.json'
OUT = f'assets/production/cage/shared-edges-{TAG}'
PAIRS = [['field_cm02_01', 'field_cm30_01'], ['field_cm05_01', 'field_cm34_01'], ['field_cm07_01', 'field_cm35_01'],
         ['field_cm10_01', 'field_cm37_01'], ['field_cm09_01', 'field_cm39_01'], ['field_cm18_01', 'field_cm32_01'],
         ['field_cm31_01', 'field_cm16_01']]
man = json.load(open(os.path.join(REPO, MANIFEST), encoding='utf-8'))
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
os.makedirs(os.path.join(REPO, OUT), exist_ok=True)


def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1.0
    u = np.clip(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1)
    return np.hypot(px - (ax + u * dx), py - (ay + u * dy))


def fill_edge(rgba, solid=250, rounds=6):
    """Floor colour carried outward over the cage's own border pixels (the joint-free render has the
    rim, foundation and walls hidden, so its outermost pixels are partly transparent)."""
    out = rgba.astype(np.float32).copy(); ok = out[..., 3] >= solid
    for _ in range(rounds):
        acc = np.zeros(out.shape[:2] + (3,), np.float32); n = np.zeros(out.shape[:2], np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sh = np.roll(np.roll(out[..., :3] * ok[..., None], dy, 0), dx, 1); sn = np.roll(np.roll(ok, dy, 0), dx, 1)
            acc += sh; n += sn
        grow = (~ok) & (n > 0)
        out[grow, :3] = acc[grow] / n[grow, None]; ok = ok | grow
    return np.clip(out, 0, 255).astype(np.uint8)


fields = []
for fid in fids:
    f = next(f for f in man['fields'] if f['fieldId'] == fid)
    frame_src = f['frames'][0]['src']
    frame = np.asarray(Image.open(os.path.join(REPO, frame_src)).convert('RGBA')).astype(np.int16)
    full = np.asarray(Image.open(os.path.join(EDGES, f'{fid}-full.png')).convert('RGBA')).astype(np.int16)
    clean = np.asarray(Image.open(os.path.join(EDGES, f'{fid}-nojoint.png')).convert('RGBA')).astype(np.uint8)
    seg = json.load(open(os.path.join(EDGES, f'{fid}-segments.json')))
    assert full.shape == frame.shape == clean.shape, (fid, full.shape, frame.shape, clean.shape)
    H, W = frame.shape[:2]
    diff = np.abs(full[..., :3] - clean[..., :3].astype(np.int16)).max(axis=2) > 10
    yy, xx = np.mgrid[0:H, 0:W]
    dists = np.stack([seg_dist(xx + .5, yy + .5, j['a'], j['b']) for j in seg['joints']])
    near = dists.min(axis=0) <= 6
    owner = dists.argmin(axis=0)
    edges, patches = [], []
    for k, j in enumerate(seg['joints']):
        m = diff & near & (owner == k)
        if m.sum() < 4: continue
        p = np.pad(m, 1)
        m = m | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        m &= frame[..., 3] > 0
        ys, xs = np.nonzero(m)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        rgba = fill_edge(clean[y0:y1, x0:x1]); rgba[..., 3] = np.where(m[y0:y1, x0:x1], 255, 0)
        patches.append(rgba)
        edges.append({'id': j['object'], 'a': j['a'], 'b': j['b'], 'x': int(x0), 'y': int(y0), 'width': int(x1 - x0), 'height': int(y1 - y0),
                      'pixels': int(m.sum())})
    # shelf-pack the patches into one atlas
    AW = max(64, min(1024, sum(p.shape[1] + 2 for p in patches)))
    x = y = shelf = 0
    for e, p in sorted(zip(edges, patches), key=lambda ep: -ep[1].shape[0]):
        if x + p.shape[1] + 2 > AW: x, y, shelf = 0, y + shelf + 2, 0
        e['atlasX'], e['atlasY'] = x, y
        x += p.shape[1] + 2; shelf = max(shelf, p.shape[0])
    AH = y + shelf
    atlas = np.zeros((max(1, AH), AW, 4), np.uint8)
    for e, p in zip(edges, patches): atlas[e['atlasY']:e['atlasY'] + p.shape[0], e['atlasX']:e['atlasX'] + p.shape[1]] = p
    rel = f'{OUT}/{fid}-edges.webp'
    Image.fromarray(atlas, 'RGBA').save(os.path.join(REPO, rel), lossless=True, quality=100, method=6, exact=True)
    fields.append({'fieldId': fid, 'sourceHash': f['frames'][0]['sha256'], 'raster': [W, H],
                   'atlas': {'src': rel, 'sha256': sha(os.path.join(REPO, rel)), 'width': AW, 'height': int(max(1, AH))}, 'edges': edges})
    print(fid, 'edges', len(edges), 'atlas', AW, AH, [e['pixels'] for e in edges])
index = {'schemaVersion': 1, 'assetId': f'art:cage:shared-edges:{TAG}', 'scope': 'LOCAL_REVIEW_ONLY', 'publicReleasePermitted': False,
         'rule': 'Draw a field edge patch only while a paired field has an edge on the same world segment.',
         'toleranceWorldPx': 8, 'pairs': PAIRS, 'fields': fields}
with open(os.path.join(REPO, OUT, 'index.json'), 'w', encoding='utf-8', newline='\n') as fh: json.dump(index, fh, indent=1)
