"""Audit actual Blender floor vertices against native hex ownership; QA overlays."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from lib.cage_hex_authoring import footprints, field_footprint
loader=importlib.util.spec_from_file_location('seams',ROOT/'scripts/check-cage-seams.py')
seams=importlib.util.module_from_spec(loader);loader.loader.exec_module(seams)
WORK=seams.WORK/'seam-v3'


def area(points):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1])))/2


def audit(spec,manifest,render):
    expected=field_footprint(ROOT,spec)
    if render.get('hexFootprint')!=expected:raise ValueError('HEX_DECLARATION_DRIFT')
    if manifest['generation'].get('footprintAuthority')!='EXISTING_NATIVE_SHAPE_MASK_UNION':
        raise ValueError('HEX_AUTHORITY_MISSING')
    mesh=render.get('hexFloorMeshNative',[])
    if len(mesh)!=len(expected['outline']) or any(abs(a-b)>.001 for p,q in zip(mesh,expected['outline']) for a,b in zip(p,q)):
        raise ValueError('HEX_BLENDER_MESH_DRIFT')
    if abs(area(mesh)-8448*len(expected['cells']))>.05:raise ValueError('HEX_AREA_DRIFT')
    return {'fieldId':spec['id'],'cells':len(expected['cells']),'areaNative':area(mesh),
            'meshMatchesNativeUnion':True,'outline':expected['outline']}


def overlay(image,footprint):
    result=image.copy();draw=ImageDraw.Draw(result)
    for cell in footprint['cells']:
        p=[(x*4,y*4) for x,y in cell['polygon']]
        draw.line(p+[p[0]],fill=(255,214,35,255),width=2)
        x=sum(p[0] for p in cell['polygon'])/6;y=sum(p[1] for p in cell['polygon'])/6
        draw.text((round(x*4)-7,round(y*4)-7),str(cell['bit']),fill=(255,255,255,255),stroke_width=1,stroke_fill=(0,0,0,255))
    return result


def build(ids=None):
    out=WORK/'review/hex-repair';out.mkdir(parents=True,exist_ok=True)
    rows=[];images={};grids={}
    for pack in sorted((WORK/'fields').iterdir()):
        if not (pack/'modular-manifest.json').exists() or (ids and pack.name not in ids):continue
        manifest,spec,image=seams.proof.compose_modular_pack(pack)
        render=seams.proof.read(pack/'render-report.json')
        row=audit(spec,manifest,render)
        if (pack/'spec.json').read_bytes()!=(seams.WORK/'fields'/pack.name/'spec.json').read_bytes():
            raise ValueError('HEX_SOURCE_SPEC_CHANGED')
        row['compositeSha256']=seams.sha(pack/'previews/composite-hd4x.png')
        row['renderReportSha256']=seams.sha(pack/'render-report.json')
        grid=overlay(image,field_footprint(ROOT,spec));grid.save(out/(pack.name+'-grid.png'))
        rows.append(row);images[pack.name]=image;grids[pack.name]=grid
    if {'field_cm28_01','field_cm02_01','field_cm01_01','field_cm16_01','field_cm29_01'}<=images.keys():
        plans=json.loads(__import__('subprocess').check_output(['node','scripts/lib/cage-authoring-geometry.mjs','--seam-review'],cwd=ROOT))
        plan=next(p['plan'] for p in plans['scenarios'] if p['id']=='starting-14')
        after=seams.compose(plan,images);after.save(out/'starting-14.png')
        grid=seams.compose(plan,grids);grid.save(out/'starting-14-grid.png');grid.close()
        before_images={}
        for fid in images:
            p=seams.WORK/'hex-repair-before/fields'/fid/'previews/composite-hd4x.png'
            if p.exists():before_images[fid]=Image.open(p).convert('RGBA')
        before=seams.compose(plan,before_images)
        sheet=Image.new('RGBA',(after.width,after.height*2+48),(20,27,37,255))
        sheet.alpha_composite(before,(0,24));sheet.alpha_composite(after,(0,after.height+48))
        d=ImageDraw.Draw(sheet);d.text((12,5),'BEFORE: tile-envelope approximation',fill='white')
        d.text((12,after.height+29),'AFTER: native hex union (same crop / slots / props)',fill='white')
        sheet.save(out/'before-after.png')
        for im in [before,after,sheet,*before_images.values()]:im.close()
    for im in [*images.values(),*grids.values()]:im.close()
    report={'status':'HEX_MESH_PASS_VISUAL_REVIEW_REQUIRED','fields':rows,
            'authority':'EXISTING_NATIVE_SHAPE_MASK_UNION','allActiveDefinitions':len(footprints(ROOT)['fields']),
            'runtimeEligible':False,'humanApproved':False,
            'limits':['Floor geometry only; scenery may overhang its own hex footprint.',
                      'QA grid lines are not runtime walls or new gameplay boundaries.',
                      'No physical phone or actor occlusion acceptance.']}
    (out/'report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'verifiedFields':len(rows)}))
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--field',action='append')
    build(parser.parse_args().field)
