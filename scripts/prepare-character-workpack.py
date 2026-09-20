"""Build offline m001 review and generation requests from verified preflight.

No uploads, provider calls, runtime edits or approval promotion. Never overwrites.
"""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('character_preflight', ROOT / 'scripts/prepare-character-production.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
OUTPUT = P.WORK / 'workpack-r03'
CHECKS = ('identity', 'pose', 'eyes', 'mouth', 'occlusion', 'restraint', 'origin', 'readability64')


def references(contract):
    result = {}
    for side, bank in contract['sides'].items():
        for full_key in bank['frameKeys']:
            result[full_key.split('/', 1)[1]] = []
        for sequence in bank['sequences']:
            for frame in sequence['frames']:
                key = f"{side}/cell_{frame['cell']:03d}"
                P.require(key in result, 'UNDECLARED_CELL')
                P.require(frame['texture'] == f'{P.ENTITY}/{key}', 'TEXTURE_CELL_MISMATCH')
                result[key].append({'side': side, 'sequenceId': sequence['id'],
                                    'frameIndex': frame['frameIndex'], 'ticks': frame['ticks'],
                                    'playbackMode': sequence['playbackMode'],
                                    'loopStartFrame': sequence['loopStartFrame']})
    return result


def validate_reviews(rows, slots):
    keys = [r['key'] for r in rows]
    P.require(len(keys) == len(set(keys)) and set(keys) == set(slots), 'REVIEW_COVERAGE_DRIFT')
    for row in rows:
        P.require(row['productionStatus'] in ('PENDING', 'ACCEPTED', 'REJECTED'), 'INVALID_PRODUCTION_STATUS')
        P.require(row['canonical'] == slots[row['key']]['canonical'] and
                  row['sameAsCell'] == slots[row['key']]['sameAsCell'], 'REVIEW_REUSE_DRIFT')
        P.require(row['sourceRgbaSha256'] == slots[row['key']]['nativeRgbaSha256'], 'REVIEW_SOURCE_DRIFT')
        P.require(set(row['checks']) == set(CHECKS), 'REVIEW_CHECKS_MISSING')
        for check in row['checks'].values():
            P.require(check['status'] in ('PENDING', 'PASS', 'FAIL', 'NOT_APPLICABLE'), 'INVALID_REVIEW_STATUS')
            if check['status'] != 'PENDING':
                P.require(bool(check.get('evidence')) and bool(check.get('reviewer')), 'REVIEW_EVIDENCE_REQUIRED')
        if row['productionStatus'] == 'ACCEPTED':
            P.require(bool(row.get('outputSha256')), 'REVIEW_OUTPUT_REQUIRED')
            P.require(all(c['status'] in ('PASS', 'NOT_APPLICABLE') for c in row['checks'].values()),
                      'INCOMPLETE_VISUAL_REVIEW')


def make_files(plan, contract, setting):
    P.verify_motion(P.read(ROOT / plan['motionContractPath']), contract)
    P.require(P.sha(P.encoded(contract)) == plan['motionContractSha256'], 'CONTRACT_HASH_DRIFT')
    refs = references(contract)
    P.require(set(refs) == set(plan['slots']), 'SLOT_COVERAGE_DRIFT')
    # Observable features only. These are not game-action or emotional labels.
    observations = {
        'main/cell_011': 'Mouth relatively closed compared with main/cell_012.',
        'main/cell_012': 'Wide open dark mouth cavity; body contour changes with mouth.',
        'main/cell_053': 'Mouth relatively closed compared with main/cell_054.',
        'main/cell_054': 'Wide open mouth with vertically stretched body.',
    }
    rows = []
    for key, slot in plan['slots'].items():
        rows.append({'key': key, 'canonical': slot['canonical'], 'sameAsCell': slot['sameAsCell'],
                     'sourceRgbaSha256': slot['nativeRgbaSha256'],
                     'visibleBounds': slot['visibleBounds'], 'nativeBounds': slot['nativeBounds'],
                     'sourceTranslationFromCanonical': slot['sourceTranslationFromCanonical'],
                     'sequenceReferences': refs[key],
                     'sourceObservation': observations.get(key),
                     'observationBasis': 'ASSEMBLED_SHEET_VISUAL_INSPECTION' if key in observations else 'PENDING',
                     'actionSemantics': 'UNKNOWN_REQUIRES_TRACE',
                     'restraintSemantics': 'PENDING_PER_CELL_INSPECTION_NOT_M441_NUMBER_MAPPING',
                     'productionStatus': 'PENDING', 'outputSha256': None,
                     'checks': {name: {'status': 'PENDING', 'evidence': None, 'reviewer': None} for name in CHECKS}})
    validate_reviews(rows, plan['slots'])
    provider = {'provider': 'Higgsfield', 'model': 'gpt_image_2_5', 'variant': 'sunburst',
                'quality': 'high', 'resolution': '1k', 'background': 'transparent', 'aspectRatio': '1:1',
                'actualModelSnapshot': 'UNKNOWN_UNTIL_PROVIDER_RECEIPT'}
    files = {}
    requests = []
    reference_candidates = [
        {'path': (P.WORK / 'generated' / row['image']).relative_to(ROOT).as_posix(),
         'sha256': P.sha((P.WORK / 'generated' / row['image']).read_bytes()),
         'status': 'EXISTING_SETTING_PROOF_NOT_FULL_MOTION_APPROVAL'}
        for row in plan['proofs'] if row['key'] in ('main/cell_000', 'main/cell_060')]
    # Two individually retryable jobs, one paired expression review packet.
    for key in ('main/cell_011', 'main/cell_012'):
        slot = plan['slots'][key]
        prompt = ('Create one original amber gel creature pose, transparent background, no text or layout. '
                  'Use the approved original identity reference, not a commercial character. '
                  'Keep integrated soft gel ear peaks, cream eye surrounds, dark green eyes and amber cheeks. '
                  'No legs, arms, tail, hair tufts or detached ornaments. '
                  f"Required observed face change: {observations[key]} "
                  'Preserve the documented body compression, head direction and detached gel droplets. '
                  'Do not invent emotion, new motion or extra effects. This is a work image for pixel authoring; '
                  'the final output is a 64x64 sprite using one shared origin, not independent auto-centering. ')
        request = {'jobId': f'{P.ENTITY}/{key}', 'slot': key, 'providerSettings': provider,
                   'prompt': prompt, 'originalIdentity': {field: setting[field] for field in
                       ('designVersion', 'features', 'faceRules', 'ornamentRules', 'palette')},
                   'geometry': {'slot': slot, 'shared': plan['geometry']},
                   'sequenceReferences': refs[key],
                   'referencePolicy': 'APPROVED_ORIGINAL_ART_ONLY_NO_ROM_UPLOAD',
                   'referenceCandidates': reference_candidates,
                   'submissionAllowed': False,
                   'blockingGates': ['VISUAL_SOURCE_POSE_REVIEW', 'REFERENCE_SELECTION_REVIEW', 'COST_QUOTE', 'CREDIT_AUTHORIZATION'],
                   'maximumImages': 1, 'automaticRetries': 0}
        request['cacheKey'] = P.sha(P.encoded(request))
        filename = f"requests/{key.replace('/', '-')}.json"
        files[filename] = P.encoded(request)
        requests.append({'jobId': request['jobId'], 'cacheKey': request['cacheKey'], 'request': filename})
    files['cell-review.json'] = P.encoded({'entityId': P.ENTITY, 'rows': rows})
    files['motion-contract.json'] = P.encoded(contract)
    files['queue.json'] = P.encoded({'entityId': P.ENTITY, 'packetId': 'm001-expression-011-012-r01',
                                     'jobs': requests, 'maxImages': 2, 'automaticRetries': 0,
                                     'creditQuote': None, 'creditsAuthorized': 0,
                                     'networkCallsMade': 0, 'nextEntityAllowed': False,
                                     'runtimeEligible': False, 'fullMotionValidated': False})
    lines = ['# m001 逐格審核清單', '',
             '來源觀察不是成品驗收。所有原創輸出仍需逐格審核；不把未知語意推定成已確認動作。', '',
             '| Cell | Canonical | Sequence IDs | 來源觀察 |', '|---|---|---|---|']
    for row in rows:
        ids = ', '.join(str(i) for i in sorted({r['sequenceId'] for r in row['sequenceReferences']}))
        lines.append(f"| {row['key']} | {row['canonical']} | {ids} | {row['sourceObservation'] or '待逐格目視確認'} |")
    files['CELL_REVIEW.md'] = ('\n'.join(lines) + '\n').encode('utf-8')
    files['receipt.json'] = P.encoded({'files': {k: P.sha(v) for k, v in sorted(files.items())},
                                       'builderSha256': P.sha(Path(__file__).read_bytes()),
                                       'preflightSha256': P.sha(P.encoded(plan)),
                                       'settingSha256': P.sha(P.encoded(setting))})
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--review', type=Path, help='Validate an edited review file without writing it')
    args = parser.parse_args()
    preflight_files, plan = P.build(ROOT.parent / 'YDIJ_PRIVATE_ROM_ART_PACK')
    P.SOURCE.publish(preflight_files, P.WORK / 'generated', check=True)
    if args.review:
        validate_reviews(P.read(args.review)['rows'], plan['slots'])
        print('REVIEW_SCHEMA_VALID; does not promote runtime or visual acceptance')
        return
    output = args.output.resolve()
    allowed = (P.WORK.resolve(), (ROOT / '.tmp/character-production').resolve())
    P.require(any(output.is_relative_to(p) and output != p for p in allowed), 'OUTPUT_OUTSIDE_WORK_AREA')
    contract = P.read(ROOT / plan['motionContractPath'])
    setting = P.read(P.PACK / 'pixel-v2/settings' / P.ENTITY / 'setting.json')
    files = make_files(plan, contract, setting)
    P.SOURCE.publish(files, output, args.check)
    print(f'WORKPACK_READY rows=83 sequences=53 paidCalls=0 output={output} check={args.check}')


if __name__ == '__main__':
    main()
