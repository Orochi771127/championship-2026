"""Append exact approved original illustrations; no generation or animation changes."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IDS = [103, 105, 119, 120, 124, 136, 138, 139, 141, 146, 168, 178, 182, 185, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 203, 204, 205]
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda p: json.loads((ROOT / p).read_text(encoding='utf8'))

def write(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', type=Path, required=True)
    parser.add_argument('--paths', type=Path, required=True)
    args = parser.parse_args()
    sources = {r['species_id']: r for r in json.loads(args.sources.read_text(encoding='utf8'))['records']}
    paths = {r['id']: Path(r['file']) for r in json.loads(args.paths.read_text(encoding='utf8'))}
    paths = {number: path if path.is_absolute() else args.paths.resolve().parent.parent / path for number, path in paths.items()}
    hp = 'src/data/championship/database-hero-portraits.public.v1.json'
    ip = 'assets/production/PUBLIC_RUNTIME_INDEX.json'
    ap = 'docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'
    bp = 'docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'
    heroes, index, allow, inputs = map(read, [hp, ip, ap, bp])
    assert len(heroes['entries']) in [155, 175, 176, 177, 179, 182]
    manifest_path = 'docs/art/production/characters/approved-dex-repair-20261019/manifest.json'
    previous = read(manifest_path) if (ROOT / manifest_path).exists() else None
    identities = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import {getDatabaseDisplayEntry as get} from './src/championship/database/databaseDisplayCatalog.js';console.log(JSON.stringify(" + json.dumps(IDS) + ".map(get)))"], cwd=ROOT, text=True))
    manifest = {'baseCommit': 'a8337dc64622111e57f972ba2ef67cca131abc35',
        'scope': 'Static encyclopedia illustrations from exact approved originals. No generated images, changed animation, gameplay, species IDs or registration.',
        'sourceMapSha256': sha(args.sources.read_bytes()),
        'authorization': 'Current owner instruction: complete missing approved mature, advanced and ultimate encyclopedia images, test, commit and publish.',
        'priorEntriesSha256': sha(json.dumps(heroes['entries'], ensure_ascii=False, separators=(',', ':')).encode()),
        'entries': []}
    if previous:
        manifest['priorEntriesSha256'] = previous['priorEntriesSha256']
        manifest['entries'] = previous['entries']
    for identity in identities:
        number = identity['speciesIndex']; source = sources[number]; path = paths[number]
        data = path.read_bytes(); assert sha(data) == source['sha256'], number
        assert source['registry_design_status'] == '設計已核准'
        if any(r['speciesIndex'] == number for r in manifest['entries']): continue
        original = Image.open(path).convert('RGBA')
        row = {k: identity[k] for k in ['speciesIndex', 'speciesId', 'displayCode']}
        evidence = json.loads(source['approval_evidence'])
        if number == 105:
            evidence = {'message_id': source['exact_approval_message_id'], 'owner_quote': '105 OK了', 'version': '105-pose-hero-r3', 'supersedes': 'rejected r2'}
        record = {**row, 'name': source['name'], 'entityId': source['entity_id'],
            'master': {'path': str(path.resolve()), 'libraryFileId': source['library_file_id'], 'sha256': sha(data), 'dimensions': list(original.size)},
            'approval': {'status': 'owner_approved', 'evidence': evidence, 'scope': source.get('latest_verified_scope', source['registry_approval_scope'])},
            'purpose': 'COMPLETE_SINGLE_IMAGE_ENCYCLOPEDIA_ONLY',
            'visualReview': 'Exact approved single-character original; no board crop, pose change, weapon addition, background removal or animation enlargement.'}
        for kind, size in [('display', 768), ('thumbnail', 96)]:
            image = original.copy(); image.thumbnail((size, size), Image.Resampling.LANCZOS)
            dest = ROOT / f'assets/production/database-repair-20261019/species-{number}.{kind}.webp'
            dest.parent.mkdir(parents=True, exist_ok=True)
            image.save(dest, format='WEBP', lossless=kind == 'thumbnail', quality=90, alpha_quality=100, method=6, exact=True)
            encoded = dest.read_bytes(); decoded = Image.open(dest).convert('RGBA')
            assert decoded.getchannel('A').tobytes() == image.getchannel('A').tobytes()
            if kind == 'thumbnail': assert decoded.tobytes() == image.tobytes()
            hashed = dest.with_name(dest.stem + '.' + sha(encoded)[:16] + '.webp')
            if hashed.exists():
                assert hashed.read_bytes() == encoded
                dest.unlink()
            else: dest.rename(hashed)
            relative = hashed.relative_to(ROOT).as_posix()
            media = {'src': relative, 'width': image.width, 'height': image.height, 'sha256': sha(encoded)}
            record[kind] = {**media, 'bytes': len(encoded), 'alphaExactlyMatchesResizedMaster': True,
                'operation': 'LANCZOS_CONTAIN_96_LOSSLESS_EXACT_RGBA' if kind == 'thumbnail' else 'LANCZOS_CONTAIN_768_WEBP_Q90_ALPHA100'}
            if kind == 'display': row.update(media)
            else: row['thumbnail'] = media
            asset = {'id': f'species-{number}:database-{"hero" if kind == "display" else "thumbnail"}', 'src': media['src'], 'sha256': media['sha256'], 'width': media['width'], 'height': media['height']}
            allow['assets'].append(asset); index['assets'].append(asset)
            selected = {'path': relative, 'sha256': media['sha256']}
            allow['files'].append(selected); inputs['files'].append(relative); inputs['publicPlaytest']['files'].append(selected)
        heroes['entries'].append(row); manifest['entries'].append(record)
    heroes['entries'].sort(key=lambda r: r['speciesIndex'])
    for value in [index, allow]: value['assets'].sort(key=lambda r: r['id'])
    write(hp, heroes); write(ip, index)
    for rows in [allow['files'], inputs['publicPlaytest']['files']]:
        for row in rows:
            if row['path'] in [hp, ip]: row['sha256'] = sha((ROOT / row['path']).read_bytes())
    write(ap, allow); write(bp, inputs)
    manifest['entries'].sort(key=lambda r: r['speciesIndex'])
    write(manifest_path, manifest)
    print(json.dumps({'added': IDS, 'total': len(heroes['entries']), 'newImageBytes': sum(r[k]['bytes'] for r in manifest['entries'] for k in ['display', 'thumbnail'])}))

if __name__ == '__main__': main()
