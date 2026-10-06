"""One reproducible review for an opus refinement batch.

    python -X utf8 scripts/build-cage-opus-review.py --round refinement-opus-r1 \
        --baseline docs/.../review/refinement-batch-e-v1/full-layout/report.json \
        --pack-root docs/.../cage-base3d-v1/opm-opus-r1 \
        --field field_cm06_01 --field field_cm15_01 --field field_cm17_01

1. Merge the baseline's candidate overrides with this batch's new candidates,
   each field id exactly once, so no earlier override is ever dropped.
2. Rebuild the 37-scenario full layout from that merged map.
3. Run all three containment gates with explicit inputs and outputs: the frame,
   the reassembled pack (plus saved selections), and the state envelope that
   bounds every source state of every object.
4. Aggregate the worst of the three per field.
5. Build before/after sheets at configuration-page and native scale.

Nothing here approves art, integrates a runtime or publishes anything.
"""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
RANK = {'PASS': 0, 'REVIEW': 1, 'FAIL': 2}


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def rel(path):
    return Path(path).resolve().relative_to(ROOT).as_posix()


def run(*args):
    result = subprocess.run([sys.executable, '-X', 'utf8', *map(str, args)], cwd=ROOT,
                            capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise SystemExit(f'STEP_FAILED: {args[0]}\n{result.stdout[-2000:]}\n{result.stderr[-3000:]}')
    return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''


def font(size):
    path = Path('C:/Windows/Fonts/msjh.ttc')
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def merged_overrides(baseline, pack_root, fields):
    overrides = dict(read(baseline).get('candidateOverrides', {}))
    for field_id in fields:
        candidate = pack_root / 'seam-v3/fields' / field_id / 'frame-00.png'
        if not candidate.exists():
            raise SystemExit(f'MISSING_CANDIDATE:{rel(candidate)}')
        overrides[field_id] = rel(candidate)
    return dict(sorted(overrides.items()))


def worst_of_all(footprint_dir):
    frame = {r['fieldId']: r for r in read(footprint_dir / 'report.json')['records']}
    composite = {r['fieldId']: r for r in read(footprint_dir / 'composite-report.json')['records']}
    envelope = {r['fieldId']: r for r in read(footprint_dir / 'state-envelope-report.json')['records']}
    rows = []
    for field_id, f in frame.items():
        c, e = composite[field_id], envelope[field_id]
        candidates = [('frame', f['severity'], f['solidOverflowPixels']),
                      ('composite', c['worstSeverity'], c['worstSolidOverflowPixels']),
                      ('envelope', e['envelopeSeverity'], e['envelopeSolidOverflowPixels'])]
        gate, severity, pixels = max(candidates, key=lambda row: (RANK[row[1]], row[2]))
        rows.append({'fieldId': field_id, 'nameZh': f['nameZh'], 'worstSeverity': severity,
                     'worstSolidOverflowPixels': pixels, 'worstGate': gate,
                     'frame': [f['severity'], f['solidOverflowPixels']],
                     'composite': [c['worstSeverity'], c['worstSolidOverflowPixels']],
                     'envelope': [e['envelopeSeverity'], e['envelopeSolidOverflowPixels']],
                     'objectStatesChecked': e['objectStatesChecked'],
                     'objectsOnlySolidOverflowPixels': e['objectsOnlySolidOverflowPixels']})
    counts = {key: sum(r['worstSeverity'] == key for r in rows) for key in RANK}
    return {'status': 'WORST_OF_FRAME_COMPOSITE_AND_STATE_ENVELOPE', 'counts': counts, 'records': rows,
            'limits': ['Containment only; not visual approval, runtime integration or shipping.']}


def before_after(baseline_layout, new_layout, fields, output):
    base_boards = Path(baseline_layout).parent / 'boards'
    new_boards = Path(new_layout).parent / 'boards'
    index = {r['fieldId']: r['definitionIndex'] for r in read(new_layout)['records']}
    names = {r['fieldId']: r['nameZh'] for r in read(new_layout)['records']}
    cards = []
    for field_id in fields:
        filename = f"{index[field_id]:02d}-{field_id}.png"
        cards.append((f'BEFORE  {field_id}  {names[field_id]}', Image.open(base_boards / filename).convert('RGB')))
        cards.append((f'AFTER   {field_id}  {names[field_id]}', Image.open(new_boards / filename).convert('RGB')))
    width = max(image.width for _, image in cards)
    height = max(image.height for _, image in cards) + 34
    sheet = Image.new('RGB', (width * 2, height * len(fields)), (7, 13, 19))
    draw = ImageDraw.Draw(sheet)
    for i, (label, image) in enumerate(cards):
        x, y = (i % 2) * width, (i // 2) * height
        draw.text((x + 12, y + 7), label, font=font(20), fill=(238, 244, 241))
        sheet.paste(image, (x, y + 34))
        image.close()
    sheet.save(output, quality=92, optimize=True)
    sheet.close()


def native_before_after(baseline_layout, new_layout, fields, output):
    """Each field's own frame at native scale, shown 2x with nearest sampling."""
    old = {r['fieldId']: r['candidateFile'] for r in read(baseline_layout)['records']}
    new = {r['fieldId']: r['candidateFile'] for r in read(new_layout)['records']}
    rows = []
    for field_id in fields:
        pair = []
        for path in (old[field_id], new[field_id]):
            with Image.open(ROOT / path) as opened:
                image = opened.convert('RGBA')
            native = image.resize((image.width // 4, image.height // 4), Image.Resampling.LANCZOS)
            pair.append(native.resize((native.width * 2, native.height * 2), Image.Resampling.NEAREST))
        rows.append((field_id, pair))
    width = max(p[0].width for _, p in rows)
    height = sum(p[0].height + 32 for _, p in rows)
    sheet = Image.new('RGB', (width * 2 + 24, height), (20, 26, 32))
    draw = ImageDraw.Draw(sheet)
    y = 0
    for field_id, (a, b) in rows:
        draw.text((8, y + 4), f'{field_id}  BEFORE  native, shown 2x', font=font(18), fill=(230, 230, 230))
        draw.text((width + 32, y + 4), 'AFTER  native, shown 2x', font=font(18), fill=(140, 230, 170))
        sheet.paste(a, (0, y + 30), a)
        sheet.paste(b, (width + 24, y + 30), b)
        y += a.height + 32
    sheet.save(output, optimize=True)
    sheet.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', required=True)
    parser.add_argument('--baseline', type=Path, required=True, help='previous full-layout report.json')
    parser.add_argument('--pack-root', type=Path, required=True)
    parser.add_argument('--field', action='append', required=True)
    args = parser.parse_args()
    review = WORK / 'review' / args.round
    review.mkdir(parents=True, exist_ok=True)
    baseline = args.baseline.resolve()
    overrides = merged_overrides(baseline, args.pack_root.resolve(), args.field)
    layout_args = ['scripts/build-cage-full-layout-review.py', '--output', review / 'full-layout']
    for field_id, path in overrides.items():
        layout_args += ['--candidate-override', f'{field_id}={path}']
    run(*layout_args)
    layout = review / 'full-layout/report.json'
    footprint = review / 'footprint'
    run('scripts/audit-cage-field-footprint.py', '--input-report', layout, '--output', footprint)
    run('scripts/audit-cage-composite-footprint.py', '--input-report', layout, '--output', footprint)
    run('scripts/audit-cage-state-envelope.py', '--input-report', layout, '--output', footprint)
    summary = worst_of_all(footprint)
    summary.update({'round': args.round, 'baseline': rel(baseline), 'batchFields': args.field,
                    'overrideCount': len(overrides), 'overrides': overrides})
    (footprint / 'worst-of-all.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n',
                                                 encoding='utf-8')
    before_after(baseline, layout, args.field, review / 'full-board-before-after.jpg')
    native_before_after(baseline, layout, args.field, review / 'native-before-after.png')
    batch = [r for r in summary['records'] if r['fieldId'] in args.field]
    print(json.dumps({'round': args.round, 'counts': summary['counts'], 'overrideCount': len(overrides),
                      'batch': [(r['fieldId'], r['worstSeverity'], r['worstSolidOverflowPixels'], r['worstGate'])
                                for r in batch]}, ensure_ascii=False))


if __name__ == '__main__':
    main()
