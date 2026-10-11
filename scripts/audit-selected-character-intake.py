"""Offline storage/selection lock for the owner's original-art catalog.

Does not submit paid jobs, replace existing settings, or approve candidate art.
Reuses the existing donor inventories/contracts and leaves renderer data alone.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
PACK = ROOT / 'docs/art/production/characters/appearance-refresh-v1'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.is_file() else None


def lock(path):
    return {'path': path.as_posix(), 'sha256': sha(path)} if path.is_file() else None


def scan(root):
    files = sorted(p for p in root.rglob('*') if p.is_file()) if root.exists() else []
    return {'path': root.as_posix(), 'exists': root.is_dir(), 'fileCount': len(files),
            'bytes': sum(p.stat().st_size for p in files),
            'resolvedOutsideR': [p.as_posix() for p in files if p.resolve().drive.upper() != 'R:']}


def build(source):
    index = source / '10_原作對應主索引.csv'
    with index.open(encoding='utf-8-sig', newline='') as handle:
        rows = list(csv.DictReader(handle))
    ids = [r['entityId'] for r in rows]
    if len(ids) != 224 or len(set(ids)) != 224:
        raise ValueError('SOURCE_ROSTER_COUNT_OR_ID_DRIFT')
    records = []
    for row in rows:
        eid = row['entityId']
        selected = row['正式選定稿'].strip()
        art = (source / selected).resolve() if selected else None
        if art and (not art.is_relative_to(source.resolve()) or not art.is_file()):
            raise ValueError(f'SELECTED_ART_MISSING_OR_OUTSIDE_SOURCE: {eid}')
        donor = PACK / 'donor-review-v1' / eid
        inventory = read(donor / 'inventory.json')
        review = read(donor / 'review.json')
        setting = PACK / 'pixel-v2/settings' / eid / 'setting.json'
        blockers = ['HIGGSFIELD_CONNECTION_REQUIRED']
        if not art:
            blockers.append('CONCEPT_SELECTION_PENDING')
        else:
            blockers.append('BIND_SELECTED_CONCEPT_TO_NEW_SETTING_AND_JOB_REVISION')
        if not inventory:
            blockers.append('DONOR_INVENTORY_REQUIRED')
        if not review or review.get('status') != 'PASS_DONOR_REVIEW':
            blockers.append('FULL_DONOR_VISUAL_REVIEW_REQUIRED')
        if eid != 'm001_zurumon':
            blockers.append('SELECTED_M001_VERTICAL_SLICE_REQUIRED')
        records.append({
            'entityId': eid, 'sourceSelectionState': row['選定狀態'],
            'concept': lock(art) if art else None,
            'candidatePaths': [v.strip() for v in row['全部候選'].split('|') if v.strip()],
            'catalogCountsInformational': {k: int(row[k]) for k in ('主畫面格數', '副畫面格數', '不重複姿勢')},
            'donorInventory': lock(donor / 'inventory.json'),
            'donorReview': lock(donor / 'review.json'),
            'donorReviewStatus': review.get('status') if review else 'MISSING',
            'donorMeasuredCounts': inventory.get('counts') if inventory else None,
            'donorOrigin': inventory.get('sourceOrigin') if inventory else None,
            'motionContract': lock(PACK / 'generated/entities' / eid / 'motion-contract.json'),
            'existingSettingPreserved': lock(setting),
            'existingSettingAcceptedForSelectedConcept': False,
            'status': 'INTAKE_ONLY_NOT_SUBMITTED', 'blockers': blockers,
            'providerJobId': None, 'humanApproved': False, 'runtimeEligible': False,
        })
    preferred = ['m001_zurumon', 'm002_choromon', 'm003_nyokimon']
    order = preferred + [eid for eid in ids if eid not in preferred]
    records.sort(key=lambda v: order.index(v['entityId']))
    directories = [source, PACK / 'sheet-jobs-v1', PACK / 'donor-review-v1',
                   PACK / 'generated', PACK / 'pixel-v2/settings',
                   ROOT / 'assets/production/internal-character-review',
                   ROOT / 'docs/art/production/original-character-cage-r1/m001-pipeline-v1',
                   WORKSPACE / '_archive/character-donor-review-v1',
                   WORKSPACE / '_archive/character-sheet-jobs-v1',
                   WORKSPACE / '_archive/character-source-attachments',
                   ROOT / '.tmp/browser-qa']
    audit = {'scope': 'Listed task-related roots; not a full-disk or cloud-account audit.',
             'storage': [scan(d) for d in directories],
             'conceptImages': len(list(source.rglob('*.png'))),
             'selectedConcepts': sum(r['concept'] is not None for r in records),
             'unselectedEntities': [r['entityId'] for r in records if not r['concept']],
             'donorReviewStatuses': dict(Counter(r['donorReviewStatus'] for r in records))}
    intake = {'schemaVersion': 1, 'capturedAt': datetime.now(timezone.utc).isoformat(),
              'purpose': 'Selection intake; not an executable paid-generation queue.',
              'sourceIndex': lock(index), 'provider': 'HIGGSFIELD',
              'requestedModelLabel': 'GPT Image 2.5', 'currentProviderModelVerified': False,
              'providerConnection': 'NOT_INSTALLED_OR_CONNECTED_AT_CHECK',
              'costEstimate': None, 'newPaidSubmissions': 0,
              'firstPilot': preferred[0], 'followingEntities': preferred[1:],
              'maximumPaidJobsInFlightAfterPilot': 2,
              'gatePolicy': 'Pass the newly selected m001 identity before releasing further paid jobs.',
              'records': records}
    return intake, audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=WORKSPACE / '自創腳色')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    destination = args.output.resolve()
    if not destination.is_relative_to(PACK.resolve()) or destination.exists():
        raise ValueError('OUTPUT_MUST_BE_A_NEW_DIRECTORY_UNDER_CHARACTER_PACK')
    intake, audit = build(args.source)
    destination.mkdir(parents=True)
    for name, data in [('selection-lock.json', intake), ('storage-audit.json', audit)]:
        with (destination / name).open('x', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
    print(json.dumps({'output': destination.as_posix(), 'selectedConcepts': audit['selectedConcepts'],
                      'totalEntities': len(intake['records']), 'paidSubmissions': 0}, ensure_ascii=False))


if __name__ == '__main__':
    main()
