"""Measure the drawn silhouette of every Dex display illustration for the detail stage.

Canvases differ in aspect and transparent margin, so fitting the canvas draws some partners at half the
size of others. This records, per published image (keyed by its SHA-256), the box [x, y, w, h] in image
pixels where alpha > 32, the same visibility threshold the earlier GR08 centring used. The Dex detail
fits that box instead of the canvas. Rerun whenever a display image changes.

Usage: python scripts/measure-dex-hero-silhouettes.py
"""
import hashlib, json, pathlib
from PIL import Image

HEROES = pathlib.Path('src/data/championship/database-hero-portraits.public.v1.json')
OUT = pathlib.Path('src/data/championship/database-hero-silhouettes.v1.json')
THRESHOLD = 32


def main():
    rows = []
    for entry in sorted(json.loads(HEROES.read_text(encoding='utf-8'))['entries'], key=lambda e: e['speciesIndex']):
        data = pathlib.Path(entry['src']).read_bytes()
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise SystemExit('HERO_BYTES_CHANGED: ' + entry['src'])
        image = Image.open(entry['src'])
        if image.size != (entry['width'], entry['height']):
            raise SystemExit('HERO_SIZE_CHANGED: ' + entry['src'])
        alpha = image.convert('RGBA').getchannel('A').point(lambda v: 255 if v > THRESHOLD else 0)
        left, top, right, bottom = alpha.getbbox() or (0, 0, *image.size)
        rows.append({'speciesIndex': entry['speciesIndex'], 'sha256': entry['sha256'], 'box': [left, top, right - left, bottom - top]})
    OUT.write_text(json.dumps({'schemaVersion': 1, 'alphaThreshold': THRESHOLD, 'entries': rows}, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'{len(rows)} silhouettes -> {OUT}')


if __name__ == '__main__':
    main()
