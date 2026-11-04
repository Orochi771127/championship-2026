"""Pack the two royal cage UI renders (Owner 2026-11-03) next to the other 37 cage pictures.

python scripts/pack-royal-cage-ui.py <render dir>

<render dir> holds field_royal_ranch_01.png and field_stellar_zoo_01.png, 960 x 800, rendered through
ranchThreeScene at the layout view (52 deg), 4 px per native px, the field's world rect, transparent, as
the 2026-11-02 cage UI pipeline does. Same encoding as that pipeline (cage-coast-20261102 pack_ui_three.py):
frames WebP q90, thumbnails 256 x 192 fitted and centred with premultiplied alpha, q92. Upserts the two
fields into the ui-three source manifest, the public cage-ui map and the public cage-ui-three manifest.
"""
import hashlib, io, json, os, sys
import numpy as np
from PIL import Image

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RENDERS = sys.argv[1]
OUT = 'assets/production/cage/ui-three-20261102'
FIELDS = ('field_royal_ranch_01', 'field_stellar_zoo_01')
TW, TH = 256, 192
sha = lambda b: hashlib.sha256(b).hexdigest()


def premultiplied_resize(im, size):
    a = np.asarray(im.convert('RGBA'), dtype=np.float32) / 255
    rgb = a[..., :3] * a[..., 3:4]
    pm = Image.fromarray((np.dstack([rgb, a[..., 3:4]]).clip(0, 1) * 255).round().astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS)
    b = np.asarray(pm, dtype=np.float32) / 255
    alpha = b[..., 3:4]
    rgb = np.where(alpha > 1e-4, b[..., :3] / np.maximum(alpha, 1e-4), 0)
    return Image.fromarray((np.dstack([rgb, alpha]).clip(0, 1) * 255).round().astype(np.uint8), 'RGBA')


def webp(im, quality):
    buf = io.BytesIO()
    im.save(buf, format='WEBP', quality=quality, alpha_quality=100, method=6)
    return buf.getvalue()


def load(path):
    with open(os.path.join(REPO, path), encoding='utf-8') as f:
        return json.load(f)


def save(path, doc):
    with open(os.path.join(REPO, path), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(doc, indent=2, ensure_ascii=False) + '\n')


def upsert(rows, row):
    return [r for r in rows if r['fieldId'] != row['fieldId']] + [row]


models = {f['fieldId']: f['sha256'] for f in load('assets/production/cage/three-20261021/manifest.json')['fields']}
source_path, map_path, ui_path = f'{OUT}/manifest.json', 'assets/production/public-runtime/cage-ui.map.v1.json', 'assets/production/public-runtime/cage-ui-three.v1.json'
source, public_map, ui = load(source_path), load(map_path), load(ui_path)
for fid in FIELDS:
    frame = Image.open(os.path.join(RENDERS, f'{fid}.png')).convert('RGBA')
    assert frame.size == (960, 800), fid
    a = np.asarray(frame).copy(); a[a[..., 3] == 0, :3] = 0; frame = Image.fromarray(a, 'RGBA')
    scale = min(TW / frame.width, TH / frame.height)
    size = (max(1, round(frame.width * scale)), max(1, round(frame.height * scale)))
    thumb = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
    thumb.alpha_composite(premultiplied_resize(frame, size), ((TW - size[0]) // 2, (TH - size[1]) // 2))
    rows = {}
    for kind, im, q in (('frames', frame, 90), ('thumbnails', thumb, 92)):
        data = webp(im, q)
        path = f'{OUT}/{kind}/{fid}.webp'
        with open(os.path.join(REPO, path), 'wb') as f:
            f.write(data)
        rows[kind] = {'src': path, 'width': im.width, 'height': im.height, 'sha256': sha(data)}
    field = {'fieldId': fid, 'worldWidthPx': 960, 'worldHeightPx': 800, 'nativeWidthPx': 240, 'nativeHeightPx': 200,
             'visualRole': 'GACHA_CAGE', 'gameplayBinding': 'EXTERNAL_EXISTING_RUNTIME', 'gateMapping': 'UNBOUND_EXPLICIT_FIELD_ID_REQUIRED',
             'collisionBinding': 'EXTERNAL_NOT_IN_ART_BUNDLE',
             'frames': [{'src': rows['frames']['src'], 'sha256': rows['frames']['sha256'], 'durationMs': None}]}
    template = next(f for f in public_map['fields'] if f['fieldId'] == 'field_cm28_01')
    field = {k: field.get(k, template[k]) for k in template}          # the same keys, in the same order
    public_map['fields'] = upsert(public_map['fields'], field)
    src_template = next(f for f in source['fields'] if f['fieldId'] == 'field_cm28_01')
    source['fields'] = upsert(source['fields'], {k: field.get(k, src_template[k]) for k in src_template})
    ui['fields'] = upsert(ui['fields'], {'fieldId': fid, 'modelSha256': models[fid], 'frame': rows['frames'], 'thumbnail': rows['thumbnails']})
    print('PACKED', fid, rows['frames']['sha256'][:12], rows['thumbnails']['sha256'][:12])
for doc in (source, public_map):
    if 'fieldCount' in doc:
        doc['fieldCount'] = len(doc['fields'])
save(source_path, source); save(map_path, public_map); save(ui_path, ui)
