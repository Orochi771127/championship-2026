"""Append the six existing approved static illustrations, preserving all prior IDs/art."""
import csv
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('C:/Users/User/Documents/Codex/2026-10-19/task-2/角色盤點_20261019')
FOLDER = 'docs/art/production/characters/approved-dex-closeout-20261019'
def read(path): return json.loads((ROOT / path).read_text(encoding='utf-8'))
def sha(data): return hashlib.sha256(data).hexdigest()
def write(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')

hp = 'src/data/championship/database-hero-portraits.public.v1.json'
cp = 'src/data/championship/database-illustrations.r1.json'
ap = 'docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'
ip = 'assets/production/PUBLIC_RUNTIME_INDEX.json'
bp = 'docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'
heroes, catalog, allow, index, inputs = map(read, [hp, cp, ap, ip, bp])
assert len(heroes['entries']) == 140 and len(catalog['entries']) == 6
manifest = {'scope': 'Six approved single-image static encyclopedia additions. Existing 140 portraits and six ART identities preserved. No playable identity, animation, stats, evolution or save changes.',
    'definition': 'A finalized portrait is one complete image. A character originally holding a removable weapon requires its matching equipped hero; body-only approval is insufficient. Naturally unarmed designs do not require invented weapons.',
    'priorEntries': heroes['entries'].copy(), 'entries': []}
rows = list(csv.DictReader((SOURCE / '00_逐角色設計盤點.csv').read_text(encoding='utf-8-sig').splitlines()))
for number in range(237, 243):
    row = next(r for r in rows if r['角色 ID'] == f'species-{number}')
    assert row['設計狀態'] == '設計已核准'
    source = Path(row['核准／候選來源檔'])
    data = source.read_bytes()
    assert sha(data) == row['核准母圖或候選 SHA256']
    code = f'ART{number - 230:02}'
    name = row['名稱']
    entry = {'speciesIndex': number, 'speciesId': f'species-{number}', 'displayCode': code}
    record = {**entry, 'displayName': name, 'master': {'path': str(source), 'sha256': sha(data), 'bytes': len(data)},
        'approval': {'status': 'owner_approved', 'evidence': json.loads(row['核准證據'])},
        'purpose': 'COMPLETE_SINGLE_IMAGE_ENCYCLOPEDIA_ONLY', 'evolutionStageAssigned': False}
    original = Image.open(source).convert('RGBA')
    record['master']['dimensions'] = list(original.size)
    for kind, size in [('display', 864), ('thumbnail', 128)]:
        image = original.copy()
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        destination = ROOT / f'assets/production/database-closeout-20261019/species-{number}.{kind}.webp'
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format='WEBP', lossless=kind == 'thumbnail', quality=95, alpha_quality=100, method=6, exact=True)
        encoded = destination.read_bytes()
        decoded = Image.open(destination).convert('RGBA')
        assert decoded.getchannel('A').tobytes() == image.getchannel('A').tobytes()
        if kind == 'thumbnail': assert decoded.tobytes() == image.tobytes()
        hashed = destination.with_name(destination.stem + '.' + sha(encoded)[:16] + destination.suffix)
        destination.rename(hashed)
        destination = hashed
        relative = destination.relative_to(ROOT).as_posix()
        media = {'src': relative, 'width': image.width, 'height': image.height, 'sha256': sha(encoded)}
        record[kind] = {**media, 'bytes': len(encoded), 'operation': f'LANCZOS_CONTAIN_{size}_EXACT_RGBA_LOSSLESS_WEBP' if kind == 'thumbnail' else 'LANCZOS_CONTAIN_864_WEBP_Q95_ALPHA100', 'alphaExactlyMatchesResizedMaster': True}
        if kind == 'display': entry.update(media)
        else: entry['thumbnail'] = media
        asset = {'id': f'species-{number}:database-{"hero" if kind == "display" else "thumbnail"}', **media}
        allow['assets'].append(asset)
        index['assets'].append(asset)
        selected = {'path': relative, 'sha256': media['sha256']}
        allow['files'].append(selected)
        inputs['files'].append(relative)
        inputs['publicPlaytest']['files'].append(selected)
    heroes['entries'].append(entry)
    catalog['entries'].append({**{k: entry[k] for k in ['speciesIndex', 'speciesId', 'displayCode']}, 'displayName': name})
    manifest['entries'].append(record)
write(hp, heroes)
write(cp, catalog)
write(f'{FOLDER}/manifest.json', manifest)
index['assets'].sort(key=lambda r: r['id'])
allow['assets'].sort(key=lambda r: r['id'])
write(ip, index)
for doc in [allow['files'], inputs['publicPlaytest']['files']]:
    for row in doc:
        if row['path'] in [hp, cp, ip]: row['sha256'] = sha((ROOT / row['path']).read_bytes())
write(ap, allow)
write(bp, inputs)
print(json.dumps({'portraits': len(heroes['entries']), 'illustrations': len(catalog['entries']), 'added': [e['speciesIndex'] for e in manifest['entries']]}))
