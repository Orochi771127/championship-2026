"""Install the two royal cage GLBs built by scripts/build-royal-cage-maps.py (Owner 2026-11-03).

python scripts/install-royal-cage-maps.py <build dir>

Copies field_royal_ranch_01.glb and field_stellar_zoo_01.glb into assets/production/cage/three-20261021/
and records their url, sha256 and bytes in that folder's manifest.json (ranchThreeScene checks both).
"""
import hashlib, json, os, shutil, sys

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
DIR = 'assets/production/cage/three-20261021'
FIELDS = ('field_royal_ranch_01', 'field_stellar_zoo_01')
build = sys.argv[1]
manifest_path = os.path.join(REPO, DIR, 'manifest.json')
with open(manifest_path, encoding='utf-8') as f:
    manifest = json.load(f)
for fid in FIELDS:
    target = os.path.join(REPO, DIR, f'{fid}.glb')
    shutil.copyfile(os.path.join(build, f'{fid}.glb'), target)
    data = open(target, 'rb').read()
    row = {'fieldId': fid, 'url': f'{DIR}/{fid}.glb', 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    manifest['fields'] = [r for r in manifest['fields'] if r['fieldId'] != fid] + [row]
    print('INSTALLED', fid, row['bytes'], row['sha256'])
with open(manifest_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
