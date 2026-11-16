"""Cuts REI's typefaces down to the Latin characters the app uses (it is English only).

The Mincho ships with the full Japanese set (15 MB a weight); the subset is under 100 KB.
The line metrics are also reset from the tall Japanese ones (1.45 em) to Latin ones (1.2 em,
centred on the capitals), so iOS sets a line where the design expects it and never clips it.
Sources are the @expo-google-fonts packages (SIL Open Font License, no reserved names).

    pip install fonttools
    python3 scripts/subset-fonts.py        # writes app/assets/fonts/*.ttf
"""
import os
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = {
    'shippori-mincho-b1': ['ShipporiMinchoB1_500Medium', 'ShipporiMinchoB1_700Bold', 'ShipporiMinchoB1_800ExtraBold'],
    'zen-kaku-gothic-new': ['ZenKakuGothicNew_400Regular', 'ZenKakuGothicNew_500Medium', 'ZenKakuGothicNew_700Bold'],
}
# Basic Latin, Latin-1, Latin Extended-A, punctuation, currency, arrows, a few maths signs and marks.
UNICODES = 'U+0020-007E,U+00A0-017F,U+02C6-02DC,U+2000-206F,U+20A0-20BF,U+2122,U+2190-2199,U+2212,U+2215,U+2248,U+2260,U+2264,U+2265,U+25A0-25FF,U+2605,U+2606,U+2713,U+2715'

# Line metrics in font units (1000 to the em).
ASCENT, DESCENT = 960, 240

out = os.path.join(ROOT, 'app', 'assets', 'fonts')
os.makedirs(out, exist_ok=True)
for pkg, names in FONTS.items():
    for name in names:
        weight = name.split('_')[1]
        src = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', pkg, weight, name + '.ttf')
        dst = os.path.join(out, name + '.ttf')
        subset.main([src, '--unicodes=' + UNICODES, '--layout-features=kern,liga,palt,pnum,tnum,lnum', '--no-hinting', '--name-IDs=*', '--output-file=' + dst])
        t = TTFont(dst)
        h, o = t['hhea'], t['OS/2']
        h.ascent, h.descent, h.lineGap = ASCENT, -DESCENT, 0
        o.sTypoAscender, o.sTypoDescender, o.sTypoLineGap = ASCENT, -DESCENT, 0
        o.usWinAscent, o.usWinDescent = ASCENT, DESCENT
        t.save(dst)
        print(name, os.path.getsize(dst) // 1024, 'KB', 'upm', t['head'].unitsPerEm, 'hhea', h.ascent, h.descent, h.lineGap, 'cap', getattr(o, 'sCapHeight', None), 'glyphs', len(t.getBestCmap()))
