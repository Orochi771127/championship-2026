"""HM01x2 world-intrusion landmark: a vintage tram car resting on a grass knoll with no rails,
plus its station companions (bus-stop sign, bench). All procedural Blender, designed here.

The car is a quiet, intact object that "fell into" the meadow: its wheels sink into the turf,
roots wrap the front bogie, moss climbs the skirt and a vine reaches the roof. It is scenery
only (blocked footprint in the game grid); no ride, shop or mail function.

Coordinates follow hunt_opus_props: (x, y) native screen px of the front contact point,
heights in Blender units (one unit lifts 9.85 native px on screen).
"""
import math
import random

from . import hunt_opus_kit as hk
from . import hunt_opus_props as hp
from . import hunt_opus_trees as trees

S = hp.S


def prepare(d):
    if 'lm-tram-green' in d.M:
        return
    m = d.material
    m('lm-tram-green', (.12, .38, .24), .38, .05)
    m('lm-tram-green-dark', (.06, .22, .14), .45, .05)
    m('lm-tram-cream', (.88, .83, .68), .42, .0)
    m('lm-tram-roof', (.20, .24, .22), .7, .15)
    m('lm-tram-roof-light', (.30, .34, .31), .65, .15)
    m('lm-tram-rib', (.22, .24, .23), .6, .3)
    m('lm-tram-glass', (.20, .32, .36), .06, .0)
    m('lm-tram-frame', (.18, .19, .20), .4, .6)
    m('lm-tram-brass', (.80, .62, .26), .3, .9)
    m('lm-tram-rust', (.40, .22, .12), .8, .3)
    m('lm-bench-wood', (.58, .38, .20), .7, .0)
    m('lm-sign-blue', (.10, .34, .70), .35, .1)
    m('lm-pennant-a', (.86, .22, .16), .6, .0)
    m('lm-pennant-b', (.95, .78, .22), .6, .0)
    m('lm-pennant-c', (.94, .93, .88), .6, .0)
    hp.glow(d, 'lm-headlamp', (1.0, .90, .66), .4, 7.0)
    hp.glow(d, 'lm-window-night', (1.0, .80, .48), .0, 1.6)


def _face(d, n, cx, cy, ux, depth_true, w, z0, z1, mat, inset=.6):
    """A thin panel on the camera-facing long side of a box centred at (cx, cy)."""
    px, py = hp.gpt(cx, cy, ux, -depth_true / 2 - inset / 2)
    return hp.gbox(d, n, px, py, w, inset, z0, z1, mat)


def tram_car(d, n, x, y, size=176, seed=0, z0=0.0):
    """``size``: car length in native px. ``(x, y)``: front contact at the footprint centre."""
    prepare(d)
    rnd = random.Random(seed * 17 + 3)
    L = size
    D = 40 / S                      # 5 tiles deep on screen -> true depth
    cy = y - 40 / 2                 # ground centre of the footprint
    sink = -.32                     # wheels and skirt sink into the turf
    # bogies and wheels (front side visible; the rest is hidden by the skirt)
    for side in (-1, 1):
        bx = x + side * L * .30
        hp.gbox(d, f'{n}-bogie{side}', bx, cy, L * .22, D * .78, sink, .62, 'lm-tram-frame', 0, .05)
        for k in (-1, 1):
            wx = bx + k * L * .065
            fy = cy + D * .40 * S
            hk_r = .46
            wheel = d.curve(f'{n}-wheel{side}{k}', [d.world(wx, fy - 1.0, .16), d.world(wx, fy + 3.2, .16)], hk_r, 'lm-tram-frame')
            wheel.data.use_fill_caps = True
            hp.cyl(d, f'{n}-hub{side}{k}', wx, fy + 3.4, 2.0, .05, .30, 'lm-tram-brass', 10)
    # underframe and skirt
    hp.gbox(d, n + '-frame', x, cy, L * .96, D * .88, .45, .80, 'lm-tram-frame', 0, .04)
    # lower body (green), belt line, upper body (cream)
    hp.gbox(d, n + '-lower', x, cy, L, D, .78, 2.30, 'lm-tram-green', 0, .10)
    hp.gbox(d, n + '-belt', x, cy, L + 1.2, D + 1.2, 2.28, 2.44, 'lm-tram-cream', 0, .03)
    hp.gbox(d, n + '-upper', x, cy, L - 2, D - 2, 2.42, 3.92, 'lm-tram-cream', 0, .08)
    # rounded ends: slightly narrower caps that soften the silhouette
    for side in (-1, 1):
        ex = x + side * (L / 2 + 2.6)
        hp.gbox(d, f'{n}-endlow{side}', ex, cy, 7, D * .86, .80, 2.30, 'lm-tram-green', 0, .9)
        hp.gbox(d, f'{n}-endup{side}', ex, cy, 6, D * .80, 2.42, 3.86, 'lm-tram-cream', 0, .8)
        gx, gy = hp.gpt(ex + side * 1.4, cy, 0, -D * .2)
        hp.gbox(d, f'{n}-endglass{side}', gx, gy, 3, D * .55, 2.72, 3.58, 'lm-tram-glass', 0, .2)
    # roof: two beveled tiers read as a rounded clerestory, with vents and a trolley pole
    hp.gbox(d, n + '-roof', x, cy, L + 4, D + 2, 3.90, 4.16, 'lm-tram-roof', 0, .12)
    hp.gbox(d, n + '-roof2', x, cy, L * .78, D * .56, 4.14, 4.44, 'lm-tram-roof-light', 0, .14)
    # clerestory window strip on the camera side, rib seams across the roof
    _face(d, n + '-clere', x, cy, 0, D * .56, L * .74, 4.18, 4.38, 'lm-tram-glass', .5)
    for k in range(int(L / 12) + 1):
        ux = -L / 2 + k * 12
        rx0, ry0 = hp.gpt(x + ux, cy, 0, 0)
        hp.gbox(d, f'{n}-rib{k}', rx0, ry0, 1.2, D + 2.4, 4.10, 4.20, 'lm-tram-rib', 0, .02)
    # moss cushions and fallen leaves gathered on the roof (wind-blown from the meadow trees)
    for k in range(14):
        ux = rnd.uniform(-L / 2 + 6, L / 2 - 6)
        uy = rnd.uniform(-D / 2 + 3, D / 2 - 3)
        mx, my = hp.gpt(x + ux, cy, 0, uy)
        z = 4.46 if abs(uy) < D * .26 and abs(ux) < L * .37 else 4.18
        for j in range(3):
            bx, by = mx + rnd.uniform(-3, 3), my + rnd.uniform(-1.5, 1.5)
            hp.ball(d, f'{n}-roofmoss{k}-{j}', bx, by, z, rnd.uniform(1.6, 3.0), 'hp-moss', .35)
    for k in range(5):
        ux = rnd.uniform(-L / 2 + 10, L / 2 - 10)
        lx0, ly0 = hp.gpt(x + ux, cy, 0, rnd.uniform(-D / 2 + 4, -D * .3))
        trees.shrub(d, f'{n}-rooftuft{k}', lx0, ly0, 4.05, .32, k + seed * 7, 'ht-leaf-shrub')
    for k in range(3):
        vx = x + (k - 1) * L * .26
        hp.gbox(d, f'{n}-vent{k}', vx, cy, 12, D * .36, 4.42, 4.64, 'lm-tram-frame', 0, .05)
    px0, py0 = hp.gpt(x + L * .18, cy, 0, 0)
    d.curve(n + '-pole', [d.world(px0, py0, 4.5), d.world(px0 - 34, py0 - 2, 6.3)], .05, 'lm-tram-frame')
    hp.ball(d, n + '-pole-tip', px0 - 34, py0 - 2, 6.34, 1.5, 'lm-tram-brass')
    hp.gbox(d, n + '-pole-base', px0, py0, 8, 6, 4.44, 4.60, 'lm-tram-frame', 0, .03)
    # windows along the camera side, a door with a folding step near the right end
    nwin, door_k = 7, 5
    pitch = (L - 18) / nwin
    for k in range(nwin):
        ux = -L / 2 + 9 + pitch * (k + .5)
        if k == door_k:
            _face(d, f'{n}-door', x, cy, ux, D, pitch * .8, .82, 3.70, 'lm-tram-green-dark')
            _face(d, f'{n}-doorglass', x, cy, ux, D + 1.2, pitch * .5, 2.6, 3.5, 'lm-tram-glass')
            sx, sy = hp.gpt(x + ux, cy, 0, -D / 2 - 3)
            hp.gbox(d, f'{n}-step', sx, sy, pitch * .7, 6, .30, .50, 'lm-tram-frame', 0, .03)
            continue
        _face(d, f'{n}-win{k}', x, cy, ux, D, pitch * .74, 2.62, 3.66, 'lm-tram-glass')
        _face(d, f'{n}-winframe{k}', x, cy, ux, D + .8, pitch * .78, 3.08, 3.14, 'lm-tram-cream', .4)
        if k in (1, 3):   # a warm cabin light only at night
            _face(d, f'{n}-winlight{k}', x, cy, ux, D - .4, pitch * .6, 2.72, 3.56, 'lm-window-night', .3)
    # number plate area (no text) and a headlamp on the left end
    _face(d, n + '-plate', x, cy, -L / 2 + 30, D + .8, 18, 1.55, 1.95, 'lm-tram-cream', .4)
    lx, ly = hp.gpt(x - L / 2 - 4.5, cy, 0, -D * .1)
    hp.ball(d, n + '-lamp', lx, ly, 1.55, 2.6, 'lm-headlamp')
    # bunting (ticket pennants) along the front roof edge
    for k in range(9):
        ux = -L / 2 + 14 + k * (L - 28) / 8
        fx, fy = hp.gpt(x + ux, cy, 0, -D / 2 - 1.6)
        mat = ('lm-pennant-a', 'lm-pennant-b', 'lm-pennant-c')[k % 3]
        hp.ribbon(d, f'{n}-pennant{k}', [(fx - 3.4, fy, 3.86), (fx, fy + .4, 3.40 - .06 * (k % 2)), (fx + 3.4, fy, 3.86)],
                  [2.4, .4, 2.4], mat, up=(0, 1, 0))
    # nature takes hold: moss along the skirt, roots around the front-left bogie, a vine to the roof
    for k in range(int(L / 9)):
        ux = -L / 2 + 4 + k * 9 + rnd.uniform(-2, 2)
        mx, my = hp.gpt(x + ux, cy, 0, -D / 2 + .5)
        hp.gbox(d, f'{n}-moss{k}', mx, my, rnd.uniform(5, 9), 2.2, .55, .78 + rnd.uniform(0, .35), 'hp-moss', 0, .3)
    rx = x - L * .30
    for k in range(4):
        a0 = -.9 + k * .6
        pts = []
        for j in range(5):
            f = j / 4
            ax = rx + math.cos(a0) * (6 + 16 * f) + rnd.uniform(-1, 1)
            ay = cy + D * .40 * S + 4 + math.sin(a0) * 4 * f + 6 * f
            pts.append((ax, ay, .42 * (1 - f) - .05))
        hp.tube(d, f'{n}-root{k}', pts, 1.1 - .2 * (k % 2), 'hp-wood-dark')
    vx, vy = hp.gpt(x + L / 2 - 6, cy, 0, -D / 2 - .6)
    vine = [(vx + 2 * math.sin(j * .9), vy, .5 + j * .52) for j in range(8)]
    hp.tube(d, n + '-vine', vine, .7, 'hp-wood-dark')
    for j in range(2, 9):
        lx2, ly2, lz2 = vine[min(j, 7)]
        trees.shrub(d, f'{n}-vineleaf{j}', lx2 + rnd.uniform(-3, 3), ly2 + 1, lz2 - .5, .34 + .05 * (j % 3), j * 5 + seed,
                    'ht-leaf-shrub')
    # turf tufts wrapping the sunk skirt so the car sits in, not on, the meadow
    tufts = []
    for k in range(int(L / 3.2)):
        ux = -L / 2 - 4 + k * 3.2 + rnd.uniform(-1, 1)
        tx, ty = hp.gpt(x + ux, cy, 0, -D / 2 - rnd.uniform(0, 3.2))
        tufts.append((tx, ty, 0.0))
    for side in (-1, 1):
        for k in range(10):
            tx, ty = hp.gpt(x + side * (L / 2 + 5 + rnd.uniform(0, 3)), cy, 0, -D / 2 + k * D / 10)
            tufts.append((tx, ty, 0.0))
    hk.tufts_at(d, n + '-turf', tufts, ('hn-tuft-1', 'hn-tuft-2'), height=(.22, .42), lean_dir=(0.0, 1.0))


def stop_sign(d, n, x, y, size=16, seed=0, z0=0.0):
    """A bus/tram stop pole with a round blank sign and a timetable box (no text)."""
    prepare(d)
    hp.cyl(d, n + '-pole', x, y - 4, 1.1, z0, z0 + 4.0, 'hp-steel', 10)
    sx, sy = hp.gpt(x, y - 4, 0, -1.2)
    hp.gbox(d, n + '-disc', sx, sy, 13, 1.0, z0 + 3.35, z0 + 4.55, 'lm-sign-blue', 0, .35)
    hp.gbox(d, n + '-ring', sx, sy + .3, 9, .6, z0 + 3.62, z0 + 4.28, 'hp-white', 0, .25)
    hp.gbox(d, n + '-table', sx, sy, 7, 1.4, z0 + 1.7, z0 + 2.6, 'hp-white', 0, .05)


def bench(d, n, x, y, size=40, seed=0, z0=0.0):
    """Wooden slat bench on cast legs, facing the camera, set slightly into the grass."""
    prepare(d)
    w = size
    cy = y - 8
    for side in (-1, 1):
        lx = x + side * w * .40
        hp.gbox(d, f'{n}-leg{side}', lx, cy, 2.2, 10, z0 - .05, z0 + .75, 'lm-tram-frame', 0, .03)
        hp.gbox(d, f'{n}-arm{side}', lx, cy, 2.4, 11, z0 + .95, z0 + 1.05, 'lm-tram-frame', 0, .03)
    for k in range(3):
        sy = cy + (k - 1) * 3.0 * S
        hp.gbox(d, f'{n}-seat{k}', x, sy, w, 2.6, z0 + .70, z0 + .82, 'lm-bench-wood', 0, .02)
    bx, by = hp.gpt(x, cy, 0, 4.6)
    for k in range(2):
        hp.gbox(d, f'{n}-back{k}', bx, by, w, 1.2, z0 + 1.15 + k * .42, z0 + 1.42 + k * .42, 'lm-bench-wood', 0, .02)


BUILDERS = {'tram-car': tram_car, 'stop-sign': stop_sign, 'bench': bench}


def register():
    hp.BUILDERS.update(BUILDERS)


# --------------------------------------------------------------------------- everyday objects stuck in the meadow
# The original HM01 already plants out-of-place real objects in the grass (a white vending machine,
# a green mailbox). Same footprints and positions; rebuilt so they read as those objects, leaning a
# little and sunk into the earth, in the map's own style.

def _lean(d, objs, x, y, degrees):
    """Lean objects left/right (screen) about their front ground point."""
    import mathutils
    pivot = d.world(x, y, 0.0)
    axis = (d.world(x, y + 10, 0.0) - pivot).normalized()      # the ground direction toward the camera
    R = mathutils.Matrix.Translation(pivot) @ mathutils.Matrix.Rotation(math.radians(degrees), 4, axis) @ mathutils.Matrix.Translation(-pivot)
    for o in objs:
        o.matrix_world = R @ o.matrix_world


def _mound(d, n, x, y, r, seed):
    """A low dirt collar where the object went into the ground, ringed by grass."""
    rnd = random.Random(seed)
    hp.rlathe(d, n + '-mound', x, y - 2, [(-.02, r * 1.25), (.10, r * 1.0), (.20, r * .55), (.22, .2)], 'lm-soil', 16)
    tufts = []
    for k in range(26):
        a = k * math.tau / 26 + rnd.uniform(-.1, .1)
        rr = r * rnd.uniform(1.05, 1.4)
        tx, ty = hp.gpt(x, y - 2, math.cos(a) * rr, math.sin(a) * rr)
        tufts.append((tx, ty, 0.0))
    hk.tufts_at(d, n + '-collar', tufts, ('hn-tuft-1', 'hn-tuft-2'), height=(.16, .32), lean_dir=(0.0, 1.0))


def _prepare_everyday(d):
    if 'lm-vend-white' in d.M:
        return
    m = d.material
    m('lm-vend-white', (.84, .85, .84), .32, .05)
    m('lm-vend-trim', (.40, .44, .48), .35, .5)
    m('lm-vend-dark', (.08, .09, .11), .45, .2)
    m('lm-soil', (.36, .25, .14), .95, .0)
    m('lm-post-green', (.08, .44, .22), .38, .1)
    m('lm-post-green-dark', (.04, .26, .13), .45, .1)
    for k, col in enumerate(((.92, .20, .16), (.18, .52, .92), (.98, .80, .18), (.26, .72, .34), (.96, .52, .16))):
        m(f'lm-can-{k}', col, .25, .6)
    hp.glow(d, 'lm-vend-glass', (.80, .92, 1.0), .25, 2.2)
    hp.glow(d, 'lm-vend-header', (.30, .66, 1.0), .6, 4.0)
    hp.glow(d, 'lm-vend-button', (.98, .55, .20), .4, 3.0)


def vending_machine(d, n, x, y, size=48, seed=0, z0=0.0):
    prepare(d); _prepare_everyday(d)
    s = size / 48
    w, dp, top = 24 * s, 17 * s, 3.1 * s
    sink = -.32
    cy = y - 9
    objs = [hp.gbox(d, n + '-body', x, cy, w, dp, sink, top, 'lm-vend-white', 0, .10),
            hp.gbox(d, n + '-cap', x, cy, w + 1.2, dp + 1.2, top - .05, top + .14, 'lm-vend-trim', 0, .06)]
    fx_, fy_ = hp.gpt(x, cy, 0, -dp / 2 - .4)
    objs.append(hp.gbox(d, n + '-header', fx_, fy_, w * .86, .7, top - .62, top - .22, 'lm-vend-header', 0, .03))
    objs.append(hp.gbox(d, n + '-glass', fx_ - w * .08, fy_, w * .62, .6, 1.05, top - .78, 'lm-vend-glass', 0, .03))
    for r in range(3):
        for c in range(4):
            cx = fx_ - w * .08 + (c - 1.5) * w * .14
            z = 1.25 + r * (top - 2.15) / 3
            objs.append(hp.cyl(d, f'{n}-can-{r}-{c}', cx, fy_ - .7, 1.1 * s, z, z + .42 * s, f'lm-can-{(r * 4 + c + seed) % 5}', 10))
    px_, py_ = fx_ + w * .34, fy_
    objs.append(hp.gbox(d, n + '-panel', px_, py_, w * .2, .7, 1.0, top - .78, 'lm-vend-trim', 0, .02))
    for k in range(4):
        objs.append(hp.gbox(d, f'{n}-btn{k}', px_, py_ - .3, w * .1, .5, 1.5 + k * .32, 1.62 + k * .32, 'lm-vend-button', 0, .02))
    objs.append(hp.gbox(d, n + '-slot', px_, py_ - .3, w * .08, .5, 2.9 * s, 3.0 * s - .05, 'lm-vend-dark', 0, .01))
    objs.append(hp.gbox(d, n + '-flap', fx_ - w * .08, fy_ - .2, w * .55, .6, .38, .78, 'lm-vend-dark', 0, .04))
    _lean(d, objs, x, y - 2, (-7 if seed % 2 else 6))
    _mound(d, n, x, y, 12 * s, seed)


def postbox(d, n, x, y, size=48, seed=0, z0=0.0):
    prepare(d); _prepare_everyday(d)
    s = size / 48
    cy = y - 7
    r = 7.2 * s
    objs = [hp.rlathe(d, n + '-body', x, cy, [(-.30, r * 1.06), (.10, r), (2.35 * s, r), (2.42 * s, r * 1.08)], 'lm-post-green', 18),
            hp.rlathe(d, n + '-dome', x, cy, [(2.42 * s, r * 1.08), (2.62 * s, r * .9), (2.80 * s, r * .55), (2.86 * s, .2)], 'lm-post-green', 18),
            hp.rlathe(d, n + '-band', x, cy, [(.08, r * 1.04), (.22, r * 1.04)], 'lm-post-green-dark', 18)]
    fx_, fy_ = hp.gpt(x, cy, 0, -r - .3)
    objs.append(hp.gbox(d, n + '-slot', fx_, fy_, r * 1.1, .6, 1.95 * s, 2.06 * s, 'lm-vend-dark', 0, .02))
    objs.append(hp.gbox(d, n + '-lip', fx_, fy_ - .3, r * 1.25, .7, 2.07 * s, 2.13 * s, 'lm-post-green-dark', 0, .02))
    objs.append(hp.gbox(d, n + '-plate', fx_, fy_, r * .8, .6, 1.25 * s, 1.62 * s, 'hp-white', 0, .03))
    objs.append(hp.gbox(d, n + '-door', fx_, fy_, r * .95, .5, .45, 1.05 * s, 'lm-post-green-dark', 0, .04))
    _lean(d, objs, x, y - 2, (5 if seed % 2 else -8))
    _mound(d, n, x, y, 9 * s, seed + 3)


def register_everyday():
    hp.BUILDERS.update({'data-terminal': vending_machine, 'circuit-cabinet': postbox})
