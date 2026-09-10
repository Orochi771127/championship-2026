#!/usr/bin/env python3
"""All-source character redesign queue; evidence coverage is not art completion."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PROGRAM=ROOT/'docs/art/production/characters/appearance-refresh-v1'
PRIORITY=['m201_agumon','m001_zurumon','m226_hagurumon','e000_digitama',
          'm222_tentomon','m228_palmon','m352_peckmon','m431_whamon']
OWNER=dict(zip(PRIORITY[:4],['A','B','B','A']))
DELEGATED=dict(zip(PRIORITY[4:],['A','A','B','A']))
STAGES=['PIXEL_DESIGN_REVIEW','ALL_MASTERS_AUTHORED','ART_REVIEW_PASS',
        'MOTION_PASS','TECHNICAL_PACKAGE_PASS','NORMAL_PATH_PASS','DEFAULT_REPLACED']

def encoded(value):
    return (json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode('utf-8')

def build(catalog,policy):
    entries=catalog['entities']; ids=[e['entityId'] for e in entries]
    if len(ids)!=len(set(ids)) or len(ids)!=policy['verifiedEntityCount']:
        raise ValueError('Source roster duplicate or count drift; reconcile actual identities first')
    if not set(PRIORITY).issubset(ids):
        raise ValueError('Priority entity missing from source')
    ordered=PRIORITY+[e['entityId'] for e in sorted(entries,key=lambda e:e['sourceOrdinal']) if e['entityId'] not in PRIORITY]
    by_id={e['entityId']:e for e in entries};records=[]
    for ordinal,eid in enumerate(ordered):
        e=by_id[eid]
        records.append({'entityId':eid,'kind':e['kind'],'queueOrdinal':ordinal+1,'packet':ordinal//4+1,
            'redesignRequired':True,'automaticDefaultReplacementRequested':True,
            'selectedConcept':OWNER.get(eid,DELEGATED.get(eid)),
            'selectionAuthority':'OWNER' if eid in OWNER else 'OWNER_DELEGATED_ART_DIRECTOR',
            'pixelDesignStatus':'AUTHORING' if eid==PRIORITY[0] else 'PENDING',
            'stages':{s:'PENDING' for s in STAGES},
            'source':{'ordinal':e['sourceOrdinal'],'batch':e['sourceBatch'],'slots':e['slotCount'],
                      'sequences':e['sequenceCount'],'masters':e['uniqueNonblankMasters'],
                      'motionContractSha256':e['motionContractSha256']},
            'promotionMode':'AUTOMATIC_AFTER_VERIFIED_WHOLE_ENTITY_GATES',
            'runtimeEligible':False,'shippingReady':False})
    return {'schemaVersion':2,'programId':'CHARACTER_PIXEL_REFRESH_V2',
        'coverageMode':'ALL_VERIFIED_SOURCE_ENTITIES_NO_SAMPLING',
        'counts':{'entities':len(records),'regular':sum(e['kind']=='digimon' for e in entries),
                  'eggs':sum(e['kind']=='egg' for e in entries),'packets':(len(records)+3)//4,
                  'redesignRequired':len(records),'defaultReplaced':0},
        'statusMeaning':'This queue records requirements, not generated art or passed release gates.',
        'records':records}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    catalog=json.loads((PROGRAM/'generated/catalog.json').read_text(encoding='utf-8'))
    policy=json.loads((PROGRAM/'pixel-v2/policy.json').read_text(encoding='utf-8'))
    result=build(catalog,policy);payload=encoded(result);out=PROGRAM/'pixel-v2/production-queue.json'
    if args.check:
        if not out.exists() or out.read_bytes()!=payload:raise SystemExit('Queue drift')
    else:
        if out.exists() and out.read_bytes()!=payload:
            raise SystemExit('Existing queue differs: preserve production progress; reconcile before replacement')
        out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(payload)
    print(json.dumps({'status':'PASS','counts':result['counts'],'sha256':hashlib.sha256(payload).hexdigest()}))

if __name__=='__main__':main()
