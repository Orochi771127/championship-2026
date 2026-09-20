"""Validate independent cm08 frame-to-cell selection and existing placement plans."""
import importlib.util
import itertools
import json
from pathlib import Path
import subprocess
from PIL import Image,ImageChops,ImageFilter,ImageDraw
from lib.cage_object_animation_contract import assert_unchanged,sha
from lib.ydij_map_formats import composite_rendered_object_placements

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT=WORK/'opm-meadow-v1'
FID='field_cm08_01'
loader=importlib.util.spec_from_file_location('meadow_seams',ROOT/'scripts/check-cage-seams.py')
seams=importlib.util.module_from_spec(loader);loader.loader.exec_module(seams)


def read(path):return json.loads(path.read_text(encoding='utf8'))


def select_cells(contract,frames):
    if len(frames)!=len(contract['objects']):raise ValueError('FRAME_SELECTION_COUNT')
    result=[]
    for o,index in zip(contract['objects'],frames):
        if type(index) is not int or not 0<=index<len(o['frames']):raise ValueError('FRAME_SELECTION_RANGE')
        result.append(o['frames'][index]['cellId'])
    return result


def build():
    c=read(OUT/'object-animation-contract.json');assert_unchanged(ROOT,c)
    states=[]
    for cell_id in (0,1):
        folder=OUT/'seam-v3/fields'/FID
        if cell_id:folder=folder/'animation/01'
        m=read(folder/'modular-manifest.json');spec=read(folder/'spec.json')
        if m['runtimeEligible'] is not False or m['sourceCellId']!=cell_id:raise ValueError('AUTHORITY_OR_CELL_DRIFT')
        if m['generation']['clockHz'] is not None:raise ValueError('UNVERIFIED_CLOCK')
        for key,file in [('producerSha256','build-cage-meadow.py'),('reusedGardenScriptSha256','build-cage-garden-higgsfield.py'),('scriptSha256','build-cage-base3d.py')]:
            if m['generation'][key].lower()!=sha(ROOT/'scripts'/file):raise ValueError('STALE_PRODUCER')
        if m['sourceSpecSha256'].lower()!=sha(folder/'spec.json'):raise ValueError('SPEC_HASH_DRIFT')
        if spec!=read(WORK/'fields'/FID/'spec.json'):raise ValueError('SPEC_DRIFT')
        if len(m['objects'])!=len(c['objects']):raise ValueError('OBJECT_COUNT_DRIFT')
        report=read(folder/'render-report.json')
        if report['hexFloorMeshNative']!=report['hexFootprint']['outline']:raise ValueError('HEX_GEOMETRY_DRIFT')
        if report['hexFootprint']['shapeMask']!=11:raise ValueError('HEX_MASK_DRIFT')
        images=[]
        for r in [m['core'],*m['objects']]:
            p=(folder/r['src']).resolve()
            if not p.is_relative_to(folder.resolve()):raise ValueError('PATH_ESCAPE')
            if sha(p)!=r['sha256'].lower():raise ValueError('IMAGE_HASH_DRIFT')
            im=Image.open(p).convert('RGBA');images.append(im)
        if images[0].size!=(960,800):raise ValueError('CORE_SIZE_DRIFT')
        objects=[]
        for r,source,im in zip(m['objects'],c['objects'],images[1:]):
            if r['sourceOrdinal']!=source['order']:raise ValueError('ORDER_DRIFT')
            for key in ('sequenceId','placement','pivot','size','horizontalFlip','verticalFlip'):
                if r[key]!=source[key]:raise ValueError('OBJECT_BINDING_DRIFT')
            if im.size!=(64,64) or not im.getchannel('A').getbbox() or im.getchannel('A').getextrema()[0]!=0:raise ValueError('CELL_ALPHA_OR_SIZE')
            objects.append({**r,'image':im,'placement':[v*4 for v in r['placement']],'pivot':[v*4 for v in r['pivot']]})
        states.append((images[0],objects))
    for i in range(2):
        diff=ImageChops.difference(states[0][1][i]['image'],states[1][1][i]['image'])
        if not any(b.getbbox() for b in diff.split()):raise ValueError('FROZEN_CELL')
        diff.close()
    plans=json.loads(subprocess.check_output(['node','--input-type=module','-e',
        "import {cageSeamReviewPlans} from './scripts/lib/cage-authoring-geometry.mjs';console.log(JSON.stringify(cageSeamReviewPlans([7],false)));"],cwd=ROOT))
    common={fid:seams.proof.compose_modular_pack(WORK/'seam-v3/fields'/fid)[2] for fid in ('field_cm28_01','field_cm29_01')}
    out=OUT/'review';out.mkdir(exist_ok=True)
    rows=[];placements=[];sheet=Image.new('RGB',(960,960),(22,39,34));draw=ImageDraw.Draw(sheet)
    for ordinal,frames in enumerate(itertools.product(range(2),range(3))):
        cells=select_cells(c,frames);core=states[cells[0] if cells[0]==cells[1] else 0][0]
        image=composite_rendered_object_placements(core,[states[cell][1][i] for i,cell in enumerate(cells)])
        coverage=seams.proof.modular_ground_coverage(spec,image)
        if not coverage['pass']:raise ValueError('GROUND_HOLE')
        name=f'frames-{frames[0]}{frames[1]}.png';image.save(out/name)
        rows.append({'frames':list(frames),'cells':cells,'file':name,'sha256':sha(out/name),'ground':coverage})
        thumb=image.copy();thumb.thumbnail((440,280));x=20+(ordinal%2)*480;y=30+(ordinal//2)*320
        sheet.paste(thumb,(x,y),thumb);draw.text((x,y-20),f'frames {frames} -> cells {cells}',fill='white');thumb.close()
        baselines={};saved=False
        for scenario in plans['scenarios']:
            assembled=seams.compose(scenario['plan'],{**common,FID:image})
            if scenario['id'].startswith('empty-'):
                baselines[scenario['unlockedCount']]=assembled.getchannel('A').point(lambda v:255 if v==255 else 0).filter(ImageFilter.MinFilter(5))
            else:
                holes=ImageChops.multiply(baselines[scenario['unlockedCount']],assembled.getchannel('A').point(lambda v:255 if v<250 else 0))
                count=holes.histogram()[255];holes.close()
                if count:raise ValueError('PLACEMENT_ALPHA_HOLE')
                placements.append({'id':scenario['id'],'frames':list(frames),'alphaHoles':count})
                if not saved:assembled.save(out/f'assembled-{frames[0]}{frames[1]}.png');saved=True
            assembled.close()
        for im in baselines.values():im.close()
        image.close()
    # Repeated sequence cells must retain identical art, not an invented third pose.
    if rows[0]['sha256']!=rows[2]['sha256'] or rows[3]['sha256']!=rows[5]['sha256']:raise ValueError('REPEATED_CELL_DRIFT')
    sheet.save(out/'contact-sheet.png');sheet.close()
    for core,objects in states:
        core.close()
        for o in objects:o['image'].close()
    for im in common.values():im.close()
    result={'status':'PASS_OFFLINE_CELL_BANK_ONLY','fieldId':FID,'outputs':rows,'placements':placements,
            'clockHz':None,'runtimeEligible':False,'fullCageCompletion':False,
            'limits':['No verified OPM update clock or loop interpretation','Mixed cells use state-zero shadows','No normal-game animation or actor occlusion acceptance']}
    (out/'report.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':result['status'],'combinations':len(rows),'placementChecks':len(placements)}))
    return result


if __name__=='__main__':build()
