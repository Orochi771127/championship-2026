"""Pivot-aligned silhouette masks of the reviewed character action art, for the facing gate.

For every playable role in src/data/championship/reviewed-animation-selection.v1.json this reads the
public manifest (pinned by the selection sha256) and, for each frame used by a clip with two or more
distinct frames, stores a GRID x GRID alpha mask in native px around the frame's pivot:
  general - Main and Sub clips;
  arena   - Data Arena clips heading L, R, UL, UR, DL, DR (U and D are front/back views, near-symmetric).
The window is symmetric about the pivot (per role and usage), so mirroring a frame about its pivot is a
column reversal. Masks are stored as drawn in the manifest; the gate applies the selection's mirror policy.
tests/championship-reviewed-action-facing-cases.mjs reads the output without decoding any image.

usage (repo root): python -I scripts/build-reviewed-action-masks.py [--check]
"""
import base64, gzip, hashlib, json, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SELECTION = ROOT / 'src/data/championship/reviewed-animation-selection.v1.json'
OUT = ROOT / 'docs/contracts/championship/REVIEWED_ACTION_FACING_MASKS.v1.json'
GRID = 32
ALPHA = 32
ARENA_HEADINGS = {'L', 'R', 'UL', 'UR', 'DL', 'DR'}
SCALE = 2  # canvas px per native px before the grid resample


def clip_usage(clip):
    if clip['mode'] in ('main', 'sub'):
        return 'general'
    if clip['mode'] == 'arena' and clip.get('direction') in ARENA_HEADINGS:
        return 'arena'
    return None


def role_masks(entry, pages):
    path = ROOT / entry['path']
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != entry['sha256']:
        raise SystemExit(f"{entry['displayCode']}: manifest sha256 differs from the selection")
    doc = json.loads(raw)
    frames = {f['id']: f for f in doc['frames']} if isinstance(doc['frames'], list) else doc['frames']
    used = {'general': set(), 'arena': set()}
    for clip in doc['clips']:
        usage = clip_usage(clip)
        ids = {s['assetId'] for s in clip['frames']}
        if usage and len(ids) >= 2:
            used[usage] |= ids
    out = {}
    for usage, ids in used.items():
        if not ids:
            continue
        cut = {}
        for aid in sorted(ids):
            f = frames[aid]
            key = path.parent / f['image']
            if key not in pages:
                pages[key] = Image.open(key).convert('RGBA')
            x, y, w, h = f['frame']
            tx, ty = (f.get('trim') or [0, 0])[:2]
            k = SCALE / f['density']  # canvas px per source px
            crop = pages[key].crop((x, y, x + w, y + h))
            crop = crop.resize((max(1, round(w * k)), max(1, round(h * k))), Image.BOX) if k != 1 else crop
            # top-left of the crop relative to the pivot, in canvas px
            cut[aid] = (crop, (tx - f['origin'][0]) * k, (ty - f['origin'][1]) * k)
        boxes = []
        for crop, ox, oy in cut.values():
            ys, xs = np.nonzero(np.asarray(crop.getchannel('A')) > ALPHA)
            if len(xs):
                boxes.append((ox + xs.min(), ox + xs.max() + 1, oy + ys.min(), oy + ys.max() + 1))
        half = int(np.ceil(max(max(-b[0], b[1]) for b in boxes))) + 1
        top = int(np.ceil(max(-b[2] for b in boxes))) + 1
        bottom = int(np.ceil(max(b[3] for b in boxes))) + 1
        masks = {}
        for aid, (crop, ox, oy) in cut.items():
            canvas = Image.new('L', (2 * half, top + bottom))
            canvas.paste(crop.getchannel('A'), (round(half + ox), round(top + oy)))
            grid = np.asarray(canvas.resize((GRID, GRID), Image.BOX)) > 64
            masks[aid] = base64.b64encode(np.packbits(grid.ravel()).tobytes()).decode()
        out[usage] = {'window': [half / SCALE, top / SCALE, bottom / SCALE], 'frames': masks}
    return out


def build():
    selection = json.loads(SELECTION.read_text('utf-8'))
    pages, roles = {}, {}
    for entry in selection['characters']:
        if entry.get('playableIdentity') is False:
            continue
        roles[entry['displayCode']] = {'speciesId': entry['speciesId'], 'manifest': entry['path'],
                                       'manifestSha256': entry['sha256'], **role_masks(entry, pages)}
    payload = json.dumps(roles, sort_keys=True, separators=(',', ':')).encode()
    return {
        'schemaVersion': 1,
        'generatedBy': 'scripts/build-reviewed-action-masks.py',
        'grid': GRID, 'alphaThreshold': ALPHA, 'arenaHeadings': sorted(ARENA_HEADINGS),
        'encoding': 'gzip+base64 JSON {displayCode: {speciesId, manifest, manifestSha256, general|arena: {window:[half,top,bottom] native px, frames: {assetId: base64 packbits row-major GRIDxGRID}}}}',
        'roles': sorted(roles),
        'payload': base64.b64encode(gzip.compress(payload, mtime=0)).decode(),
    }


if __name__ == '__main__':
    result = json.dumps(build(), indent=1) + '\n'
    if '--check' in sys.argv:
        current = OUT.read_text('utf-8') if OUT.exists() else ''
        if current != result:
            raise SystemExit(f'{OUT.relative_to(ROOT)} is stale; rerun without --check')
        print('masks up to date')
    else:
        OUT.write_text(result, encoding='utf-8', newline='\n')
        print(f'wrote {OUT.relative_to(ROOT)} ({len(result.encode())} bytes)')
