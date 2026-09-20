"""Independent field assets, composed only for QA with the existing runtime plan."""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
sys.path.insert(0,str(ROOT/'scripts'))
loader=importlib.util.spec_from_file_location('cage_proof',ROOT/'scripts/build-cage-authoring-proof.py')
proof=importlib.util.module_from_spec(loader); loader.loader.exec_module(proof)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def checker_parity(x,y):
    return (math.floor(x/16+y/8)+math.floor(x/16-y/8))%2


def compose(plan, images):
    canvas=Image.new('RGBA',(plan['wrapWidthPx'],704))
    for placement in plan['placements']:
        image=images[placement['fieldId']]
        r=placement['sourceRect']
        fragment=image.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height']))
        canvas.alpha_composite(fragment,(placement['x'],placement['y']))
    return canvas


def contact_samples(image):
    # The shared contour is from two retained numeric envelopes under STARTING
    # art-plan placement (waiting x=0, sports x=768, both top crop=96).
    # Check both sides of the contour, not a fake rectangular tile grid.
    points=[(768,0),(768,256),(960,352),(960,608)]
    alpha=image.getchannel('A'); values=[]
    for a,b in zip(points,points[1:]):
        n=round(math.dist(a,b)); dx=(b[0]-a[0])/n; dy=(b[1]-a[1])/n
        for step in range(4,n-4):
            for offset in (-1,0,1):
                x=round(a[0]+step*dx-offset*dy)
                y=round(a[1]+step*dy+offset*dx)
                values.append(alpha.getpixel((x,y)))
    return {'sampleCount':len(values),'transparentSamples':sum(v==0 for v in values),
            'below250Samples':sum(v<250 for v in values),'minimumAlpha':min(values),
            'contourPx':points,'pass':all(v>=250 for v in values)}


def run(pack_root):
    runtime=proof.read(ROOT/'assets/production/cage/licensed-runtime-v1/manifest.json')
    geometry=json.loads(subprocess.check_output(['node','scripts/lib/cage-authoring-geometry.mjs','--seam-review'],cwd=ROOT))
    images={}; sources={}; adopted=[]
    for field in runtime['fields']:
        fid=field['fieldId']; pack=pack_root/'fields'/fid
        if (pack/'modular-manifest.json').exists():
            manifest,spec,image=proof.compose_modular_pack(pack)
            if not proof.modular_ground_coverage(spec,image)['pass']:
                raise ValueError('Candidate ground coverage failed: '+fid)
            path=pack/'previews/composite-hd4x.png'
            with Image.open(path) as saved:
                if saved.tobytes()!=image.tobytes():raise ValueError('Stale composed output: '+fid)
            adopted.append(fid)
        else:
            path=ROOT/field['frames'][0]['src']
            image=Image.open(path).convert('RGBA')
        images[fid]=image
        sources[fid]={'path':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':sha(path),
                      'role':'ORIGINAL_CANDIDATE' if fid in adopted else 'EXISTING_RUNTIME_CONTEXT_ONLY'}
    for required in ['field_cm28_01','field_cm02_01']:
        if required not in adopted:raise ValueError('Both independent neighbor candidates are required')
    output=pack_root/'review'; output.mkdir(exist_ok=True)
    rows=[]; phase_failures=[]
    for scenario in geometry['scenarios']:
        plan=scenario['plan']
        for p in plan['placements']:
            if p['fieldId'] not in adopted:continue
            # Native local->world includes source crop, wrapped fragments, row offsets.
            dx=(p['x']-p['sourceRect']['x'])/4
            dy=(p['y']-p['sourceRect']['y'])/4
            for x,y in [(3.17,9.31),(19.77,21.17),(73.43,51.33)]:
                if checker_parity(x,y)!=checker_parity(x+dx,y+dy):
                    phase_failures.append({'scenario':scenario['id'],'fieldId':p['fieldId'],'offset':[dx,dy]})
        frame=compose(plan,images)
        if scenario['id'].startswith('starting-'):
            frame.save(output/(scenario['id']+'.png'))
        rows.append({'id':scenario['id'],'fragments':len(plan['placements']),
                     'wrapFragments':sum('fragmentOfSlot' in p for p in plan['placements'])})
        frame.close()
    # Isolate the two independent sources: no lid/old artwork can hide holes.
    pair=next(s['plan'] for s in geometry['scenarios'] if s['id']=='starting-14').copy()
    pair['placements']=[p for p in pair['placements'] if p['fieldId'] in ('field_cm28_01','field_cm02_01')]
    joined=compose(pair,images)
    contact=contact_samples(joined)
    joined.crop((0,0,1536,704)).save(output/'waiting-sports-assembled-review.png')
    joined.crop((720,0,1008,640)).save(output/'joint-closeup.png')
    report={'status':'SEAM_CHECK_PASS_VISUAL_REVIEW_REQUIRED' if contact['pass'] and not phase_failures else 'SEAM_CHECK_FAILED',
            'productionUnit':'ONE_FIELD_ID_PER_ASSET','assembledImagesRole':'QA_ONLY_NOT_RUNTIME_ASSETS',
            'candidateFields':adopted,'sources':sources,'scenarioCount':len(rows),'scenarios':rows,
            'checkerPhaseFailures':phase_failures,'waitingSportsContact':contact,
            'limits':['Numerical/contact checks are not full visual acceptance of all neighbor combinations.',
                      'Unconverted runtime neighbors/lids are context only; no new art or approval for those fields.',
                      'Actor foreground ordering and physical device acceptance remain unverified.'],
            'runtimeEligible':False,'shippingReady':False,'humanApproved':False}
    (output/'seam-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    for image in images.values():image.close()
    if report['status']=='SEAM_CHECK_FAILED':raise ValueError(json.dumps(report['waitingSportsContact'])+str(phase_failures))
    print(json.dumps({k:report[k] for k in ['status','candidateFields','scenarioCount','waitingSportsContact']}))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--pack-root',type=Path,default=WORK/'seam-v3')
    run(parser.parse_args().pack_root.resolve())
