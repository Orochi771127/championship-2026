"""Write the walk data of the two gachapon royal cages into ranch-three-ground.r1.json (Owner 2026-11-03).

python scripts/build-royal-cage-ground.py [--check]

Walkability lives in this data, not in the picture: scripts/lib/royal_cage_layout.py decides it and both the
Blender map (scripts/build-royal-cage-maps.py) and the ground paint read the same layout. Each field is the
waiting room's 30 x 25 tiles. Runs are [count, owner, terrain, clearance] like every other field:
walkable tiles are [1, 0, d] (d = tiles to the nearest unwalkable tile, capped at 4, as the originals),
buildings, the fountain and the pool are owned but blocked [1, 1, 0], everything else is [0, -1, 0].
--check exits non-zero when the stored entries differ from the layout.
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import royal_cage_layout as L

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'championship', 'catalogs', 'ranch-three-ground.r1.json')
FIELDS = {36: 'ROYAL_RANCH', 37: 'STELLAR_ZOO'}


def field(definition, edition):
    walk = L.walk_tiles(edition)
    W, H = L.TILES_W, L.TILES_H
    cells = []
    for y in range(H):
        for x in range(W):
            if walk[y][x]:
                d = 1
                while d < 4 and all(0 <= x + dx < W and 0 <= y + dy < H and walk[y + dy][x + dx]
                                    for dx in range(-d, d + 1) for dy in range(-d, d + 1)):
                    d += 1
                cells.append((1, 0, d))
            elif L.obstacle_hit(edition, x * 8 + 4, y * 8 + 4) and L.rim_distance(x * 8 + 4, y * 8 + 4) > 0:
                cells.append((1, 1, 0))
            else:
                cells.append((0, -1, 0))
    runs, clear = [], []
    for c in cells:
        if runs and tuple(runs[-1][1:]) == c:
            runs[-1][0] += 1
        else:
            runs.append([1, *c])
        if clear and clear[-1][1] == c[2]:
            clear[-1][0] += 1
        else:
            clear.append([1, c[2]])
    return {'definitionIndex': definition, 'width': W, 'height': H, 'runs': runs, 'clearanceRuns': clear}


with open(PATH, encoding='utf-8') as f:
    doc = json.load(f)
wanted = {d: field(d, e) for d, e in FIELDS.items()}
current = {f['definitionIndex']: f for f in doc['fields'] if f['definitionIndex'] in FIELDS}
if '--check' in sys.argv:
    bad = [d for d in FIELDS if current.get(d) != wanted[d]]
    print('ROYAL_GROUND_CHECK', 'OK' if not bad else f'DIFFERS {bad}')
    sys.exit(1 if bad else 0)
doc['fields'] = [f for f in doc['fields'] if f['definitionIndex'] not in FIELDS] + [wanted[d] for d in sorted(FIELDS)]
with open(PATH, 'w', encoding='utf-8', newline='\n') as f:
    f.write(json.dumps(doc, indent=2, ensure_ascii=False) + '\n')
for d, e in FIELDS.items():
    walkable = sum(r[0] for r in wanted[d]['runs'] if r[1] == 1 and r[2] == 0)
    print('ROYAL_GROUND', d, e, 'walkable', walkable)
