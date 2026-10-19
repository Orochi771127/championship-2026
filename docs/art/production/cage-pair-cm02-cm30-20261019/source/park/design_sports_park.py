"""Sports-park pair, designed as one park (Owner 2026-10-19 brief: keep each cage's size, hex
footprint and function; plan zones, circulation, planting and facilities like a scene designer;
CM02 = track + all-round training, CM30 = basketball; each complete alone, joined like one park,
no duplicated facilities; bright, lived-in world style shared with the hunt maps).

Zones (native px of each frame):
 CM02  track + infield lawn (core); hurdle drill row on the infield (training); mown practice
       pitch in the bottom lobe so the goal has its own playing area and lines; rest corner in the
       right waist outside the walk cells (paved pad, bench facing the track, drinking fountain,
       shade tree, low flower bed); garden corner in the left waist (tree, shrubs, flower bed);
       dense planting only at the back corners (trees over a shrub layer) -> density falls from
       the back corners to open activity space.
 CM30  basketball court on a paved apron (core); spectator bleacher on the far side instead of a
       bench (no duplicate of CM02's rest corner); ball cart beside the court; small trees in the
       back corners, shrub clumps and one flower bed at the front corners, outside the court.
 Both  the same hunt-style lawn as base ground everywhere else, so any joined edge is one meadow;
       walls, rim, foundation thickness, camera and footprint untouched.
args: <in.blend> <out.blend> <cm02|cm30>
"""
import importlib.util, math, os, sys
import bpy
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
SRC, DST, KIND = args
spec = importlib.util.spec_from_file_location('kit', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cage_park_kit.py'))
k = importlib.util.module_from_spec(spec); spec.loader.exec_module(k)
bpy.ops.wm.open_mainfile(filepath=SRC)
sc = bpy.context.scene
FIELD = next(o.name[:-len('-surface')] for o in sc.objects if o.name.endswith('-surface'))
surface = bpy.data.objects[FIELD + '-surface']


def remove(prefixes=(), roles=(), materials=()):
    for o in list(sc.objects):
        mats = [m.name for m in getattr(o.data, 'materials', []) if m] if o.data else []
        if o.name.startswith(tuple(prefixes)) or o.get('objectRole') in roles or any(m in materials for m in mats):
            bpy.data.objects.remove(o, do_unlink=True)


def shift(prefix, dx_native, dy_native):
    d = k.W(dx_native, dy_native) - k.W(0, 0)
    for o in sc.objects:
        if o.name.startswith(prefix): o.location += d


# shared base ground: the hunt lawn material on the cage floor
k.lawn_material(surface.data.materials[0])

if KIND == 'cm02':
    remove(prefixes=('ground-hedge',))
    # infield is lawn too (same material keeps one meadow); lines/track untouched
    for o in sc.objects:
        if o.name.startswith('ground-infield'):
            o.data.materials.clear(); o.data.materials.append(surface.data.materials[0])
    # hurdle drill: both hurdles in a row on the left infield, behind the warm-up line
    shift('cm02-04-hurdle', 57 - 138 + 30, 58 - 98)
    # practice pitch in the bottom lobe; lines lifted onto the turf
    turf = k.turf_material('kit-pitch-turf', 45, .40)   # stripes run across the pitch (screen-horizontal)
    lobe = [(55, 108), (137, 108), (137, 173), (96, 194), (55, 173)]   # the bottom lobe, inset from its edges
    k.slab('pitch-turf', lobe, -.004, .006, turf, FIELD, 'pitch')
    line_white = k.mat('kit-line-white', (.97, .97, .95), .5)
    for o in sc.objects:
        if o.name.startswith(('ground-goal', 'ground-penalty')):
            o.location.z += .012
            if o.type == 'CURVE': o.data.bevel_depth = max(o.data.bevel_depth, .028)
            o.data.materials.clear(); o.data.materials.append(line_white)
    # rest corner: the small triangle right of the track's lower curve, kept inside the hex edge
    # (lower-right edge: y = 88 + (192 - x) / 2), mostly off the walk cells
    pave = k.paving_material('kit-paving')
    k.slab('rest-paving', [(148, 88), (184, 80), (189, 87), (162, 100), (149, 101)], -.004, .008, pave, FIELD, 'rest-plaza')
    k.bench('rest-bench', 162, 91, 18, 1, FIELD)
    k.fountain('rest-fountain', 182, 85, FIELD)
    k.tree('rest-tree', 176, 68, 2.6, 13, 11, FIELD)
    k.flower_bed('rest-bed', k.ellipse(140, 106, 7, 3.5, wob=.12, seed=3), 3, FIELD)
    # garden corner (left waist)
    k.tree('garden-tree', 24, 102, 2.6, 15, 21, FIELD)
    k.shrub('garden-shrub-a', 40, 106, 9, .7, 22, FIELD)
    k.flower_bed('garden-bed', k.ellipse(48, 96, 11, 5, wob=.12, seed=4), 4, FIELD)
    # back corners: trees over a shrub layer (densest planting, farthest from play)
    for i, (x, y, h, cr) in enumerate(((164, 34, 2.8, 14), (176, 44, 2.4, 12), (18, 42, 2.8, 15))):
        k.tree(f'back-tree-{i}', x, y, h, cr, 31 + i, FIELD)
    for i, (x, y, r, h) in enumerate(((158, 26, 8, .6), (186, 88, 7, .55), (32, 22, 7, .5), (8, 60, 7, .55))):
        k.shrub(f'back-shrub-{i}', x, y, r, h, 41 + i, FIELD)
    # soft lawn blades over the open lawn (outside the track, pitch, plaza and beds)
    lawn_pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    import random
    rnd = random.Random(7)
    for gy in range(0, 200):
        for gx in range(0, 192):
            x, y = gx + rnd.uniform(-.45, .45), gy + rnd.uniform(-.45, .45)
            p = k.W(x, y, 2.0)
            ok, loc, nrm, idx, ob, mtx = sc.ray_cast(dg, p, Vector((0, 0, -1)))
            if ok and ob is not None and ob.data and ob.data.materials and ob.data.materials[0] == surface.data.materials[0] and loc.z < .02:
                lawn_pts.append((x, y))
    k.blades('cm02-lawn', lawn_pts, .0, ('kit-lawn-1', 'kit-lawn-2', 'kit-lawn-2', 'kit-lawn-3'), field=FIELD)
    print('PARK_CM02 lawn tufts', len(lawn_pts))

else:
    remove(roles=('bench',), prefixes=('mini-hedge', 'rf-'))
    court = bpy.data.objects['bb-court']
    # paved apron around the court (finished edge, same paving as CM02's rest corner)
    pave = k.paving_material('kit-paving')
    lb = court.bound_box
    x0, x1 = min(c[0] for c in lb), max(c[0] for c in lb); y0, y1 = min(c[1] for c in lb), max(c[1] for c in lb)
    m = .22
    corners = [court.matrix_world @ Vector((x, y, 0)) for x, y in ((x0 - m, y0 - m), (x1 + m, y0 - m), (x1 + m, y1 + m), (x0 - m, y1 + m))]
    k.slab('court-apron', [k.nat(c) for c in corners], -.004, .004, pave, FIELD, 'court-apron')
    # bleacher on the far long side (spectators; CM02 keeps the benches)
    k.bleacher('court-bleacher', 54, 30, 30, FIELD)
    # planting: small trees in the back corners, shrubs and a bed at the front corners
    k.tree('corner-tree-l', 14, 40, 2.4, 13, 51, FIELD)
    k.tree('corner-tree-r', 84, 44, 2.3, 12, 52, FIELD)
    k.shrub('front-shrub-l', 16, 84, 8, .6, 53, FIELD)
    k.shrub('front-shrub-r', 80, 90, 7, .55, 54, FIELD)
    k.flower_bed('front-bed', k.ellipse(40, 100, 12, 4.5, wob=.12, seed=5), 5, FIELD)
    import random
    dg = bpy.context.evaluated_depsgraph_get(); rnd = random.Random(8); lawn_pts = []
    for gy in range(0, 112):
        for gx in range(0, 96):
            x, y = gx + rnd.uniform(-.45, .45), gy + rnd.uniform(-.45, .45)
            ok, loc, nrm, idx, ob, mtx = sc.ray_cast(dg, k.W(x, y, 2.0), Vector((0, 0, -1)))
            if ok and ob is not None and ob.data and ob.data.materials and ob.data.materials[0] == surface.data.materials[0] and loc.z < .02:
                lawn_pts.append((x, y))
    k.blades('cm30-lawn', lawn_pts, .0, ('kit-lawn-1', 'kit-lawn-2', 'kit-lawn-2', 'kit-lawn-3'), field=FIELD)
    print('PARK_CM30 lawn tufts', len(lawn_pts))

bpy.ops.wm.save_as_mainfile(filepath=DST)
print('PARK_DONE', KIND, DST)
