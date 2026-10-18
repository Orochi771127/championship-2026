"""Reproducible delivery variants of the existing approved title; masters stay intact.

Requires Pillow. No generated/repainted artwork. Keep alpha and original framing.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/production/title-morning-r1'
OUT = SOURCE / 'delivery'
OUT.mkdir(exist_ok=True)
rows = []
for name, compact_width, large_width in [
    ('arena', 800, 941), ('logo-zh-Hant', 720, 1100),
    ('blaze', 440, 640), ('cloud', 420, 620),
]:
    original = SOURCE / (name + '.webp')
    with Image.open(original) as image:
        for size, width in [('compact', compact_width), ('large', large_width)]:
            height = round(image.height * width / image.width)
            scaled = image.resize((width, height), Image.Resampling.LANCZOS)
            target = OUT / f'{name}-{size}.webp'
            scaled.save(target, 'WEBP', quality=86, method=6, exact=True)
            rows.append({'path': target.relative_to(ROOT).as_posix(), 'bytes': target.stat().st_size,
                         'width': width, 'height': height, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                         'source': original.relative_to(ROOT).as_posix(),
                         'sourceSha256': hashlib.sha256(original.read_bytes()).hexdigest()})

# An opaque icon using the existing partner art. Insets keep the face inside iOS's crop.
icons = ROOT / 'assets/production/web-app'
icons.mkdir(exist_ok=True)
with Image.open(SOURCE / 'blaze.webp') as source:
    for size in [180, 192, 512]:
        tile = Image.new('RGBA', (size, size), '#12343e')
        partner = source.convert('RGBA')
        partner.thumbnail((round(size * .84), round(size * .84)), Image.Resampling.LANCZOS)
        tile.alpha_composite(partner, ((size - partner.width) // 2, (size - partner.height) // 2))
        target = icons / f'icon-{size}.png'
        tile.convert('RGB').save(target, optimize=True)
        rows.append({'path': target.relative_to(ROOT).as_posix(), 'bytes': target.stat().st_size,
                     'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'source': 'title-morning-r1/blaze.webp'})
(OUT / 'manifest.json').write_text(json.dumps({'pillow': Image.__version__, 'files': rows}, indent=2) + '\n', encoding='utf-8')
for variant in ['compact', 'large']:
    print(variant, sum(r['bytes'] for r in rows if r['path'].endswith(f'-{variant}.webp')))
