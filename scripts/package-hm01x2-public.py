"""Package the HM01x2 hunt art for the public playtest (Owner 2026-10-21).

The local review set (assets/production/hunt/hm01x2-review-20261019) stays lossless. The public
build ships a size-bounded copy: the same referenced frames and occluder atlases re-encoded as
quality-96 WebP (alpha kept lossless), written under hm01x2-public-20261021 with new content
hashes and a manifest that points at them. Geometry JSON is copied byte for byte. Nothing in the
review directory is modified.

  python scripts/package-hm01x2-public.py
"""
import hashlib, json, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/production/hunt/hm01x2-review-20261019'
OUT = ROOT / 'assets/production/hunt/hm01x2-public-20261021'
SRC_PREFIX = 'assets/production/hunt/hm01x2-review-20261019/'
OUT_PREFIX = 'assets/production/hunt/hm01x2-public-20261021/'
QUALITY = 96

manifest = json.loads((SRC / 'manifest.json').read_text(encoding='utf-8'))
if OUT.exists():
    shutil.rmtree(OUT)
(OUT / 'images').mkdir(parents=True)
(OUT / 'geometry').mkdir()
remap = {}


def encode(src):
    if src in remap:
        return remap[src]
    path = ROOT / src
    if not src.startswith(SRC_PREFIX) or not path.is_file():
        raise SystemExit('unexpected media path: ' + src)
    image = Image.open(path)
    image.load()
    name = OUT / 'images' / '_tmp.webp'
    image.save(name, 'WEBP', quality=QUALITY, method=6, alpha_quality=100)
    data = name.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    (OUT / 'images' / f'{digest}.webp').write_bytes(data)
    name.unlink()
    remap[src] = (OUT_PREFIX + f'images/{digest}.webp', digest)
    return remap[src]


def visit(node):
    if isinstance(node, list):
        for item in node:
            visit(item)
    elif isinstance(node, dict):
        src = node.get('src')
        if isinstance(src, str) and src.endswith('.webp'):
            node['src'], node['sha256'] = encode(src)
        elif isinstance(src, str) and src.endswith('.json') and src.startswith(SRC_PREFIX + 'geometry/'):
            target = OUT_PREFIX + src[len(SRC_PREFIX):]
            shutil.copyfile(ROOT / src, ROOT / target)
            node['src'] = target
        for value in node.values():
            visit(value)


SRC_FIRST = {f['fieldId']: f['frames'][0]['src'] for f in manifest['fields']}
visit(manifest['fields'])
# Gate previews show the first frame of each field; ship a 1440 px preview instead of the 2880 px map.
for field in manifest['fields']:
    first = Image.open(ROOT / SRC_FIRST[field['fieldId']]).convert('RGB').resize((1440, 1440), Image.LANCZOS)
    tmp = OUT / 'images' / '_thumb.webp'
    first.save(tmp, 'WEBP', quality=92, method=6)
    data = tmp.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    (OUT / 'images' / f'{digest}.webp').write_bytes(data)
    tmp.unlink()
    field['thumbnail'] = {'src': OUT_PREFIX + f'images/{digest}.webp', 'sha256': digest, 'width': 1440, 'height': 1440}
manifest['assetId'] = 'art:hunt:hm01x2-public:20261021'
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
before = sum((ROOT / s).stat().st_size for s in remap)
after = sum((ROOT / t).stat().st_size for t, _ in remap.values())
print(json.dumps({'images': len(remap), 'bytesBefore': before, 'bytesAfter': after, 'quality': QUALITY}))
