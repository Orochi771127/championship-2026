"""Package the HM01x2 rebuild (day field_hm01_01 + night field_hm01_02) for the local review.

1. Occluders: the R11 cutter (build-hunt-occluders.py) on the 2880 world with the R11 cave
   candidate (solid cave roofs at the mouth), one layout cut from frame-00 and an atlas page set
   per animation frame (atlas pixels = that frame's pixels, so leaves/water stay in phase).
2. Solid back-caps over each cave roof (R11 rule: exact crops, cave sort row), three caves.
3. Lossless WebP frames/atlases named by sha256, a review manifest with the two fields and the
   expansion terrain JSON copied into the worktree catalog folder.
args: <pipeline_root> <round> <repo_worktree>
"""
import hashlib, importlib.util, json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image

PIPE, ROUND, REPO = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
OUT = 'assets/production/hunt/hm01x2-review-20261019'
DATA = 'src/data/championship/catalogs/hunt-hm01x2.review-20261019.json'
base = PIPE / 'docs/art/production/original-maps-r1/hunt' / ROUND
spec = importlib.util.spec_from_file_location('x2_oc', PIPE / 'scripts/build-hunt-occluders.py')
o = importlib.util.module_from_spec(spec); spec.loader.exec_module(o)
DEPTH = np.asarray(Image.open(base / 'terrains/hm01/layers/depth.png').convert('RGBA'))
WORLD = DEPTH.shape[0]
assert DEPTH.shape[:2] == (WORLD, WORLD) and WORLD == 2880, DEPTH.shape
o.WORLD = WORLD


def candidate_solid(band, caves):
    rows = np.arange(WORLD)[:, None]; cols = np.arange(WORLD)[None, :]
    foot = band * 8 + 4; solid = np.zeros(band.shape, bool)
    for c in caves:
        cx = c['centreXNative'] * 2; mouth = c['mouthYNative'] * 2; back = (c['corridorTiles'][1] * 8 - 6) * 2
        solid |= ((abs(cols - cx) <= 102) & (rows >= back - 110) & (rows <= mouth + 4) & (foot >= back - 8) & (foot <= mouth + 8))
    return band, solid & (DEPTH[..., 1] > 8) & (DEPTH[..., 2] > 128)


o.cave_roofs_at_mouth = candidate_solid
sys.path.insert(0, str(PIPE / 'scripts'))
from lib import hunt_opus_terrain as t
grid = t.load_terrain_grid(PIPE, 'hm01')
inventory = json.loads((PIPE / 'docs/art/production/original-maps-r1/hunt/object-inventory.json').read_text())['terrains']['hm01']
mask, band = o.matters_mask(DEPTH, grid, inventory['caves'])
pieces = o.pieces_from(mask, band)
place, heights = o.pack(pieces, width=WORLD, page_height=WORLD)
cave = o.CAVE_MASK
caps = []
for c in inventory['caves']:
    cx = c['centreXNative'] * 2; mouth = c['mouthYNative'] * 2; top = c['corridorTiles'][1] * 16
    y0 = max(0, mouth - 212)
    caps.append((cx - 100, y0, 200, mouth + 4 - y0, top + 16))
print('pieces', len(pieces), 'pages', heights, 'caps', caps)


def sha(b): return hashlib.sha256(b).hexdigest()


def save_webp(arr):
    tmp = REPO / OUT / 'images' / '_tmp.webp'
    tmp.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr, 'RGBA').save(tmp, lossless=True, quality=100, method=6, exact=True)
    h = sha(tmp.read_bytes()); dst = REPO / OUT / 'images' / f'{h}.webp'
    os.replace(tmp, dst)
    return {'src': f'{OUT}/images/{h}.webp', 'sha256': h}


def atlases_for(frame):
    pages = [np.zeros((max(1, hgt), WORLD, 4), np.uint8) for hgt in heights]
    records = []
    for i, (b, x, y, w, h, solid) in enumerate(pieces):
        ax, ay, page = place[i]
        sub = mask[y:y + h, x:x + w] & (band[y:y + h, x:x + w] == b) & (cave[y:y + h, x:x + w] == bool(solid))
        rgba = frame[y:y + h, x:x + w].copy(); rgba[..., 3] = np.where(sub, 255, 0)
        pages[page][ay:ay + h, ax:ax + w] = rgba
        records.append([int(x), int(y), int(w), int(h), int(ax), int(ay), int(b * o.BAND_GROUP * 8 + o.BAND_GROUP * 4), int(page), int(solid)])
    capw = sum(c[2] for c in caps) + 4 * len(caps); caph = max(c[3] for c in caps)
    cap = np.zeros((caph, capw, 4), np.uint8); ax = 0
    for (x, y, w, h, z) in caps:
        cap[0:h, ax:ax + w] = frame[y:y + h, x:x + w]
        records.append([int(x), int(y), int(w), int(h), int(ax), 0, int(z), len(pages), 1]); ax += w + 4
    pages.append(cap)
    return pages, records


acc = json.loads((REPO / 'assets/production/hunt/accepted-20261010/manifest.json').read_text(encoding='utf-8'))
fields = []
for fid in ('field_hm01_01', 'field_hm01_02'):
    src_field = next(f for f in acc['fields'] if f['fieldId'] == fid)
    fdir = base / 'fields' / fid
    nframes = len(src_field['frames'])
    frames, groups, records = [], [], None
    for k in range(nframes):
        fr = np.asarray(Image.open(fdir / f'frame-{k:02d}.png').convert('RGBA'))
        assert fr.shape[:2] == (WORLD, WORLD)
        e = save_webp(fr); e['durationMs'] = src_field['frames'][k]['durationMs']; frames.append(e)
        pages, rec = atlases_for(fr)
        groups.append({'atlases': [save_webp(p) for p in pages]})
        records = rec
    body = json.dumps({'fieldId': fid, 'worldPx': WORLD, 'pages': len(groups[0]['atlases']),
                       'format': '[worldX, worldY, w, h, atlasX, atlasY, zIndex, page, solid]', 'pieces': records},
                      separators=(',', ':')).encode()
    ph = sha(body); pdst = f'{OUT}/geometry/{ph}.json'
    (REPO / OUT / 'geometry').mkdir(parents=True, exist_ok=True); (REPO / pdst).write_bytes(body)
    field = {k: v for k, v in src_field.items() if k not in ('frames', 'depthOccluders', 'intakeProvenance')}
    field.update(worldWidthPx=WORLD, worldHeightPx=WORLD, frames=frames,
                 depthOccluders={**{k: v for k, v in src_field['depthOccluders'].items() if k not in ('atlases', 'animationFrames', 'pieces', 'pieceCount')},
                                 'atlases': groups[0]['atlases'], 'animationFrames': groups,
                                 'pieces': {'src': pdst, 'sha256': ph}, 'pieceCount': len(records)},
                 reviewProvenance={'terrain': 'hm01x2 180x180', 'round': ROUND, 'producer': 'R11 build-hunt-opus.py (patched copy, map-polish-20261018/hunt/hm01x2/pipeline)',
                                   'atlasCoupling': 'EXISTING_BACKGROUND_PHASE_NO_INDEPENDENT_TIMER'})
    fields.append(field)
    print(fid, 'frames', len(frames), 'pieces', len(records))
man = {k: v for k, v in acc.items() if k not in ('fields', 'notes', 'sourceIntake', 'publicPackagingProvenance')}
man.update(assetId='art:hunt:hm01x2-review:20261019', fieldCount=len(fields), fields=fields,
           productionStatus='LOCAL_REVIEW_CANDIDATE_NOT_PUBLISHED', runtimeScope='LOOPBACK_ONLY', publicReleasePermitted=False,
           ownerDirection='Owner 2026-10-19: rebuild each hunt theme as one map with about twice the explorable area; HM01 sample first.')
(REPO / OUT / 'manifest.json').write_text(json.dumps(man, indent=1) + '\n', encoding='utf-8')
data = json.loads((PIPE.parent / 'out/hunt-hm01x2.review.json').read_text(encoding='utf-8'))
(REPO / DATA).write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
print('manifest', OUT + '/manifest.json', 'data', DATA)
