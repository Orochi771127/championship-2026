"""Headless: per cage master, an object-level ID render for animatable parts
(wind / glow / water), everything else black but still rendered so hidden
parts stay hidden, plus per-object raster anchors (top, bottom, centre)."""
import bpy, json, sys, re, os, mathutils
from bpy_extras.object_utils import world_to_camera_view
args = sys.argv[sys.argv.index('--') + 1:]
out_dir, masters = args[0], json.loads(open(args[1]).read())
only = set(args[2].split(',')) if len(args) > 2 and args[2] else None
WIND = re.compile(r'(bb-net|crown|frond|canopy|-leaf|leaves|banana|fern|vine|tuft|shrub|flower|petal|tulip|hedge|curtain-.*cloth|-paper|flag|banner|grass|bush)')
WIND_NOT = re.compile(r'(stem$|valve|-pot|planter|bed-frame|seat)')
GLOW = re.compile(r'(screen|monitor|-led|glow|beacon|orb|lantern-glow|crystal|bulb|lens|indicator|lamp-head|end-lamp|rig-lamp|-lamp$|cabinet-lamp)')
WATER = re.compile(r'(liquid|ripple|water|trough-water|pond|pool|spring-.*surface)')
WATER_NOT = re.compile(r'(seat|seal|seam|bottle|tower)')
RIG = [('spin', re.compile(r'flywheel$')), ('swing', re.compile(r'-arm-(upper|elbow|fore|wrist|tool)$')),
       ('slide', re.compile(r'-arm-(quill|gripper)$')), ('belt', re.compile(r'(belt-belt|belt-slat|treadmill-\d-belt)(-\d+)*$'))]
def rig_of(n):
    b = re.sub(r'(\.\d+)+$', '', n)
    for mode, rx in RIG:
        if rx.search(b):
            key = re.sub(r'-(arm|belt)-.*$', r'-\1', b) if mode != 'spin' else b
            return mode, key
    return None
def kind(n):
    if rig_of(n): return 'rig'
    b = re.sub(r'([.-]\d+)+$', '', n)
    if WATER.search(b) and not WATER_NOT.search(b): return 'water'
    if GLOW.search(b): return 'glow'
    if WIND.search(b) and not WIND_NOT.search(b): return 'wind'
    return None
for fid, path in masters.items():
    if only and fid not in only: continue
    bpy.ops.wm.open_mainfile(filepath=path)
    sc = bpy.context.scene; cam = sc.camera; W, H = sc.render.resolution_x, sc.render.resolution_y
    def px(v):
        c = world_to_camera_view(sc, cam, v); return [round(c.x * W, 2), round((1 - c.y) * H, 2)]
    objs, k = {}, 0
    for o in sc.objects:
        o.color = (0, 0, 0, 1)
        if o.type not in ('MESH', 'CURVE', 'SURFACE') or o.hide_render: continue
        kd = kind(o.name)
        if not kd: continue
        k += 1
        if k > 65000: break
        col = [(k >> 8) & 255, k & 255, 77]
        o.color = (col[0] / 255, col[1] / 255, col[2] / 255, 1)
        bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
        zmin, zmax = min(v.z for v in bb), max(v.z for v in bb)
        cx, cy = sum(v.x for v in bb) / 8, sum(v.y for v in bb) / 8
        rg = rig_of(o.name)
        objs[o.name] = {'kind': kd, 'rig': rg, 'center': px(mathutils.Vector((cx, cy, (zmin + zmax) / 2))),
                        'wmin': [round(min(v.x for v in bb), 3), round(min(v.y for v in bb), 3)],
                        'wmax': [round(max(v.x for v in bb), 3), round(max(v.y for v in bb), 3)], 'color': col, 'zmin': round(zmin, 3), 'zmax': round(zmax, 3),
                        'top': px(mathutils.Vector((cx, cy, zmax))), 'bottom': px(mathutils.Vector((cx, cy, zmin))),
                        'floor': px(mathutils.Vector((cx, cy, 0.0)))}
    # Glass would hide the liquid it holds; the ambient pass looks through it.
    for o in sc.objects:
        if re.search(r'glass|window-pane', o.name): o.hide_render = True
    # Rig pivots: arm chains swing about their shoulder; belts scroll along
    # their long axis by the slat spacing; flywheels spin about their centre.
    rigs = {}
    for name, o in objs.items():
        if not o['rig']: continue
        mode, key = o['rig']
        r = rigs.setdefault(key, {'mode': mode, 'objects': []}); r['objects'].append(name)
    for key, r in rigs.items():
        if r['mode'] == 'swing':
            sh = next((x for x in sc.objects if re.sub(r'(\.\d+)+$', '', x.name) == key + '-shoulder'), None)
            if sh:
                bb = [sh.matrix_world @ mathutils.Vector(c) for c in sh.bound_box]
                r['pivot'] = px(mathutils.Vector((sum(v.x for v in bb) / 8, sum(v.y for v in bb) / 8, sum(v.z for v in bb) / 8)))
        elif r['mode'] == 'spin':
            r['pivot'] = objs[r['objects'][0]]['center']
        elif r['mode'] == 'belt':
            lo = [min(objs[n]['wmin'][i] for n in r['objects']) for i in (0, 1)]
            hi = [max(objs[n]['wmax'][i] for n in r['objects']) for i in (0, 1)]
            axis = 0 if hi[0] - lo[0] >= hi[1] - lo[1] else 1
            a0 = mathutils.Vector((lo[0], lo[1], 0)); a1 = a0.copy(); a1[axis] = hi[axis]
            p0, p1 = px(a0), px(a1)
            slats = sum(1 for n in r['objects'] if 'slat' in n)
            L = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5
            r['dir'] = [round((p1[0] - p0[0]) / max(L, 1e-6), 4), round((p1[1] - p0[1]) / max(L, 1e-6), 4)]
            r['period'] = round(L / slats, 2) if slats >= 2 else 12.0
        elif r['mode'] == 'slide':
            r['dir'] = [0.0, -1.0]
    # A chain without a shoulder (gantry quills) slides instead of swinging.
    for key, r in rigs.items():
        if r['mode'] == 'swing' and 'pivot' not in r:
            r['mode'] = 'slide'; r['dir'] = [0.0, -1.0]
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'FLAT'; sh.color_type = 'OBJECT'; sh.show_shadows = False; sh.show_cavity = False
    sh.show_object_outline = False; sh.show_specular_highlight = False; sh.show_xray = False
    sc.display.render_aa = 'OFF'; sc.render.film_transparent = True; sc.render.dither_intensity = 0
    sc.view_settings.view_transform = 'Raw'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.color_depth = '8'
    sc.render.filepath = os.path.join(out_dir, f'{fid}-amb.png')
    bpy.ops.render.render(write_still=True)
    json.dump({'fieldId': fid, 'res': [W, H], 'objects': objs, 'rigs': rigs}, open(os.path.join(out_dir, f'{fid}-amb.json'), 'w'))
    print('AMB_DONE', fid, {kk: sum(1 for v in objs.values() if v['kind'] == kk) for kk in ('wind', 'glow', 'water', 'rig')}, {k: v['mode'] for k, v in list(rigs.items())[:6]}, flush=True)
