"""Frame strips of the flight transitions, for looking at them.

Usage: python3 test/e2e/strip.py [--out DIR] [--video]
Writes <out>/<transition>-<width>.png (24 frames tiled 6x4 at 1/4 scale, labelled with frame
index and the active segment's p (slug cut to 5 chars)); --video adds home-1280.webm, a steady scroll through the
whole home page. Run it without -I: it imports serve() and DIST from check.py next to it.
Set PW_WS to use a remote Playwright.
"""
import argparse
from io import BytesIO
from pathlib import Path

from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

from check import DIST, SHOTS, connect, expect, serve

FRAMES, COLS = 24, 6
VIEWPORTS = ((1280, 800), (390, 844))

# Page-side helpers: document y of a segment edge, and the scroll-progress of the segment on screen.
JS = '''() => {
  const top = e => { let t = 0; for (; e; e = e.offsetParent) t += e.offsetTop; return t };
  const seg = s => document.getElementById('seg-' + s);
  const span = s => seg(s).offsetHeight - seg(s).querySelector('.stage').offsetHeight;
  window.__strip = {
    at: (s, p) => top(seg(s)) + p * span(s),
    start: s => top(seg(s)),
    end: s => top(seg(s)) + seg(s).offsetHeight,
    p: () => { for (const s of document.querySelectorAll('.seg')) {
      const p = (scrollY - top(s)) / (s.offsetHeight - s.querySelector('.stage').offsetHeight);
      if (p >= 0 && p <= 1) return s.dataset.slug.slice(0, 5) + ' p=' + p.toFixed(2) } return '-' },
  };
}'''

TRANSITIONS = {
    'log-cover-log': lambda s, vh: (s('start', 'agentic-texture-pipeline') - 0.5 * vh,
                                    s('end', 'agentic-texture-pipeline') + 0.5 * vh),
    'cover-cover': lambda s, vh: (s('at', 'ba-art-direction', 0.6), s('at', 'configurator-framework', 0.45)),
    'cover-log': lambda s, vh: (s('at', 'configurator-framework', 0.6),
                                s('end', 'configurator-framework') + 0.8 * vh),
}


def new_page(browser, base, w, h, **ctx):
    context = browser.new_context(viewport={'width': w, 'height': h}, **ctx)
    pg = context.new_page()
    pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    pg.goto(base + '/')
    pg.wait_for_timeout(350)
    pg.evaluate(JS)
    return pg


def edge(pg):
    return lambda kind, slug, p=None: pg.evaluate(
        f'() => __strip.{kind}({", ".join(repr(a) if isinstance(a, str) else str(a) for a in (slug, p) if a is not None)})')


def strip(pg, name, w, h, a, b, out):
    cw, ch = w // 4, h // 4
    sheet = Image.new('RGB', (cw * COLS, ch * (FRAMES // COLS)))
    for i in range(FRAMES):
        pg.evaluate(f'() => scrollTo(0, {a + (b - a) * i / (FRAMES - 1)})')
        pg.wait_for_timeout(250)
        label = f'{i} {pg.evaluate("() => __strip.p()")}'
        tile = Image.open(BytesIO(pg.screenshot())).convert('RGB').resize((cw, ch), Image.LANCZOS)
        d = ImageDraw.Draw(tile)
        tw = d.textlength(label)
        d.rectangle((0, 0, tw + 6, 12), fill=(0, 0, 0))
        d.text((3, 1), label, fill=(255, 255, 0))
        sheet.paste(tile, ((i % COLS) * cw, (i // COLS) * ch))
    path = out / f'{name}-{w}.png'
    sheet.save(path)
    print(path)


def video(browser, base, out):
    pg = new_page(browser, base, 1280, 800, record_video_dir=str(out), record_video_size={'width': 1280, 'height': 800})
    pg.evaluate('''() => new Promise(done => {
      requestAnimationFrame(function tick() {
        if (scrollY >= document.documentElement.scrollHeight - innerHeight - 1) return done();
        scrollBy(0, 6);
        requestAnimationFrame(tick);
      });
    })''')
    pg.wait_for_timeout(500)
    vid = pg.video
    pg.context.close()
    path = out / 'home-1280.webm'
    vid.save_as(str(path))
    print(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(SHOTS / 'strips'))
    ap.add_argument('--video', action='store_true')
    args = ap.parse_args()
    expect(DIST.exists(), 'dist/ missing: run npm run build first')
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    srv, base = serve()
    try:
        with sync_playwright() as p:
            browser = connect(p)
            try:
                for w, h in VIEWPORTS:
                    pg = new_page(browser, base, w, h)
                    s = edge(pg)
                    for name, span in TRANSITIONS.items():
                        a, b = span(s, h)
                        strip(pg, name, w, h, a, b, out)
                    pg.context.close()
                if args.video:
                    video(browser, base, out)
            finally:
                browser.close()
    finally:
        srv.shutdown()


if __name__ == '__main__':
    main()
