"""Bounded two-state surface batch, using native placement plans for EVERY frame."""
import importlib.util
import argparse
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageChops, ImageFilter, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
loader=importlib.util.spec_from_file_location('seams',ROOT/'scripts/check-cage-seams.py')
seams=importlib.util.module_from_spec(loader);loader.loader.exec_module(seams)
WORK=seams.WORK/'seam-v3'
FIELDS=('field_cm07_01','field_cm39_01')
BATCHES={'batch1':(FIELDS,[6,33]),'batch2':(('field_cm09_01','field_cm21_01'),[8,20])}


def build(batch='batch1'):
    fields,definitions=BATCHES[batch]
    command="import {cageSeamReviewPlans} from './scripts/lib/cage-authoring-geometry.mjs';console.log(JSON.stringify(cageSeamReviewPlans("+json.dumps(definitions)+",false)));"
    plans=json.loads(subprocess.check_output(['node','--input-type=module','-e',command],cwd=ROOT))
    out=WORK/'review'/('stage3-'+batch);out.mkdir(parents=True,exist_ok=True)
    rows=[];sources={};panels=[]
    for index in range(2):
        images={};baseline={}
        for fid in (*fields,'field_cm28_01','field_cm29_01'):
            pack=WORK/'fields'/fid
            manifest,spec,image=seams.proof.compose_modular_pack(pack,index if fid in fields else 0)
            coverage=seams.proof.modular_ground_coverage(spec,image)
            if not coverage['pass']:raise ValueError('GROUND_HOLE: '+fid)
            images[fid]=image
            if fid in fields:
                name=f'frame-{index:02d}.png';path=pack/'previews'/name
                with Image.open(path) as saved:
                    if saved.tobytes()!=image.tobytes():raise ValueError('STALE_COMPOSITE')
                sources.setdefault(fid,[]).append({'index':index,**spec['frames'][index],'sha256':seams.sha(path),'ground':coverage})
                panels.append((fid,index,image.copy()))
        for scenario in plans['scenarios']:
            image=seams.compose(scenario['plan'],images)
            if scenario['id'].startswith('empty-'):
                baseline[scenario['unlockedCount']]=image.getchannel('A').point(lambda v:255 if v==255 else 0).filter(ImageFilter.MinFilter(5))
                image.close();continue
            holes=ImageChops.multiply(baseline[scenario['unlockedCount']],image.getchannel('A').point(lambda v:255 if v<250 else 0))
            fid=next(p['fieldId'] for p in scenario['plan']['placements'] if p['fieldId'] in fields)
            rows.append({'id':scenario['id'],'fieldId':fid,'frameIndex':index,'alphaHoles':holes.histogram()[255]})
            if not any(r['fieldId']==fid and r['frameIndex']==index for r in rows[:-1]):
                image.save(out/(fid+f'-assembled-{index:02d}.png'))
            image.close();holes.close()
        for image in [*images.values(),*baseline.values()]:image.close()
    widths={fid:image.width for fid,index,image in panels};row_height=max(image.height for _,_,image in panels)+32
    sheet=Image.new('RGBA',(sum(widths.values()),row_height*2),(20,27,37,255));draw=ImageDraw.Draw(sheet)
    for fid,index,image in panels:
        x=sum(widths[f] for f in fields[:fields.index(fid)]);y=index*row_height
        sheet.alpha_composite(image,(x,y+32));draw.text((x+12,y+10),f'{fid} / state {index}',fill='white');image.close()
    sheet.save(out/'two-state-contact-sheet.png');sheet.close()
    report={'status':'PASS' if all(r['alphaHoles']==0 for r in rows) else 'SEAM_REPAIR_REQUIRED',
            'sources':sources,'scenarios':rows,'runtimeEligible':False,'humanApproved':False,
            'limits':['Two original timed surface frames only; animated OPM sequences remain unsupported.',
                      'No physical-phone, actor-occlusion or final-art acceptance.']}
    (out/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'frames':4,'scenarios':len(rows),'failed':sum(r['alphaHoles']>0 for r in rows)}))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--batch',choices=BATCHES,default='batch1')
    raise SystemExit(0 if build(parser.parse_args().batch)['status']=='PASS' else 1)
