"""BM10 stadium arena: a clay pitch in an open concrete stadium (see _stadium)."""
from arenas import _stadium

FIELD_ID = 'field_bm10_01'
JOIN = {'weld': 12.0, 'soften': .6, 'clash': 60.0, 'tone_cap': 26.0}
ROOF = (20, 4, 308, 76)            # four roof panels
UPPER_SEATS = (606, 22, 694, 92)   # four seats by two rows of the open upper stand
CFG = {
    'seed': 100,
    'apron': [(6, 560, 40, 860), (1624, 560, 1658, 860)],
    'apron_tone': (102, 114, 110),
    'side_tile': (310, 0, 442, 215),
    'top_zones': [(-10000, 500, ROOF), (500, 1160, UPPER_SEATS), (1160, 10000, ROOF)],
    'exterior': (50, 56, 62),
    'rim': (34, 38, 42),
    'seats': [(24, 112, 126), (172, 142, 72)],
    'boards': [(24, 30, 34), (30, 84, 96), (120, 96, 40)],
}


def paint(G, work):
    return _stadium.paint(G, work, CFG)


def build(K):
    _stadium.build(K, CFG)
