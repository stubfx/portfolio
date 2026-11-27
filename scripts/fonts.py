"""Download, instance and subset the site's fonts into site/fonts/.

Local only, never part of the build or CI: run it again only to refresh the fonts, then commit site/fonts/.
    uv run -q --with fonttools --with brotli python -I scripts/fonts.py

Sources: google/fonts on GitHub at a pinned commit (ofl/<family>/), all under the SIL Open Font License,
whose texts ship next to the fonts. Writes the woff2 subsets, fonts.css (faces plus metric-matched
fallbacks, so the swap doesn't move the page) and coverage.json (what each subset can render, for the
glyph coverage test). Adapted from the previous site's scripts/fonts.py (commit 5ed1192).
"""
import hashlib
import io
import json
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'site' / 'fonts'
CONTENT = ROOT / 'content'
# Pinned so a rerun reproduces these exact files; bump it on purpose to pick up upstream font updates.
GOOGLE_FONTS_COMMIT = 'a0b5fecfb2274abee69ebf3be32d4510b8ddf56c'
RAW = 'https://github.com/google/fonts/raw/' + GOOGLE_FONTS_COMMIT + '/ofl/{}/{}'
BUDGET = 150 * 1024

# (output, family dir, source file, axis limits, licence name, css family, css weight, fallback)
FONTS = [
    ('archivo-black.woff2', 'archivoblack', 'ArchivoBlack-Regular.ttf', None, 'OFL-ArchivoBlack.txt', 'Archivo Black', '400', 'sans'),
    ('dm-sans.woff2', 'dmsans', 'DMSans[opsz,wght].ttf', {'wght': (400, 700)}, 'OFL-DMSans.txt', 'DM Sans', '400 700', 'sans'),
    ('jetbrains-mono.woff2', 'jetbrainsmono', 'JetBrainsMono[wght].ttf', {'wght': 400}, 'OFL-JetBrainsMono.txt', 'JetBrains Mono', '400', 'mono'),
]
# Published metrics of the local fonts the fallbacks map onto (as used by capsize and next/font).
FALLBACK = {
    'sans': {'local': ['Arial', 'Liberation Sans', 'Arimo'], 'upm': 2048, 'x_width_avg': 904},
    'mono': {'local': ['Courier New', 'Liberation Mono', 'Cousine'], 'upm': 2048, 'x_width_avg': 1229},
}
# Basic Latin and Latin-1 always, so new copy in any Western European language still renders.
LATIN = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100))
TYPOGRAPHY = {0x2018, 0x2019, 0x201C, 0x201D, 0x2013, 0x2014, 0x2026, 0x00B7, 0x2022, 0x20AC, 0x2122,
              0x2190, 0x2191, 0x2192, 0x2193}
# The logic diagrams: box drawing and the four solid triangles; the embed's play mark is one of them.
MONO_EXTRA = set(range(0x2500, 0x2580)) | {0x25B2, 0x25B6, 0x25BC, 0x25C0}
# Letter frequencies (English, %), plus the space: the weighted average width that size-adjust matches.
FREQ = {'a': 8.2, 'b': 1.5, 'c': 2.8, 'd': 4.3, 'e': 12.7, 'f': 2.2, 'g': 2.0, 'h': 6.1, 'i': 7.0, 'j': 0.15,
        'k': 0.77, 'l': 4.0, 'm': 2.4, 'n': 6.7, 'o': 7.5, 'p': 1.9, 'q': 0.095, 'r': 6.0, 's': 6.3, 't': 9.1,
        'u': 2.8, 'v': 0.98, 'w': 2.4, 'x': 0.15, 'y': 2.0, 'z': 0.074, ' ': 18.0}


def fetch(family, name, into):
    """Download one source file into the scratch dir (downloads stay data: only fontTools parses them)."""
    path = into / f'{family}-{name}'
    if not path.exists():
        with urllib.request.urlopen(RAW.format(family, urllib.parse.quote(name)), timeout=60) as r:
            path.write_bytes(r.read())
    return path


def content_chars():
    chars = set()
    for f in CONTENT.rglob('*.md'):
        chars |= {ord(c) for c in f.read_text(encoding='utf-8')}
    return {c for c in chars if c >= 0x20}


def x_width_avg(font):
    cmap, hmtx = font.getBestCmap(), font['hmtx']
    total = sum(FREQ.values())
    return sum(hmtx[cmap[ord(c)]][0] * w for c, w in FREQ.items() if ord(c) in cmap) / total


def fallback_face(css_family, font, kind):
    fb = FALLBACK[kind]
    upm, hhea = font['head'].unitsPerEm, font['hhea']
    size_adjust = (x_width_avg(font) / upm) / (fb['x_width_avg'] / fb['upm'])
    pct = lambda v: f'{v / (upm * size_adjust) * 100:.2f}%'
    src = ','.join(f'local("{name}")' for name in fb['local'])
    return (f'@font-face{{font-family:"{css_family} fallback";src:{src};size-adjust:{size_adjust * 100:.2f}%;'
            f'ascent-override:{pct(hhea.ascent)};descent-override:{pct(abs(hhea.descent))};line-gap-override:{pct(hhea.lineGap)}}}')


def build(scratch):
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = content_chars()
    css, coverage, total = [], {}, 0
    for out, family, name, limits, licence, css_family, weight, kind in FONTS:
        font = TTFont(fetch(family, name, scratch))
        if limits:
            font = instancer.instantiateVariableFont(font, limits)
        metrics_font = TTFont(io.BytesIO(_save(font)))  # before subsetting: full hmtx for the fallback maths
        unicodes = LATIN | TYPOGRAPHY | wanted | (MONO_EXTRA if kind == 'mono' else set())
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['kern', 'mark', 'mkmk', 'ccmp', 'locl', 'case'] if kind == 'mono' else ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=unicodes)
        sub.subset(font)
        path = OUT / out
        subset.save_font(font, str(path), opts)
        data = path.read_bytes()
        total += len(data)
        saved = TTFont(str(path))
        has_ligatures = 'GSUB' in saved and any(
            fr.FeatureTag in ('liga', 'calt', 'dlig') for fr in saved['GSUB'].table.FeatureList.FeatureRecord)
        coverage[out] = {'sha256': hashlib.sha256(data).hexdigest(), 'codepoints': sorted(saved.getBestCmap()),
                         'ligatures': has_ligatures}
        css.append(f'@font-face{{font-family:"{css_family}";src:url(fonts/{out}) format("woff2");'
                   f'font-weight:{weight};font-style:normal;font-display:swap}}')
        css.append(fallback_face(css_family, metrics_font, kind))
        (OUT / licence).write_bytes(fetch(family, 'OFL.txt', scratch).read_bytes())
        print(f'{out}: {len(data) / 1024:.1f} KB, {len(coverage[out]["codepoints"])} glyphs')
    (OUT / 'fonts.css').write_text('/* Generated by scripts/fonts.py. Do not edit. */\n' + '\n'.join(css) + '\n')
    (OUT / 'coverage.json').write_text(json.dumps(coverage, separators=(',', ':')) + '\n')
    print(f'total {total / 1024:.1f} KB (budget {BUDGET // 1024} KB)')
    if total > BUDGET:
        sys.exit('over the fonts budget')


def _save(font):
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as tmp:
        build(Path(tmp))
