import bpy, math, json, sys
from mathutils import Vector
S = math.sin(math.radians(52)); K = 16 * math.sqrt(2) / 2
out = {}
for o in bpy.context.scene.objects:
    role = o.get('objectRole')
    if role not in ('hoop', 'bench', 'ball-cart') or o.type not in ('MESH', 'CURVE'): continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    if min(v.z for v in bb) > .2: continue     # parts on or just above the ground
    for v in bb:
        x = (v.x + v.y) * K; y = (v.x - v.y) * K * S
        out.setdefault(role, set()).add((int(x // 8), int(y // 8)))
rects = {k: [min(c[0] for c in v), min(c[1] for c in v), max(c[0] for c in v), max(c[1] for c in v)] for k, v in out.items() if k != 'hoop'}
print('PROP_CELLS', json.dumps({'hoopCells': sorted(out.get('hoop', ())), 'rects': rects}))
