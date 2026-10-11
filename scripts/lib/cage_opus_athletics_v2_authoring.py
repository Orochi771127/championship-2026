"""Stadium (cm03) revision on top of the frozen athletics module (round opus-r15).

Owner 2026-10-06: 「把競技場看台移到配置看的到的位置」.  In r15 the grandstands
stood on the only blocked back row (y 24-32), which the layout's top crop of
24 native px cuts away, so only the advertising boards showed.

Here the track's top straight moves down by 15 px (centreline y 40 -> 55), and
the grandstands take the band it frees: three tiers plus a back wall between y
32.6 and 46, every screen-projected top at or below y 25.4, so the layout shows
them whole.  The band is walkable, which is intended: residents drawn there
read as spectators in the stands.  The long-jump runway and pit move down with
the track; everything else (track width, field events, masts, objects) is the
r15 design.  ``cage_opus_athletics_authoring`` stays unchanged.
"""
from . import cage_opus_athletics_authoring as base
from . import cage_opus_facility_authoring as fx
from . import cage_opus_remaining_authoring as kit


FIELDS = ('field_cm03_01',)
CONTAINMENT = base.CONTAINMENT
SURFACES = {'field_cm03_01': base.SURFACES['field_cm03_01']}
DEPENDENCIES = base.DEPENDENCIES + ('cage_opus_athletics_authoring',)
ART_DIRECTION_INPUTS = base.ART_DIRECTION_INPUTS + ['Owner 2026-10-06: move the stadium stands where the layout shows them']
CONTRACTS = base.CONTRACTS
prepare = base.prepare

TRACK_KEYS = [(144, 55), (210, 55), (248, 57), (264, 65), (270, 77), (262, 89), (244, 97), (232, 107),
              (230, 122), (230, 146), (224, 160), (208, 166), (144, 166), (80, 166), (64, 160), (58, 146),
              (58, 122), (56, 107), (44, 97), (26, 89), (18, 77), (24, 65), (40, 57), (78, 55)]
STAND_BLOCKS = ((14.0, 90.0), (102.0, 186.0), (198.0, 274.0))
# (y0, y1, top) from the front tier back; seats sit on the top 0.05 of each tier.
TIERS = ((42.0, 46.0, .22, 'at-seat-blue'), (38.0, 42.0, .40, 'at-seat-white'), (34.0, 38.0, .58, 'at-seat-blue'))
BACK_WALL = (32.6, 34.0, .72)
BOARDS = (46.4, 47.6, .26)
CROP_LINE = 24.0


def grandstands(d, footprint):
    """Three-tier grandstands per top hex with aisles at the gaps, boards in front."""
    for b, (x0, x1) in enumerate(STAND_BLOCKS):
        y0, y1, top = BACK_WALL
        fx.prism(d, f'stadium-stand-{b}-back', [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], 0, top, 'at-stand', .004)
        for t, (ty0, ty1, ttop, seat) in enumerate(TIERS):
            fx.prism(d, f'stadium-stand-{b}-tier-{t}', [(x0, ty0), (x1, ty0), (x1, ty1), (x0, ty1)], 0, ttop - .05,
                     'at-stand', .004)
            n = int((x1 - x0) // 4)
            for s in range(n):
                sx0 = x0 + .6 + s * (x1 - x0) / n
                sx1 = sx0 + (x1 - x0) / n - 1.0
                fx.prism(d, f'stadium-stand-{b}-seat-{t}-{s}', [(sx0, ty0 + .3), (sx1, ty0 + .3), (sx1, ty1 - .4),
                                                                (sx0, ty1 - .4)], ttop - .05, ttop, seat, .003)
    colours = ('at-board-blue', 'at-board-yellow', 'at-board-red', 'at-board-green')
    by0, by1, btop = BOARDS
    x, k = 6.0, 0
    while x < 282.0:
        x1 = min(282.0, x + 22.0)
        fx.prism(d, f'stadium-board-{k}', [(x, by0), (x1 - .5, by0), (x1 - .5, by1), (x, by1)], 0, btop,
                 colours[k % 4], .003)
        x, k = x1, k + 1
    tops = []
    for x0, x1 in STAND_BLOCKS:
        tops += [base.scr(d, x0, BACK_WALL[0], BACK_WALL[2]), base.scr(d, x1, BACK_WALL[0], BACK_WALL[2])]
    if min(y for _, y in tops) < CROP_LINE + 1.0:
        raise ValueError('STANDS_INSIDE_LAYOUT_CROP')
    if not kit.core_inside(tops + [base.scr(d, 6.0, by0, btop), base.scr(d, 282.0, by0, btop)], footprint, 1.3):
        raise ValueError('STANDS_LEAVE_FIELD')


def long_jump(d):
    runway = [(150.0, 68.0), (214.0, 68.0), (214.0, 72.0), (150.0, 72.0)]
    fx.prism(d, 'stadium-runway', runway, .002, .012, 'at-track', 0)
    fx.pipe(d, 'stadium-takeoff-board', [(211.0, 68.1, .014), (211.0, 71.9, .014)], .035, 'sp-white')
    pit = [(216.0, 63.5), (242.0, 63.5), (242.0, 76.5), (216.0, 76.5)]
    fx.prism(d, 'stadium-pit-rim', pit, 0, .06, 'at-rim', .004)
    fx.prism(d, 'stadium-pit-sand', [(217.2, 64.7), (240.8, 64.7), (240.8, 75.3), (217.2, 75.3)], .06, .066,
             'at-sand', 0)


def stadium_core(d, footprint):
    base.stadium_track(d, footprint)
    long_jump(d)
    base.throwing_circle(d)
    grandstands(d, footprint)
    base.floodlights(d, footprint)
    return ['blue-ring-track-following-outline', 'striped-artificial-turf', 'long-jump-runway-and-sand-pit',
            'throwing-circle-and-sector', 'three-tier-grandstands-visible-in-layout', 'advertising-boards',
            'floodlight-masts']


def build(field, d, cell_id):
    saved = base.TRACK_KEYS, base.stadium_core
    base.TRACK_KEYS, base.stadium_core = TRACK_KEYS, stadium_core
    try:
        return base.build(field, d, cell_id)
    finally:
        base.TRACK_KEYS, base.stadium_core = saved
