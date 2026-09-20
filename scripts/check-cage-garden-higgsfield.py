"""Offline cm32 state/placement checks. No timing inference or runtime promotion."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageChops, ImageFilter
from lib.cage_object_animation_contract import extract, assert_unchanged, sha
from lib.ydij_map_formats import composite_rendered_object_placements

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT=WORK/'higgsfield-garden-v1'
FID='field_cm32_01'
loader=importlib.util.spec_from_file_location('garden_seams',ROOT/'scripts/check-cage-seams.py')
seams=importlib.util.module_from_spec(loader);loader.loader.exec_module(seams)


def read(path):return json.loads(path.read_text(encoding='utf8'))


def load_state(index):
    if type(index) is not int or index not in (0,1):raise ValueError('UNKNOWN_MANUAL_STATE')
    folder=OUT/'seam-v3/fields'/FID
    if index:folder=folder/'animation/01'
    manifest=read(folder/'modular-manifest.json')
    spec=read(folder/'spec.json')
    contract=read(OUT/'object-animation-contract.json')
    assert_unchanged(ROOT,contract)
    if manifest['manualStateIndex']!=index or manifest['runtimeEligible'] is not False:
        raise ValueError('STATE_OR_AUTHORITY_DRIFT')
    if manifest['generation']['animationClockHz'] is not None:
        raise ValueError('UNVERIFIED_CLOCK')
    if manifest['generation']['gardenScriptSha256']!=sha(ROOT/'scripts/build-cage-garden-higgsfield.py'):
        raise ValueError('STALE_PRODUCER')
    if len(manifest['objects'])!=7:raise ValueError('OBJECT_COUNT_DRIFT')
    for k,r in enumerate(manifest['objects']):
        expected=contract['objects'][k]
        for key in ('sequenceId','size','pivot','placement','horizontalFlip','verticalFlip'):
            if r[key]!=expected[key]:raise ValueError('OBJECT_BINDING_DRIFT')
        if r['sourceOrdinal']!=expected['order']:raise ValueError('SOURCE_ORDER_DRIFT')
    for r in [manifest['core'],*manifest['objects']]:
        if sha(folder/r['src']).upper()!=r['sha256'].upper():raise ValueError('RASTER_HASH_DRIFT')
    core=Image.open(folder/manifest['core']['src']).convert('RGBA')
    if core.size!=(384,448):raise ValueError('CORE_SIZE_DRIFT')
    objects=[]
    for r in manifest['objects']:
        cell=Image.open(folder/r['src']).convert('RGBA')
        if cell.size!=(64,64) or not cell.getchannel('A').getbbox():raise ValueError('CELL_DIMENSION_OR_EMPTY')
        if cell.getchannel('A').getextrema()[0]!=0:raise ValueError('OPAQUE_CELL_BACKGROUND')
        objects.append({**r,'image':cell,'placement':[v*4 for v in r['placement']],
                        'pivot':[v*4 for v in r['pivot']]})
    return spec,core,objects


def build():
    out=OUT/'review';out.mkdir(exist_ok=True)
    states=[load_state(i) for i in (0,1)]
    cmd="import {cageSeamReviewPlans} from './scripts/lib/cage-authoring-geometry.mjs';console.log(JSON.stringify(cageSeamReviewPlans([29],false)));"
    plans=json.loads(subprocess.check_output(['node','--input-type=module','-e',cmd],cwd=ROOT))
    common={}
    for fid in ('field_cm28_01','field_cm29_01'):
        common[fid]=seams.proof.compose_modular_pack(WORK/'seam-v3/fields'/fid)[2]
    rows=[];outputs=[]
    for a,b in ((0,0),(1,1),(0,1),(1,0)):
        # Mixed states exercise independent sequences, not a claimed shared phase.
        objects=[states[a if r['sequenceId']==0 else b][2][i] for i,r in enumerate(states[0][2])]
        core_state=a if a==b else 0
        image=composite_rendered_object_placements(states[core_state][1],objects)
        coverage=seams.proof.modular_ground_coverage(states[0][0],image)
        if not coverage['pass']:raise ValueError('GROUND_HOLE')
        name=f'sequences-{a}{b}.png';image.save(out/name)
        outputs.append({'sequence0State':a,'sequence1State':b,'file':name,'sha256':sha(out/name),'ground':coverage})
        images={**common,FID:image};baseline={}
        for scenario in plans['scenarios']:
            assembled=seams.compose(scenario['plan'],images)
            if scenario['id'].startswith('empty-'):
                baseline[scenario['unlockedCount']]=assembled.getchannel('A').point(lambda v:255 if v==255 else 0).filter(ImageFilter.MinFilter(5))
            else:
                holes=ImageChops.multiply(baseline[scenario['unlockedCount']],assembled.getchannel('A').point(lambda v:255 if v<250 else 0))
                rows.append({'id':scenario['id'],'states':[a,b],'alphaHoles':holes.histogram()[255]})
                if not any(r['states']==[a,b] for r in rows[:-1]):assembled.save(out/f'assembled-{a}{b}.png')
                holes.close()
            assembled.close()
        for im in baseline.values():im.close()
        image.close()
    changed=[]
    for i in range(7):
        diff=ImageChops.difference(states[0][2][i]['image'],states[1][2][i]['image'])
        changed.append(any(band.getbbox() for band in diff.split()));diff.close()
    if not all(changed):raise ValueError('FROZEN_OBJECT_STATE')
    for _,core,objects in states:
        core.close()
        for obj in objects:obj['image'].close()
    for im in common.values():im.close()
    report={'status':'PASS_OFFLINE_STATES_ONLY' if all(r['alphaHoles']==0 for r in rows) else 'SEAM_REPAIR_REQUIRED',
            'fieldId':FID,'objectExports':14,'objectsWithDistinctStates':sum(changed),
            'outputs':outputs,'scenarios':rows,'clockHz':None,'runtimeEligible':False,
            'humanApproved':False,'fullCageCompletion':False,
            'limits':['Raw 46 ticks retained; milliseconds and loop-mode semantics unverified.',
                      'Mixed-state review uses state-zero baked shadows; dynamic shadow fidelity not accepted.',
                      'No normal-game object animation or foreground occlusion integration.',
                      'Not final art, physical mobile acceptance or publication.']}
    (out/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'scenarios':len(rows),'holes':sum(r['alphaHoles'] for r in rows),'objectExports':14}))
    return report


if __name__=='__main__':raise SystemExit(0 if build()['status']=='PASS_OFFLINE_STATES_ONLY' else 1)
