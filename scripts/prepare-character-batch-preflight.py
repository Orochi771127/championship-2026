"""Offline roster-wide production preparation. Never submit jobs or approve art.

Reuse the existing source audit tables; keep research outputs outside product.
Read every CSV/XLSX cell and build per-entity geometry/timing specifications.
Missing morphology review remains blocked, even with complete source tables.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'docs/art/production/characters/appearance-refresh-v1'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def xlsx_tables(path):
    result = []
    with ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            for si in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', NS):
                strings.append(''.join(t.text or '' for t in si.findall('.//s:t', NS)))
        rels = {e.attrib['Id']: e.attrib['Target'] for e in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        for sheet in E.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet', NS):
            rid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = rels[rid]
            target = target.lstrip('/') if target.startswith('/') else 'xl/'+target
            records = []
            formulas = 0
            for row in E.fromstring(z.read(target)).findall('s:sheetData/s:row', NS):
                cells = {}
                for cell in row.findall('s:c', NS):
                    kind = cell.get('t'); v = cell.find('s:v', NS)
                    value = v.text if v is not None else ''
                    if kind == 's': value = strings[int(value)]
                    if kind == 'inlineStr': value = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                    formula = cell.find('s:f', NS)
                    if formula is not None: formulas += 1
                    cells[cell.attrib['r']] = {'value': value, 'formula': formula.text if formula is not None else None}
                records.append(cells)
            result.append({'sheet': sheet.attrib['name'], 'rowsIncludingHeader': len(records),
                           'cellsRead': sum(len(r) for r in records), 'formulasNotRecalculated': formulas,
                           'recordsSha256': hashlib.sha256(json.dumps(records, ensure_ascii=False, sort_keys=True).encode()).hexdigest(),
                           'header': records[0] if records else {}})
    return result


def validate_profile_inventory(profile, inventory, independent_sub_checks=None):
    """Cross-check source-table geometry/reuse/timing; never approve appearance."""
    def require(ok, message):
        if not ok:
            raise ValueError('SOURCE_TABLE_' + message)

    def numbers(value):
        return [int(x) for x in value.split()]

    eid = profile['entityId']
    require(inventory['entityId'] == eid, 'ENTITY_MISMATCH')
    cells = profile['cells']; slots = inventory['slots']
    keys = [f"{r['side']}/cell_{int(r['cell']):03}" for r in cells]
    require(len(keys) == len(set(keys)) and set(keys) == set(slots), 'CELL_COVERAGE')
    counts = dict(Counter(r['side'] for r in cells))
    require(counts == profile['sourceCellCounts'], 'CELL_COUNTS')
    storage=inventory.get('canvas',[64,64])
    require(len(storage)==2 and storage[0]==storage[1] and type(storage[0]) is int and 64<=storage[0]<=256 and storage[0]%32==0,'INVALID_STORAGE_CANVAS')
    if storage!=[64,64]:
        require(inventory.get('nativeScale')==1 and inventory.get('packingPolicy')=='EXPLICIT_PER_SLOT_ORIGIN_NATIVE_WORLD_COORDINATES_UNCHANGED','EXTENDED_STORAGE_REQUIRES_NATIVE_PACKING')
    for key, row in zip(keys, cells):
        slot = slots[key]; blank = row['blank'] == 'True'
        require(row['csvGeometryMatch'] == 'True' and row['reuseVerified'] == 'True', 'AUDIT_FAILED_' + key)
        require(slot['blank'] == blank, 'BLANK_MISMATCH_' + key)
        bounds = numbers(row['boundsFromOrigin'])
        # A decoded empty cell may retain its NCER storage bounds; it has no
        # visible bounds. Both sources already independently confirmed blank.
        require(blank or (not bounds and not slot['visibleBounds']) or bounds == slot['visibleBounds'], 'BOUNDS_MISMATCH_' + key)
        if not blank:
            require([bounds[2]-bounds[0], bounds[3]-bounds[1]] == [int(row['nativeWidth']), int(row['nativeHeight'])], 'SIZE_MISMATCH_' + key)
            require(int(row['nativeWidth'])<=storage[0] and int(row['nativeHeight'])<=storage[1], 'OVERSIZE_EXCEPTION_' + key)
            if storage!=[64,64]:
                origin=slot.get('canvasOrigin',inventory['sourceOrigin'])
                require(all(0<=bounds[i]+origin[i] and bounds[i+2]+origin[i]<=storage[i] for i in (0,1)), 'EXTENDED_STORAGE_CLIPPING_'+key)
    aliases = profile['subAliases']
    sub_ids = [int(r['subCell']) for r in aliases]
    require(len(sub_ids) == len(set(sub_ids)) == counts.get('sub', 0), 'SUB_COVERAGE')
    independent_sub_checks = independent_sub_checks or {}
    independent_checked = []
    for row in aliases:
        key = f"sub/cell_{int(row['subCell']):03}"
        require(key in slots, 'SUB_KEY_' + key)
        classification = row['classification']
        if classification == 'DETERMINISTIC_PALETTE_MAP' and key in independent_sub_checks:
            sub=slots[key];proof=independent_sub_checks[key]
            require(sub['canonical']==key and sub['translation']==[0,0], 'PALETTE_SUB_CANONICAL_'+key)
            require(isinstance(proof,dict) and proof.get('sourcePixelsVerified') is True, 'PALETTE_SUB_PIXEL_PROOF_'+key)
            require(proof['sourceRgbaSha256']==sub['sourceRgbaSha256'], 'PALETTE_SUB_HASH_'+key)
            require(proof['base']==f"main/cell_{int(row['matchedMainCell']):03}", 'PALETTE_SUB_BASE_'+key)
            require(proof['paletteMapping']==json.loads(row['paletteMapping']), 'PALETTE_SUB_MAPPING_'+key)
            independent_checked.append(key)
            continue
        if classification == 'NO_EXACT_MAIN_MATCH' and key in independent_sub_checks:
            sub = slots[key]
            require(sub['canonical'] == key and sub['translation'] == [0, 0], 'INDEPENDENT_SUB_CANONICAL_' + key)
            require(not row['matchedMainCell'] and not row['samePixelMainCells'], 'INDEPENDENT_SUB_HAS_MAIN_' + key)
            require(independent_sub_checks[key] == sub['sourceRgbaSha256'], 'INDEPENDENT_SUB_HASH_' + key)
            independent_checked.append(key)
            continue
        # Palette/mirror/non-exact exceptions need their own reviewed adapter;
        # a matching frame count must never silently authorize an exact alias.
        require(classification in ('EXACT_PIXELS_AND_ORIGIN', 'EXACT_PIXELS_DIFFERENT_ORIGIN'), 'SUB_EXCEPTION_' + key)
        main = slots[f"main/cell_{int(row['matchedMainCell']):03}"]; sub = slots[key]
        require(main['canonical'] == sub['canonical'], 'ALIAS_MISMATCH_' + key)
        delta = [sub['translation'][i]-main['translation'][i] for i in (0, 1)]
        require(delta == [int(row['offsetDx']), int(row['offsetDy'])], 'ALIAS_OFFSET_' + key)
    require(set(independent_checked) == set(independent_sub_checks), 'UNUSED_INDEPENDENT_SUB_REVIEW')
    expected = {(side, int(s['id'])): s for side, data in inventory['sequences'].items() for s in data['sequences']}
    rows = profile['sequences']; ids = [(r['side'], int(r['sequence'])) for r in rows]
    require(len(ids) == len(set(ids)) and set(ids) == set(expected), 'SEQUENCE_COVERAGE')
    for key, row in zip(ids, rows):
        sequence = expected[key]; frames = sequence['frames']
        require(row['csvRawMatch'] == 'True' and row['refsValid'] == 'True', 'TIMING_AUDIT_FAILED')
        require(int(row['frames']) == len(frames) and numbers(row['cells']) == [f['cell'] for f in frames], 'SEQUENCE_CELLS_' + str(key))
        require(numbers(row['ticks']) == [f['ticks'] for f in frames], 'TIMING_MISMATCH_' + str(key))
        require(int(row['mode']) == sequence['playbackMode'] and int(row['loopStart']) == sequence['loopStartFrame'], 'LOOP_MODE_' + str(key))
    return {'status': 'PASS_SOURCE_TABLE_CROSSCHECK_ONLY', 'entityId': eid,
            'cellsChecked': len(cells), 'subAliasesChecked': len(aliases), 'sequencesChecked': len(rows),
            'independentSubCellsChecked': independent_checked,
            'artAccepted': False, 'runtimeEligible': False}


def validate_source_profile(source, profile_path, inventory, independent_sub_checks=None):
    """Verify the current R-drive tables and their cached per-character rows."""
    profile = read(profile_path)
    prefix = '224角色_Main_Sub_審核/'
    names = {'03_全部17235格核對.csv': 'cells', '04_全部11480段核對.csv': 'sequences',
             '02_Sub逐格對應Main.csv': 'subAliases'}
    expected_paths = {prefix + name for name in names}
    if set(profile['sourceTableHashes']) != expected_paths:
        raise ValueError('SOURCE_TABLE_HASH_COVERAGE')
    for name, field in names.items():
        relative = prefix + name; path = source / relative
        if sha(path) != profile['sourceTableHashes'][relative]:
            raise ValueError('SOURCE_TABLE_HASH_DRIFT_' + relative)
        with path.open(encoding='utf-8-sig', newline='') as handle:
            records = [r for r in csv.DictReader(handle) if r['entityId'] == profile['entityId']]
        if records != profile[field]:
            raise ValueError('SOURCE_TABLE_PROFILE_DRIFT_' + field)
    result = validate_profile_inventory(profile, inventory, independent_sub_checks)
    result.update(profilePath=str(profile_path), profileSha256=sha(profile_path),
                  sourceTableHashes=profile['sourceTableHashes'])
    return result


def prepare(source, output):
    source = source.resolve(); output = output.resolve()
    if output.exists() or output.is_relative_to(ROOT):
        raise ValueError('USE_NEW_RESEARCH_OUTPUT_OUTSIDE_PRODUCT')
    tables = {}; ledger = []
    # Generated job snapshots contain no authoritative roster tables.
    for path in sorted(source.rglob('*.csv')):
        if '生成成果' in path.relative_to(source).parts: continue
        with path.open(encoding='utf-8-sig', newline='') as f:
            reader = csv.DictReader(f); rows = list(reader)
            if any(None in r for r in rows): raise ValueError('CSV_COLUMN_OVERFLOW '+str(path))
        key = path.relative_to(source).as_posix(); tables[key] = rows
        ledger.append({'path': key, 'sha256': sha(path), 'dataRows': len(rows), 'columns': reader.fieldnames})
    books = [{'path': p.relative_to(source).as_posix(), 'sha256': sha(p), 'sheets': xlsx_tables(p)} for p in sorted(source.rglob('*.xlsx'))]
    prefix = '224角色_Main_Sub_審核/'
    roster = tables['10_原作對應主索引.csv']
    audited = {r['entityId']: r for r in tables[prefix+'01_224角色審核名冊.csv']}
    if len(roster) != 224 or len(audited) != 224 or {r['entityId'] for r in roster} != set(audited):
        raise ValueError('ROSTER_IDENTITY_DRIFT')
    cells = defaultdict(list); sequences = defaultdict(list); aliases = defaultdict(list)
    for name, dest in [('03_全部17235格核對.csv', cells), ('04_全部11480段核對.csv', sequences), ('02_Sub逐格對應Main.csv', aliases)]:
        for r in tables[prefix+name]: dest[r['entityId']].append(r)
    rows = []; profiles = []; errors = []
    for position, r in enumerate(roster):
        eid = r['entityId']; a = audited[eid]
        for left, right in [('主畫面格數', 'mainCells'), ('副畫面格數', 'subCells')]:
            if int(r[left]) != int(a[right]): errors.append({'entityId': eid, 'field': left, 'index': r[left], 'source': a[right]})
        counts = Counter(c['side'] for c in cells[eid])
        if counts['main'] != int(a['mainCells']) or counts['sub'] != int(a['subCells']):
            errors.append({'entityId': eid, 'error': 'SOURCE_CELL_COUNT_MISMATCH'})
        review_path = PACK/'donor-review-v1'/eid/'review.json'
        review = read(review_path) if review_path.exists() else {}
        concept = source/r['正式選定稿'] if r['正式選定稿'] else None
        blockers = ['MORPHOLOGY_COMPATIBILITY_RECEIPT_REQUIRED']
        if not concept or not concept.exists(): blockers.append('CONCEPT_SELECTION_REQUIRED')
        if review.get('status') != 'PASS_DONOR_REVIEW': blockers.append('FULL_DONOR_VISUAL_REVIEW_REQUIRED')
        if any(int(c['nativeWidth']) > 64 or int(c['nativeHeight']) > 64 for c in cells[eid]): blockers.append('NATIVE_OVER_64_EXCEPTION')
        if eid == 'm002_choromon': blockers.append('REDESIGN_LOW_BODY_REQUIRED')
        profile = {'entityId': eid, 'sourceFamily': r['種族'], 'sourceGeneration': r['世代'],
                   'sourceCellCounts': dict(counts), 'cells': cells[eid], 'sequences': sequences[eid], 'subAliases': aliases[eid],
                   'donorReviewStatus': review.get('status', 'MISSING'), 'donorCharacterObservations': review.get('character'),
                   'anatomyClassification': 'REQUIRES_EXPLICIT_VISUAL_REVIEW',
                   'selectedConcept': {'path': str(concept), 'sha256': sha(concept)} if concept and concept.exists() else None,
                   'sourceTableHashes': {x['path']: x['sha256'] for x in ledger if x['path'] in [prefix+n for n in ('03_全部17235格核對.csv','04_全部11480段核對.csv','02_Sub逐格對應Main.csv')]},
                   'morphologyAccepted': False, 'eligibleForFullSheetGeneration': False, 'blockers': blockers}
        profiles.append(profile)
        rows.append({'index': position, 'entityId': eid, 'family': r['種族'], 'generation': r['世代'],
                     'mainCells': counts['main'], 'subCells': counts['sub'], 'sequences': len(sequences[eid]),
                     'sourceProfile': f'profiles/{eid}.json', 'donorReviewStatus': profile['donorReviewStatus'],
                     'selectedConcept': str(concept) if concept else '',
                     'nextStage': 'RETAIN_ACCEPTED_M001' if eid == 'm001_zurumon' else 'M002_LOW_BODY_PILOT' if eid == 'm002_choromon' else 'MORPHOLOGY_REVIEW',
                     'paidFullSheetReady': False, 'blockers': '|'.join(blockers)})
    if errors: raise ValueError(json.dumps(errors, ensure_ascii=False))
    output.mkdir(parents=True); (output/'profiles').mkdir()
    for p in profiles: write(output/'profiles'/f'{p["entityId"]}.json', p)
    write(output/'table-read-ledger.json', {'csv': ledger, 'xlsx': books, 'scope': 'All CSV records and XLSX stored cell values read; no new raw ROM decode or full visual approval.'})
    with (output/'224角色開工清單.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    write(output/'dispatch-plan.json', {'status': 'PREPARATION_ONLY_NO_SUBMISSION', 'providerMaxRequestsPerCall': 6,
          'countPerRequest': 1, 'generationKind': 'ONE_CHARACTER_PER_REQUEST',
          'initialParallelismAfterM002Acceptance': 2, 'steadyStateMaxParallelism': 6,
          'accountConcurrencyVerified': False, 'requests': [], 'fullSheetReadyCount': 0,
          'afterEachWave': 'Collect jobs, local validation, visually accept or isolate NG; refill only accepted-profile queue.',
          'onPartialFailure': 'Preserve stable index and job_id; reconcile unknown submissions before any retry.',
          'deduplicationKeyFields': ['entityId','conceptSha256','inventorySha256','promptSha256','model','variant','quality','resolution'],
          'maxCreditsPerRun': None, 'budgetMustBeSetBeforeUnattendedDispatch': True,
          'automaticSubmissionImplemented': False})
    summary = {'csvRead': len(ledger), 'csvDataRows': sum(x['dataRows'] for x in ledger),
               'workbooksRead': len(books), 'worksheetsRead': sum(len(x['sheets']) for x in books),
               'xlsxCellsRead': sum(s['cellsRead'] for x in books for s in x['sheets']),
               'profilesPrepared': len(profiles), 'sourceCells': sum(len(p['cells']) for p in profiles),
               'sourceSequences': sum(len(p['sequences']) for p in profiles),
               'newMorphologyApprovals': 0, 'paidSubmissions': 0, 'sourceCountJoinErrors': errors}
    write(output/'summary.json', summary)
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--source', type=Path, default=ROOT.parent/'自創腳色')
    p.add_argument('--output', type=Path, required=True); a = p.parse_args(); prepare(a.source, a.output)
