"""Build the interface font subset (Owner 2026-11-11: 源泉圓體 GenSenRounded2 TW, SIL OFL 1.1).

  python -X utf8 -P scripts/build-ui-font-subset.py <folder with GenSenRounded2TW-B.otf and -H.otf>

The source fonts are not in the repository (60 MB): download GenSenRounded2TW-otf.zip from
the v2.100 release of github.com/ButTaiwan/gensen-font. The subset keeps every character the
game's own text uses (source, styles, page, data and locale tables) plus printable ASCII and
common punctuation; anything else (a player-typed name, Thai, Vietnamese accents) falls back
to the system fonts after it in --font-ui. Needs fonttools and brotli.

Writes src/championship/app/ui/fonts/*.woff2 and prints the character count.
"""
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'src' / 'championship' / 'app' / 'ui' / 'fonts'
SOURCES = [('GenSenRounded2TW-B.otf', 'CyberPartnerRounded-Bold.woff2'), ('GenSenRounded2TW-H.otf', 'CyberPartnerRounded-Heavy.woff2')]
TEXT_SUFFIXES = {'.js', '.mjs', '.css', '.html', '.json'}


def game_characters():
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars.update('　、。，．・：；？！「」『』（）［］【】〈〉《》〔〕—–…‧·～﹏％＋－＝／＆＃＠＊×÷→←↑↓▲▼◀▶●○◎★☆♪♥✓✕∞≥≤≠±°′″№¥€£')
    files = [ROOT / 'championship.html', ROOT / 'index.html']
    files += [p for p in (ROOT / 'src').rglob('*') if p.is_file() and p.suffix in TEXT_SUFFIXES]
    for path in files:
        if not path.exists():
            continue
        for ch in path.read_text(encoding='utf8', errors='ignore'):
            if ord(ch) >= 0x80 and not (0xD800 <= ord(ch) <= 0xDFFF):
                chars.add(ch)
    return chars


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    source_dir = pathlib.Path(sys.argv[1])
    chars = game_characters()
    OUT.mkdir(parents=True, exist_ok=True)
    for source, target in SOURCES:
        font = TTFont(source_dir / source)
        have = set(font.getBestCmap())
        wanted = sorted(ord(c) for c in chars if ord(c) in have)
        options = subset.Options()
        options.flavor = 'woff2'
        options.layout_features = ['kern', 'locl', 'ccmp', 'mark', 'mkmk']
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
        options.notdef_outline = True
        options.desubroutinize = True
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=wanted)
        subsetter.subset(font)
        font.flavor = 'woff2'
        font.save(OUT / target)
        print(f'{target}: {len(wanted)} characters, {(OUT / target).stat().st_size} bytes')
    missing = sorted(c for c in chars if ord(c) not in have and ord(c) < 0x10000)
    han_missing = [c for c in missing if 0x3400 <= ord(c) <= 0x9FFF]
    print(f'not in the font (system fallback): {len(missing)} characters, {len(han_missing)} of them Han: {"".join(han_missing)}')


if __name__ == '__main__':
    main()
