"""Polish pass for the shrine (cm13) on top of the frozen sacred module (round opus-r3).

``cage_opus_sacred_authoring`` stays unchanged (its hash is recorded in the r3
manifests).  This module reuses it and replaces only two pieces for cm13:

* The grand stair.  The six original steps rose 0.064 world units each, so
  every riser hid under the next tread and the stair read as a ladder of lines;
  its head also followed the V-shaped seam between the hexes, which read as a
  gable.  Now a landing fills the V so the stair head is straight, and three
  treads of stone blocks are joined by four short dark sloped risers.  The
  podium is only 0.45 units high (4.4 native px), so a vertical riser could
  show at most 1.1 px here; the slope adds its 2.5 px run, and each riser reads
  as a band of about 3.6 px.  The carpet drapes over every riser, and the balustrade rails
  follow the same profile.  The podium height is unchanged.
* The extra carpet square that overlapped the carpet run at the same height
  (a coplanar overlap that rendered as a black diamond) is gone.
* The guardian statues stand on the balustrades, and their wings face the
  camera in a softly glowing marble so they read as white wings instead of dark
  spikes.  Each statue is designed into its source window (no fit scaling).
"""
import math

from . import cage_opus_facility_authoring as fx
from . import cage_opus_sacred_authoring as base


FIELDS = ('field_cm13_01',)
SURFACES = {'field_cm13_01': base.SURFACES['field_cm13_01']}
CONTAINMENT = 'cage_opus_containment'
DEPENDENCIES = ('cage_opus_sacred_authoring', 'cage_opus_facility_authoring')
CONTRACTS = base.CONTRACTS
PODIUM = base.PODIUM

POLISH_PALETTE = {
    'sc-riser': ((.34, .38, .46), .40, .0, 0),
    'sc-wing': ((.88, .89, .92), .32, .0, .45),
}
# Stair plan (native px / world units): the landing's front edge, three treads of stone
# blocks, and four sloped risers whose run (RUN) adds to their 1.1 px rise on screen.
STAIR_X = (72.0, 120.0)
STAIR_HEAD = 100.0
TREAD = 12.0
STEP_TOPS = (.3375, .225, .1125)
RUN = 2.5
# Block joints per tread, staggered on alternate treads (outside the carpet).
JOINTS = ((84.0, 108.0), (80.0, 112.0))
CAP = .03
RAILS = (('left', 67.5), ('right', 120.0))
RAIL_WIDTH = 4.5
RAIL_HEIGHT = .16


def prepare(d, cell_id):
    base.prepare(d, cell_id)
    for name, (color, roughness, metal, glow) in POLISH_PALETTE.items():
        if name not in d.M:
            d.material(name, color, roughness, metal, glow)


def _rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def x_extrusion(d, name, x0, x1, profile, mat, bevel=0.0):
    """A solid whose (y, z) cross-section is swept along x from x0 to x1 (stairs, rails)."""
    n = len(profile)
    verts = [d.world(x, y, z) for x in (x0, x1) for y, z in profile]
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return fx._object(d, name, verts, faces, mat, bevel)


def stair_profile(lift=0.0, drop=0.0):
    """Stair surface as (y, z) points: nosing, sloped riser, tread ... down to the floor."""
    levels = (PODIUM,) + STEP_TOPS + (0.0,)
    points = []
    for k in range(len(levels) - 1):
        y = STAIR_HEAD + k * TREAD
        points += [(y, levels[k] + lift - drop), (y + RUN, levels[k + 1] + lift - drop)]
    return points


def shrine_core(d, footprint):
    """Raised marble podium, light font, carpet run and a broad stair with visible risers."""
    base.clipped_prism(d, 'shrine-podium', base.UPPER_OUTLINE, footprint, 0, PODIUM, 'sc-marble', 1.0)
    for k, (half, z) in enumerate(((10.0, .10), (7.5, .20), (5.0, .30))):
        fx.box(d, f'shrine-dais-{k}', 96, 50, half, half * .6, PODIUM, PODIUM + z, 'sc-marble-shade', .010)
    fx.lathe(d, 'shrine-font', 96, 50, [(PODIUM + .30, 3.4), (PODIUM + .42, 3.8), (PODIUM + .52, 2.6),
                                         (PODIUM + .62, 1.2)], 'sc-gold', 24)
    fx.ball(d, 'shrine-light-orb', 96, 50, PODIUM + 1.05, 3.2, 'sc-light-orb')
    x0, x1 = STAIR_X
    foot = STAIR_HEAD + len(STEP_TOPS) * TREAD + RUN
    # The landing fills the V between the upper hexes exactly (its upper edges lie on the
    # podium's seam edges), so the stair head is one straight nosing.  No bevel: the landing
    # top continues the podium top without a crease.
    landing = [(x0, STAIR_HEAD), (96.0, 88.0), (x1, STAIR_HEAD)]
    fx.prism(d, 'shrine-landing-body', landing, 0, PODIUM - CAP, 'sc-riser', 0)
    fx.prism(d, 'shrine-landing-cap', landing, PODIUM - CAP, PODIUM, 'sc-marble', 0)
    # Stair body in the riser shade: only its sloped risers show.  Light caps form the treads.
    body = [(STAIR_HEAD, 0.0)] + stair_profile(drop=CAP)[:-1] + [(foot, 0.0)]
    x_extrusion(d, 'shrine-stair-body', x0, x1, body, 'sc-riser')
    for k, top in enumerate(STEP_TOPS):
        y0 = STAIR_HEAD + k * TREAD + RUN
        y1 = STAIR_HEAD + (k + 1) * TREAD
        edges = [x0, *JOINTS[k % 2], x1]
        for j in range(len(edges) - 1):
            a = edges[j] + (.25 if j else 0)
            b = edges[j + 1] - (.25 if j < len(edges) - 2 else 0)
            fx.prism(d, f'shrine-step-tread-{k}-{j}', _rect(a, y0, b, y1), top - CAP, top, 'sc-marble', .004)
    # Carpet: the podium run, the landing, then one draped strip over every tread and riser.
    cx0, cx1 = 91.0, 101.0
    fx.prism(d, 'shrine-carpet-run', _rect(cx0, 60, cx1, 88), PODIUM, PODIUM + .012, 'sc-carpet', 0)
    fx.prism(d, 'shrine-carpet-landing', _rect(cx0, 88, cx1, STAIR_HEAD), PODIUM, PODIUM + .012, 'sc-carpet', 0)
    surface = stair_profile(lift=.012)
    under = stair_profile(drop=CAP + .01)
    runner = surface + [(foot + 5.0, .012), (foot + 5.0, -.004)] + [(foot, -.004)] + under[::-1][1:]
    x_extrusion(d, 'shrine-stair-runner', cx0, cx1, runner, 'sc-carpet')
    # Balustrade rails follow the stair profile; newels at the head, a newel at the left
    # foot (the right foot newel is the guardian's pedestal).
    top = stair_profile(lift=RAIL_HEIGHT)
    rail = [(STAIR_HEAD + 2.0, 0.0), (STAIR_HEAD + 2.0, top[1][1])] + top[2:-1] + [(foot, RAIL_HEIGHT), (foot, 0.0)]
    for side, rx in RAILS:
        fx.box(d, f'shrine-newel-head-{side}', rx + RAIL_WIDTH / 2, STAIR_HEAD + 1.0, 1.7, 1.7, 0, PODIUM + .22,
               'sc-marble-shade', .008)
        x_extrusion(d, f'shrine-rail-{side}', rx, rx + RAIL_WIDTH, rail, 'sc-marble-shade')
        if side == 'left':
            fx.box(d, f'shrine-newel-foot-{side}', rx + RAIL_WIDTH / 2, foot + .6, 1.7, 1.7, 0, .40,
                   'sc-marble-shade', .008)
    return ['raised-marble-podium', 'broad-stair-sloped-risers', 'light-font-on-dais', 'marble-columns']


def winged_statue(d, name, rect):
    """Guardian on a balustrade pedestal; its wings face the camera in glowing marble."""
    x, y, w, h = rect
    # Stand on the balustrade nearest the window centre; the pedestal (13.6 px wide)
    # and the wings stay inside the window, and the pedestal's front corner stays
    # above the window's bottom edge.
    rails = [rx + RAIL_WIDTH / 2 for _, rx in RAILS]
    cx = min(rails, key=lambda r: abs(r - (x + w / 2)))
    if not (x + 8.0 <= cx <= x + w - 8.0):
        cx = x + w / 2
    cy = y + h - 5.2
    fx.box(d, name + '-pedestal', cx, cy, 3.4, 3.4, 0, .55, 'sc-marble-shade', .012)
    fx.lathe(d, name + '-robe', cx, cy, [(.55, 2.7), (1.05, 2.4), (1.55, 1.6), (1.75, 1.1)], 'sc-marble', 20)
    fx.ball(d, name + '-head', cx, cy, 1.95, 1.4, 'sc-marble')
    for sign in (-1, 1):
        wing = [(0, 1.0), (2.0 * sign, 1.25), (4.2 * sign, 1.90), (3.1 * sign, 1.52), (1.5 * sign, 1.30), (0, 1.6)]
        if sign < 0:
            wing = wing[::-1]
        base.vertical_slab(d, f'{name}-wing-{"l" if sign < 0 else "r"}', cx + sign * .6, cy - .9, 'X', wing, .7,
                           'sc-wing')
    return (cx, cy)


def build(field, d, cell_id):
    original_core, original_statue = base.CORES['field_cm13_01'], base.winged_statue
    base.CORES['field_cm13_01'] = shrine_core
    base.winged_statue = winged_statue
    try:
        return base.build(field, d, cell_id)
    finally:
        base.CORES['field_cm13_01'] = original_core
        base.winged_statue = original_statue
