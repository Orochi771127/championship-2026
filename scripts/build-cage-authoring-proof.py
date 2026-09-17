#!/usr/bin/env python3
"""One-field authoring proof from committed exports. No ROM, generation or promotion."""
from __future__ import annotations
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw
from lib.ydij_map_formats import composite_rendered_object_placements

ROOT = Path(__file__).resolve().parents[1]
FIELD = 'field_cm01_01'
EVIDENCE = ROOT / 'docs/art/production/cage/faithful-hd40'
SOURCE = EVIDENCE / 'fields' / FIELD
CONTRACT = ROOT / 'docs/art/contracts/cage/field_cm01_01.v1.json'
OUTPUT = ROOT / '.tmp/cage-authoring-proof/field_cm01_01'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()

def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'

def require(condition, message):
    if not condition:
        raise ValueError(message)

def geometry():
    return json.loads(subprocess.check_output(['node', 'scripts/lib/cage-authoring-geometry.mjs'], cwd=ROOT, text=True))

def extract_contract():
    baseline = next(x for x in read(EVIDENCE/'manifest.json')['fields'] if x['fieldId'] == FIELD)
    bank, animation, placement = [read(SOURCE/name) for name in ('object-cell-bank.json','object-animation-bank.json','object-placement.json')]
    cells = {x['cellIndex']: x for x in bank['renderedCells']}
    sequences = {x['sequenceId']: x for x in animation['sequences']}
    sources = [EVIDENCE/'manifest.json', ROOT/'assets/production/cage/licensed-runtime-v1/manifest.json']
    sources += sorted(SOURCE.glob('*.json')) + sorted(SOURCE.glob('*.png')) + sorted((SOURCE/'object-cells').glob('*.png'))
    sources += [ROOT/p for p in (
        'src/championship/cage/ranchSlotGeometry.js','src/championship/cage/ranchTileComposition.js',
        'src/championship/cage/nativeRanchLayout.js','src/championship/cage/cageCatalog.js',
        'src/championship/presentation/raisingCageArtPlan.js','src/championship/raising/nativeRaisingGround.js',
        'src/data/championship/catalogs/raising-ground.r1.json')]
    objects = []
    for p in placement['placements']:
        seq = sequences[p['sequenceId']]
        require(seq['frameCount'] == 1, 'PILOT_STATIC_SEQUENCE_ONLY')
        cell = cells[seq['frames'][0]['cellId']]
        require(cell['cellIndex'] == p['resolvedFirstFrameCellId'], 'BINDING_CONFLICT')
        bounds = bank['cells'][cell['cellIndex']]['bounds']
        require((cell['anchorX'],cell['anchorY']) == (-bounds['minX'],-bounds['minY']), 'NCER_PIVOT_CONFLICT')
        image = Image.open(EVIDENCE/cell['file']).convert('RGBA')
        require(image.size == (cell['width'],cell['height']), 'CELL_DIMENSIONS_CONFLICT')
        objects.append({'objectId': f"obj-{p['ordinal']:03d}", 'order': p['ordinal'],
            'sequenceId': p['sequenceId'], 'cellId': cell['cellIndex'], 'ticks': seq['frames'][0]['rawDurationTicks'],
            'sourceImage': (EVIDENCE/cell['file']).relative_to(ROOT).as_posix(),
            'size': [cell['width'],cell['height']], 'placement': [p['sourceX'],p['sourceY']],
            'pivot': [cell['anchorX'],cell['anchorY']], 'horizontalFlip': p['horizontalFlip'], 'verticalFlip': p['verticalFlip'],
            'safeAlphaBounds': list(image.getchannel('A').getbbox()),
            'layerRole': 'SOURCE_ORDER_STATIC_BAKED_OBJECT', 'placementBinding': 'OPMD_TO_NANR_TO_NCER'})
    geo = geometry()
    return {'schemaVersion': 1, 'fieldId': FIELD, 'status': 'AUTHORING_PROOF_ONLY',
        'runtimeEligible': False, 'shippingReady': False,
        'geometryAuthority': 'EXISTING_SOURCE_AND_DECODED_EVIDENCE_NOT_NEW_GAMEPLAY',
        'geometry': {k:v for k,v in geo.items() if k != 'scenarios'},
        'core': {'sourceImage': (SOURCE/'core-native.png').relative_to(ROOT).as_posix(),
            'size': [baseline['nativeOriginal']['width'],baseline['nativeOriginal']['height']]},
        'objects': objects,
        'rules': {'composition': 'CORE_THEN_SOURCE_ORDER_OBJECTS', 'objectRoot': 'placement - pivot',
            'crop': 'CLIP_TO_EXISTING_96x112_FIELD_BOUNDS_INCLUDING_NEGATIVE_OBJECT_ROOTS',
            'allowNewAlphaOutsideSafeBounds': False, 'runtimeObjectPass': False,
            'changedCanvasOrPivot': 'REQUIRES_NEW_EXPLICIT_CONTRACT_VERSION_AND_REVIEW',
            'collisionSemantics': 'RAW_CLASSES_ONLY_USE_EXISTING_GROUND_RUNTIME_FOR_PLAYABILITY',
            'connectorSemantics': 'EXISTING_TILE_CROP_AND_WRAP_NO_INVENTED_SOCKETS',
            'foregroundOcclusion': 'UNKNOWN_REQUIRES_TRACE'},
        'sourceLocks': {p.relative_to(ROOT).as_posix(): digest(p) for p in sources}}

def validate_contract(contract):
    # Includes source hashes, order, bindings, geometry, dimensions and pivots.
    require(contract == extract_contract(), 'CONTRACT_OR_SOURCE_DRIFT_REQUIRES_REVIEW')

def load_export(contract, overrides=None):
    overrides = overrides or {}
    require(set(overrides).issubset({o['objectId'] for o in contract['objects']}), 'UNKNOWN_OBJECT_EXPORT')
    out = []
    for o in contract['objects']:
        im = overrides.get(o['objectId'])
        im = Image.open(ROOT/o['sourceImage']).convert('RGBA') if im is None else im.convert('RGBA')
        require(list(im.size) == o['size'], 'EXPORT_DIMENSION_DRIFT')
        bounds = im.getchannel('A').getbbox()
        require(bounds is not None, 'EMPTY_OBJECT_EXPORT')
        allowed = o['safeAlphaBounds']
        require(bounds[0]>=allowed[0] and bounds[1]>=allowed[1] and bounds[2]<=allowed[2] and bounds[3]<=allowed[3], 'NEW_ALPHA_OUTSIDE_SAFE_BOUNDS')
        out.append({**o, 'image': im})
    return out

def compose(contract, overrides=None):
    validate_contract(contract)
    objects = load_export(contract, overrides)
    with Image.open(ROOT/contract['core']['sourceImage']) as core:
        return composite_rendered_object_placements(core, objects)

def candidate_manifest(contract, candidate):
    path = candidate / 'manifest.json'
    require(path.is_file(), 'CANDIDATE_MANIFEST_MISSING')
    manifest = read(path)
    require(manifest.get('fieldId') == contract['fieldId'], 'CANDIDATE_FIELD_MISMATCH')
    require(manifest.get('status') == 'ART_PROPOSAL', 'CANDIDATE_STATUS_MUST_BE_ART_PROPOSAL')
    require(manifest.get('runtimeEligible') is False, 'CANDIDATE_RUNTIME_MUST_REMAIN_FALSE')
    require(manifest.get('shippingReady') is False, 'CANDIDATE_SHIPPING_MUST_REMAIN_FALSE')
    require(manifest.get('humanApproved') is False, 'CANDIDATE_HUMAN_APPROVAL_MUST_REMAIN_FALSE')
    require(manifest.get('rightsStatus') == 'ORIGINAL_CREATED', 'CANDIDATE_RIGHTS_STATUS_INVALID')
    require(manifest.get('geometryContract') == CONTRACT.relative_to(ROOT).as_posix(), 'CANDIDATE_CONTRACT_MISMATCH')
    sources = manifest.get('sources') or {}
    expected = {o['objectId'] for o in contract['objects']}
    require(set((sources.get('objects') or {}).keys()) == expected, 'CANDIDATE_SOURCE_OBJECT_SET_INCOMPLETE')
    prompts = manifest.get('prompts') or {}
    require(set((prompts.get('objects') or {}).keys()) == expected, 'CANDIDATE_PROMPT_OBJECT_SET_INCOMPLETE')
    source_paths = [sources.get('core'), *sources['objects'].values()]
    for relative in [*source_paths, prompts.get('core'), *prompts['objects'].values()]:
        require(isinstance(relative, str) and (candidate/relative).is_file(), 'CANDIDATE_SOURCE_OR_PROMPT_MISSING')
    source_hashes = (manifest.get('generation') or {}).get('sourceSha256') or {}
    require(set(source_hashes) == {Path(relative).name for relative in source_paths}, 'CANDIDATE_SOURCE_HASH_SET_INCOMPLETE')
    for relative in source_paths:
        require(digest(candidate/relative) == source_hashes[Path(relative).name], 'CANDIDATE_SOURCE_HASH_MISMATCH')
    return manifest

def _fit_modular_core_source(source, size):
    image = source.convert('RGBA')
    alpha = image.getchannel('A')
    threshold = alpha.point(lambda value: 255 if value >= 16 else 0)
    bounds = threshold.getbbox()
    require(bounds is not None, 'CANDIDATE_CORE_SOURCE_EMPTY')
    # Alpha trim and fit the authored four-way connector silhouette to the
    # existing 96x112 contract. No placement, pivot or hand-tuned X/Y offset is
    # introduced; the visible source bounds define all four contact edges.
    image = image.crop(bounds).convert('RGBa').resize(tuple(size), Image.Resampling.LANCZOS).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda value: 0 if value < 8 else value))
    return image

def _fit_object_source(source, record, inset=1):
    image = source.convert('RGBA')
    alpha = image.getchannel('A')
    threshold = alpha.point(lambda value: 255 if value >= 16 else 0)
    bounds = threshold.getbbox()
    require(bounds is not None, f"CANDIDATE_SOURCE_EMPTY:{record['objectId']}")
    image = image.crop(bounds)
    allowed = record['safeAlphaBounds']
    left = allowed[0] + inset
    top = allowed[1] + inset
    right = allowed[2] - inset
    bottom = allowed[3] - inset
    require(right > left and bottom > top, f"CANDIDATE_SAFE_BOUNDS_TOO_SMALL:{record['objectId']}")
    scale = min((right-left)/image.width, (bottom-top)/image.height)
    resized_size = (max(1, round(image.width*scale)), max(1, round(image.height*scale)))
    # Premultiplied resizing prevents transparent RGB from creating dark halos.
    image = image.convert('RGBa').resize(resized_size, Image.Resampling.LANCZOS).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda value: 0 if value < 8 else value))
    canvas = Image.new('RGBA', tuple(record['size']))
    x = left + (right-left-image.width)//2
    y = bottom-image.height
    canvas.alpha_composite(image, (x, y))
    return canvas

def prepare_candidate(contract, candidate):
    manifest = candidate_manifest(contract, candidate)
    sources = manifest['sources']
    with Image.open(candidate/sources['core']) as source:
        core = _fit_modular_core_source(source, contract['core']['size'])
    core.save(candidate/'core-native.png', optimize=True)
    object_dir = candidate/'object-cells'
    object_dir.mkdir(parents=True, exist_ok=True)
    records = {o['objectId']: o for o in contract['objects']}
    for object_id, relative in sources['objects'].items():
        with Image.open(candidate/relative) as source:
            image = _fit_object_source(source, records[object_id])
        image.save(object_dir/f'{object_id}.png', optimize=True)

def load_candidate_export(contract, candidate):
    candidate_manifest(contract, candidate)
    core_path = candidate/'core-native.png'
    require(core_path.is_file(), 'CANDIDATE_CORE_EXPORT_MISSING')
    core = Image.open(core_path).convert('RGBA')
    require(list(core.size) == contract['core']['size'], 'CANDIDATE_CORE_DIMENSION_DRIFT')
    alpha = core.getchannel('A')
    require(alpha.getextrema() == (0,255), 'CANDIDATE_CORE_REQUIRES_REAL_ALPHA')
    require(alpha.getbbox() == (0,0,core.width,core.height), 'CANDIDATE_CORE_CONNECTORS_MUST_REACH_ALL_EDGES')
    require(all(alpha.getpixel(point) == 0 for point in ((0,0),(core.width-1,0),(0,core.height-1),(core.width-1,core.height-1))),
        'CANDIDATE_CORE_CORNERS_MUST_REMAIN_TRANSPARENT')
    expected = {o['objectId'] for o in contract['objects']}
    object_dir = candidate/'object-cells'
    actual = {p.stem for p in object_dir.glob('*.png')} if object_dir.is_dir() else set()
    require(actual == expected, 'CANDIDATE_OBJECT_EXPORT_SET_INCOMPLETE')
    overrides = {object_id: Image.open(object_dir/f'{object_id}.png').convert('RGBA') for object_id in expected}
    try:
        objects = load_export(contract, overrides)
    finally:
        for image in overrides.values():
            image.close()
    return core, objects

def compose_candidate(contract, candidate):
    validate_contract(contract)
    core, objects = load_candidate_export(contract, candidate)
    try:
        return composite_rendered_object_placements(core, objects)
    finally:
        core.close()

def diff_count(a, b):
    require(a.size == b.size, 'COMPARISON_DIMENSIONS_DIFFER')
    left, right = a.convert('RGBA').tobytes(), b.convert('RGBA').tobytes()
    return sum(left[i:i+4] != right[i:i+4] for i in range(0,len(left),4))

def template(contract, image):
    # ViewBox includes overflow; no hidden repair or translation of field space.
    top = min([0]+[o['placement'][1]-o['pivot'][1] for o in contract['objects']])
    width, height = contract['core']['size']
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 {top-20} {width+160} {height-top+55}">',
        '<style>text{font:4px monospace;fill:#fff} .box{fill:none;stroke-width:.5}</style>',
        f'<rect x="-10" y="{top-20}" width="{width+160}" height="{height-top+55}" fill="#172534"/>',
        f'<image href="composite-native.png" width="{width}" height="{height}" style="image-rendering:pixelated"/>',
        f'<rect class="box" width="{width}" height="{height}" stroke="#fff"/>',
        '<text x="0" y="-5">Field origin (0,0); white = fixed core/crop</text>']
    raw = read(SOURCE/'collision-raw-classes.json')
    for i,v in enumerate(raw['cells']):
        x,y = (i%raw['width'])*8,(i//raw['width'])*8
        parts.append(f'<rect class="box" x="{x}" y="{y}" width="8" height="8" stroke="#70849b"/><text x="{x+1}" y="{y+5}">{v}</text>')
    colors = ['#ffdd57','#5fffa3','#ff87b7','#7bb8ff']
    for o,color in zip(contract['objects'],colors):
        x,y=o['placement']; px,py=o['pivot']; w,h=o['size']; b=o['safeAlphaBounds']
        parts += [f'<rect class="box" x="{x-px}" y="{y-py}" width="{w}" height="{h}" stroke="{color}"/>',
            f'<rect class="box" x="{x-px+b[0]}" y="{y-py+b[1]}" width="{b[2]-b[0]}" height="{b[3]-b[1]}" stroke="{color}" stroke-dasharray="1 1"/>',
            f'<path d="M{x-3},{y}h6 M{x},{y-3}v6" stroke="{color}" stroke-width="1"/>',
            f'<text x="110" y="{o["order"]*18}">{o["objectId"]} seq {o["sequenceId"]} cell {o["cellId"]}</text>',
            f'<text x="110" y="{o["order"]*18+5}">placement {x},{y}; pivot {px},{py}</text>',
            f'<text x="110" y="{o["order"]*18+10}">root {x-px},{y-py}; {w}x{h}</text>']
    parts.append('<text x="110" y="80">Separate board space: shape 0 / mask 1</text>')
    # Debug diagram uses the recorded board coordinates at 0.5x plus label padding.
    # This transform never feeds the object compositor or a runtime placement.
    for cell in contract['geometry']['boardCells']:
        x=110+cell['x']/2; y=85+cell['y']/2
        parts += [f'<rect class="box" x="{x}" y="{y}" width="11" height="9" stroke="#5fffa3"/>',
            f'<text x="{x+1}" y="{y+6}">{cell["slotIndex"]}</text>']
    parts.append('<text x="110" y="115">Slots 8 / 9: upper crop / lower full; 13 wraps.</text>')
    parts += ['<text x="0" y="120">Numbers = RAW collision classes, not invented walkability.</text>',
        '<text x="0" y="126">Dashed = allowed alpha; order = source ordinal; outside core is clipped.</text>',
        '<text x="0" y="132">Board shape/row/crop/wrap and ground guide: geometry.json + layout PNGs.</text>', '</svg>']
    return '\n'.join(parts)+'\n'

def layout_image(scenario, replacement=None):
    board=scenario['ground']; image=Image.new('RGBA',(board['width']*8,board['height']*8))
    for p in scenario['plan']['placements']:
        source = replacement if p['fieldId']==FIELD and replacement is not None else Image.open(EVIDENCE/'fields'/p['fieldId']/'native-original.png').convert('RGBA')
        rect = p['sourceRect']; sx,sy,sw,sh=[round(rect[k]/4) for k in ('x','y','width','height')]
        image.alpha_composite(source.crop((sx,sy,sx+sw,sy+sh)),(round(p['x']/4),round(p['y']/4)))
    return image

def build(contract, output):
    image=compose(contract)
    comparisons={name: diff_count(image,Image.open(SOURCE/name)) for name in ('static-composite-native.png','native-original.png')}
    hd=image.resize((image.width*4,image.height*4),Image.Resampling.NEAREST)
    runtime=ROOT/f'assets/production/cage/licensed-runtime-v1/fields/{FIELD}/frame-00.png'
    comparisons['runtime-frame-00.png']=diff_count(hd,Image.open(runtime))
    require(all(v==0 for v in comparisons.values()), 'BASELINE_COMPOSITE_MISMATCH')
    output.mkdir(parents=True,exist_ok=True)
    image.save(output/'composite-native.png', optimize=True)
    hd.save(output/'composite-hd4x.png', optimize=True)
    (output/'template.svg').write_text(template(contract,image),encoding='utf-8')
    geo=geometry(); (output/'geometry.json').write_text(dump(geo),encoding='utf-8')
    for s in geo['scenarios']:
        rebuilt=layout_image(s,image); original=layout_image(s)
        comparisons[s['id']]=diff_count(rebuilt,original)
        require(comparisons[s['id']]==0,'LAYOUT_COMPARISON_MISMATCH')
        rebuilt.save(output/f'{s["id"]}.png', optimize=True)
        guide=rebuilt.copy(); draw=ImageDraw.Draw(guide)
        for i,(terrain,owner) in enumerate(zip(s['ground']['terrain'],s['ground']['owners'])):
            if terrain!=1 and owner>=0 and owner!=36:
                x,y=(i%s['ground']['width'])*8,(i//s['ground']['width'])*8
                draw.rectangle((x,y,x+7,y+7),outline=(80,255,170,255))
        guide.save(output/f'{s["id"]}-ground-guide.png',optimize=True)
    report={'fieldId':FIELD,'status':'PASS','comparisonsChangedPixels':comparisons,
        'formula':'placement - pivot','manualCorrections':0,'newArtGenerated':0,
        'geometryUnchanged':True,'runtimeEligible':False,'shippingReady':False,
        'limits':['Pixel equality proves this static fixture, not arbitrary artwork semantics or foreground occlusion.',
            'Replacement exports must retain identity, canvas, pivot and safe bounds; visible foot contact and baked duplicates still need review.'],
        'outputs': {p.name:digest(p) for p in sorted(output.iterdir()) if p.suffix in ('.png','.svg','.json') and p.name!='proof.json'}}
    (output/'proof.json').write_text(dump(report),encoding='utf-8')
    return report

def build_candidate(contract, candidate, output):
    manifest = candidate_manifest(contract, candidate)
    image = compose_candidate(contract, candidate)
    output.mkdir(parents=True, exist_ok=True)
    image.save(output/'composite-native.png', optimize=True)
    image.resize((image.width*4,image.height*4),Image.Resampling.NEAREST).save(output/'composite-hd4x.png', optimize=True)
    adjacency=Image.new('RGBA',(image.width*3,image.height*2))
    for row in range(2):
        for column in range(3): adjacency.alpha_composite(image,(column*image.width,row*image.height))
    adjacency.resize((adjacency.width*4,adjacency.height*4),Image.Resampling.NEAREST).save(output/'adjacency-hd4x.png',optimize=True)
    (output/'template.svg').write_text(template(contract,image),encoding='utf-8')
    geo=geometry(); (output/'geometry.json').write_text(dump(geo),encoding='utf-8')
    scenarios=[]
    for scenario in geo['scenarios']:
        preview=layout_image(scenario,image)
        preview.save(output/f'{scenario["id"]}.png', optimize=True)
        scenarios.append({'id':scenario['id'],'width':preview.width,'height':preview.height,
            'sha256':digest(output/f'{scenario["id"]}.png')})
    alpha={}; review_scale=4; review_cell=(96,96)
    review=Image.new('RGBA',(review_cell[0]*4*review_scale,review_cell[1]*review_scale),(24,36,48,255))
    draw=ImageDraw.Draw(review)
    for y in range(0,review.height,16):
        for x in range(0,review.width,16):
            if (x//16+y//16)%2==0: draw.rectangle((x,y,x+15,y+15),fill=(52,68,80,255))
    for record in contract['objects']:
        path=candidate/'object-cells'/f'{record["objectId"]}.png'
        with Image.open(path).convert('RGBA') as object_image:
            channel=object_image.getchannel('A'); bounds=channel.getbbox()
            edge=sum(1 for x in range(object_image.width) for y in (0,object_image.height-1) if channel.getpixel((x,y)))
            edge+=sum(1 for y in range(1,object_image.height-1) for x in (0,object_image.width-1) if channel.getpixel((x,y)))
            alpha[record['objectId']]={'bounds':list(bounds),'edgeAlphaPixels':edge,'sha256':digest(path)}
            require(edge==0,f'CANDIDATE_OBJECT_TOUCHES_CANVAS_EDGE:{record["objectId"]}')
            enlarged=object_image.resize((object_image.width*review_scale,object_image.height*review_scale),Image.Resampling.NEAREST)
            column=record['order']; x=column*review_cell[0]*review_scale+(review_cell[0]*review_scale-enlarged.width)//2
            y=(review_cell[1]*review_scale-enlarged.height)//2
            review.alpha_composite(enlarged,(x,y))
            draw.text((column*review_cell[0]*review_scale+8,8),record['objectId'],fill=(255,255,255,255))
    review.save(output/'object-review.png',optimize=True)
    with Image.open(candidate/'core-native.png').convert('RGBA') as core:
        channel=core.getchannel('A'); pixels=core.load()
        edge_alpha={
            'top':sum(channel.getpixel((x,0))>0 for x in range(core.width)),
            'bottom':sum(channel.getpixel((x,core.height-1))>0 for x in range(core.width)),
            'left':sum(channel.getpixel((0,y))>0 for y in range(core.height)),
            'right':sum(channel.getpixel((core.width-1,y))>0 for y in range(core.height))}
        require(all(value>0 for value in edge_alpha.values()),'CANDIDATE_CORE_MISSING_CONNECTOR_EDGE')
        transparent=channel.tobytes().count(0)
        require(transparent>=core.width*core.height*.05,'CANDIDATE_CORE_TRANSPARENT_EXTERIOR_TOO_SMALL')
        blue=sum(1 for y in range(core.height) for x in range(core.width)
            if channel.getpixel((x,y))>=32 and pixels[x,y][2]>=pixels[x,y][0]+25)
        require(blue>=core.width*core.height*.08,'CANDIDATE_CORE_BLUE_RIM_NOT_READABLE')
        seam={'connectorEdgeAlphaPixels':edge_alpha,'transparentExteriorPixels':transparent,
            'blueRimPixels':blue,'status':'GEOMETRY_PASS_VISUAL_JOIN_REVIEW_REQUIRED'}
    report={'fieldId':FIELD,'assetId':manifest['assetId'],'status':'CANDIDATE_GEOMETRY_PASS_VISUAL_REVIEW_REQUIRED',
        'formula':'placement - pivot','manualCorrections':0,'geometryUnchanged':True,'completePackage':True,
        'rightsStatus':'ORIGINAL_CREATED','humanApproved':False,'runtimeEligible':False,'shippingReady':False,
        'core':{'size':contract['core']['size'],'opaque':False,'alphaBounds':list(channel.getbbox()),
            'sha256':digest(candidate/'core-native.png')},
        'objects':alpha,'seamQa':seam,'scenarios':scenarios,
        'limits':['Generated-art geometry and completeness pass; this is not pixel equality with research material.',
            'Foreground actor-object ordering remains UNKNOWN_REQUIRES_TRACE until separately traced and approved.',
            'Browser screenshots are local candidate preview evidence, not production-manifest promotion or physical-device acceptance.'],
        'outputs':{p.name:digest(p) for p in sorted(output.iterdir()) if p.suffix in ('.png','.svg','.json') and p.name!='candidate-proof.json'}}
    (output/'candidate-proof.json').write_text(dump(report),encoding='utf-8')
    return report

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--write-contract',action='store_true'); parser.add_argument('--output',type=Path)
    parser.add_argument('--candidate',type=Path); parser.add_argument('--prepare-candidate',action='store_true')
    args=parser.parse_args(); contract=extract_contract()
    if args.write_contract:
        require(not CONTRACT.exists(), 'CONTRACT_ALREADY_EXISTS_REVIEW_INSTEAD_OF_OVERWRITING')
        CONTRACT.parent.mkdir(parents=True,exist_ok=True); CONTRACT.write_text(dump(contract),encoding='utf-8')
    require(CONTRACT.exists(),'CONTRACT_MISSING_USE_WRITE_CONTRACT_ONCE')
    contract=read(CONTRACT)
    if args.candidate:
        candidate=args.candidate if args.candidate.is_absolute() else ROOT/args.candidate
        if args.prepare_candidate: prepare_candidate(contract,candidate)
        output=args.output or candidate/'previews'
        output=output if output.is_absolute() else ROOT/output
        print(dump(build_candidate(contract,candidate,output)))
    else:
        require(not args.prepare_candidate,'PREPARE_CANDIDATE_REQUIRES_CANDIDATE')
        output=args.output or OUTPUT
        output=output if output.is_absolute() else ROOT/output
        print(dump(build(contract,output)))

if __name__=='__main__':
    main()
