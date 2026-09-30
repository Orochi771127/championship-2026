"""Compact three-stage continuation ledger, derived from real modular artifacts."""
import importlib.util
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
FIRST={'field_cm01_01','field_cm02_01','field_cm16_01','field_cm28_01','field_cm29_01'}
sys.path.insert(0,str(ROOT/'scripts'))
loader=importlib.util.spec_from_file_location('stage_proof',ROOT/'scripts/build-cage-authoring-proof.py')
proof=importlib.util.module_from_spec(loader);loader.loader.exec_module(proof)
hex_loader=importlib.util.spec_from_file_location('hex_audit',ROOT/'scripts/check-cage-hex-footprints.py')
hex_audit=importlib.util.module_from_spec(hex_loader);hex_loader.loader.exec_module(hex_audit)


def phase(field):
    if field['id'] in FIRST:return 1
    return 3 if len(field['frames'])>1 or any(o['sequenceFrameCount']>1 for o in field['objects']) else 2


def build():
    rows=[]
    for field in proof.read(WORK/'catalog.json')['fields']:
        pack=WORK/'seam-v3/fields'/field['id']
        row={'fieldId':field['id'],'name':field['name'],'stage':phase(field),
             'runtimeFrameCount':len(field['frames']),
             'animatedObjectSequences':sorted({o['sequenceId'] for o in field['objects'] if o['sequenceFrameCount']>1}),
             'status':'NOT_PRODUCED','humanApproved':False}
        if (pack/'modular-manifest.json').is_file():
            try:
                manifest,spec,image=proof.compose_modular_pack(pack)
                report=proof.read(pack/'previews/modular-proof.json')
                if report['status']!='ASSEMBLY_PASS_ART_REVIEW_REQUIRED':raise ValueError('PROOF_NOT_PASSING')
                expected=report['outputs']['composite-hd4x.png']
                if report['sourceManifestSha256']!=proof.digest(pack/'modular-manifest.json') or expected!=proof.digest(pack/'previews/composite-hd4x.png'):
                    raise ValueError('STALE_PROOF')
                if not proof.modular_ground_coverage(spec,image)['pass']:raise ValueError('GROUND_HOLE')
                image.close()
                hex_result=hex_audit.audit(spec,manifest,proof.read(pack/'render-report.json'))
                if len(spec['frames'])>1:
                    if len(report.get('animationFrames',[]))!=len(spec['frames']):raise ValueError('ANIMATION_PROOF_MISSING')
                    for index in range(len(spec['frames'])):
                        _,_,image=proof.compose_modular_pack(pack,index)
                        try:
                            if not proof.modular_ground_coverage(spec,image)['pass']:raise ValueError('ANIMATION_GROUND_HOLE')
                            name=f'frame-{index:02d}.png'
                            if proof.digest(pack/'previews'/name)!=report['outputs'][name]:raise ValueError('STALE_ANIMATION_PROOF')
                            phase_pack=pack if index==0 else pack/'animation'/f'{index:02d}'
                            hex_audit.audit(spec,manifest,proof.read(phase_pack/'render-report.json'))
                        finally:image.close()
                row.update(status='LOCAL_CANDIDATE_VERIFIED_NOT_FINAL_ART',sha256=expected,hexCells=hex_result['cells'])
            except (OSError,ValueError,KeyError) as exc:
                row.update(status='RECHECK_REQUIRED',reason=str(exc))
        rows.append(row)
    stages=[{'stage':i,'total':sum(r['stage']==i for r in rows),
             'verifiedCandidates':sum(r['stage']==i and r['status']=='LOCAL_CANDIDATE_VERIFIED_NOT_FINAL_ART' for r in rows)} for i in (1,2,3)]
    result={'schemaVersion':1,'scope':'37 independent cages including structural lid',
            'stages':stages,'fields':rows,'runtimeEligible':False,'shippingReady':False,
            'deliveryOrder':['Complete all 37 base candidates','Validate assembled full scene','Refine each cage and recheck neighbors'],
            'stageMeaning':'Historical production sub-batches, not full-scene or final-polish acceptance',
            'fullSceneAccepted':False,'finalPolishAccepted':False,
            'rules':['Sports lower area is clay, not waiting-room checker.',
                     'Preserve native canvas, placements, pivots, crop, collision and timing.',
                     'Stage 3 includes animated object sequences even when runtime currently has only one flattened frame.',
                     'Candidate counts are not human art acceptance or publication approval.']}
    (WORK/'three-stage-progress.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps(stages))
    return result


if __name__=='__main__':build()
