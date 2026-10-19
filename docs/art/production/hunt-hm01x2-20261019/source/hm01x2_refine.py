"""HM01x2 refinement pass (Owner 2026-10-19: find why the maps look rough, fix it at the source).

Diagnosis against the original art and the user's reference stills, same zoom:
  1. the meadow only had low-frequency colour clouds: no blade-scale detail, so it read as blur;
  2. those clouds were darker patches that looked like soft shadows -> a foggy, grey field;
  3. the original's ground vocabulary was missing: dirt fields with gravel cores, lush tall-grass
     zones, light clover patches and small rocks on the lawn (user, 2026-10-19: "原作這裡就有石頭，
     然後還有泥土地");
  4. cliff tops followed the 8 px tile staircase;
  5. 96-sample renders without denoising left grain.
Fixes (offline only; the runtime still shows one image per frame, so phones pay nothing):
  * ground classes per tile (hm01x2-ground-classes.npy: original layout read at tile granularity,
    new ground procedural) drive the ground material through a smooth class texture with noisy edges;
  * a soft, dense lawn of fine short blades in close tints (user: softer, finer, denser grass);
  * real tall-grass blades in the tall-grass zones; low clover with a few white flowers only there
    (user: the scattered small flowers were too busy);
  * small rocks set into the lawn at the original's rock positions;
  * rounded cliff contours that never leave their blocked tiles (shrink-only); denoised renders.
"""
import json
import math
import os
import random
from pathlib import Path

import numpy as np

from . import cage_opus_facility_authoring as fx
from . import hunt_opus_kit as hk
from . import hunt_opus_terrain as t
from . import maps_materials_v2 as mv

_n, _m, _ramp, _mix = mv._n, mv._m, mv._ramp, mv._mix
OUT = Path(os.environ.get('HM01X2_OUT', Path(__file__).resolve().parents[3] / 'out'))
DIRT, GRAVEL, TALL, CLOVER = 1, 2, 3, 4
_CLASSES = None


def classes():
    global _CLASSES
    if _CLASSES is None:
        _CLASSES = np.load(OUT / 'hm01x2-ground-classes.npy')
    return _CLASSES


def class_at(x, y):
    c = classes(); tx, ty = int(x // t.TILE), int(y // t.TILE)
    return int(c[ty, tx]) if 0 <= ty < c.shape[0] and 0 <= tx < c.shape[1] else 0


def class_image():
    """RGBA (dirt, gravel, tall grass, clover) at 2 px per native px, softly blurred."""
    import bpy
    c = classes(); H, W = c.shape; k = t.TILE // 2   # 4 px per tile cell -> 2 native px per texel
    chans = []
    for v in (DIRT, GRAVEL, TALL, CLOVER):
        m = np.repeat(np.repeat((c == v).astype(np.float32), k, 0), k, 1)
        if v == DIRT:   # gravel lies on dirt: dirt covers gravel tiles too
            m = np.maximum(m, np.repeat(np.repeat((c == GRAVEL).astype(np.float32), k, 0), k, 1))
        for _ in range(14):
            p = np.pad(m, 1, mode='edge')
            m = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + p[1:-1, 1:-1] * 2) / 6
        chans.append(m)
    rgba = np.stack(chans, -1)[::-1]   # Blender images start at the bottom row
    img = bpy.data.images.new('hm01x2-ground-classes', W * k, H * k, alpha=True, float_buffer=True)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.pack()
    return img


def _native_uv(nodes, links, geo):
    """World position -> native px -> UV of the class image (inverse of d.world)."""
    sep = nodes.new('ShaderNodeSeparateXYZ'); links.new(geo.outputs['Position'], sep.inputs[0])
    k = 16 * math.sqrt(2) / 2
    s = math.sin(math.radians(52))
    nx = _m(nodes, links, 'MULTIPLY', _m(nodes, links, 'ADD', sep.outputs['X'], sep.outputs['Y']), k / t.NATIVE)
    ny = _m(nodes, links, 'MULTIPLY', _m(nodes, links, 'SUBTRACT', sep.outputs['X'], sep.outputs['Y']), k * s / t.NATIVE)
    comb = nodes.new('ShaderNodeCombineXYZ')
    links.new(nx, comb.inputs['X']); links.new(_m(nodes, links, 'SUBTRACT', 1.0, ny), comb.inputs['Y'])
    return comb.outputs[0]


def grass_ground(d, name):
    mat = d.material(name, (.30, .54, .12), .9, .0)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    sh = nodes.get('Principled BSDF')
    geo = nodes.new('ShaderNodeNewGeometry')
    tex = nodes.new('ShaderNodeTexImage'); tex.image = class_image(); tex.interpolation = 'Linear'; tex.extension = 'EXTEND'
    links.new(_native_uv(nodes, links, geo), tex.inputs['Vector'])
    sepc = nodes.new('ShaderNodeSeparateColor'); links.new(tex.outputs['Color'], sepc.inputs[0])
    edge = _n(nodes, 'ShaderNodeTexNoise', Scale=1.1, Detail=6.0, Roughness=.62)
    links.new(geo.outputs['Position'], edge.inputs['Vector'])
    wig = _m(nodes, links, 'MULTIPLY', _m(nodes, links, 'SUBTRACT', edge.outputs['Fac'], .5), .62)
    def mask(chan, lo=.42, hi=.50, src=None):
        v = _m(nodes, links, 'ADD', src if src is not None else sepc.outputs[chan], wig)
        mr = nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = lo; mr.inputs['From Max'].default_value = hi
        links.new(v, mr.inputs['Value']); return mr.outputs['Result']
    # soft lawn: gentle hue drift, very fine low-contrast blade texture (no dark clouds)
    hue = _n(nodes, 'ShaderNodeTexNoise', Scale=.09, Detail=3.0, Roughness=.5)
    links.new(geo.outputs['Position'], hue.inputs['Vector'])
    base = _ramp(nodes, links, hue.outputs['Fac'], [(.25, (.22, .45, .10)), (.50, (.27, .50, .11)), (.80, (.34, .55, .12))])
    fine = _n(nodes, 'ShaderNodeTexNoise', Scale=14.0, Detail=2.0, Roughness=.4)
    links.new(geo.outputs['Position'], fine.inputs['Vector'])
    base = _mix(nodes, links, .12, base, fine.outputs['Fac'], 'OVERLAY')
    # tall-grass zones: deeper green underneath the tall blades
    base = _mix(nodes, links, mask('Blue', .35, .55), base, (.12, .32, .08))
    # clover: lighter, cooler green
    base = _mix(nodes, links, mask('Alpha' if False else 'Blue', .35, .55, src=tex.outputs['Alpha']), base, (.36, .62, .20))
    # dirt fields with crisp wiggly edge, gravel cores
    dn = _n(nodes, 'ShaderNodeTexNoise', Scale=6.0, Detail=6.0)
    links.new(geo.outputs['Position'], dn.inputs['Vector'])
    dirt = _ramp(nodes, links, dn.outputs['Fac'], [(.3, (.30, .23, .15)), (.55, (.37, .29, .19)), (.8, (.45, .36, .25))])
    clod = _n(nodes, 'ShaderNodeTexVoronoi', Scale=9.0)
    links.new(geo.outputs['Position'], clod.inputs['Vector'])
    dirt = _mix(nodes, links, .35, dirt, _ramp(nodes, links, clod.outputs['Distance'], [(.0, (.62, .5, .36)), (.5, (.42, .30, .18))]), 'OVERLAY')
    # darker, damp rim just inside the dirt edge (the field sits a touch lower than the lawn)
    inner = mask('Red', .52, .66)
    dirt = _mix(nodes, links, _m(nodes, links, 'SUBTRACT', 1.0, inner), dirt, (.24, .16, .09), 'MIX')
    base = _mix(nodes, links, mask('Red'), base, dirt)
    peb = _n(nodes, 'ShaderNodeTexVoronoi', Scale=16.0)
    links.new(geo.outputs['Position'], peb.inputs['Vector'])
    gravel = _ramp(nodes, links, peb.outputs['Distance'], [(.0, (.58, .56, .51)), (.30, (.45, .43, .39)), (.42, (.27, .25, .22))])
    base = _mix(nodes, links, mask('Green', .40, .52), base, gravel)
    links.new(base, sh.inputs['Base Color'])
    bump = _n(nodes, 'ShaderNodeBump', Strength=.30, Distance=.02)
    links.new(_mix(nodes, links, .5, fine.outputs['Fac'], peb.outputs['Distance']), bump.inputs['Height'])
    links.new(bump.outputs[0], sh.inputs['Normal'])
    return mat


def _mats(d):
    if 'rf-lawn-1' in d.M:
        return
    for name, col in (('rf-lawn-1', (.25, .48, .10)), ('rf-lawn-2', (.27, .505, .11)), ('rf-lawn-3', (.295, .53, .12)),
                      ('rf-tall-1', (.10, .30, .07)), ('rf-tall-2', (.15, .38, .09)), ('rf-tall-3', (.21, .45, .11)),
                      ('rf-clover', (.30, .58, .18)), ('rf-petal-w', (.97, .97, .93)), ('rf-eye', (.98, .78, .16))):
        m = d.material(name, col, .75, .0)
        b = m.node_tree.nodes.get('Principled BSDF')
        if 'Subsurface Weight' in b.inputs and (name.startswith('rf-lawn') or name.startswith('rf-tall')):
            b.inputs['Subsurface Weight'].default_value = .2


def _blades(d, name, pts, mats, n, h, w, lean, seed):
    rnd = random.Random(seed)
    buckets = {m: ([], []) for m in mats}
    for (x, y) in pts:
        for b in range(rnd.randint(*n)):
            verts, faces = buckets[mats[rnd.randrange(len(mats))]]
            ox, oy = rnd.uniform(-1.8, 1.8), rnd.uniform(-.8, .8)
            hh = rnd.uniform(*h); ww = rnd.uniform(*w); ln = rnd.uniform(-lean, lean)
            i = len(verts)
            verts += [d.world(x + ox - ww, y + oy, 0.0), d.world(x + ox + ww, y + oy, 0.0), d.world(x + ox + ln, y + oy, hh)]
            faces.append((i, i + 1, i + 2))
    for mat, (verts, faces) in buckets.items():
        if faces:
            obj = fx._object(d, f'{name}-{mat}', verts, faces, mat, 0.0)
            obj['huntLayer'] = 'ground'


def lawn(d, ctx, h, seed=505):
    from .hunt_opus_themes import walk_points
    _mats(d)
    pts = [p for p in walk_points(ctx, 2.0, ctx.seed + seed, clearance=0) if class_at(*p) in (0, CLOVER)]
    _blades(d, 'rf-lawn', pts, ('rf-lawn-1', 'rf-lawn-2', 'rf-lawn-2', 'rf-lawn-3'), (3, 5), (.04, .08), (.22, .36), .5, seed)
    ctx.count('lawnTufts', len(pts))
    tall = [p for p in walk_points(ctx, 2.4, ctx.seed + seed + 1, clearance=0) if class_at(*p) == TALL]
    _blades(d, 'rf-tall', tall, ('rf-tall-1', 'rf-tall-2', 'rf-tall-2', 'rf-tall-3'), (6, 9), (.22, .42), (.35, .6), 1.6, seed + 1)
    ctx.count('tallGrassTufts', len(tall))
    # dirt edges: a fringe of lawn blades overhanging the dirt rim
    rim = [p for p in walk_points(ctx, 3.0, ctx.seed + seed + 2, clearance=0)
           if class_at(*p) == DIRT and any(class_at(p[0] + dx, p[1] + dy) == 0 for dx, dy in ((8, 0), (-8, 0), (0, 8), (0, -8)))]
    _blades(d, 'rf-rim', rim, ('rf-lawn-1', 'rf-lawn-2'), (2, 4), (.05, .10), (.3, .45), .7, seed + 2)


def clover(d, ctx, h, seed=606):
    """Low clover leaves (three round leaflets) and a few white flowers, only in clover patches."""
    from .hunt_opus_themes import walk_points
    _mats(d)
    rnd = random.Random(seed)
    leaves, flowers, eyes = ([], []), ([], []), ([], [])
    def disc(buf, x, y, z, r, n=7, sq=.6):
        verts, faces = buf; c = len(verts); verts.append(d.world(x, y, z))
        for j in range(n): a = j * math.tau / n; verts.append(d.world(x + math.cos(a) * r, y + math.sin(a) * r * sq, z))
        faces += [(c, c + 1 + j, c + 1 + (j + 1) % n) for j in range(n)]
    pts = [p for p in walk_points(ctx, 3.2, ctx.seed + seed, clearance=0) if class_at(*p) == CLOVER]
    for (x, y) in pts:
        z = rnd.uniform(.04, .08)
        for j in range(3):
            a = j * math.tau / 3 + rnd.uniform(0, 1)
            disc(leaves, x + math.cos(a) * 1.1, y + math.sin(a) * .7, z, 1.15)
        if rnd.random() < .14:
            fz = z + rnd.uniform(.06, .12)
            disc(flowers, x, y - .4, fz, 1.5, 10, .6); disc(eyes, x, y - .45, fz + .01, .45, 5, .6)
    for name, (verts, faces), mat in (('rf-clover-leaves', leaves, 'rf-clover'), ('rf-clover-flowers', flowers, 'rf-petal-w'), ('rf-clover-eyes', eyes, 'rf-eye')):
        if faces:
            obj = fx._object(d, name, verts, faces, mat, 0.0); obj['huntLayer'] = 'ground'
    ctx.count('cloverTufts', len(pts))


def rocks(d, ctx, h):
    """Small rocks set into the lawn at the original's rock positions (and a few on the new ground)."""
    rec = json.loads((OUT / 'hm01x2-ground-decor.json').read_text())
    for k, (x, y, size) in enumerate(rec['rocks']):
        if ctx.grid[int(y // t.TILE), int(x // t.TILE)] != t.WALK:
            continue
        hk.boulder(d, f'rf-rock-{k}', x, y, max(6.0, size * 1.05), .42, 'hn-rock', k, -.08)
        ctx.count('lawnRocks')


def pebbles(d, ctx, h, seed=808):
    """Loose pebbles on gravel and a few on dirt: one low-poly mesh, varied greys."""
    from .hunt_opus_themes import walk_points
    rnd = random.Random(seed)
    for name, col in (('rf-peb-1', (.52, .50, .46)), ('rf-peb-2', (.66, .63, .58)), ('rf-peb-3', (.40, .37, .33))):
        if name not in d.M:
            d.material(name, col, .85, .0)
    buckets = {m: ([], []) for m in ('rf-peb-1', 'rf-peb-2', 'rf-peb-3')}
    pts = [p for p in walk_points(ctx, 2.2, ctx.seed + seed, clearance=0) if class_at(*p) == GRAVEL]
    pts += [p for p in walk_points(ctx, 9.0, ctx.seed + seed + 1, clearance=0) if class_at(*p) == DIRT]
    for (x, y) in pts:
        verts, faces = buckets[('rf-peb-1', 'rf-peb-2', 'rf-peb-3')[rnd.randrange(3)]]
        r = rnd.uniform(.7, 1.7); hz = r * rnd.uniform(.05, .09); a0 = rnd.uniform(0, math.tau)
        c = len(verts); verts.append(d.world(x, y, hz))
        for j in range(6):
            a = a0 + j * math.tau / 6; rr = r * rnd.uniform(.75, 1.15)
            verts.append(d.world(x + math.cos(a) * rr, y + math.sin(a) * rr * .65, 0.0))
        faces += [(c, c + 1 + j, c + 1 + (j + 1) % 6) for j in range(6)]
    for mat, (verts, faces) in buckets.items():
        if faces:
            obj = fx._object(d, f'rf-pebbles-{mat}', verts, faces, mat, 0.0); obj['huntLayer'] = 'ground'
    ctx.count('pebbles', len(pts))


def dress(d, ctx, h):
    lawn(d, ctx, h)
    pebbles(d, ctx, h)
    clover(d, ctx, h)
    rocks(d, ctx, h)


def rounded_relief(original):
    """Wrap t.relief: cliff tops follow a rounded, slightly wiggled contour inside the blocked mask."""
    def relief(grid, relief_mask, height, rise_px, roughness=.22, seed=1, margin_px=3.0, water_depth=.14, shore_noise=.05,
               tile_height=None):
        h = original(grid, relief_mask, height, rise_px, roughness, seed, margin_px, water_depth, shore_noise, tile_height)
        mp = np.pad(relief_mask, t.PAD, mode='edge').astype(np.float64)
        cov = t.fine_mask(mp)
        for _ in range(6):   # box blur at 4 px, six passes ~ gaussian of ~10 px
            p = np.pad(cov, 1, mode='edge')
            cov = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:] + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9
        pv = np.pad(cov, 1, mode='edge')
        cv = (pv[:-1, :-1] + pv[:-1, 1:] + pv[1:, :-1] + pv[1:, 1:]) / 4
        noise = t.value_noise(cv.shape, 5.0, seed + 31) - .5
        keep = cv + .10 * noise > .56
        return np.where((h > 0) & ~keep, 0.0, h)
    return relief
