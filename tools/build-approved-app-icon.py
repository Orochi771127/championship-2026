"""Downsample the exact Owner-approved local master; never overwrite its source."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

MASTER_SHA256 = '33f557a1549bbd82f97ff873f0be4b8370a16aa45138b0d55cc88602e34841c6'
ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('master', type=Path)
    args = parser.parse_args()
    source = args.master.resolve()
    assert hashlib.sha256(source.read_bytes()).hexdigest() == MASTER_SHA256, 'APPROVED_MASTER_HASH_MISMATCH'
    with Image.open(source) as master:
        assert master.size == (1254, 1254) and master.mode == 'RGB', 'APPROVED_MASTER_FORMAT_MISMATCH'
        rows = []
        for size in (180, 192, 512):
            relative = f'assets/production/web-app/icon-{size}.png'
            output = ROOT / relative
            assert output.resolve() != source, 'SOURCE_OVERWRITE_REFUSED'
            # Square composition stays intact. The OS supplies any corner mask.
            master.resize((size, size), Image.Resampling.LANCZOS).save(output, format='PNG', optimize=True)
            with Image.open(output) as result:
                assert result.size == (size, size) and result.mode == 'RGB'
                assert not result.info, 'UNEXPECTED_OUTPUT_METADATA'
            rows.append({'path': relative, 'width': size, 'height': size,
                         'bytes': output.stat().st_size,
                         'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
    assert hashlib.sha256(source.read_bytes()).hexdigest() == MASTER_SHA256, 'SOURCE_CHANGED'
    report = {'sourceLibraryId': 'libfile_fdc9f26e8e5c81919da5b99c9da96219',
              'sourceSha256': MASTER_SHA256, 'sourceSize': [1254, 1254],
              'sourceAccess': 'OWNER_DOWNLOADED_LOCAL_FILE',
              'processing': 'Full square Lanczos downsample; opaque RGB PNG; no corner mask or extra metadata.',
              'files': rows}
    destination = ROOT / 'docs/reports/app-icon-2026-10-18/ICON_BYTES.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    # Icons now have their own approved source record, rather than incorrectly
    # claiming the old full-body title artwork as their source.
    title_manifest = ROOT / 'assets/production/title-morning-r1/delivery/manifest.json'
    title_delivery = json.loads(title_manifest.read_text(encoding='utf8'))
    title_delivery['files'] = [row for row in title_delivery['files']
                               if not row['path'].startswith('assets/production/web-app/')]
    title_manifest.write_text(json.dumps(title_delivery, indent=2) + '\n', encoding='utf8')
    print(json.dumps(report))

if __name__ == '__main__':
    main()
