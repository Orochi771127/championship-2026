"""Validate individually reviewed briefs against all 224 actual source witnesses."""
import argparse
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('identity_queue_review',ROOT/'scripts/review-character-pixel-settings.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
BASE=r.PACK/'pixel-v2'
FAMILIES={'FELINE','CANINE','BIG_EYE','DRAGONFOLK','BEASTFOLK','OTHER_WITH_REASON'}

def validate_execution_queue(queue, source_records):
    ids=[e['entityId'] for e in queue];expected={e['entityId'] for e in source_records}
    if len(expected)!=224 or len(ids)!=224 or len(set(ids))!=224 or set(ids)!=expected:
        raise ValueError('Execution queue must retain every actual identity exactly once')

def validate_briefs(records, source_records):
    expected={e['entityId']:e for e in source_records}
    ids=[e['entityId'] for e in records]
    if len(expected)!=224 or len(ids)!=224 or len(set(ids))!=224 or set(ids)!=set(expected):
        raise ValueError('Identity design queue must cover every actual entity exactly once')
    for e in records:
        if e.get('sourceImageSha256')!=expected[e['entityId']]['sourceImageSha256']:raise ValueError('Stale source witness')
        if e.get('chosenFamily') not in FAMILIES:raise ValueError('Unknown design family')
        if e.get('sourceVisualReviewed') is not True or e.get('artStatus')!='BRIEF_ONLY_NOT_DRAWN':raise ValueError('Brief must distinguish source review from new drawing')
        for key in ['observedBody','designName','rationale','risk']:
            if not isinstance(e.get(key),str) or not e[key].strip():raise ValueError(f'Missing per-entity {key}')
        for key,minimum in [('fixedTraits',3),('changedRegions',1),('preservedMotion',1),('allowedContourChanges',0)]:
            values=e.get(key)
            if not isinstance(values,list) or not all(isinstance(v,str) and v.strip() for v in values) or len(set(values))<minimum:
                raise ValueError(f'Incomplete {key}')

def build():
    source=r.read(BASE/'identity-source-survey/index.json')['records']
    records=[]
    for file in sorted((BASE/'identity-briefs').glob('*.json')):records.extend(r.read(file))
    validate_briefs(records,source)
    by_id={e['entityId']:e for e in records}
    queue=r.read(BASE/'production-queue.json')['records'];result=[]
    validate_execution_queue(queue,source)
    for entry in queue:
        e=by_id[entry['entityId']]
        result.append({**e,'queueOrdinal':entry['queueOrdinal'],'packet':entry['packet']})
    families={family:sum(e['chosenFamily']==family for e in result) for family in sorted(FAMILIES)}
    return {'schemaVersion':1,'directionVersion':r.IDENTITY_DIRECTION_VERSION,'sourceWitnessIndexSha256':r.digest((BASE/'identity-source-survey/index.json').read_bytes()),
            'counts':{'required':224,'sourceWitnessReviewed':224,'identityBriefs':224,'families':families},
            'reviewScope':'One actual source witness per entity reviewed by assigned designer; complete poses and motion are not reviewed by this queue.',
            'statusMeaning':'A brief is not a newly drawn appearance, representative-pose approval, or runtime replacement. Drawing progress comes from actual setting files and reviews.',
            'records':result}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');a=parser.parse_args()
    data=build();payload=r.encoded(data);path=BASE/'identity-design-queue.json'
    if a.check:
        if not path.exists() or path.read_bytes()!=payload:raise SystemExit('Identity queue drift')
    else:path.write_bytes(payload)
    print(data['counts'])
