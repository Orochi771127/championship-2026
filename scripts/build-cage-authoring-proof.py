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

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--write-contract',action='store_true'); parser.add_argument('--output',type=Path,default=OUTPUT)
    args=parser.parse_args(); contract=extract_contract()
    if args.write_contract:
        require(not CONTRACT.exists(), 'CONTRACT_ALREADY_EXISTS_REVIEW_INSTEAD_OF_OVERWRITING')
        CONTRACT.parent.mkdir(parents=True,exist_ok=True); CONTRACT.write_text(dump(contract),encoding='utf-8')
    require(CONTRACT.exists(),'CONTRACT_MISSING_USE_WRITE_CONTRACT_ONCE')
    print(dump(build(read(CONTRACT),args.output)))

if __name__=='__main__':
    main()
