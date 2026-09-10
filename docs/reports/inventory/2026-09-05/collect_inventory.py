"""Read-only product audit; writes only beside this script. Run from the Git root.

Counts describe files and declarations, not behavioral or visual completion.
Static references are lexical evidence, not proof of execution.
"""
import collections
import csv
import datetime
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path.cwd().resolve()
OUT = pathlib.Path(__file__).resolve().parent
assert (ROOT / 'src/championship/app/main.js').is_file()
assert OUT.is_relative_to(ROOT / 'docs/reports/inventory')


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8').strip()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_csv(name, rows, keys):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=keys, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


head_paths = set(git('ls-tree', '-r', '--name-only', 'HEAD').splitlines())
status_bytes = subprocess.check_output(['git', 'status', '--porcelain=v1', '-z', '-uall'], cwd=ROOT)
statuses = {}
parts = iter(status_bytes.decode('utf-8').split('\0'))
for part in parts:
    if not part:
        continue
    statuses[part[3:]] = part[:2]
    if 'R' in part[:2] or 'C' in part[:2]:
        next(parts, None)
file_paths = set(git('ls-files', '--cached', '--others', '--exclude-standard').splitlines())
excluded = OUT.relative_to(ROOT).as_posix() + '/'
file_paths = {p for p in file_paths if not p.startswith(excluded)}
rows = []
for relative in sorted(file_paths):
    path = ROOT / relative
    stat = path.stat() if path.is_file() else None
    group = '/'.join(pathlib.PurePosixPath(relative).parts[:2])
    should_hash = relative.startswith(('src/', 'tests/', 'docs/contracts/', 'docs/coordination/')) or path.name == 'manifest.json' or relative in ('package.json', 'AGENTS.md', 'README.md', 'docs/CURRENT_PRODUCT_STATUS.md', 'assets/production/ART_PRODUCTION_INDEX.json')
    rows.append({
        'path': relative, 'group': group, 'exists': stat is not None,
        'inHead': relative in head_paths, 'gitStatus': statuses.get(relative, '  '),
        'bytes': stat.st_size if stat else 0,
        'modifiedUtc': datetime.datetime.fromtimestamp(stat.st_mtime, datetime.timezone.utc).isoformat() if stat else '',
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest() if stat and should_hash else '',
    })
write_csv('files.csv', rows, ['path', 'group', 'exists', 'inHead', 'gitStatus', 'bytes', 'modifiedUtc', 'sha256'])

source_texts = {p: (ROOT / p).read_text(encoding='utf-8-sig') for p in file_paths if p.startswith('src/') and p.endswith('.js') and (ROOT / p).is_file()}
catalogs = []
for path in sorted((ROOT / 'src/data/championship/catalogs').glob('*.json')):
    data = read_json(path)
    counts = {k: len(v) for k, v in data.items() if isinstance(v, list)}
    catalogs.append({
        'path': path.relative_to(ROOT).as_posix(), 'inHead': path.relative_to(ROOT).as_posix() in head_paths,
        'sourceEvidenceDeclared': data.get('sourceEvidence'), 'counts': counts,
        'declaredRecordCount': data.get('recordCount'), 'actualRecordCount': len(data['records']) if isinstance(data.get('records'), list) else None,
        'consumers': [p for p, text in source_texts.items() if path.name in text],
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    })
write_json('catalogs.json', catalogs)

contracts = []
for path in sorted((ROOT / 'docs/contracts/championship').glob('*.json')):
    data = read_json(path)
    contracts.append({'path': path.relative_to(ROOT).as_posix(), 'inHead': path.relative_to(ROOT).as_posix() in head_paths, 'keys': list(data), 'declaredStatus': {k: v for k, v in data.items() if isinstance(v, (str, int, bool))}, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
write_json('contracts.json', contracts)

production = read_json(ROOT / 'assets/production/ART_PRODUCTION_INDEX.json')
assets = []
for entry in production['entries']:
    manifest = ROOT / entry['manifestPath']
    data = read_json(manifest) if manifest.is_file() else {}
    assets.append({**entry, 'manifestExists': manifest.is_file(), 'inHead': entry['manifestPath'] in head_paths,
                   'manifestCounts': {k: len(v) for k, v in data.items() if isinstance(v, list)},
                   'manifestSummary': data.get('summary'),
                   'manifestDeclaredFlags': {k: v for k, v in data.items() if k in ('runtimeEligible', 'shippingReady', 'rightsStatus', 'productionStatus', 'status')},
                   'manifestKeys': list(data),
                   'sourceReferences': [p for p, text in source_texts.items() if entry['manifestPath'] in text]})
write_json('production-bundles.json', assets)

research_files = [row for row in rows if row['path'].startswith(('docs/research/', 'research/original-evidence/'))]
write_csv('research-files.csv', research_files, ['path', 'exists', 'inHead', 'gitStatus', 'bytes', 'modifiedUtc'])
tests = [p for p in file_paths if p.startswith('tests/') and p.endswith(('.mjs', '.cjs')) and (ROOT / p).is_file()]
write_json('tests.json', {'deterministicEntrypoints': sorted(p for p in tests if len(pathlib.PurePosixPath(p).parts) == 2 and p.endswith('.mjs')), 'browserAndOtherCjs': sorted(p for p in tests if p.endswith('.cjs'))})

# Walk relative imports starting at the browser entry. This does not model fetch,
# computed imports, build transforms, or whether an imported function is invoked.
reachable = set()
missing_imports = []
queue = ['src/championship/app/main.js']
pattern = re.compile(r'''(?:from\s*|import\s*\(?\s*)["'](\.[^"']+)["']''')
while queue:
    relative = queue.pop()
    if relative in reachable:
        continue
    reachable.add(relative)
    path = ROOT / relative
    if not path.is_file():
        continue
    if path.suffix != '.js':
        continue
    for spec in pattern.findall(path.read_text(encoding='utf-8-sig')):
        target = (path.parent / spec).resolve()
        if not target.is_relative_to(ROOT):
            missing_imports.append({'source': relative, 'specifier': spec, 'reason': 'outside repository'})
            continue
        target_relative = target.relative_to(ROOT).as_posix()
        if not target.is_file():
            missing_imports.append({'source': relative, 'specifier': spec, 'reason': 'missing'})
        elif not target_relative.startswith('node_modules/'):
            queue.append(target_relative)
write_json('static-entry-dependencies.json', {'limitations': 'Relative literal imports only; comments may match; reachability is not execution or browser QA.', 'reachableFiles': sorted(reachable), 'missingLiteralImports': missing_imports})

summary = {
    'capturedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'root': str(ROOT), 'branch': git('branch', '--show-current'), 'head': git('rev-parse', 'HEAD'),
    'scope': 'Current nonignored Git files excluding this audit directory; existing working files included; deleted tracked files retained as absent.',
    'totalEntries': len(rows), 'existingFiles': sum(row['exists'] for row in rows),
    'bytes': sum(row['bytes'] for row in rows),
    'gitStatusCounts': dict(collections.Counter(row['gitStatus'] for row in rows)),
    'headFileCount': len(head_paths),
    'groups': {group: {'files': len(items), 'bytes': sum(item['bytes'] for item in items)} for group in sorted({row['group'] for row in rows}) if (items := [row for row in rows if row['group'] == group and row['exists']])},
    'catalogCount': len(catalogs), 'contractCount': len(contracts),
    'productionEntryCount': len(assets), 'productionRuntimeEligible': sum(entry.get('runtimeEligible') is True for entry in assets),
    'productionShippingReady': sum(entry.get('shippingReady') is True for entry in assets),
    'missingProductionManifests': [entry['manifestPath'] for entry in assets if not entry['manifestExists']],
    'researchFileCount': len(research_files),
    'deterministicTestFileCount': sum(len(pathlib.PurePosixPath(p).parts) == 2 and p.endswith('.mjs') for p in tests),
    'browserAndOtherCjsFileCount': sum(p.endswith('.cjs') for p in tests),
    'sourceJsCount': len(source_texts), 'staticEntryDependencyCount': len(reachable),
}
write_json('summary.json', summary)
print(json.dumps({k: v for k, v in summary.items() if k != 'groups'}, ensure_ascii=False, indent=2))

# Art-workspace deliverables are counted independently from production entries.
art_root = ROOT / 'docs/art/production/characters/faithful-hd224'
characters = read_json(art_root / 'manifest.json')
art_counts = {'entities': len(characters['entities']), 'atlasFrames': 0, 'sequences': 0, 'atlasPages': 0, 'missingFiles': []}
for entry in characters['entities']:
    runtime_path = art_root / entry['runtime']
    if not runtime_path.is_file():
        art_counts['missingFiles'].append(str(runtime_path))
        continue
    runtime = read_json(runtime_path)
    for side in runtime['sides'].values():
        art_counts['sequences'] += len(side['animations'])
        for atlas in side['atlases']:
            art_counts['atlasPages'] += 1
            atlas_path = runtime_path.parent / atlas['data']
            if atlas_path.is_file():
                art_counts['atlasFrames'] += len(read_json(atlas_path)['frames'])
            else:
                art_counts['missingFiles'].append(str(atlas_path))
ui = read_json(ROOT / 'docs/art/production/ui/faithful-hd96/manifest.json')
remix = read_json(ROOT / 'assets/production/internal-character-review/m201-remix-v1/manifest.json')
write_json('art-workspaces.json', {'characters': art_counts, 'ui': ui['counts'], 'remixM201': {k: v for k, v in remix.items() if k in ('state', 'slotCounts', 'sequenceCounts', 'candidateSlotCount', 'faithfulFallbackSlotCount', 'technicalCandidateUniqueCount', 'pendingUniqueCount')}})

registry = read_json(ROOT / 'docs/art/ART_ASSET_REGISTRY.json')
reference_rows = []
for asset in registry['assets']:
    references = [('sourcePath', asset.get('sourcePath'))]
    references += [('evidenceRef', p) for p in asset.get('evidenceRefs', []) if isinstance(p, str)]
    references += [('component', c.get('path')) for c in asset.get('components', []) if isinstance(c, dict)]
    for role, reference in references:
        if not isinstance(reference, str) or not reference:
            continue
        reference_path = pathlib.Path(reference)
        is_absolute = reference_path.is_absolute()
        logical_uri = bool(re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]+:', reference)) and not bool(re.match(r'^[a-zA-Z]:[\\/]', reference))
        resolved = reference_path if is_absolute else ROOT / reference_path
        kind = 'FILESYSTEM'
        if logical_uri:
            kind = 'LOGICAL_URI_NOT_FILESYSTEM'
        elif role == 'evidenceRef' and re.fullmatch(r'[0-9a-fA-F]{64}', reference):
            kind = 'SHA256_VALUE_NOT_FILESYSTEM'
        elif role == 'evidenceRef' and not is_absolute and not resolved.exists() and reference_path.suffix.lower() in {'.nanr', '.ncbr', '.ncer', '.nclr', '.ncgr', '.nbs', '.nscr', '.nxr', '.nsbmd', '.nsbca', '.nsbta', '.nsbtp', '.nsbva', '.nsbma', '.opm', '.narc'}:
            kind = 'ROM_RELATIVE_RESOURCE_NOT_REPO_PATH'
        reference_rows.append({'assetId': asset['assetId'], 'role': role, 'path': reference, 'referenceKind': kind, 'absolute': is_absolute, 'exists': resolved.exists() if kind == 'FILESYSTEM' else None, 'containsReplacementCharacter': '\ufffd' in reference})
write_csv('registry-reference-paths.csv', reference_rows, ['assetId', 'role', 'path', 'referenceKind', 'absolute', 'exists', 'containsReplacementCharacter'])
write_json('registry-summary.json', {'records': len(registry['assets']), 'domains': dict(collections.Counter(a.get('domain') for a in registry['assets'])), 'referenceOccurrences': len(reference_rows), 'referenceKindCounts': dict(collections.Counter(row['referenceKind'] for row in reference_rows)), 'nonFilesystemOccurrencesNotChecked': sum(row['exists'] is None for row in reference_rows), 'missingFilesystemOccurrences': sum(row['exists'] is False for row in reference_rows), 'uniqueReferences': len({row['path'] for row in reference_rows}), 'uniqueMissingFilesystemReferences': len({row['path'] for row in reference_rows if row['exists'] is False}), 'replacementCharacterOccurrences': sum(row['containsReplacementCharacter'] for row in reference_rows), 'limitations': 'Filesystem existence at recorded paths only. Logical ROM URIs, bare source-resource names in evidenceRefs and hash values are not repository filesystem paths and are not classified as missing. No automatic relocation, hash re-verification, rights review or source reclassification.'})

private_pack = ROOT.parent / 'YDIJ_PRIVATE_ROM_ART_PACK'
external_rows = []
if private_pack.is_dir():
    paths = subprocess.check_output(['rg', '--files', '--hidden', '--no-ignore', str(private_pack)]).decode('utf-8').splitlines()
    for value in paths:
        p = pathlib.Path(value)
        if p.is_file():
            external_rows.append({'path': str(p), 'relativePath': p.relative_to(private_pack).as_posix(), 'bytes': p.stat().st_size, 'scope': 'EXTERNAL_RESEARCH_REFERENCE_NOT_PRODUCT_SOURCE'})
write_csv('external-private-pack-files.csv', external_rows, ['path', 'relativePath', 'bytes', 'scope'])
write_json('external-evidence-summary.json', {'privatePackPath': str(private_pack), 'privatePackExists': private_pack.is_dir(), 'privatePackFiles': len(external_rows), 'privatePackBytes': sum(row['bytes'] for row in external_rows), 'privatePackGroups': dict(collections.Counter(row['relativePath'].split('/')[0] for row in external_rows)), 'mcpOriginalRoot': 'R:\\NEXUS LINK\\原作', 'mcpRootRole': 'Championship original research evidence; read-only MCP root, not Nexus Link product source; existence was returned by evidence_roots; contents not fully audited.', 'limitations': 'External pack metadata only; source payload contents and hashes not validated in this pass. Archives, dependencies, emulator saves and other project code excluded.'})
