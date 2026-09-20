"""Validate cm17/cm06 cell banks, exact bindings, coverage and placement seams."""
import importlib.util
import json
from pathlib import Path
import subprocess
from PIL import Image,ImageChops,ImageDraw,ImageFilter
from lib.cage_object_animation_contract import assert_unchanged,sha
from lib.ydij_map_formats import composite_rendered_object_placements

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT=WORK/'opm-care-lab-v1'
FIELDS=('field_cm17_01','field_cm06_01')
loader=importlib.util.spec_from_file_location('care_seams',ROOT/'scripts/check-cage-seams.py')
seams=importlib.util.module_from_spec(loader);loader.loader.exec_module(seams)


def read(path):return json.loads(Path(path).read_text(encoding='utf8'))


def cell_folder(fid,cell_id):
    base=OUT/'seam-v3/fields'/fid
    return base if cell_id==0 else base/'animation'/f'{cell_id:02d}'


def selections(contract):
    seq_frames={}
    for obj in contract['objects']:
        seq_frames.setdefault(obj['sequenceId'],len(obj['frames']))
        if seq_frames[obj['sequenceId']]!=len(obj['frames']):raise ValueError('SHARED_SEQUENCE_LENGTH_DRIFT')
    rows=[{sid:0 for sid in seq_frames}]
    for sid,count in seq_frames.items():
        for frame in range(1,count):rows.append({**rows[0],sid:frame})
    last={sid:count-1 for sid,count in seq_frames.items()}
    if last not in rows:rows.append(last)
    return rows


def load_field(fid):
    contract=read(OUT/'fields'/fid/'object-animation-contract.json');assert_unchanged(ROOT,contract)
    spec=read(WORK/'fields'/fid/'spec.json')
    cells=sorted({f['cellId'] for o in contract['objects'] for f in o['frames']});states={}
    for cell_id in cells:
        folder=cell_folder(fid,cell_id);m=read(folder/'modular-manifest.json');report=read(folder/'render-report.json')
        if m['sourceCellId']!=cell_id or m['runtimeEligible'] is not False:raise ValueError('CELL_AUTHORITY_DRIFT')
        if m['generation']['clockHz'] is not None:raise ValueError('UNVERIFIED_CLOCK')
        for key,path in [('producerSha256',ROOT/'scripts/build-cage-care-batch.py'),
                         ('careAuthoringSha256',ROOT/'scripts/lib/cage_care_authoring.py'),
                         ('scriptSha256',ROOT/'scripts/build-cage-base3d.py')]:
            if m['generation'][key].lower()!=sha(path):raise ValueError('STALE_PRODUCER')
        if report['hexFloorMeshNative']!=report['hexFootprint']['outline']:raise ValueError('HEX_MESH_DRIFT')
        if report['sourceRastersLoaded'] is not False or report['runtimeEligible'] is not False:raise ValueError('SOURCE_OR_RUNTIME_DRIFT')
        core_path=folder/m['core']['src']
        if sha(core_path)!=m['core']['sha256'].lower():raise ValueError('CORE_HASH_DRIFT')
        core=Image.open(core_path).convert('RGBA')
        if core.size!=tuple(spec['worldSize']):raise ValueError('CORE_SIZE_DRIFT')
        objects=[]
        if len(m['objects'])!=len(contract['objects']):raise ValueError('OBJECT_COUNT_DRIFT')
        for row,source in zip(m['objects'],contract['objects']):
            if row['sourceOrdinal']!=source['order']:raise ValueError('ORDER_DRIFT')
            for key in ('sequenceId','size','placement','pivot','horizontalFlip','verticalFlip'):
                if row[key]!=source[key]:raise ValueError('BINDING_DRIFT')
            path=(folder/row['src']).resolve()
            if not path.is_relative_to(folder.resolve()):raise ValueError('PATH_ESCAPE')
            if sha(path)!=row['sha256'].lower():raise ValueError('OBJECT_HASH_DRIFT')
            image=Image.open(path).convert('RGBA')
            if image.size!=(source['size'][0]*4,source['size'][1]*4):raise ValueError('OBJECT_SIZE_DRIFT')
            if not image.getchannel('A').getbbox() or image.getchannel('A').getextrema()[0]!=0:raise ValueError('OBJECT_ALPHA_DRIFT')
            objects.append({**row,'image':image,'placement':[v*4 for v in row['placement']],
                            'pivot':[v*4 for v in row['pivot']]})
        states[cell_id]=(core,objects)
    # Every authored animated cell used by an object must differ from its siblings.
    for i,obj in enumerate(contract['objects']):
        unique=[]
        for f in obj['frames']:
            if f['cellId'] not in unique:unique.append(f['cellId'])
        for a,b in zip(unique,unique[1:]):
            diff=ImageChops.difference(states[a][1][i]['image'],states[b][1][i]['image'])
            changed=any(band.getbbox() for band in diff.split());diff.close()
            if not changed:raise ValueError('FROZEN_ANIMATED_CELL')
    return spec,contract,states


def build():
    out=OUT/'review';out.mkdir(exist_ok=True)
    cmd="import {cageSeamReviewPlans} from './scripts/lib/cage-authoring-geometry.mjs';console.log(JSON.stringify(cageSeamReviewPlans([5,16],false)));"
    plans=json.loads(subprocess.check_output(['node','--input-type=module','-e',cmd],cwd=ROOT))
    common={fid:seams.proof.compose_modular_pack(WORK/'seam-v3/fields'/fid)[2] for fid in ('field_cm28_01','field_cm29_01')}
    report={'status':'PASS_OFFLINE_CELL_BANK_ONLY','fields':{},'clockHz':None,'runtimeEligible':False,
            'fullCageCompletion':False,'humanApproved':False,
            'limits':['Raw OPM ticks retained; update cadence and loop semantics unverified.',
                      'Mixed cells use cell-zero baked shadows.',
                      'No normal-game animation, actor occlusion, mobile or publication acceptance.']}
    for fid in FIELDS:
        spec,contract,states=load_field(fid);definition=spec['definitionIndex']
        scenarios=[p for p in plans['scenarios'] if p['id'].startswith('empty-') or p['id'].startswith(f'definition-{definition}-')]
        rows=[];placement_checks=0;previews=[]
        for selection in selections(contract):
            cells=[o['frames'][selection[o['sequenceId']]]['cellId'] for o in contract['objects']]
            objects=[states[cell][1][i] for i,cell in enumerate(cells)]
            image=composite_rendered_object_placements(states[0][0],objects)
            coverage=seams.proof.modular_ground_coverage(spec,image)
            if not coverage['pass']:raise ValueError('GROUND_HOLE')
            code='-'.join(f'{sid}.{frame}' for sid,frame in sorted(selection.items()))
            name=f'{fid}-{code}.png';image.save(out/name)
            rows.append({'selection':selection,'cells':cells,'file':name,'sha256':sha(out/name),'ground':coverage})
            baselines={};saved=False
            for scenario in scenarios:
                assembled=seams.compose(scenario['plan'],{**common,fid:image})
                if scenario['id'].startswith('empty-'):
                    baselines[scenario['unlockedCount']]=assembled.getchannel('A').point(lambda v:255 if v==255 else 0).filter(ImageFilter.MinFilter(5))
                else:
                    holes=ImageChops.multiply(baselines[scenario['unlockedCount']],assembled.getchannel('A').point(lambda v:255 if v<250 else 0))
                    count=holes.histogram()[255];holes.close();placement_checks+=1
                    if count:raise ValueError('PLACEMENT_ALPHA_HOLE')
                    if not saved:assembled.save(out/f'assembled-{fid}-{len(rows)-1:02d}.png');saved=True
                assembled.close()
            for base in baselines.values():base.close()
            previews.append((code,image.copy()));image.close()
        width=640;cell_h=340;sheet=Image.new('RGB',(width*2,cell_h*((len(previews)+1)//2)),(18,36,34));draw=ImageDraw.Draw(sheet)
        for index,(code,image) in enumerate(previews):
            image.thumbnail((width-30,cell_h-40));x=(index%2)*width+15;y=(index//2)*cell_h+28
            sheet.paste(image,(x,y),image);draw.text((x,7+(index//2)*cell_h),code,fill='white');image.close()
        sheet_path=out/f'{fid}-contact-sheet.jpg';sheet.save(sheet_path,quality=91);sheet.close()
        report['fields'][fid]={'cells':len(states),'selections':rows,'placementChecks':placement_checks,
            'contactSheet':sheet_path.name,'contactSheetSha256':sha(sheet_path)}
        for core,objects in states.values():
            core.close()
            for obj in objects:obj['image'].close()
    for image in common.values():image.close()
    (out/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'fields':{k:{'cells':v['cells'],'selections':len(v['selections']),
        'placementChecks':v['placementChecks']} for k,v in report['fields'].items()}}))
    return report


if __name__=='__main__':build()
