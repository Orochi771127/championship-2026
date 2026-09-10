"""Verify supplied ROM against art sources and current catalogs without editing product files.

Rebuilds use the repository's existing builders in an OS temporary directory.
Equality verifies transcription/reproducibility, not all field semantics.
Only hashes, counts, differences, and verification metadata are kept in this report.
"""
import collections
import contextlib
import datetime
import hashlib
import importlib.util
import io
import json
import pathlib
import struct
import sys
import tempfile

import ndspy.rom

ROOT = pathlib.Path.cwd().resolve()
OUT = pathlib.Path(__file__).resolve().parent
ROM = pathlib.Path('R:/8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds')
PACK = ROOT.parent / 'YDIJ_PRIVATE_ROM_ART_PACK'
EXPECTED = '8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1'
CATALOGS = ROOT / 'src/data/championship/catalogs'
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts/lib'))


def save(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def differences(left, right, path='$'):
    if type(left) is not type(right):
        return [path + ':type']
    if isinstance(left, dict):
        result = [path + '.' + k + ':missing-key' for k in sorted(left.keys() ^ right.keys())]
        for key in left.keys() & right.keys():
            result.extend(differences(left[key], right[key], path + '.' + key))
        return result
    if isinstance(left, list):
        result = [path + ':length'] if len(left) != len(right) else []
        for i, (a, b) in enumerate(zip(left, right)):
            result.extend(differences(a, b, f'{path}[{i}]'))
        return result
    return [] if left == right else [path]


data = ROM.read_bytes()
digest = hashlib.sha256(data).hexdigest()
assert digest == EXPECTED
rom = ndspy.rom.NintendoDSRom(data)
pack_manifest = read_json(PACK / '00_METADATA/PACK_MANIFEST.json')
provenance = {'capturedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'romPath': str(ROM), 'romSha256': digest, 'romBytes': len(data), 'title': data[:12].rstrip(b'\0').decode(), 'gameCode': data[12:16].decode(), 'packPath': str(PACK), 'packDeclaredRomSha256': pack_manifest['sourceRom']['sha256'], 'packRomMatch': pack_manifest['sourceRom']['sha256'] == digest}
save('rom-provenance.json', provenance)

raw_root = PACK / '07_RAW_NITRO_ART_BY_ROM_DIRECTORY'
raw_checks = []
for path in sorted(raw_root.rglob('*')):
    if not path.is_file():
        continue
    name = path.relative_to(raw_root).as_posix()
    file_id = rom.filenames.idOf(name)
    source = rom.files[file_id] if file_id is not None else None
    actual = path.read_bytes()
    raw_checks.append({'path': name, 'romFileId': file_id, 'bytes': len(actual), 'sha256': hashlib.sha256(actual).hexdigest(), 'romSha256': hashlib.sha256(source).hexdigest() if source is not None else None, 'matchesRom': source == actual})
save('raw-art-rom-comparison.json', {'checked': len(raw_checks), 'matched': sum(row['matchesRom'] for row in raw_checks), 'mismatches': [row for row in raw_checks if not row['matchesRom']], 'files': raw_checks})
print('Raw art compared:', len(raw_checks), 'matched:', sum(row['matchesRom'] for row in raw_checks), flush=True)

builder_runs = []
comparisons = []
with tempfile.TemporaryDirectory(prefix='championship-rom-parity-') as temporary:
    temp = pathlib.Path(temporary)
    generated = temp / 'catalogs'
    generated.mkdir()
    nitrofs = temp / 'nitrofs'
    for name in ['ui/txt/txt_list_txt.dat', 'ui/txt/help_text_txt.dat']:
        target = nitrofs / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(rom.files[rom.filenames.idOf(name)])

    builders = [
        ('build-battle-catalogs', ['--rom', str(ROM), '--out', str(generated)]),
        ('build-creature-catalogs', ['--rom', str(ROM)]),
        ('build-battle-script-catalog', ['--rom', str(ROM), '--out', str(generated)]),
        ('build-battle-native-catalog', ['--rom', str(ROM), '--out', str(generated)]),
        ('build-rng-channel-catalog', ['--rom', str(ROM), '--out', str(generated)]),
        ('build-cage-definitions', ['--rom', str(ROM)]),
        ('build-gate-catalog', ['--rom', str(ROM), '--nitrofs', str(nitrofs)]),
        ('build-help-catalog', ['--nitrofs', str(nitrofs)]),
        ('build-species-names', ['--nitrofs', str(nitrofs)]),
        ('build-title-event-strings', ['--nitrofs', str(nitrofs)]),
    ]
    for name, arguments in builders:
        spec = importlib.util.spec_from_file_location('parity_' + name.replace('-', '_'), ROOT / 'scripts' / (name + '.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.OUT_DIR = generated
        if hasattr(module, 'SPECIES_CATALOG'):
            module.SPECIES_CATALOG = generated / 'creature-species.r1.json'
        prior_argv = sys.argv
        sys.argv = [name] + arguments
        log = io.StringIO()
        try:
            with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
                code = module.main()
            builder_runs.append({'builder': name, 'exitCode': code or 0, 'output': log.getvalue()})
        except (Exception, SystemExit) as error:
            builder_runs.append({'builder': name, 'error': str(error), 'output': log.getvalue()})
        finally:
            sys.argv = prior_argv
    for target in sorted(generated.glob('*.json')):
        current = CATALOGS / target.name
        result = {'catalog': target.name, 'currentExists': current.is_file()}
        if current.is_file():
            before, after = read_json(current), read_json(target)
            delta = differences(before, after)
            result.update({'jsonEqual': not delta, 'differenceCount': len(delta), 'differencePaths': delta[:100], 'currentSha256': hashlib.sha256(current.read_bytes()).hexdigest(), 'regeneratedSha256': hashlib.sha256(target.read_bytes()).hexdigest()})
        comparisons.append(result)

# Independent Shop numeric comparison directly against the supplied ARM9 image.
arm_offset, arm_base, arm_size = struct.unpack_from('<I', data, 0x20)[0], struct.unpack_from('<I', data, 0x28)[0], struct.unpack_from('<I', data, 0x2C)[0]
arm9 = data[arm_offset:arm_offset + arm_size]
shop = read_json(CATALOGS / 'shop.r1.json')['records']
shop_deltas = []
category_names = ['TRAINING_GOODS', 'HUNT_ITEMS', 'PLUGINS', 'CAGES']
for index, record in enumerate(shop):
    values = struct.unpack_from('<14I', arm9, 0x020E0248 - arm_base + index * 56)
    expected = {'shopRecordIndex': index, 'category': category_names[values[0]], 'itemIndex': values[2], 'unlockParameter': values[5], 'initialOwned': values[6], 'maxOwned': values[8], 'unitPriceBits': values[11]}
    for key, value in expected.items():
        if record[key] != value:
            shop_deltas.append({'record': index, 'field': key, 'current': record[key], 'rom': value})
comparisons.append({'catalog': 'shop.r1.json', 'method': 'Independent struct reads: ARM9 0x020E0248, stride 56, seven declared fields per record', 'recordsChecked': len(shop), 'numericFieldsChecked': len(shop) * 7, 'differenceCount': len(shop_deltas), 'differences': shop_deltas, 'scope': 'Other mappings and unlockKind semantics not re-proven by this numeric comparison.'})

save('catalog-rom-comparison.json', {'method': '16 catalogs rebuilt using existing checked-in builders in temporary storage; Shop numeric fields independently read. Reproducibility and byte equality do not prove every semantic name or original control flow.', 'builderRuns': builder_runs, 'catalogs': comparisons})
print('Catalogs checked:', len(comparisons), 'differences:', [(r['catalog'], r.get('differenceCount')) for r in comparisons if r.get('differenceCount')], flush=True)
print('Builder errors:', [r for r in builder_runs if 'error' in r], flush=True)
failed = (
    not provenance['packRomMatch']
    or not raw_checks
    or any(not row['matchesRom'] for row in raw_checks)
    or len(comparisons) != 17
    or any('error' in run or run.get('exitCode', 0) != 0 for run in builder_runs)
    or any(row.get('differenceCount', 0) or row.get('currentExists') is False for row in comparisons)
)
raise SystemExit(1 if failed else 0)
