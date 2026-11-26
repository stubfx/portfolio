"""Frame strips of the home page, for looking at them.

Usage: python3 test/e2e/strip.py [--out DIR] [--video]
Writes <out>/<transition>-<width>.png (24 frames tiled 6x4 at 1/4 scale, labelled with frame
index and scrollY); --video adds home-1280.webm, a steady scroll through the whole home page.
Run it without -I: it imports serve() and DIST from check.py next to it.
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

# Page-side helpers: document y of an element's top and bottom edge, by id (layout boxes, transforms ignored).
JS = '''() => {
  const top = id => { let t = 0; for (let e = document.getElementById(id); e; e = e.offsetParent) t += e.offsetTop; return t };
  window.__strip = { top, bottom: id => top(id) + document.getElementById(id).offsetHeight };
}'''

TRANSITIONS = {
    'load': lambda s, vh: (0, 1.5 * vh),
    'attachment': lambda s, vh: (s('top', 'configurator-framework') - vh, s('bottom', 'configurator-framework') + 0.2 * vh),
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
    return lambda kind, el_id: pg.evaluate(f'() => __strip.{kind}({el_id!r})')


def strip(pg, name, w, h, a, b, out):
    cw, ch = w // 4, h // 4
    sheet = Image.new('RGB', (cw * COLS, ch * (FRAMES // COLS)))
    for i in range(FRAMES):
        pg.evaluate(f'() => scrollTo(0, {a + (b - a) * i / (FRAMES - 1)})')
        pg.wait_for_timeout(250)
        label = f'{i} y={pg.evaluate("() => Math.round(scrollY)")}'
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
