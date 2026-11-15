"""BM11 dome-stadium arena: a turf pitch under a tubular roof (see _stadium)."""
from arenas import _stadium

FIELD_ID = 'field_bm11_01'
JOIN = {'weld': 12.0, 'soften': .6, 'clash': 60.0, 'tone_cap': 26.0}
ROOF = (100, 2, 200, 44)           # one bay of the roof strip, between two of its posts
CFG = {
    'seed': 110,
    'apron': [(6, 560, 40, 860), (1624, 560, 1658, 860)],
    'apron_from': 'field_bm10_01',
    'apron_tone': (90, 108, 112),
    'side_tile': (500, 0, 600, 215),
    'top_zones': [(-10000, 10000, ROOF)],
    'exterior': (40, 50, 58),
    'rim': (30, 36, 42),
    'seats': [(18, 106, 122), (178, 72, 28)],
    'boards': [(22, 30, 34), (20, 88, 100), (150, 60, 24)],
    # The two roof tubes that cross the play area, carried on along their own lines to anchors.
    'tubes': [[(119.6, -576), (88.5, 0)], [(30, 1088), (11, 1440)], [(1533, -576), (1569, 0)], [(1644, 1088), (1666, 1440)]],
    'tube_dark': (84, 104, 108),
    'tube_lit': (168, 186, 190),
    'anchors': [(11, 1452), (1666, 1452)],
}


def paint(G, work):
    return _stadium.paint(G, work, CFG)


def build(K):
    _stadium.build(K, CFG)
