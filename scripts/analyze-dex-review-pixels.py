"""Inspect local QA image bytes; does not run a browser or upload images.

Color/area checks detect blank captures. Human visual review is recorded
separately; these metrics are not a substitute for that review.
"""
import argparse
import hashlib
import json
import pathlib

from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('qa_output', type=pathlib.Path)
args = parser.parse_args()
report_path = args.qa_output / 'dex-browser-review.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
assert report['status'] == 'AUTOMATED_CHECKS_PASSED_VISUAL_ACCEPTANCE_PENDING'
assert len(report['localesTested']) == 5
assert len(report['lifecycle']) == 40
assert len(report['imageReadiness']) == 26
assert report['failures'] == [] and report['pageErrors'] == []
metrics = []
for shot in report['screenshots']:
    relative = pathlib.PurePosixPath(shot['filename'])
    assert not relative.is_absolute() and len(relative.parts) == 1
    path = args.qa_output / 'screenshots' / shot['filename']
    raw = path.read_bytes()
    assert len(raw) == shot['sizeBytes']
    assert hashlib.sha256(raw).hexdigest() == shot['sha256']
    if not shot['filename'].endswith('-hero-region.png'):
        continue
    with Image.open(path) as image:
        pixels = list(image.convert('RGB').getdata())
        colorful = sum(max(p) - min(p) > 40 and max(p) > 100 for p in pixels)
        row = {
            'filename': shot['filename'], 'width': image.width,
            'height': image.height, 'sha256': shot['sha256'],
            'uniqueColors': len(set(pixels)),
            'colorfulFraction': colorful / len(pixels),
        }
    assert row['width'] > 200 and row['height'] > 200
    assert row['uniqueColors'] > 10000 and row['colorfulFraction'] > 0.1
    metrics.append(row)
assert len(metrics) == 26
result = {
    'status': 'PASS_LOCAL_IMAGE_BYTE_AND_NONBLANK_CHECKS',
    'screenshotsHashed': len(report['screenshots']),
    'decodedHeroRegionsMeasured': len(metrics),
    'humanVisualReview': 'SEPARATE_REQUIRED_RECORD',
    'screenshotsUploaded': False, 'regions': metrics,
}
(args.qa_output / 'local-pixel-metrics.json').write_text(
    json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'regions'}))
