"""Find the head of every Dex display illustration for the special cut-in close-up.

The cut-in strip shows the caster's face. Centring the canvas (or its silhouette) frames the belly or the
claws, and the top of the silhouette is often a flame, a crest or a tail. This records, per published image
(keyed by its SHA-256), a head box [cx, cy, size] in image pixels: the face centre and a square that holds
the whole head.

How the head is found (alpha > 32 is the drawn body, as in measure-dex-hero-silhouettes.py):
 1. Eyes. Anime-style eyes carry a near-white catchlight inside a dark pupil. Every near-white pixel with a
    very dark pixel close by, in the upper 72 % of the body, is a candidate; candidates are clustered and the
    cluster pair that looks most like two eyes (similar height, a plausible gap) wins, else the strongest
    single cluster. The face centre sits a little under the eyes; the head is ~2.6 eye gaps wide.
 2. Without a usable eye, the head is the upper body: the widest opaque run in the top 38 % of the
    silhouette, centred on its mass.
 3. FACE_OVERRIDES holds reviewed corrections (normalised to the silhouette box) for drawings the rules read
    wrongly; every row says why.

Rerun whenever a display image changes, then review the contact sheets it can write:
  python scripts/measure-dex-hero-faces.py [--sheets <dir>]
"""
import hashlib, json, pathlib, sys
from PIL import Image, ImageDraw

HEROES = pathlib.Path('src/data/championship/database-hero-portraits.public.v1.json')
SILHOUETTES = pathlib.Path('src/data/championship/database-hero-silhouettes.v1.json')
OUT = pathlib.Path('src/data/championship/database-hero-faces.v1.json')
THRESHOLD = 32
WORK = 256  # analysis size (longest side)

# speciesIndex -> (cx, cy, size) as fractions of the silhouette box [x, y, w, h]; size is of max(w, h).
# Reviewed 2026-10-29 on the contact sheets. The rules miss these because the catchlights they found were
# elsewhere (glowing cores, jewels, claws, flowers, star patterns) or the head is a small part of a large
# body (winged, armoured or tall partners) or carries no catchlight (visors, masks, skulls, beaks).
FACE_OVERRIDES = {
    9: (0.55, 0.50, 0.60), 14: (0.55, 0.62, 0.60), 17: (0.50, 0.60, 0.60), 20: (0.42, 0.45, 0.55),
    22: (0.35, 0.62, 0.55), 28: (0.48, 0.48, 0.55), 34: (0.78, 0.36, 0.42), 35: (0.86, 0.50, 0.40),
    51: (0.72, 0.45, 0.45), 57: (0.62, 0.50, 0.35), 67: (0.62, 0.32, 0.38), 71: (0.72, 0.32, 0.40),
    73: (0.83, 0.42, 0.38), 76: (0.74, 0.30, 0.32), 77: (0.50, 0.30, 0.35), 78: (0.55, 0.18, 0.36),
    80: (0.28, 0.40, 0.40), 82: (0.62, 0.35, 0.38), 84: (0.50, 0.22, 0.35), 90: (0.45, 0.50, 0.45),
    95: (0.18, 0.68, 0.35), 96: (0.30, 0.18, 0.35), 98: (0.50, 0.55, 0.55), 100: (0.50, 0.15, 0.30),
    101: (0.20, 0.25, 0.38), 102: (0.18, 0.35, 0.38), 106: (0.50, 0.22, 0.30), 108: (0.45, 0.42, 0.50),
    110: (0.66, 0.28, 0.32), 115: (0.22, 0.42, 0.38), 117: (0.68, 0.25, 0.32), 131: (0.62, 0.30, 0.35),
    133: (0.50, 0.25, 0.30), 134: (0.74, 0.32, 0.35), 135: (0.72, 0.32, 0.35), 141: (0.75, 0.45, 0.38),
    142: (0.50, 0.30, 0.35), 143: (0.50, 0.20, 0.35), 150: (0.58, 0.35, 0.30), 151: (0.48, 0.22, 0.38),
    153: (0.45, 0.12, 0.25), 154: (0.58, 0.50, 0.30), 162: (0.50, 0.14, 0.25), 167: (0.52, 0.25, 0.35),
    168: (0.25, 0.18, 0.32), 172: (0.76, 0.38, 0.35), 176: (0.55, 0.15, 0.30), 178: (0.62, 0.12, 0.28),
    180: (0.60, 0.30, 0.30), 181: (0.86, 0.45, 0.35), 183: (0.55, 0.30, 0.28), 188: (0.48, 0.14, 0.28),
    190: (0.86, 0.28, 0.30), 194: (0.82, 0.45, 0.35), 195: (0.88, 0.40, 0.30), 197: (0.55, 0.22, 0.30),
    198: (0.50, 0.12, 0.25), 201: (0.55, 0.22, 0.30), 202: (0.62, 0.22, 0.30), 204: (0.63, 0.28, 0.30),
    208: (0.22, 0.22, 0.30), 219: (0.20, 0.45, 0.35), 220: (0.55, 0.15, 0.28), 221: (0.55, 0.22, 0.30),
    223: (0.50, 0.22, 0.28), 241: (0.55, 0.18, 0.30), 242: (0.60, 0.17, 0.30),
    # Second review (2026-10-29), from the calibrator's alpha check (scripts/calibrate-218-visual-anchors.mjs).
    83: (0.30, 0.22, 0.35), 110: (0.58, 0.26, 0.30), 120: (0.42, 0.32, 0.35), 146: (0.83, 0.25, 0.30),
    184: (0.42, 0.32, 0.40), 214: (0.15, 0.27, 0.30),
}


def luma(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def clusters(points, radius):
    groups = []
    for x, y in points:
        for g in groups:
            if abs(g['x'] - x) <= radius and abs(g['y'] - y) <= radius:
                g['n'] += 1
                g['sx'] += x; g['sy'] += y
                g['x'] = g['sx'] / g['n']; g['y'] = g['sy'] / g['n']
                break
        else:
            groups.append({'x': x, 'y': y, 'sx': x, 'sy': y, 'n': 1})
    return [g for g in groups if g['n'] >= 1]


def find_head(image, box):
    rgba = image.convert('RGBA')
    scale = WORK / max(rgba.size)
    small = rgba.resize((max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))), Image.LANCZOS)
    px = small.load()
    w, h = small.size
    bx, by, bw, bh = (v * scale for v in box)
    top, bottom = by, by + bh
    reach = max(2, round(max(bw, bh) * 0.018))
    white = lambda q: q[3] > 200 and min(q[:3]) >= 228 and max(q[:3]) - min(q[:3]) <= 40
    candidates = []
    for y in range(int(top), int(top + bh * 0.72)):
        for x in range(int(bx), int(bx + bw)):
            if not white(px[x, y]):
                continue
            dark = bright = total = 0
            for dy in range(-reach, reach + 1):
                for dx in range(-reach, reach + 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w and 0 <= yy < h:
                        q = px[xx, yy]
                        total += 1
                        if q[3] > 200 and luma(q) < 46:
                            dark += 1
                        elif white(q):
                            bright += 1
            # A catchlight is a small dot in a dark pupil, not a white petal or a patch of fur.
            if dark >= 2 and bright <= total * 0.3 and dark >= total * 0.12:
                candidates.append((x, y))
    groups = clusters(candidates, reach * 2.5)
    size = max(bw, bh)
    best = None
    # Two eyes: similar height, a gap between 7 % and 34 % of the body, the higher pair preferred.
    for i, a in enumerate(groups):
        for b in groups[i + 1:]:
            gap = abs(a['x'] - b['x'])
            if gap < size * 0.07 or gap > size * 0.34 or abs(a['y'] - b['y']) > gap * 0.45:
                continue
            height = 1 - ((a['y'] + b['y']) / 2 - top) / bh
            score = height * 2 + min(a['n'], b['n']) * 0.05
            if not best or score > best[0]:
                best = (score, 'eyes', (a['x'] + b['x']) / 2, (a['y'] + b['y']) / 2, gap)
    if not best and groups:
        g = max(groups, key=lambda g: g['n'] * 0.2 + (1 - (g['y'] - top) / bh) * 2)
        best = (0, 'eye', g['x'], g['y'], size * 0.14)
    if best:
        _, method, ex, ey, gap = best
        head = max(size * 0.34, min(size * 0.62, gap * 2.9))
        cx, cy = ex, ey + head * 0.12
    else:
        # The upper body: mass centre of the top 38 % of the silhouette.
        sx = n = sy = 0
        for y in range(int(top), int(top + bh * 0.38)):
            for x in range(int(bx), int(bx + bw)):
                if px[x, y][3] > THRESHOLD:
                    sx += x; sy += y; n += 1
        cx, cy = (sx / n, sy / n) if n else (bx + bw / 2, top + bh * 0.28)
        head, method = size * 0.46, 'upper'
    # The square must stay on the drawing.
    cy = max(top + head * 0.42, cy)
    return method, cx / scale, cy / scale, head / scale


def main():
    sheets = pathlib.Path(sys.argv[sys.argv.index('--sheets') + 1]) if '--sheets' in sys.argv else None
    boxes = {row['sha256']: row['box'] for row in json.loads(SILHOUETTES.read_text(encoding='utf-8'))['entries']}
    rows, previews = [], []
    for entry in sorted(json.loads(HEROES.read_text(encoding='utf-8'))['entries'], key=lambda e: e['speciesIndex']):
        data = pathlib.Path(entry['src']).read_bytes()
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise SystemExit('HERO_BYTES_CHANGED: ' + entry['src'])
        box = boxes.get(entry['sha256'])
        if not box:
            raise SystemExit('HERO_SILHOUETTE_MISSING: ' + entry['src'])
        image = Image.open(entry['src'])
        override = FACE_OVERRIDES.get(entry['speciesIndex'])
        if override:
            fx, fy, fs = override
            method, cx, cy, size = 'reviewed', box[0] + fx * box[2], box[1] + fy * box[3], fs * max(box[2], box[3])
        else:
            method, cx, cy, size = find_head(image, box)
        face = [round(cx), round(cy), round(size)]
        rows.append({'speciesIndex': entry['speciesIndex'], 'sha256': entry['sha256'], 'method': method, 'face': face})
        if sheets:
            preview = image.convert('RGBA')
            preview.thumbnail((240, 240))
            k = preview.width / image.width
            card = Image.new('RGB', (240, 256), (34, 38, 58))
            card.paste(preview, (0, 0), preview)
            draw = ImageDraw.Draw(card)
            # The silhouette box in tenths, so a reviewer can read override fractions.
            x0, y0, x1, y1 = box[0] * k, box[1] * k, (box[0] + box[2]) * k, (box[1] + box[3]) * k
            for t in range(1, 10):
                c = (120, 120, 160) if t != 5 else (190, 190, 230)
                draw.line([x0 + (x1 - x0) * t / 10, y0, x0 + (x1 - x0) * t / 10, y0 + 4], fill=c)
                draw.line([x0, y0 + (y1 - y0) * t / 10, x0 + 4, y0 + (y1 - y0) * t / 10], fill=c)
            draw.rectangle([x0, y0, x1, y1], outline=(90, 90, 130))
            half = face[2] * k / 2
            draw.rectangle([face[0] * k - half, face[1] * k - half, face[0] * k + half, face[1] * k + half], outline=(0, 255, 160), width=2)
            draw.ellipse([face[0] * k - 3, face[1] * k - 3, face[0] * k + 3, face[1] * k + 3], fill=(255, 60, 120))
            draw.text((4, 242), f"{entry['speciesIndex']} {method}", fill=(255, 255, 255))
            previews.append(card)
    OUT.write_text(json.dumps({'schemaVersion': 1, 'alphaThreshold': THRESHOLD, 'method': 'catchlight-eyes-then-upper-body',
                               'entries': rows}, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'{len(rows)} faces -> {OUT}', {m: sum(r['method'] == m for r in rows) for m in ('eyes', 'eye', 'upper', 'reviewed')})
    if sheets:
        sheets.mkdir(parents=True, exist_ok=True)
        for start in range(0, len(previews), 24):
            sheet = Image.new('RGB', (6 * 240, 4 * 256), (10, 10, 20))
            for i, card in enumerate(previews[start:start + 24]):
                sheet.paste(card, ((i % 6) * 240, (i // 6) * 256))
            sheet.save(sheets / f'faces-{start // 24:02d}.png')


if __name__ == '__main__':
    main()
