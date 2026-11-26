"""Download, instance and subset the site's fonts into public/fonts/.

Reproducible, and never part of the build: run it again only to refresh the fonts.
Needs a Python with fonttools and brotli:  python3 scripts/fonts.py

Sources: google/fonts on GitHub (ofl/<family>/), all under the SIL Open Font License,
whose text ships next to the fonts. The fonts budget is 120 KB and never moves: if the
files come out larger, the script cuts in the spec's order (narrow the characters to the
ones the built site uses, then pin Fraunces's optical size, then static Fraunces) and
says where it stopped.
"""
import html
import io
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'fonts'
DIST = ROOT / 'dist'
RAW = 'https://github.com/google/fonts/raw/main/ofl/{}/{}'
BUDGET = 120 * 1024
LATIN = ('U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, '
         'U+0329, U+2000-206F, U+20AC, U+2122, U+2190-2193, U+2212, U+2215, U+FEFF, U+FFFD')

NEXT = ('atkinsonhyperlegiblenext', 'AtkinsonHyperlegibleNext[wght].ttf')
NEXT_I = ('atkinsonhyperlegiblenext', 'AtkinsonHyperlegibleNext-Italic[wght].ttf')
MONO = ('atkinsonhyperlegiblemono', 'AtkinsonHyperlegibleMono[wght].ttf')
FRAUNCES_I = ('fraunces', 'Fraunces-Italic[SOFT,WONK,opsz,wght].ttf')
LICENCES = {'atkinsonhyperlegiblenext': 'OFL-AtkinsonHyperlegibleNext.txt',
            'atkinsonhyperlegiblemono': 'OFL-AtkinsonHyperlegibleMono.txt',
            'fraunces': 'OFL-Fraunces.txt'}


def fetch(family, name, into):
    """Download one source file into the scratch dir (downloads stay data: only fontTools parses them)."""
    path = into / f'{family}-{name}'  # three families each ship an OFL.txt
    if not path.exists():
        with urllib.request.urlopen(RAW.format(family, urllib.request.quote(name)), timeout=60) as r:
            path.write_bytes(r.read())
    return path


def parse_ranges(spec):
    out = set()
    for part in spec.split(','):
        lo, _, hi = part.strip()[2:].partition('-')
        out.update(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


def ranges_css(codepoints):
    """Compact unicode-range for a set of code points."""
    cps, parts, i = sorted(codepoints), [], 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1:
            j += 1
        parts.append(f'U+{cps[i]:04X}' + (f'-{cps[j]:04X}' if j > i else ''))
        i = j + 1
    return ', '.join(parts)


def used_characters():
    """The spec's first cut: Latin basic and Latin-1 always (so new copy in any Western European language
    still renders), plus every other character the built site shows (punctuation and symbols such as † → – ’ ·)."""
    if not DIST.exists():
        sys.exit('dist/ missing: run npm run build first (the narrow cut reads the built pages)')
    chars = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100))
    for f in list(DIST.rglob('*.html')) + list(DIST.rglob('*.css')):
        text = html.unescape(re.sub(r'<script\b.*?</script>', ' ', f.read_text(), flags=re.S))
        chars.update(ord(ch) for ch in text if ord(ch) >= 0x20)
        for esc in re.findall(r'\\([0-9a-fA-F]{2,6})', f.read_text() if f.suffix == '.css' else ''):
            chars.add(int(esc, 16))
    return chars


def instance(src, limits):
    return instancer.instantiateVariableFont(TTFont(src), limits)


def woff2(font, codepoints):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=codepoints)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    return buf.getvalue()


def faces(src, codepoints, fraunces):
    """file name -> (bytes, @font-face descriptors)."""
    out = {}
    for name, (fam, weight) in {'atkinson-next-400.woff2': (NEXT, 400), 'atkinson-next-700.woff2': (NEXT, 700),
                                'atkinson-next-400i.woff2': (NEXT_I, 400),
                                'atkinson-mono-400.woff2': (MONO, 400), 'atkinson-mono-700.woff2': (MONO, 700)}.items():
        family = 'Atkinson Hyperlegible Next' if fam in (NEXT, NEXT_I) else 'Atkinson Hyperlegible Mono'
        out[name] = (woff2(instance(src[fam], {'wght': weight}), codepoints),
                     {'font-family': f'"{family}"', 'font-style': 'italic' if fam is NEXT_I else 'normal', 'font-weight': str(weight)})
    if fraunces == 'static':
        for w, name in ((400, 'fraunces-italic.woff2'), (300, 'fraunces-italic-300.woff2')):
            out[name] = (woff2(instance(src[FRAUNCES_I], {'wght': w, 'opsz': 72, 'SOFT': None, 'WONK': None}), codepoints),
                         {'font-family': '"Fraunces"', 'font-style': 'italic', 'font-weight': str(w)})
    else:
        opsz = (9, 144) if fraunces == 'variable' else 72
        out['fraunces-italic.woff2'] = (woff2(instance(src[FRAUNCES_I], {'wght': (300, 500), 'opsz': opsz, 'SOFT': None, 'WONK': None}), codepoints),
                                        {'font-family': '"Fraunces"', 'font-style': 'italic', 'font-weight': '300 500'})
    return out


def css(files, unicode_range):
    rules = []
    for name, (_, d) in files.items():
        body = ''.join(f'\n  {k}: {v};' for k, v in d.items())
        rules.append(f"@font-face {{{body}\n  font-display: swap;\n  src: url(./{name}) format('woff2');\n  unicode-range: {unicode_range};\n}}")
    head = ('/* Self-hosted, subset fonts (scripts/fonts.py). SIL Open Font License: see the OFL-*.txt files beside this one.\n'
            '   Atkinson Hyperlegible Next and Mono: Braille Institute of America. Fraunces: Undercase Type. */\n')
    return head + '\n'.join(rules) + '\n'


def main():
    with tempfile.TemporaryDirectory(prefix='fonts-src-') as tmp:
        tmp = Path(tmp)
        src = {f: fetch(f[0], f[1], tmp) for f in (NEXT, NEXT_I, MONO, FRAUNCES_I)}
        latin = parse_ranges(LATIN)
        steps = [('latin', latin, 'variable'),
                 ('Latin-1 plus the symbols the site uses', None, 'variable'),
                 ('Fraunces opsz pinned to 72', None, 'pinned'),
                 ('static Fraunces italic 300 and 400', None, 'static')]
        for label, cps, fraunces in steps:
            cps = cps if cps is not None else used_characters()
            files = faces(src, cps, fraunces)
            total = sum(len(b) for b, _ in files.values())
            print(f'{label}: {total / 1024:.1f} KB')
            if total <= BUDGET:
                break
        else:
            sys.exit(f'still {total / 1024:.1f} KB after every cut: over the 120 KB budget')

        OUT.mkdir(parents=True, exist_ok=True)
        for old in OUT.glob('*.woff2'):
            old.unlink()
        for name, (data, _) in files.items():
            (OUT / name).write_bytes(data)
            print(f'  {name:28} {len(data) / 1024:6.1f} KB')
        (OUT / 'fonts.css').write_text(css(files, LATIN if cps is latin else ranges_css(cps)))
        for family, name in LICENCES.items():
            (OUT / name).write_bytes(fetch(family, 'OFL.txt', tmp).read_bytes())
        print(f'total {total / 1024:.1f} KB of {BUDGET // 1024} KB, stopped at: {label}')


if __name__ == '__main__':
    main()
