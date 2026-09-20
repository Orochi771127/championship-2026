"""Validate cm15/cm23 cell banks, bindings, coverage and hex-placement seams."""
import importlib.util,json,subprocess
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,ImageFilter
from lib.cage_object_animation_contract import assert_unchanged,sha
from lib.ydij_map_formats import composite_rendered_object_placements

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
OUT=WORK/'opm-industrial-v1';FIELDS=('field_cm15_01','field_cm23_01');DEFINITIONS=(14,22)
PROVENANCE=(('producerSha256',ROOT/'scripts/build-cage-industrial-batch.py'),
            ('industrialAuthoringSha256',ROOT/'scripts/lib/cage_industrial_authoring.py'),
            ('scriptSha256',ROOT/'scripts/build-cage-base3d.py'))
CONTRACT_ASSERT=assert_unchanged;PER_FRAME_GEOMETRY=False
loader=importlib.util.spec_from_file_location('industrial_seams',ROOT/'scripts/check-cage-seams.py')
seams=importlib.util.module_from_spec(loader);loader.loader.exec_module(seams)

def read(path):return json.loads(Path(path).read_text(encoding='utf8'))
def cell_folder(fid,cell_id):
    base=OUT/'seam-v3/fields'/fid
    return base if cell_id==0 else base/'animation'/f'{cell_id:02d}'

def selections(contract):
    counts={}
    for obj in contract['objects']:
        counts.setdefault(obj['sequenceId'],len(obj['frames']))
        if counts[obj['sequenceId']]!=len(obj['frames']):raise ValueError('SHARED_SEQUENCE_LENGTH_DRIFT')
    base={sid:0 for sid in counts};rows=[base]
    for sid,count in counts.items():
        for frame in range(1,count):rows.append({**base,sid:frame})
    last={sid:count-1 for sid,count in counts.items()}
    if last not in rows:rows.append(last)
    return rows

def load_field(fid):
    contract=read(OUT/'fields'/fid/'object-animation-contract.json');CONTRACT_ASSERT(ROOT,contract)
    spec=read(WORK/'fields'/fid/'spec.json');cells=sorted({f['cellId'] for o in contract['objects'] for f in o['frames']});states={}
    for cell_id in cells:
        folder=cell_folder(fid,cell_id);manifest=read(folder/'modular-manifest.json');render=read(folder/'render-report.json')
        if manifest['sourceCellId']!=cell_id or manifest['runtimeEligible'] is not False:raise ValueError('CELL_AUTHORITY_DRIFT')
        if manifest['generation']['clockHz'] is not None:raise ValueError('UNVERIFIED_CLOCK')
        for key,path in PROVENANCE:
            if manifest['generation'][key].lower()!=sha(path):raise ValueError('STALE_PRODUCER')
        if render['hexFloorMeshNative']!=render['hexFootprint']['outline']:raise ValueError('HEX_MESH_DRIFT')
        if render['sourceRastersLoaded'] is not False or render['runtimeEligible'] is not False:raise ValueError('SOURCE_OR_RUNTIME_DRIFT')
        core_path=folder/manifest['core']['src'];core=Image.open(core_path).convert('RGBA')
        if sha(core_path)!=manifest['core']['sha256'].lower() or core.size!=tuple(spec['worldSize']):raise ValueError('CORE_DRIFT')
        if len(manifest['objects'])!=len(contract['objects']):raise ValueError('OBJECT_COUNT_DRIFT')
        objects=[]
        for row,source in zip(manifest['objects'],contract['objects']):
            if row['sourceOrdinal']!=source['order']:raise ValueError('ORDER_DRIFT')
            geometry=next((f for f in source['frames'] if f['cellId']==cell_id),source['frames'][0]) if PER_FRAME_GEOMETRY else source
            for key in ('sequenceId','placement','horizontalFlip','verticalFlip'):
                if row[key]!=source[key]:raise ValueError('BINDING_DRIFT')
            for key in ('size','pivot'):
                if row[key]!=geometry[key]:raise ValueError('FRAME_GEOMETRY_BINDING_DRIFT')
            path=(folder/row['src']).resolve()
            if not path.is_relative_to(folder.resolve()) or sha(path)!=row['sha256'].lower():raise ValueError('OBJECT_PATH_OR_HASH_DRIFT')
            image=Image.open(path).convert('RGBA')
            if image.size!=(geometry['size'][0]*4,geometry['size'][1]*4):raise ValueError('OBJECT_SIZE_DRIFT')
            if not image.getchannel('A').getbbox() or image.getchannel('A').getextrema()[0]!=0:raise ValueError('OBJECT_ALPHA_DRIFT')
            objects.append({**row,'image':image,'placement':[v*4 for v in row['placement']],'pivot':[v*4 for v in row['pivot']]})
        states[cell_id]=(core,objects)
    for index,obj in enumerate(contract['objects']):
        unique=[]
        for frame in obj['frames']:
            if frame['cellId'] not in unique:unique.append(frame['cellId'])
        for a,b in zip(unique,unique[1:]):
            left=states[a][1][index]['image'];right=states[b][1][index]['image']
            if left.size!=right.size:changed=True
            else:
                diff=ImageChops.difference(left,right);changed=any(band.getbbox() for band in diff.split());diff.close()
            if not changed:raise ValueError('FROZEN_ANIMATED_CELL')
    return spec,contract,states

def build():
    review=OUT/'review';review.mkdir(exist_ok=True)
    definitions=json.dumps(list(DEFINITIONS))
    cmd=f"import {{cageSeamReviewPlans}} from './scripts/lib/cage-authoring-geometry.mjs';console.log(JSON.stringify(cageSeamReviewPlans({definitions},false)));"
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
        rows=[];checks=0;previews=[]
        for selection in selections(contract):
            cells=[o['frames'][selection[o['sequenceId']]]['cellId'] for o in contract['objects']]
            objects=[states[cell][1][i] for i,cell in enumerate(cells)]
            image=composite_rendered_object_placements(states[0][0],objects);coverage=seams.proof.modular_ground_coverage(spec,image)
            if not coverage['pass']:raise ValueError('GROUND_HOLE')
            code='-'.join(f'{sid}.{frame}' for sid,frame in sorted(selection.items()));name=f'{fid}-{code}.png';image.save(review/name)
            rows.append({'selection':selection,'cells':cells,'file':name,'sha256':sha(review/name),'ground':coverage})
            baselines={};saved=False
            for scenario in scenarios:
                assembled=seams.compose(scenario['plan'],{**common,fid:image})
                if scenario['id'].startswith('empty-'):
                    baselines[scenario['unlockedCount']]=assembled.getchannel('A').point(lambda v:255 if v==255 else 0).filter(ImageFilter.MinFilter(5))
                else:
                    holes=ImageChops.multiply(baselines[scenario['unlockedCount']],assembled.getchannel('A').point(lambda v:255 if v<250 else 0))
                    count=holes.histogram()[255];holes.close();checks+=1
                    if count:raise ValueError('PLACEMENT_ALPHA_HOLE')
                    if not saved:assembled.save(review/f'assembled-{fid}-{len(rows)-1:02d}.png');saved=True
                assembled.close()
            for baseline in baselines.values():baseline.close()
            previews.append((code,image.copy()));image.close()
        width=640;cell_h=340;sheet=Image.new('RGB',(width*2,cell_h*((len(previews)+1)//2)),(23,30,38));draw=ImageDraw.Draw(sheet)
        for index,(code,image) in enumerate(previews):
            image.thumbnail((width-30,cell_h-40));x=(index%2)*width+15;y=(index//2)*cell_h+28
            sheet.paste(image,(x,y),image);draw.text((x,7+(index//2)*cell_h),code,fill='white');image.close()
        contact=review/f'{fid}-contact-sheet.jpg';sheet.save(contact,quality=91);sheet.close()
        report['fields'][fid]={'cells':len(states),'selections':rows,'placementChecks':checks,
            'contactSheet':contact.name,'contactSheetSha256':sha(contact)}
        for core,objects in states.values():
            core.close()
            for obj in objects:obj['image'].close()
    for image in common.values():image.close()
    (review/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'fields':{k:{'cells':v['cells'],'selections':len(v['selections']),'placementChecks':v['placementChecks']} for k,v in report['fields'].items()}}))
    return report

if __name__=='__main__':build()
