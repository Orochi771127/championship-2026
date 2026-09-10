"""Compile source-grid setting proofs; no runtime promotion or automatic art approval."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'docs/art/production/characters/appearance-refresh-v1'

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def encoded(value):
    return (json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode('utf-8')

def digest(payload):
    return hashlib.sha256(payload).hexdigest()

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/filename)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result

PIXEL = module('setting_pixel_tools','compile-pixel-character-bank.py')
SOURCE = module('setting_source_tools','build-character-appearance-workflow.py')

IDENTITY_DIRECTION_VERSION = 'creature-identity-v1'

def identity_review_reason(setting, visual):
    """A historical technical/visual pass cannot approve a new identity direction."""
    identity=setting.get('identityDesign')
    if not isinstance(identity,dict):return 'IDENTITY_DESIGN_REQUIRED'
    if identity.get('directionVersion')!=IDENTITY_DIRECTION_VERSION:return 'IDENTITY_DIRECTION_STALE'
    if not isinstance(identity.get('family'),str) or not identity['family'].strip():return 'IDENTITY_FAMILY_REQUIRED'
    for field,minimum in [('fixedTraits',3),('changedRegions',1),('preservedMotion',1),('allowedContourChanges',0)]:
        values=identity.get(field)
        if not isinstance(values,list) or not all(isinstance(v,str) and v.strip() for v in values):return 'IDENTITY_RULES_INCOMPLETE'
        if len({v.strip() for v in values})<minimum:return 'IDENTITY_RULES_INCOMPLETE'
    if visual.get('identityDirectionVersion')!=IDENTITY_DIRECTION_VERSION:return 'IDENTITY_REVIEW_REQUIRED'
    if visual.get('identityVerdict')!='PASS_IDENTITY_DIRECTION':return 'IDENTITY_REPAIR_REQUIRED'
    return None

def validate_setting(setting, known_ids):
    PIXEL.require(setting.get('entityId') in known_ids,'Unknown source entity')
    PIXEL.require(bool(setting.get('designVersion')),'Design version required')
    palette = PIXEL.parse_palette(setting.get('palette'))
    PIXEL.require(setting.get('features') and setting.get('faceRules') and setting.get('ornamentRules'), 'Incomplete setting rules')
    poses = setting.get('poses',[])
    PIXEL.require(poses and len({p['key'] for p in poses})==len(poses),'Missing or duplicate source pose')
    for pose in poses:
        PIXEL.require(bool(PIXEL.KEY_RE.fullmatch(pose['key'])),'Invalid source pose key')
        bounds = PIXEL.valid_bounds(pose.get('nativeBounds'),pose['key'])
        grid = PIXEL.validate_grid(pose.get('pixels'),len(palette),pose['key'])
        PIXEL.require((len(grid[0]),len(grid))==(bounds[2]-bounds[0],bounds[3]-bounds[1]),'Grid/bounds mismatch')
    return palette

def support(image, bounds):
    alpha = image.getchannel('A')
    return {(x+bounds[0],y+bounds[1]) for y in range(image.height) for x in range(image.width) if alpha.getpixel((x,y))}

def compare_pose(original, authored, bounds):
    before, after = support(original,bounds), support(authored,bounds)
    return {'removedSupport':[list(p) for p in sorted(before-after)],
            'addedSupport':[list(p) for p in sorted(after-before)],
            'sourceVisiblePixels':len(before), 'authoredVisiblePixels':len(after),
            'sourceAlphaBounds':list(original.getchannel('A').getbbox() or []),
            'authoredAlphaBounds':list(authored.getchannel('A').getbbox() or []),
            'sourceRgbaSha256':digest(original.tobytes()),
            'authoredRgbaSha256':digest(authored.tobytes()),
            'supportMeaning':'VISIBLE_SUPPORT_ONLY_NOT_ANATOMICAL_LANDMARK_OR_ART_APPROVAL'}

def review(setting_path, archive, output):
    setting = read(setting_path); roster = read(PACK/'generated/catalog.json')
    known = {e['entityId']:e for e in roster['entities']}
    palette=validate_setting(setting,known); eid=setting['entityId']
    raw=archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon'
    banks={}; all_source={}; source_files={}
    for side in ('main','sub'):
        family=archive/'08_FULL_FAMILY_CONVERSION/digimon'/f'{eid}_{side}'
        cells=read(family/'cells.json'); bank=SOURCE.native_bank(raw,f'{eid}_{side}',cells)
        banks[side]=(cells,bank)
        for path in [family/'cells.json',family/'animations.json',*sorted(raw.glob(f'{eid}_{side}.*'))]:
            source_files[path.relative_to(archive).as_posix()]=digest(path.read_bytes())
        for cell in cells['cells']:
            im,_=SOURCE.render_native(cell,bank)
            # Full native canvas + placement distinguishes state/position variants.
            all_source[f"{side}/cell_{cell['cellIndex']:03d}"]=(cell,im)
    files={}; records=[]; panels=[]
    for pose in setting['poses']:
        key=pose['key']; PIXEL.require(key in all_source,'Unknown source cell')
        cell,original=all_source[key]; b=cell['bounds']; bounds=[b['minX'],b['minY'],b['maxXExclusive'],b['maxYExclusive']]
        PIXEL.require(bounds==pose['nativeBounds'],f'{eid}/{key}: source NCER bounds changed')
        authored=PIXEL.indexed_image(pose['pixels'],palette).convert('RGBA')
        record={'key':key,'nativeBounds':bounds,**compare_pose(original,authored,bounds)}
        records.append(record); filename=key.replace('/','-')+'.png'
        files[filename]=PIXEL.png_bytes(PIXEL.indexed_image(pose['pixels'],palette))
        panels.append((key,original,authored))
    unique=lambda cell,image: digest(encoded(cell['bounds'])+encoded(list(image.size))+image.tobytes())
    selected={unique(*all_source[p['key']]) for p in setting['poses']}
    all_distinct={unique(*v) for v in all_source.values()}
    is_egg=known[eid]['kind']=='egg'
    pose_requirement=selected==all_distinct if is_egg else len(selected)>=min(3,len(all_distinct))
    cell_width=720; cell_height=350
    board=Image.new('RGB',(cell_width,cell_height*len(panels)),'#233139'); draw=ImageDraw.Draw(board)
    for i,(key,original,authored) in enumerate(panels):
        y=i*cell_height; draw.text((12,y+10),f'{eid} {key} | SOURCE REFERENCE / AUTHORED SETTING',fill='white')
        scale=max(1,min(8,320//original.width,215//original.height))
        for x,image in [(16,original),(376,authored)]:
            big=image.resize((image.width*scale,image.height*scale),Image.Resampling.NEAREST)
            board.paste(big,(x,y+40),big)
            # Native scale proof has no interpolation and no fitted dimensions.
            board.paste(image,(x,y+285),image)
        draw.text((12,y+265),f'native={original.width}x{original.height} integer zoom={scale}; original coordinates retained',fill='#b6cdd5')
    files['source-comparison.png']=PIXEL.png_bytes(board)
    qa={'schemaVersion':1,'entityId':eid,'designVersion':setting['designVersion'],
        'settingFileSha256':digest(Path(setting_path).read_bytes()),
        'sourceFiles':source_files,'decoderSha256':digest((ROOT/'scripts/build-character-appearance-workflow.py').read_bytes()),
        'technicalStatus':'PASS','poseSamplingStatus':'PASS' if pose_requirement else 'INCOMPLETE',
        'settingPoseCount':len(records),'distinctSourcePosesSelected':len(selected),
        'distinctSourceCanvasStates':len(all_distinct),'eggFullStateCoverage':selected==all_distinct if is_egg else None,
        'visiblePaletteCount':len(palette)-1,'poses':records,
        'artReview':'PENDING_INDEPENDENT_VISUAL_REVIEW','fullMotionQa':'NOT_RUN',
        'normalGameQa':'NOT_RUN','physicalDeviceQa':'NOT_RUN','runtimeEligible':False,'shippingReady':False}
    files['technical-qa.json']=encoded(qa)
    files['receipt.json']=encoded({'settingFileSha256':qa['settingFileSha256'],'files':{p:digest(b) for p,b in files.items()}})
    output=Path(output)
    for rel,payload in files.items():
        path=output/rel
        PIXEL.require(not path.exists() or path.read_bytes()==payload,f'Review snapshot differs: use a new output version: {path}')
    for rel,payload in files.items():
        path=output/rel; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(payload)
    return {k:qa[k] for k in ['entityId','technicalStatus','poseSamplingStatus','settingPoseCount','eggFullStateCoverage']}

def stage_review(expected_ids, artifacts):
    """A changed setting or a pending visual verdict must prevent stage advance."""
    PIXEL.require(expected_ids and len(expected_ids)==len(set(expected_ids)),'Empty or duplicate expected entity')
    PIXEL.require(len(artifacts)==len({a['entityId'] for a in artifacts}),'Duplicate reviewed entity')
    by_id={a['entityId']:a for a in artifacts}; pending=[]; accepted=[]
    PIXEL.require(set(by_id).issubset(expected_ids),'Unexpected stage entity')
    for eid in expected_ids:
        a=by_id.get(eid)
        if not a:
            pending.append({'entityId':eid,'reason':'SETTING_NOT_REVIEWED'});continue
        payload=Path(a['setting']).read_bytes(); technical=read(a['technicalQa']); visual=read(a['visualQa'])
        sha=digest(payload)
        comparison=Path(a['technicalQa']).parent/'source-comparison.png'
        setting=read(a['setting']); pngs_valid=verify_compiled_art(setting,Path(a['technicalQa']).parent)
        valid=(setting['entityId']==technical.get('entityId')==visual.get('entityId')==eid
               and technical.get('settingFileSha256')==visual.get('settingFileSha256')==sha
               and visual.get('technicalQaSha256')==digest(Path(a['technicalQa']).read_bytes())
               and comparison.exists() and visual.get('sourceComparisonSha256')==digest(comparison.read_bytes())
               and technical.get('technicalStatus')=='PASS' and technical.get('poseSamplingStatus')=='PASS'
               and visual.get('verdict')=='PASS_SETTING_STAGE' and visual.get('reviewer')
               and not visual.get('unresolvedBlockingIssues',[]) and pngs_valid)
        identity_reason=identity_review_reason(setting,visual)
        if valid and identity_reason is None:accepted.append(eid)
        else:pending.append({'entityId':eid,'reason':identity_reason or ('POSE_SAMPLING_INCOMPLETE' if technical.get('poseSamplingStatus')!='PASS' else 'MISSING_FAILED_OR_STALE_REVIEW')})
    return {'expected':len(expected_ids),'accepted':len(accepted),'acceptedEntities':accepted,
            'pending':pending,'stageStatus':'PASS' if not pending else 'REPAIR_OR_COMPLETE_CURRENT_STAGE',
            'mayAdvance':not pending,'runtimePromotionGranted':False}

def verify_compiled_art(setting, folder):
    """Require the actual delivered pixels, not only reports claiming they exist."""
    receipt_path=folder/'receipt.json'
    if not receipt_path.exists():return False
    receipt=read(receipt_path); hashes=receipt.get('files',{})
    for filename in ['technical-qa.json','source-comparison.png']:
        p=folder/filename
        if not p.exists() or hashes.get(filename)!=digest(p.read_bytes()):return False
    palette=validate_setting(setting,{setting['entityId']})
    for pose in setting['poses']:
        filename=pose['key'].replace('/','-')+'.png';p=folder/filename
        expected=PIXEL.png_bytes(PIXEL.indexed_image(pose['pixels'],palette))
        if not p.exists() or p.read_bytes()!=expected or hashes.get(filename)!=digest(expected):return False
    return True

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--setting',required=True);parser.add_argument('--archive-root',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();print(json.dumps(review(Path(args.setting),Path(args.archive_root),Path(args.output))))

if __name__=='__main__': main()
