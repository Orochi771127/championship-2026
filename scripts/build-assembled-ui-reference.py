"""Copy selected assembled cells for the Owner's local art review.

No source payload, preview sheet or GIF enters the game. Static selections use
the recovered Shop identity and NANR sequence/frame, never row-order offsets.
"""
import csv
import hashlib
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT.parent / 'YDIJ_ART_PACK_ASSEMBLED'
SOURCE = ROOT.parent / 'YDIJ_PRIVATE_ROM_ART_PACK/08_FULL_FAMILY_CONVERSION'
REL = 'assets/production/internal-faithful-baseline/assembled-ui-v1'
ASSET = 'art:ui:assembled:local-reference:v1'

def read(p): return json.loads(p.read_text(encoding='utf-8'))
def emit(p, d):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes((json.dumps(d, ensure_ascii=False, indent=2)+'\n').encode())
def sha(data): return hashlib.sha256(data).hexdigest()

def build():
    pack = read(PACK/'MANIFEST.json')
    families = {f['family']: f for f in pack['families']}
    cells = {}
    def select(family, sequence, frame):
        source = SOURCE/family
        animation = read(source/'animations.json')['sequences'][sequence]
        assert animation['sequenceId'] == sequence
        cell = animation['frames'][frame]['cellId']
        key = f'{family}:{cell}'
        if key not in cells:
            png = PACK/Path(families[family]['sheet']).parent/'cells'/f'cell-{cell:03}.png'
            data = png.read_bytes()
            with Image.open(png) as image:
                width, height = image.size
                assert image.mode == 'RGBA'
                image.verify()
            name = family.replace('/', '--')+f'--{cell:03}.png'
            dest = ROOT/REL/name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            # Assembled PNGs use OAM extents, without NCER bounding-box padding.
            objects = read(source/'cells.json')['cells'][cell]['oamEntries']
            left = min(o['x'] for o in objects); top = min(o['y'] for o in objects)
            right = max(o['x']+o['width'] for o in objects); bottom = max(o['y']+o['height'] for o in objects)
            assert (width, height) == (right-left, bottom-top)
            cells[key] = dict(key=key, src=REL+'/'+name, width=width, height=height,
                origin=[-left, -top], sha256=sha(data), sourceFamily=family, sourceCell=cell)
        return dict(cellKey=key, sequence=sequence, frame=frame)

    catalog = read(ROOT/'src/data/championship/catalogs/shop.r1.json')['records']
    evidence = Path('R:/NEXUS LINK/原作/YDIJ_RAW_RESEARCH_EVIDENCE/SHOP_REVERSE_CATALOG_118.csv')
    with evidence.open(encoding='utf-8-sig', newline='') as stream: native = list(csv.DictReader(stream))
    assert len(catalog) == len(native) == 118
    goods = []
    for row, original in zip(catalog, native):
        assert row['shopRecordIndex'] == int(original['record_index'])
        assert row['itemIndex'] == int(original['item_index'])
        if row['category'] == 'TRAINING_GOODS': continue  # already correct toolbar icons
        family = {'HUNT_ITEMS':'ui/itemiconL_main', 'PLUGINS':'ui/setting_obj_plug_main_lt',
                  'CAGES':'ui/cage_shop_icon_main'}[row['category']]
        expected = {'HUNT_ITEMS':'itemiconL','PLUGINS':'setting_obj_plug','CAGES':'cage_shop_icon'}[row['category']]
        assert original['resource_key'] == expected
        sequence = max(0, int(original['subcategory_raw'])-1)
        goods.append(dict(shopRecordIndex=row['shopRecordIndex'], category=row['category'],
            subcategory=row['subcategory'], itemIndex=row['itemIndex'], **select(family, sequence, row['itemIndex'])))
    cages = [dict(definition=i, **select('training/cage_edit_icon', i, 0)) for i in range(36)]
    hud = {}
    for i in range(36): hud[f'ranch-{i}'] = select('training/training_sub', 4, i)
    for i in range(16): hud[f'gate-{i}'] = select('ui/hunt/world/field_image_icon', 0, i)
    for i, name in enumerate(['tl','top','tr','left','right','bl','bottom','br']):
        hud[f'memory-{name}'] = select('ui/hunt/hunting/memory_card_plate', i, 0)
    for name, frame in [('evolution-word',0),('evolution-word-small',1),('evolution-code',4),('evolution-ring',5)]:
        hud[name] = select('common/e001_evolution_all', 1, frame)
    animations = {}
    for name, family, sequence in [('evolution-burst','common/e001_evolution_all',0),
                                    ('evolution-green','common/e001_ikusei',15)]:
        native_sequence = read(SOURCE/family/'animations.json')['sequences'][sequence]
        animations[name] = dict(playbackMode=native_sequence['rawWordB'],loopStartFrame=native_sequence['loopStartFrame'],
            frames=[dict(**select(family,sequence,i),ticks=f['rawDurationTicks']) for i,f in enumerate(native_sequence['frames'])])
    meta = dict(schemaVersion=1, assetId=ASSET, manifestPath=REL+'/manifest.json',
        runtimeEligible=True, localOnly=True, runtimeScope='LOOPBACK_RESEARCH_ONLY',
        rightsStatus='ROM_COPYRIGHTED_REFERENCE', publicReleasePermitted=False, shippingReady=False,
        humanApproved=False, productionStatus='OWNER_AUTHORIZED_LOCAL_REFERENCE',
        gameplayBinding='EXTERNAL_EXISTING_RUNTIME')
    emit(ROOT/REL/'manifest.json', dict(**meta, sourcePackage=pack['package'],
        sourceManifestSha256=sha((PACK/'MANIFEST.json').read_bytes()),
        identityEvidence='SHOP_RECORD_CATEGORY_SUBCATEGORY_ITEM_INDEX_AND_NANR_STATIC_FRAME',
        sourceCatalogSha256=sha(evidence.read_bytes()), goods=goods, cages=cages, hud=hud,
        animations=animations, cells=list(cells.values())))
    index_path = ROOT/'assets/production/ART_PRODUCTION_INDEX.json'
    index_newline = '\r\n' if b'\r\n' in index_path.read_bytes() else '\n'
    index_text = index_path.read_text(encoding='utf-8')
    index = json.loads(index_text)
    existing = next((e for e in index['entries'] if e['assetId'] == ASSET), None)
    if existing:
        assert existing == meta
        assert index['summary']['registeredRuntimeBundles'] == len(index['entries'])
    else:
        # Keep formatting and all unrelated registrations intact.
        at = index_text.rfind('\n  ]')
        assert at >= 0
        encoded = '\n'.join('    '+line for line in json.dumps(meta,ensure_ascii=False,indent=2).splitlines())
        index_text = index_text[:at]+',\n'+encoded+index_text[at:]
        index_text = re.sub(r'"registeredRuntimeBundles": \d+',f'"registeredRuntimeBundles": {len(index["entries"])+1}',index_text,count=1)
        index_path.write_bytes(index_text.replace('\n',index_newline).encode())
    print(json.dumps(dict(goods=len(goods), cages=len(cages), uniqueCells=len(cells))))

if __name__ == '__main__': build()
