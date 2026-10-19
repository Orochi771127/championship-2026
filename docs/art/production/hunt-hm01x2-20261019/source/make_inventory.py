"""HM01x2 object inventory (180x180) + hunt-scene copy for the pipeline.
Original caves/islands/layer objects keep their coordinates; the new cave comes from its
escape-anchor pair; every new small blocked island gets a prop so it never reads as bare ground;
the tram car is a landmark footprint. args: <out_dir> <pipeline_root> <hunt-scene.r1.json>"""
import json, sys, os, hashlib
import numpy as np
sys.path.insert(0, os.path.join(sys.argv[2], 'scripts'))
from lib import hunt_opus_terrain as t
OUT, PIPE, SCENE = sys.argv[1:4]
grid = np.load(os.path.join(OUT, 'hm01x2-terrain.npy')).astype(np.int8)
met = json.load(open(os.path.join(OUT, 'hm01x2-metrics.json')))
r11 = json.load(open(os.path.join(PIPE, 'docs/art/production/original-maps-r1/hunt/object-inventory.r11.json')))
inv = json.loads(json.dumps(r11['terrains']['hm01']))
cx, cy = met['cave']
inv['caves'].append({'kind': 'cave', 'anchorTiles': [[cx, cy], [cx + 1, cy]], 'corridorTiles': [cx, cy, cx + 1, 162],
                     'mouthYNative': 163 * 8, 'centreXNative': (cx + 1) * 8, 'depthTiles': 162 - cy + 1, 'source': 'escapeAnchor'})
car = met['car']
inv['landmarks'] = [{'kind': 'tram-car', 'bboxTiles': car, 'note': 'HM01x2 world-intrusion landmark; scenery only'}]
named = {tuple(b): k for k, b in met['props']}
comps, label = t.components(grid == t.BLOCK)
orig_boxes = [tuple(i['bboxTiles']) for i in inv['islands']]
added = []
for c in comps:
    if c['edge'] or c['area'] > 64: continue
    x0, y0, x1, y1 = c['bbox']
    if x1 < 127 and y1 < 127: continue          # original islands keep their R11 records
    if car[0] <= x0 and x1 <= car[2] and car[1] <= y0 and y1 <= car[3]: continue
    kind = named.get((x0, y0, x1, y1))
    if kind is None:
        kind = 'boulder' if c['area'] <= 6 else ('bush-big' if c['area'] <= 12 else 'tree-round')
    kinds = [kind] if kind != 'tree-round' or c['area'] < 30 else ['tree-round', 'tree-round']
    added.append({'kinds': kinds, 'bboxTiles': [x0, y0, x1, y1], 'area': c['area'],
                  'centreNative': [(x0 + x1 + 1) * 4, (y0 + y1 + 1) * 4], 'baseYNative': (y1 + 1) * 8, 'anchorsNative': []})
inv['islands'] += added
inv['terrainSha256'] = t.grid_sha(grid)
doc = {'schemaVersion': 1, 'status': 'HM01X2_LOCAL_REVIEW', 'note': 'R11 hm01 inventory + 180x180 rebuild additions', 'terrains': {'hm01': inv}}
dst = os.path.join(PIPE, 'docs/art/production/original-maps-r1/hunt/object-inventory.json')
json.dump(doc, open(dst, 'w'), indent=1)
scene = json.load(open(SCENE, encoding='utf-8'))
exp = json.load(open(os.path.join(OUT, 'hunt-hm01x2.review.json'), encoding='utf-8'))
for fid, env in exp['environments'].items(): scene['environments'][fid] = env
json.dump(scene, open(os.path.join(PIPE, 'src/data/championship/catalogs/hunt-scene.r1.json'), 'w', encoding='utf-8'), separators=(',', ':'))
print('islands added', len(added), {k: sum(1 for a in added if k in a['kinds']) for k in {k for a in added for k in a['kinds']}}, 'sha', inv['terrainSha256'][:12])
