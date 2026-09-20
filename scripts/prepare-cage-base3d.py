"""Build the full Cage-only 3D authoring workpack from numeric authorities.

No source-game image is opened. The silhouette is a numeric tile-envelope
authoring approximation; it is not promoted to collision or pixel-alpha truth.
"""
from pathlib import Path
import csv
import hashlib
import json
import math
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/art/production/original-character-cage-r1/cage-base3d-v1'
EVIDENCE = ROOT / 'docs/art/production/cage/faithful-hd40/fields'

# Every active field has an explicit art treatment, not a model-generated theme.
DESIGNS = {
1: ('soil', 'woodland-pipes', '土面與後側植栽，前側低矮管狀構件'),
2: ('clay', 'running-track', '獨立運動場：暖土跑道、綠色內場、兩個跨欄與下方三片訓練網；逐筆對應原定位'),
3: ('rubber', 'athletics', '深色競技地面、環形跑道與低矮看台'),
4: ('wood', 'dojo', '木質演武地板與木製訓練器'),
5: ('rubber', 'gym', '防滑訓練地面、重量架與體能設備'),
6: ('tile', 'laboratory', '冷白研究基地與玻璃培養設備'),
7: ('basalt', 'volcano', '黑岩、低矮火山口與局部岩漿光'),
8: ('grass', 'meadow', '大片草地、成簇灌木與草原岩石'),
9: ('sand', 'beach', '沙岸與淺水、岩礁及棕櫚'),
10: ('stone', 'mountain', '分層岩峰、碎石與耐寒植栽'),
11: ('grass', 'forest', '木幹與樹冠分明的疏林'),
12: ('grass', 'jungle', '較深色濕地植栽與寬葉叢林'),
13: ('marble', 'sanctum', '淺色石台、柱列與小型祭壇'),
14: ('stone', 'memorial', '灰石紀念碑與安靜的矮植栽'),
15: ('metal', 'factory', '工業金屬板、設備筒與管線'),
16: ('tile', 'clinic-small', '小型保健艙、低矮用品台'),
17: ('tile', 'hospital', '成組保健艙與白色服務設備'),
18: ('grass', 'garden', '分區花台、矮花叢與休息椅'),
19: ('stone', 'hot-spring', '石材池緣、暖水與木製附屬設施'),
20: ('sand', 'desert', '暖沙、低矮岩層與耐旱植栽'),
21: ('snow', 'ice', '冷色冰雪與透明冰晶，局部閃光'),
22: ('metal', 'power', '藍灰機械平台、線圈與發電設備'),
23: ('metal', 'gas', '封閉處理筒與黃綠警示設備'),
24: ('marble', 'temple', '緊湊石階、雙柱與屋頂構件'),
25: ('grass', 'zoo', '棲地分區、餵食台與木質設備'),
26: ('grass', 'ranch', '草地、低矮飼料槽與牧場設備'),
27: ('rubber', 'ring', '擂台繩柱與柔和藍色墊面'),
28: ('checker', 'waiting', '獨立等候室：明亮藍白方格平台與共用托盤；原配置沒有獨立物件，不自行加長椅或植栽'),
29: ('metal', 'lid', '共用封閉蓋板、低矮接縫與平台外緣'),
30: ('clay', 'running-small', '小型土質訓練區與跨欄'),
31: ('tile', 'clinic', '中型保健設備與用品台'),
32: ('grass', 'garden-small', '小型花台與季節植栽'),
34: ('rubber', 'gym-small', '緊湊重量訓練器與防滑地面'),
35: ('basalt', 'volcano-small', '小型黑岩熱源與火山岩'),
37: ('stone', 'mountain-small', '小型岩峰與山地植栽'),
39: ('sand', 'beach-small', '小型淺水沙岸與岩礁'),
40: ('stone', 'cave', '岩壁入口與低矮碎石')}


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def boundary(mask, width, height):
    """Clockwise exterior edges of occupied numerical cells, no pixel tracing."""
    edges = set()
    for y in range(height):
        for x in range(width):
            if not mask[y * width + x]:
                continue
            for a, b, nx, ny in [((x,y),(x+1,y),x,y-1), ((x+1,y),(x+1,y+1),x+1,y),
                                   ((x+1,y+1),(x,y+1),x,y+1), ((x,y+1),(x,y),x-1,y)]:
                if not (0 <= nx < width and 0 <= ny < height and mask[ny * width + nx]):
                    edges.add((a, b))
    if not edges:
        raise ValueError('Empty numerical tile envelope')
    loops = []
    while edges:
        first = min(edges)
        start = first[0]
        p = start
        previous = (first[1][0]-p[0], first[1][1]-p[1])
        loop = []
        directions = [(1,0),(0,1),(-1,0),(0,-1)]
        while True:
            loop.append([p[0] * 8, p[1] * 8])
            candidates = [edge for edge in edges if edge[0] == p]
            if not candidates:
                raise ValueError('Open tile boundary')
            incoming = directions.index(previous)
            def turn(edge):
                direction = (edge[1][0]-p[0], edge[1][1]-p[1])
                delta = (directions.index(direction)-incoming) % 4
                return {1:0, 0:1, 3:2, 2:3}[delta]
            edge = min(candidates, key=turn)
            edges.remove(edge)
            previous = (edge[1][0]-p[0], edge[1][1]-p[1])
            p = edge[1]
            if p == start:
                break
        if p != start:
            raise ValueError('Open tile boundary')
        loops.append(loop)
    def area(poly):
        return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1])))
    return max(loops, key=area)


def simplify(points, epsilon=6):
    """RDP around two distant anchors; retain concavity of multi-slot fields."""
    def rdp(p):
        if len(p) < 3:
            return p
        a, b = p[0], p[-1]
        den = math.dist(a, b)
        distances = [abs((b[0]-a[0])*(a[1]-q[1])-(a[0]-q[0])*(b[1]-a[1])) / max(den, 1e-9) for q in p]
        i = max(range(len(p)), key=distances.__getitem__)
        if distances[i] > epsilon:
            return rdp(p[:i+1])[:-1] + rdp(p[i:])
        return [a,b]
    i = max(range(len(points)), key=lambda i: math.dist(points[0], points[i]))
    return rdp(points[:i+1])[:-1] + rdp(points[i:]+[points[0]])[:-1]


def main():
    with (ROOT.parent/'ART_REFERENCE_LIBRARY/REPLACEMENT_SPEC/SPEC_CAGES.csv').open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    with (ROOT.parent/'ART_REFERENCE_LIBRARY/CATALOG_CAGES.csv').open(encoding='utf-8-sig', newline='') as f:
        pack = {r['fieldId']:r for r in csv.DictReader(f)}
    runtime = read(ROOT/'assets/production/cage/licensed-runtime-v1/manifest.json')
    runtime = {f['fieldId']:f for f in runtime['fields']}
    ground = read(ROOT/'src/data/championship/catalogs/raising-ground.r1.json')
    ground = {f['definitionIndex']:f for f in ground['fields']}
    locks, fields = {}, []
    for row in rows:
        if row['usedInGame'] != '是':
            continue
        fid = row['fieldId']
        number = int(fid[8:10])
        material, family, intent = DESIGNS[number]
        directory = EVIDENCE/fid
        core = read(directory/'core-tilemap.json')
        placements = read(directory/'object-placement.json')['placements']
        cells = {}
        if placements:
            bank = read(directory/'object-cell-bank.json')
            cells = {c['cellIndex']:c for c in bank['renderedCells']}
        for name in ['core-tilemap.json','object-placement.json'] + (['object-cell-bank.json'] if placements else []):
            path = directory/name
            locks[str(path.relative_to(ROOT)).replace('\\','/')] = sha(path)
        definition = int(row['cageDefinitionIndex'])
        ref = runtime[fid]
        fields.append({'id':fid, 'name':row['nameZh'], 'definitionIndex':definition,
            'role':row['role'], 'family':family, 'surface':material, 'designIntent':intent,
            'status':'NUMERIC_SPEC_COMPLETE_ART_NOT_ACCEPTED', 'runtimeEligible':False,
            'nativeSize':[ref['nativeWidthPx'],ref['nativeHeightPx']],
            'worldSize':[ref['worldWidthPx'],ref['worldHeightPx']],
            'referenceSpec':{'fieldId':fid,'canvasPx':row['canvasPx'],'frameCount':int(row['frameCount']),
                'frameMs':row['frameMs'],'topCropPx':int(row['topCropPx']),
                'topCropWhen':row['topCropWhen'],'maskImage':row['maskImage'],
                'researchFrames':pack[fid]['researchFrames'],
                'restriction':'RESEARCH_ONLY; no original rasters copied or uploaded for generation'},
            'outputContract':{'unit':'ONE_FIELD_ID','fieldIds':[fid],
                'directory':f'fields/{fid}','nativeOrigin':[0,0],
                'canvasPx':[ref['worldWidthPx'],ref['worldHeightPx']],
                'sourceCropApplied':False,'neighborFieldIds':[],
                'assemblyRule':'Only the game or a separate preview composes independent field assets'},
            'outlineNative':simplify(boundary([c['tileIndex']!=0 for c in core['cells']],core['width'],core['height'])),
            'outlineAuthority':'NUMERIC_TILE_ENVELOPE_APPROXIMATION; NOT_SOURCE_PIXEL_ALPHA',
            'ground':ground[definition],
            'objects':[{'order':p['ordinal'], 'sequenceId':p['sequenceId'],
                'placement':[p['sourceX'],p['sourceY']],
                'pivot':[cells[p['resolvedFirstFrameCellId']]['anchorX'],cells[p['resolvedFirstFrameCellId']]['anchorY']],
                'size':[cells[p['resolvedFirstFrameCellId']]['width'],cells[p['resolvedFirstFrameCellId']]['height']],
                'horizontalFlip':p['horizontalFlip'], 'verticalFlip':p['verticalFlip'],
                'sequenceFrameCount':p['sequenceFrameCount']} for p in placements],
            'frames':[{k:v for k,v in f.items() if k.startswith('duration')} for f in ref['frames']]})
    if len(fields)!=37 or len(DESIGNS)!=37:
        raise ValueError('The complete active Cage inventory must have 37 fields')
    for name in ['src/data/championship/catalogs/raising-ground.r1.json','assets/production/cage/licensed-runtime-v1/manifest.json']:
        locks[name]=sha(ROOT/name)
    write(OUT/'catalog.json', {'schemaVersion':1,'scope':'ALL_36_ACTIVE_FACILITIES_PLUS_STRUCTURAL_LID',
        'productionUnit':'ONE_FIELD_ID_PER_ASSET','combinedArtworkRole':'LEGACY_LOOKDEV_ONLY_NOT_A_FIELD_ASSET',
        'runtimeEligible':False,'shippingReady':False,'fields':fields,'excludedUnused':['field_cm33_01','field_cm36_01','field_cm38_01']})
    for field in fields:
        write(OUT/'fields'/field['id']/'spec.json',field)
    write(OUT/'source-locks.json', locks)
    geometry=json.loads(subprocess.check_output(['node','scripts/lib/cage-authoring-geometry.mjs'],cwd=ROOT,encoding='utf-8'))
    write(OUT/'layout-snapshot.json', geometry)
    print(json.dumps({'fields':len(fields),'objects':sum(len(f['objects']) for f in fields),'frames':sum(len(f['frames']) for f in fields),'output':str(OUT)}))


if __name__=='__main__':
    main()
