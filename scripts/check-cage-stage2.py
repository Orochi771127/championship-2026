"""QA only: independent candidates in all native placements, never a runtime map."""
import importlib.util
import argparse
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageChops, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('seams',ROOT/'scripts/check-cage-seams.py')
seams=importlib.util.module_from_spec(loader);loader.loader.exec_module(seams)
WORK=seams.WORK/'seam-v3'
FIELDS=('field_cm05_01','field_cm30_01','field_cm31_01','field_cm34_01')
BATCH2_FIELDS=('field_cm03_01','field_cm04_01','field_cm27_01')
BATCH3_FIELDS=('field_cm10_01','field_cm11_01','field_cm12_01','field_cm20_01','field_cm35_01','field_cm37_01','field_cm40_01')


def ring_join_review(pack,composite):
    """Check actual rendered joins, not only mathematical segment continuity."""
    render=seams.proof.read(pack/'render-report.json');samples=[]
    with Image.open(pack/'frame-00.png') as source:
        reference=source.convert('RGBA')
    def brightness(image,x,y):
        return max(sum(image.getpixel((xx,yy))[:3])/3
                   for xx in range(max(0,x-1),min(image.width,x+2))
                   for yy in range(max(0,y-1),min(image.height,y+2)))
    for chain in render['ringRopePartition']:
        for a,b in zip(chain['pieces'],chain['pieces'][1:]):
            if a['owner']==b['owner']:continue
            x,y=[round(v*4) for v in a['b']]
            loss=brightness(reference,x,y)-brightness(composite,x,y)
            samples.append({'x':x,'y':y,'brightnessLoss':round(loss,3)})
    reference.close()
    return {'pass':all(s['brightnessLoss']<=35 for s in samples),
            'sampleCount':len(samples),'maxBrightnessLoss':max(s['brightnessLoss'] for s in samples),
            'limit':35,'samples':samples,
            'scope':'3x3 highlight coverage at rope part/core joins vs full Blender render, not actor occlusion'}


def build(batch=1):
    fields={1:FIELDS,2:BATCH2_FIELDS,3:BATCH3_FIELDS}[batch]
    flag='--stage2-review' if batch==1 else f'--stage2-batch{batch}-review'
    plans=json.loads(subprocess.check_output(['node','scripts/lib/cage-authoring-geometry.mjs',flag],cwd=ROOT))
    images={};sources={}
    for fid in (*fields,'field_cm28_01','field_cm29_01'):
        pack=WORK/'fields'/fid
        manifest,spec,image=seams.proof.compose_modular_pack(pack)
        coverage=seams.proof.modular_ground_coverage(spec,image)
        if not coverage['pass']:raise ValueError('GROUND_HOLE: '+fid)
        path=pack/'previews/composite-hd4x.png'
        with Image.open(path) as saved:
            if saved.tobytes()!=image.tobytes():raise ValueError('STALE_COMPOSITE: '+fid)
        images[fid]=image
        sources[fid]={'sha256':seams.sha(path),'objects':len(manifest['objects']),'ground':coverage}
    rope_joins=ring_join_review(WORK/'fields/field_cm27_01',images['field_cm27_01']) if batch==2 else None
    output=WORK/f'review/stage2-batch{batch}';output.mkdir(parents=True,exist_ok=True)
    baseline={};rows=[];selected=set()
    for s in plans['scenarios']:
        frame=seams.compose(s['plan'],images)
        if s['id'].startswith('empty-'):
            # Erode the empty-bay coverage by 2px so edge antialiasing cannot
            # masquerade as an internal transparent crack.
            baseline[s['unlockedCount']]=frame.getchannel('A').point(lambda v:255 if v==255 else 0).filter(ImageFilter.MinFilter(5))
            frame.close();continue
        holes=ImageChops.multiply(baseline[s['unlockedCount']],frame.getchannel('A').point(lambda v:255 if v<250 else 0))
        hole_count=holes.histogram()[255]
        fid=next(p['fieldId'] for p in s['plan']['placements'] if p['fieldId'] in fields)
        wrapped=any('fragmentOfSlot' in p for p in s['plan']['placements'] if p['fieldId']==fid)
        slot=next(p['slotIndex'] for p in s['plan']['placements'] if p['fieldId']==fid and 'slotIndex' in p)
        key=(fid,'wrap' if wrapped else 'upper' if slot%2==0 else 'lower')
        if key not in selected:
            frame.save(output/(fid+'-'+key[1]+'.png'));selected.add(key)
        rows.append({'id':s['id'],'fieldId':fid,'slotIndex':slot,'wrap':wrapped,'alphaHoles':hole_count,'holeBounds':holes.getbbox()})
        frame.close();holes.close()
    for image in [*images.values(),*baseline.values()]:image.close()
    report={'status':'PASS' if all(r['alphaHoles']==0 for r in rows) and (rope_joins is None or rope_joins['pass']) else 'SEAM_REPAIR_REQUIRED',
            'scope':f'Stage 2 batch {batch}; all native placements against waiting room and lids',
            'scenarios':rows,'sources':sources,'allInternalAlphaCovered':all(r['alphaHoles']==0 for r in rows),
            'runtimeEligible':False,'humanApproved':False,
            'ringRopeJoinReview':rope_joins,
            'limits':['No physical phone acceptance','No arbitrary mixed-facility adjacency acceptance',
                      'No actor occlusion acceptance','Images are QA assemblies only, not fused runtime assets']}
    (output/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'scenarios':len(rows),'failed':sum(r['alphaHoles']>0 for r in rows),
                      'maxAlphaHoles':max(r['alphaHoles'] for r in rows)}))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--batch',type=int,choices=(1,2,3),default=1)
    result=build(parser.parse_args().batch)
    raise SystemExit(0 if result['status']=='PASS' else 1)
