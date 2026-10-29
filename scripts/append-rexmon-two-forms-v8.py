"""Append Rexmon (dragon form) and Rexmon · Battle Form as two art-only Dex identities.

Owner handoff 2026-10-29 (REXMON_V8_CLAUDE_SETUP_HANDOFF.zip): one character, two forms, both ultimate.
Only the two v8-selected main images become Dex renditions; turnarounds and the v1 story reference stay
provenance on R. No stats, moves, evolution, save or animation data is created. Run once with the R
archive's extracted folder:

  python scripts/append-rexmon-two-forms-v8.py --masters <R archive>/extracted
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FOLDER = 'docs/art/production/characters/rexmon-two-forms-v8-20261029'
ASSETS = 'assets/production/database-rexmon-v8-20261029'
PACK = {'name': '雷克斯獸-雙形態設計交付-v8.zip', 'bytes': 9779509,
        'sha256': '4990677778c0a9428484cbb1cf7654fa4df1d037c83231be5d6c586cb09a235f',
        'manifestSha256': '9420df3c4f4896b660157086953181ecf2355f5682a5871328317525ef2d1fb4',
        'designVersion': 'rexmon-v8'}
HANDOFF = {'name': 'REXMON_V8_CLAUDE_SETUP_HANDOFF.zip', 'bytes': 9785556,
           'sha256': '0666d12a4017e3aae536a57e5b12ac4fb2f47301520db96da986062c38a41882',
           'instructionSha256': 'dc3d048fda190e1107f6d05546c1ffb4c359e8ccecb61a2adacb003e95def1ae'}
R_ARCHIVE = 'R:\\Projects\\Championship2026\\character-animation-art-archive-20261025\\rex-two-forms-design-v8-20261029'
CHARACTER = 'rexmon'
# (speciesIndex, form, name, UL serial, main role, turnaround role)
FORMS = [(243, 'dragon', '雷克斯獸', 41, 'dragon_main', 'dragon_turnaround'),
         (244, 'battle', '雷克斯獸·戰鬥型態', 42, 'battle_main', 'battle_turnaround')]
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda p: json.loads((ROOT / p).read_text(encoding='utf8'))
def write(p, j):
    target = ROOT / p; target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--masters', type=Path, required=True); args = parser.parse_args()
    hp = 'src/data/championship/database-hero-portraits.public.v1.json'; cp = 'src/data/championship/database-illustrations.r1.json'
    ip = 'assets/production/PUBLIC_RUNTIME_INDEX.json'; ap = 'docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'
    bp = 'docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'
    heroes, catalog, index, allow, inputs = map(read, [hp, cp, ip, ap, bp])
    assert len(heroes['entries']) == 230 and len(catalog['entries']) == 12
    taken = {e['speciesIndex'] for e in heroes['entries']} | {e['speciesIndex'] for e in catalog['entries']}
    assert not taken & {243, 244}
    ultimate = [e for e in catalog['entries'] if e.get('numberingStageIndex') == 6]
    assert max(e['serial'] for e in ultimate) == 40
    pack_manifest = (args.masters / 'asset-manifest-v8.json').read_bytes(); assert sha(pack_manifest) == PACK['manifestSha256']
    assets = {a['role']: a for a in json.loads(pack_manifest)['assets']}
    def source(role):
        meta = assets[role]; path = args.masters / meta['filename']; data = path.read_bytes()
        assert sha(data) == meta['sha256'] and len(data) == meta['bytes'] and meta['design_version'] == PACK['designVersion']
        return {'file': meta['filename'], 'rPath': R_ARCHIVE + '\\extracted\\' + meta['filename'], 'libraryFileId': meta['library_file_id'],
                'sha256': meta['sha256'], 'bytes': meta['bytes'], 'dimensions': meta['dimensions']}, path
    manifest = {'scope': 'Two art-only ultimate Dex identities for one character (Rexmon dragon form and battle form). '
                'Existing 230 portraits and 12 illustration identities preserved. No playable identity, registration, stats, moves, '
                'evolution, transformation trigger, save or animation changes.',
                'handoff': HANDOFF, 'artPack': PACK, 'rArchive': R_ARCHIVE,
                'character': {'characterKey': CHARACTER, 'sameCharacter': True, 'stage': 'ultimate', 'stageLabel': '究極體',
                              'forms': [f[1] for f in FORMS], 'sourceCharacterKey': 'rexmon-transforming-concept'},
                'excludedFromRuntime': {'dual_main': assets['dual_main']['sha256'], 'STORY_PORTRAIT_REFERENCE': assets['STORY_PORTRAIT_REFERENCE']['sha256'],
                                        'reason': 'Combined sheet and v1 story-mode portrait reference; turnarounds are design references, never Dex or animation atlases.'},
                'superseded': {'designVersion': 'rexmon-v7', 'reason': 'v7 humanoid back-cannon direction superseded by v8; never a motion or turnaround basis.'},
                'priorEntriesSha256': sha(json.dumps(heroes['entries'], ensure_ascii=False, separators=(',', ':')).encode()),
                'entries': []}
    for number, form, name, serial, main_role, turn_role in FORMS:
        main_source, path = source(main_role); turnaround, _ = source(turn_role)
        code = f'UL{serial}'; row = {'speciesIndex': number, 'speciesId': f'species-{number}', 'displayCode': code}
        record = {**row, 'displayName': name, 'form': {'characterKey': CHARACTER, 'formKey': form}, 'numberingStageIndex': 6, 'serial': serial,
                  'master': main_source, 'turnaround': {**turnaround, 'use': 'DESIGN_REFERENCE_ONLY_NOT_RUNTIME'},
                  'purpose': 'COMPLETE_SINGLE_IMAGE_ENCYCLOPEDIA_ONLY'}
        original = Image.open(path).convert('RGBA')
        assert list(original.size) == main_source['dimensions']
        for kind, size in [('display', 768), ('thumbnail', 96)]:
            image = original.copy(); image.thumbnail((size, size), Image.Resampling.LANCZOS)
            dest = ROOT / f'{ASSETS}/species-{number}.{kind}.webp'; dest.parent.mkdir(parents=True, exist_ok=True)
            image.save(dest, format='WEBP', lossless=kind == 'thumbnail', quality=90, alpha_quality=100, method=6, exact=True)
            encoded = dest.read_bytes(); decoded = Image.open(dest).convert('RGBA')
            assert decoded.getchannel('A').tobytes() == image.getchannel('A').tobytes()
            if kind == 'thumbnail': assert decoded.tobytes() == image.tobytes()
            hashed = dest.with_name(dest.stem + '.' + sha(encoded)[:16] + '.webp'); dest.rename(hashed); relative = hashed.relative_to(ROOT).as_posix()
            media = {'src': relative, 'width': image.width, 'height': image.height, 'sha256': sha(encoded)}
            record[kind] = {**media, 'bytes': len(encoded), 'alphaExactlyMatchesResizedMaster': True}
            if kind == 'display': row.update(media)
            else: row['thumbnail'] = media
            # Same key order as every selected asset row: the build re-projects the index and compares bytes.
            asset = {'id': f'species-{number}:database-{"hero" if kind == "display" else "thumbnail"}', 'src': relative,
                     'sha256': media['sha256'], 'width': media['width'], 'height': media['height']}
            index['assets'].append(asset); allow['assets'].append(asset)
            selected = {'path': relative, 'sha256': media['sha256']}
            allow['files'].append(selected); inputs['files'].append(relative); inputs['publicPlaytest']['files'].append(selected)
        heroes['entries'].append(row)
        catalog['entries'].append({**{k: row[k] for k in ['speciesIndex', 'speciesId', 'displayCode']}, 'numberingStageIndex': 6, 'serial': serial,
                                   'displayName': name, 'form': {'characterKey': CHARACTER, 'formKey': form}})
        manifest['entries'].append(record)
    heroes['entries'].sort(key=lambda e: e['speciesIndex'])
    for value in [index, allow]: value['assets'].sort(key=lambda r: r['id'])
    write(hp, heroes); write(cp, catalog); write(ip, index); write(f'{FOLDER}/manifest.json', manifest)
    write(ap, allow); write(bp, inputs)
    print(json.dumps({'added': [f[0] for f in FORMS], 'portraits': len(heroes['entries']), 'illustrations': len(catalog['entries']),
                      'bytes': sum(r[k]['bytes'] for r in manifest['entries'] for k in ['display', 'thumbnail'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()
