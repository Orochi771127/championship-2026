"""Original gas chamber for the opus round: cm23 (毒氣室).

Intent from the field spec: sealed processing cylinders and yellow-green warning
equipment.  Design:

* Floor: steel tread plate where residents walk, dark grimy concrete on the
  blocked tiles, yellow-black hazard bands in front of the equipment.
* Blocked back row: a pipe manifold with a red valve wheel and a control
  cabinet with yellow and green warning lamps (kept low enough that the
  layout's top crop leaves it readable).
* Blocked right column of the upper hex: two tall sealed processing cylinders
  with domed tops, glowing green level rings and yellow base bands.
* Blocked lower-right corner: a horizontal process tank on saddles; toxic
  waste drums on the blocked lower-left band of the upper hex; a floor drain
  grating on the blocked left strip of the lower hex.
* Source objects: three low floor pipelines (the original's pipe railing
  positions) with hazard bands and valves, a floor-standing warning beacon,
  and two eight-pose toxic gas plumes (volumetric yellow-green puffs that rise,
  grow and thin out; one leaks from the left pipeline, one from the tank).

Walkability comes from the product's raising-ground catalog; tall equipment
only stands on blocked tiles, and everything south of a walked tile stays low.
Research rasters were viewed locally only; nothing is loaded or traced, and no
lettering or symbol is used.
"""
import math

from . import cage_footprint_fit as fit
from . import cage_opus_containment_v2 as containment
from . import cage_opus_facility_authoring as fx
from . import cage_opus_ground_zones as gz
from . import cage_opus_remaining_authoring as kit


FIELDS = ('field_cm23_01',)
CONTAINMENT = 'cage_opus_containment_v2'
SURFACES = {'field_cm23_01': 'tx-floor'}
DEPENDENCIES = ('cage_opus_facility_authoring', 'cage_opus_remaining_authoring', 'cage_opus_ground_zones',
                'cage_authoring_coordinates')
ART_DIRECTION_INPUTS = ['LOCAL_RESEARCH_INTENT_ONLY',
                        'src/data/championship/catalogs/raising-ground.r1.json walkable tiles (gameplay data)']
CONTRACTS = {}
U, V = fx.U, fx.V
DESIGN_MARGIN = 1.35
NATIVE = (144, 200)

PALETTE = {
    'tx-steel': ((.42, .45, .47), .40, .60, 0),
    'tx-steel-dark': ((.16, .17, .18), .50, .50, 0),
    'tx-tank': ((.28, .40, .30), .45, .30, 0),
    'tx-tank-light': ((.46, .58, .42), .45, .30, 0),
    'tx-glow': ((.58, 1.0, .22), .30, .0, 3.0),
    'tx-hazard-yellow': ((.95, .76, .06), .50, .0, 0),
    'tx-hazard-black': ((.05, .05, .05), .60, .0, 0),
    'tx-valve': ((.78, .10, .06), .45, .10, 0),
    'tx-pipe': ((.24, .34, .27), .45, .40, 0),
    'tx-pipe-thin': ((.40, .42, .40), .45, .50, 0),
    'tx-drum': ((.60, .70, .10), .55, .10, 0),
    'tx-drum-band': ((.06, .06, .06), .60, .0, 0),
    'tx-lamp-yellow': ((1.0, .78, .12), .30, .0, 3.0),
    'tx-lamp-green': ((.45, 1.0, .30), .30, .0, 3.0),
    'tx-beacon': ((.84, 1.0, .18), .25, .0, 4.0),
    'tx-cabinet': ((.34, .38, .36), .50, .30, 0),
    'tx-gauge': ((.92, .92, .88), .40, .0, .2),
    'tx-grate': ((.07, .08, .08), .60, .40, 0),
    'tx-wall': ((.19, .21, .22), .55, .45, 0),
    'tx-wall-rib': ((.12, .13, .14), .50, .50, 0),
}
GAS = (('tx-gas-0', 22.0), ('tx-gas-1', 14.0), ('tx-gas-2', 7.5))


# --------------------------------------------------------------------------- materials

def _gas_volume(d, name, density_scale):
    """Toxic gas: a yellow-green volume that fades to nothing at the puff's surface."""
    import bpy
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes.get('Principled BSDF'))
    output = nodes.get('Material Output')
    volume = nodes.new('ShaderNodeVolumePrincipled')
    volume.inputs['Color'].default_value = (.66, .95, .20, 1)
    volume.inputs['Emission Color'].default_value = (.58, .98, .16, 1)
    volume.inputs['Emission Strength'].default_value = .90
    coords = nodes.new('ShaderNodeTexCoord')
    radial = nodes.new('ShaderNodeVectorMath')
    radial.operation = 'LENGTH'
    links.new(coords.outputs['Object'], radial.inputs[0])
    falloff = nodes.new('ShaderNodeMapRange')
    falloff.inputs['From Min'].default_value = 1.0
    falloff.inputs['From Max'].default_value = .15
    falloff.inputs['To Min'].default_value = 0.0
    falloff.inputs['To Max'].default_value = 1.0
    links.new(radial.outputs['Value'], falloff.inputs['Value'])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2.6
    noise.inputs['Detail'].default_value = 3.0
    links.new(coords.outputs['Object'], noise.inputs['Vector'])
    shaped = nodes.new('ShaderNodeMath')
    shaped.operation = 'MULTIPLY'
    links.new(falloff.outputs['Result'], shaped.inputs[0])
    links.new(noise.outputs['Fac'], shaped.inputs[1])
    density = nodes.new('ShaderNodeMath')
    density.operation = 'MULTIPLY'
    density.inputs[1].default_value = density_scale
    links.new(shaped.outputs[0], density.inputs[0])
    links.new(density.outputs[0], volume.inputs['Density'])
    links.new(volume.outputs[0], output.inputs['Volume'])
    d.M[name] = mat
    return mat


def prepare(d, cell_id):
    fx.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)
    for name, density in GAS:
        if name not in d.M:
            _gas_volume(d, name, density)
    if 'tx-floor' not in d.M:
        plate = kit._noise_mix(d, 'tx-plate', (.23, .25, .26), (.20, .22, .23), 5.0, .50, .15, .45,
                               spots=((.30, .32, .33), 22.0, .07))
        dark = kit._noise_mix(d, 'tx-floor-dark', (.15, .16, .16), (.12, .13, .13), 2.0, .50, .20, .85,
                              spots=((.20, .23, .11), 6.0, .05))
        walk = gz.walk_tiles('field_cm23_01')
        w, h = NATIVE[0] // 8, NATIVE[1] // 8
        values = {(tx, ty): (1.0 if (tx, ty) in walk else 0.0) for tx in range(w) for ty in range(h)}
        gz.zone_ground(d, 'tx-floor', 'field_cm23_01', NATIVE, values, [(dark, 0, 0), (plate, .45, .55)], .12)


# --------------------------------------------------------------------------- helpers

def scr(d, x, y, z):
    return (x, y - fx.lift(d, z))


def core_check(label, points, footprint, margin=1.4):
    if not kit.core_inside(points, footprint, margin):
        raise ValueError(f'CORE_DESIGN_OUTSIDE_FIELD:{label}')


def check(label, points, footprint, window):
    if not kit.inside(points, footprint, window, DESIGN_MARGIN):
        raise ValueError(f'DESIGN_OUTSIDE_WINDOW_OR_FIELD:{label}')


def tube_points(d, a, b, radius_wu, n=16):
    """Exact screen samples of an open tube from native point a to b: both end circles."""
    from mathutils import Vector
    pa, pb = d.world(*a), d.world(*b)
    axis = (pb - pa).normalized()
    helper = Vector((0.0, 0.0, 1.0)) if abs(axis.z) < .9 else Vector((1.0, 0.0, 0.0))
    n1 = axis.cross(helper).normalized()
    n2 = axis.cross(n1).normalized()
    pts = []
    for centre in (pa, pb):
        for i in range(n):
            t = i / n * math.tau
            pts.append(tuple(fit.native_screen(centre + radius_wu * (math.cos(t) * n1 + math.sin(t) * n2))))
    return pts


def hazard_band(d, name, a, b, width, z=.004):
    """Yellow-black diagonal hazard stripes painted along the ground segment a-b."""
    (ax, ay), (bx, by) = a, b
    length = math.hypot(bx - ax, by - ay)
    tx, ty = (bx - ax) / length, (by - ay) / length
    nx, ny = -ty, tx
    n = max(2, int(length / 2.4))
    step = length / n
    shear = width * .8
    for k in range(n):
        s0, s1 = k * step, (k + 1) * step
        quad = [(ax + tx * s0, ay + ty * s0), (ax + tx * s1, ay + ty * s1),
                (ax + tx * (s1 + shear) + nx * width, ay + ty * (s1 + shear) + ny * width),
                (ax + tx * (s0 + shear) + nx * width, ay + ty * (s0 + shear) + ny * width)]
        fx.prism(d, f'{name}-{k}', quad, z, z + .006, 'tx-hazard-yellow' if k % 2 == 0 else 'tx-hazard-black', 0)


def valve_wheel(d, name, cx, cy, z, r, axis='X'):
    """A red valve wheel standing in a vertical plane (camera-facing for 'X')."""
    along = {'X': (1.0, 0.0), 'U': U, 'V': V}[axis]
    pts = []
    for i in range(17):
        t = i / 16 * math.tau
        pts.append((cx + along[0] * r * math.cos(t), cy + along[1] * r * math.cos(t), z + r / d.UNIT * math.sin(t)))
    fx.pipe(d, name + '-rim', pts, .028, 'tx-valve')
    for t in (0, math.pi / 2):
        p = (cx + along[0] * r * math.cos(t), cy + along[1] * r * math.cos(t), z + r / d.UNIT * math.sin(t))
        q = (cx - along[0] * r * math.cos(t), cy - along[1] * r * math.cos(t), z - r / d.UNIT * math.sin(t))
        fx.pipe(d, f'{name}-spoke-{t:.1f}', [p, q], .018, 'tx-valve')


# --------------------------------------------------------------------------- core

def back_wall(d, footprint):
    """A ribbed steel wall, pipe manifold, valve wheel and a control cabinet on the blocked back row."""
    wall = [(10.0, 33.0), (86.0, 33.0), (86.0, 34.6), (10.0, 34.6)]
    core_check('wall', [scr(d, x, y, .86) for x, y in wall] + wall, footprint)
    fx.prism(d, 'gas-back-wall', wall, 0, .85, 'tx-wall', .006)
    for k, x in enumerate(range(16, 86, 10)):
        fx.prism(d, f'gas-back-wall-rib-{k}', [(x - .6, 34.6), (x + .6, 34.6), (x + .6, 35.3), (x - .6, 35.3)], 0, .85,
                 'tx-wall-rib', .004)
    for k, (y, z, radius, mat) in enumerate(((39.0, .95, .075, 'tx-pipe'), (41.0, .55, .055, 'tx-pipe-thin'))):
        a, b = (6.0, y, z), (76.0, y, z)
        core_check(f'manifold-{k}', tube_points(d, a, b, radius), footprint)
        fx.pipe(d, f'gas-manifold-{k}', [a, b], radius, mat)
        for x in (12.0, 34.0, 58.0):
            fx.pipe(d, f'gas-manifold-{k}-bracket-{x:.0f}', [(x, y, 0.0), (x, y, z)], .03, 'tx-steel-dark')
    valve_wheel(d, 'gas-manifold-valve', 20.0, 40.2, .95, 3.2)
    cx, cy = 50.0, 43.0
    core_check('cabinet', [scr(d, cx - 8, cy, 1.55), scr(d, cx + 8, cy, 1.55), (cx - 8, cy + 3), (cx + 8, cy + 3)],
               footprint)
    fx.box(d, 'gas-cabinet', cx, cy, 4.6, 2.2, 0, 1.45, 'tx-cabinet', .010)
    fx.face_panel(d, 'gas-cabinet-door', cx, cy, 4.6, 2.2, .15, 1.30, 'tx-steel', 'front-left', .20, .25)
    for k, (t, mat) in enumerate(((-2.4, 'tx-lamp-yellow'), (0.0, 'tx-lamp-green'), (2.4, 'tx-lamp-yellow'))):
        px, py = cx + t * U[0] - 2.4 * V[0], cy + t * U[1] - 2.4 * V[1]
        fx.ball(d, f'gas-cabinet-lamp-{k}', px, py, 1.12, .9, mat)
    for k, t in enumerate((-1.6, 1.6)):
        px, py = cx + t * U[0] - 2.5 * V[0], cy + t * U[1] - 2.5 * V[1]
        fx.ball(d, f'gas-cabinet-gauge-{k}', px, py, .70, .8, 'tx-gauge')
    hazard_band(d, 'gas-hazard-back', (10.0, 46.6), (78.0, 46.6), 1.4)


def process_cylinder(d, name, cx, cy, height, r, footprint):
    core_check(name, [scr(d, cx - r, cy, height + .1), scr(d, cx + r, cy, height + .1), scr(d, cx, cy, height + .45),
                      (cx - r - .6, cy), (cx + r + .6, cy), (cx, cy + (r + .6) / 2)], footprint)
    fx.cylinder(d, name + '-plinth', cx, cy, r + .6, 0, .10, 'tx-steel-dark', 24)
    fx.lathe(d, name + '-body', cx, cy, [(.10, r), (height - .30, r), (height, r * .78), (height + .25, r * .42),
                                         (height + .36, .05)], 'tx-tank', 28)
    fx.lathe(d, name + '-base-band', cx, cy, [(.12, r + .08), (.42, r + .08)], 'tx-hazard-yellow', 28,
             caps=(False, False))
    fx.lathe(d, name + '-level-ring', cx, cy, [(height * .48, r + .10), (height * .58, r + .10)], 'tx-glow', 28,
             caps=(False, False))
    fx.lathe(d, name + '-seam', cx, cy, [(height * .80, r + .06), (height * .83, r + .06)], 'tx-tank-light', 28,
             caps=(False, False))
    fx.pipe(d, name + '-vent', [(cx, cy, height + .30), (cx, cy, height + .45)], .06, 'tx-steel')


def process_tank(d, footprint):
    """Horizontal process tank on two saddles in the blocked lower-right corner."""
    radius, z = .40, .52
    a = (118.0, 124.0, z)
    b = (134.0, 132.0, z)
    cap = radius * d.UNIT * .9
    probe = tube_points(d, a, b, radius + .03)
    for end in (a, b):
        sx, sy = scr(d, *end)
        probe += [(sx + cap * math.cos(t), sy + cap * math.sin(t)) for t in [i * math.tau / 12 for i in range(12)]]
    core_check('tank', probe, footprint)
    tank = fx.pipe(d, 'gas-tank-shell', [a, b], radius, 'tx-tank')
    tank.data.use_fill_caps = True
    for k, end in enumerate((a, b)):
        fx.ball(d, f'gas-tank-cap-{k}', end[0], end[1], z, cap, 'tx-tank')
    for k, t in enumerate((.25, .75)):
        px, py = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        fx.box(d, f'gas-tank-saddle-{k}', px, py, .6, 2.6, 0, z - .10, 'tx-steel-dark', .006)
        band_a = (px - .5 * U[0], py - .5 * U[1], z)
        band_b = (px + .5 * U[0], py + .5 * U[1], z)
        fx.pipe(d, f'gas-tank-band-{k}', [band_a, band_b], radius + .025, 'tx-hazard-yellow')
    mid = (a[0] + (b[0] - a[0]) * .5, a[1] + (b[1] - a[1]) * .5)
    fx.pipe(d, 'gas-tank-sight', [(mid[0] - 1.6 * U[0], mid[1] - 1.6 * U[1], z + .18),
                                  (mid[0] + 1.6 * U[0], mid[1] + 1.6 * U[1], z + .18)], .17, 'tx-glow')
    fx.pipe(d, 'gas-tank-outlet', [(b[0] - 2.0, b[1] + 1.0, z - .1), (b[0] - 2.0, b[1] + 1.0, .06),
                                   (b[0] - 2.0, b[1] + 5.0, .06)], .05, 'tx-pipe')


def waste_drums(d, footprint):
    for k, (cx, cy) in enumerate(((12.0, 89.5), (20.5, 93.5), (29.0, 97.5))):
        r, h = 2.5, .62
        core_check(f'drum-{k}', [scr(d, cx - r, cy, h), scr(d, cx + r, cy, h), (cx - r, cy + 1.3), (cx + r, cy + 1.3),
                                 (cx, cy + 1.3)], footprint)
        fx.cylinder(d, f'gas-drum-{k}', cx, cy, r, 0, h, 'tx-drum', 20)
        for j, z in enumerate((.14, .46)):
            fx.lathe(d, f'gas-drum-{k}-band-{j}', cx, cy, [(z, r + .06), (z + .05, r + .06)], 'tx-drum-band', 20,
                     caps=(False, False))
        fx.cylinder(d, f'gas-drum-{k}-lid', cx, cy, r * .9, h, h + .02, 'tx-steel-dark', 20)


def drain_grating(d, footprint):
    pts = [(49.6, 116.0), (55.4, 116.0), (55.4, 172.0), (49.6, 172.0)]
    core_check('grating', pts, footprint, 1.2)
    fx.prism(d, 'gas-grating-frame', pts, 0, .012, 'tx-steel-dark', 0)
    y = 118.0
    k = 0
    while y < 170.0:
        fx.prism(d, f'gas-grating-slot-{k}', [(50.6, y), (54.4, y), (54.4, y + 1.0), (50.6, y + 1.0)], .012, .014,
                 'tx-grate', 0)
        y += 2.2
        k += 1


def floor_vent(d, footprint):
    cx, cy = PLUMES[1]['source']
    core_check('vent', fx.quad(cx, cy, 3.0, 3.0), footprint)
    fx.box(d, 'gas-vent-frame', cx, cy, 3.0, 3.0, 0, .03, 'tx-steel-dark', .004)
    for k, t in enumerate((-1.8, -.6, .6, 1.8)):
        px, py = cx + t * V[0], cy + t * V[1]
        fx.box(d, f'gas-vent-slot-{k}', px, py, 2.4, .32, .03, .035, 'tx-grate', 0)


def toxic_core(d, footprint):
    back_wall(d, footprint)
    floor_vent(d, footprint)
    process_cylinder(d, 'gas-cylinder-a', 88.0, 64.0, 3.0, 5.6, footprint)
    process_cylinder(d, 'gas-cylinder-b', 88.0, 92.0, 2.4, 5.6, footprint)
    hazard_band(d, 'gas-hazard-side', (79.4, 50.0), (79.4, 102.0), 1.3)
    process_tank(d, footprint)
    waste_drums(d, footprint)
    drain_grating(d, footprint)
    return ['steel-tread-plate-floor', 'hazard-stripes', 'pipe-manifold-and-valve', 'warning-lamp-cabinet',
            'sealed-processing-cylinders', 'horizontal-process-tank', 'toxic-waste-drums', 'toxic-gas-plumes']


# --------------------------------------------------------------------------- objects

def pipeline(d, name, record, footprint, run, thin_offset, valve=None):
    """A low floor pipeline: a main and a thin pipe that rise out of floor flanges, run on
    saddles with hazard bands, and dive back into the floor, all inside the source window."""
    window = containment.source_window(record)
    main, thin, z_main, z_thin = .085, .05, .16, .11
    ox, oy = thin_offset
    pipes = (('main', run, main, z_main, 'tx-pipe'),
             ('thin', [(x + ox, y + oy) for x, y in run], thin, z_thin, 'tx-pipe-thin'))
    pts = []
    for _, path, radius, z, _ in pipes:
        path3 = [(path[0][0], path[0][1], .02)] + [(x, y, z) for x, y in path] + [(path[-1][0], path[-1][1], .02)]
        for a, b in zip(path3, path3[1:]):
            pts += tube_points(d, a, b, radius)
        rf = radius * d.UNIT + .8
        for x, y in (path[0], path[-1]):
            pts += [(x - rf, y), (x + rf, y), (x, y + rf / 2), (x, y - rf / 2 - .4)]
    if valve:
        vx, vy = valve
        pts += [scr(d, vx - 2.1, vy, z_main + .40), scr(d, vx + 2.1, vy, z_main + .40), scr(d, vx, vy, z_main + .42)]
    check(name, pts, footprint, window)
    for label, path, radius, z, mat in pipes:
        path3 = [(path[0][0], path[0][1], .02)] + [(x, y, z) for x, y in path] + [(path[-1][0], path[-1][1], .02)]
        fx.pipe(d, f'{name}-{label}', path3, radius, mat)
        for k, (x, y) in enumerate((path[0], path[-1])):
            fx.cylinder(d, f'{name}-{label}-flange-{k}', x, y, radius * d.UNIT + .8, 0, .04, 'tx-steel-dark', 16)
    total = sum(math.dist(a, b) for a, b in zip(run, run[1:]))
    marks = max(1, int(total // 14))
    for k in range(marks):
        t = (k + .5) / marks * total
        for a, b in zip(run, run[1:]):
            seg = math.dist(a, b)
            if t <= seg:
                dx, dy = (b[0] - a[0]) / seg, (b[1] - a[1]) / seg
                px, py = a[0] + dx * t, a[1] + dy * t
                fx.pipe(d, f'{name}-band-{k}', [(px - dx * .6, py - dy * .6, z_main), (px + dx * .6, py + dy * .6, z_main)],
                        main + .02, 'tx-hazard-yellow')
                sx, sy = px + dx * 3.0, py + dy * 3.0
                fx.box(d, f'{name}-saddle-{k}', sx, sy, .7, .7, 0, z_main - .05, 'tx-steel-dark', .004)
                break
            t -= seg
    if valve:
        vx, vy = valve
        fx.pipe(d, name + '-valve-stem', [(vx, vy, z_main), (vx, vy, z_main + .26)], .03, 'tx-steel')
        valve_wheel(d, name + '-valve', vx, vy, z_main + .28, 2.0)
    return run[len(run) // 2]


def beacon(d, name, record, footprint):
    window = containment.source_window(record)
    x, y, w, h = window
    cx, cy = x + w / 2, y + h - 1.6
    pts = [(cx - 1.8, cy + .9), (cx + 1.8, cy + .9), scr(d, cx - 1.7, cy, .40), scr(d, cx + 1.7, cy, .40),
           scr(d, cx, cy, .62)]
    check(name, pts, footprint, window)
    fx.box(d, name + '-post', cx, cy, .7, .7, 0, .26, 'tx-steel-dark', .004)
    fx.cylinder(d, name + '-collar', cx, cy, 1.5, .26, .32, 'tx-hazard-yellow', 16)
    fx.lathe(d, name + '-dome', cx, cy, [(.32, 1.4), (.44, 1.3), (.54, .8), (.58, .2)], 'tx-beacon', 16)
    return (cx, cy)


PLUMES = {
    # source on the ground, drift per unit age (dx, dy), rise in world units, puff radii (wu)
    2: {'source': (51.0, 82.0), 'drift': (16.0, -2.0), 'rise': 1.25, 'radii': (.22, .30, .36)},
    1: {'source': (106.0, 148.0), 'drift': (-12.0, -3.0), 'rise': 1.05, 'radii': (.20, .28, .34)},
}


def gas_plume(d, name, record, footprint, phase, phases):
    """Three puffs at staggered ages: each rises, grows and thins over the eight poses."""
    window = containment.source_window(record)
    spec = PLUMES[record['order']]
    sx, sy = spec['source']
    made = 0
    for k in range(3):
        age = ((phase / max(1, phases)) + k / 3.0) % 1.0
        r = spec['radii'][0] + (spec['radii'][2] - spec['radii'][0]) * age
        px = sx + spec['drift'][0] * age + .8 * math.sin(age * 5.0 + k)
        py = sy + spec['drift'][1] * age
        pz = .25 + spec['rise'] * age
        half = r * d.UNIT
        sxp, syp = scr(d, px, py, pz)
        probe = [(sxp + dx * half, syp + dy * half * .9) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
        if not kit.inside(probe, footprint, window, DESIGN_MARGIN):
            raise ValueError(f'GAS_PUFF_OUTSIDE_WINDOW:{name}:{phase}:{k}')
        material = GAS[0][0] if age < .4 else GAS[1][0] if age < .72 else GAS[2][0]
        d.sphere(f'{name}-puff-{k}', d.world(px, py, pz), (r, r, r * .78), material)
        made += 1
    return (sx, sy)


def toxic_object(d, record, footprint, phase, phases):
    name = f"gas23-{record['order']:02d}"
    order = record['order']
    if order == 0:
        return 'warning-beacon', beacon(d, name + '-beacon', record, footprint)
    if order in (1, 2):
        return 'toxic-gas-plume', gas_plume(d, name + '-gas', record, footprint, phase, phases)
    if order == 3:
        return 'floor-pipeline', pipeline(d, name + '-pipe', record, footprint, [(5.0, 82.0), (49.0, 82.0)],
                                          (0.0, -2.6), valve=(36.0, 82.0))
    if order == 4:
        return 'floor-pipeline', pipeline(d, name + '-pipe', record, footprint, [(61.0, 84.0), (61.0, 146.0)],
                                          (-2.9, 0.0))
    return 'floor-pipeline', pipeline(d, name + '-pipe', record, footprint, [(68.0, 162.0), (139.0, 162.0)],
                                      (0.0, -2.6), valve=(96.0, 162.0))


# --------------------------------------------------------------------------- entry point

def build(field, d, cell_id):
    import bpy
    field_id = field['id']
    if field_id not in FIELDS:
        raise ValueError('UNSUPPORTED_TOXIC_FIELD:' + field_id)
    footprint = dict(d.field_footprint(d.ROOT, field))
    footprint['fieldId'] = field_id
    contract = {obj['order']: obj for obj in CONTRACTS[field_id]['objects']}
    d.LAYER = 'base'
    features = toxic_core(d, footprint)
    anchors = []
    for record in field['objects']:
        d.LAYER = 'decor'
        before = set(bpy.context.scene.objects)
        containment.authoring_window(field_id, footprint, record)
        phase, phases = containment.phase_for(contract[record['order']], cell_id)
        role, anchor = toxic_object(d, record, footprint, phase, phases)
        containment.register_anchor(field_id, record['order'], anchor)
        for obj in set(bpy.context.scene.objects) - before:
            obj['sourceObjectOrdinal'] = record['order']
            obj['sourceAnchorNative'] = record['placement']
            obj['objectSequenceId'] = record['sequenceId']
            obj['sourceCellId'] = cell_id
            obj['objectRole'] = role
        anchors.append({'sourceOrdinal': record['order'], 'sequenceId': record['sequenceId'], 'role': role,
                        'anchorNative': record['placement'], 'phase': phase, 'phases': phases})
    d.LAYER = 'base'
    bpy.context.view_layer.update()
    containment.finish(d, field, footprint, cell_id, features)
    return anchors
