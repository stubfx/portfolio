"""End-to-end checks against dist/ in headless Chrome.

Usage: python3 test/e2e/check.py [name ...]   (no names: run all)
Needs: Python Playwright and Chrome at /usr/bin/google-chrome (or $CHROME).
Web fonts are blocked so runs are offline and deterministic.
"""
import functools
import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'
SHOTS = Path(__file__).resolve().parent / 'shots'
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
CHECKS = {}


def check(fn):
    CHECKS[fn.__name__.replace('_', '-')] = fn
    return fn


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=str(DIST))
    srv = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}'


class Ctx:
    def __init__(self, browser, base):
        self.browser, self.base = browser, base

    def page(self, path='/', w=1280, h=800, reduced=False):
        pg = self.browser.new_page(viewport={'width': w, 'height': h},
                                   reduced_motion='reduce' if reduced else 'no-preference')
        pg.errors = []
        pg.on('pageerror', lambda e: pg.errors.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and 'net::' not in m.text and pg.errors.append(m.text))
        pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pg.route('**/fonts.gstatic.com/**', lambda r: r.abort())
        pg.goto(self.base + path)
        pg.wait_for_timeout(350)
        return pg


def expect(cond, msg):
    if not cond:
        raise AssertionError(msg)


def no_errors(pg):
    expect(not pg.errors, f'page errors: {pg.errors}')


@check
def hash_lands(c):
    for w, h in ((1280, 800), (390, 844)):
        pg = c.page('/#configurator-framework', w, h)
        top = pg.evaluate("() => [document.getElementById('configurator-framework').getBoundingClientRect().top, innerHeight]")
        # -1, not 0: the browser snaps the scroll to whole pixels, so the top can land a fraction above.
        expect(-1 < top[0] <= 0.5 * top[1], f'{w}: #configurator-framework top at {top[0]} of {top[1]}')
        no_errors(pg)
        pg.close()


def cursor_vs_node(pg):
    return pg.evaluate("""() => {
      const r = document.querySelector('#graph > rect').getBoundingClientRect();
      const d = document.querySelector('#graph > circle').getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2, d.left + d.width / 2, d.top + d.height / 2, r.height];
    }""")


@check
def graph_cursor(c):
    pg = c.page('/')
    pg.wait_for_timeout(600)
    v = cursor_vs_node(pg)
    expect(abs(v[0] - v[2]) <= 1 and abs(v[1] - v[3]) <= 1, f'cursor not on node at load: {v}')
    paths = pg.eval_on_selector_all('#graph > g:first-child > g', "gs => gs.filter(g => +g.getAttribute('opacity') > 0.01).length")
    expect(paths <= 2, f'{paths} branches visible, max is 2')
    no_errors(pg)
    pg.close()


@check
def go_stays(c):
    for w, h in ((1280, 800), (390, 844)):
        pg = c.page('/', w, h)
        want = pg.evaluate('() => { const g = __site.graph; const i = g.rows.findIndex(r => r.hash === "2e6a8d1"); g.go(i); return i }')
        pg.wait_for_timeout(2500)
        got = pg.evaluate('() => __site.graph.index')
        expect(got == want, f'{w}: go({want}) ended on row {got}')
        v = cursor_vs_node(pg)
        expect(abs(v[0] - v[2]) <= 1 and abs(v[1] - v[3]) <= 1 and 0 < v[3] < h, f'{w}: cursor not settled on a visible node {v}')
        pg.mouse.wheel(0, 400)
        pg.wait_for_timeout(500)
        moved = pg.evaluate('() => __site.graph.index')
        expect(moved != want, f'{w}: wheel did not release the pinned row')
        no_errors(pg)
        pg.close()


@check
def resize(c):
    pg = c.page('/')
    pg.evaluate("() => scrollTo(0, document.querySelector('[data-hash=\\'1a7c3e9\\']').getBoundingClientRect().top + scrollY - innerHeight * 0.3)")
    pg.wait_for_timeout(900)
    a = cursor_vs_node(pg)
    expect(abs(a[0] - a[2]) <= 1 and abs(a[1] - a[3]) <= 1, f'1280: cursor off node {a}')
    pg.set_viewport_size({'width': 390, 'height': 844})
    pg.wait_for_timeout(1200)
    b = cursor_vs_node(pg)
    expect(abs(b[0] - b[2]) <= 1 and abs(b[1] - b[3]) <= 1, f'390: cursor off node {b}')
    on = pg.evaluate("() => document.querySelector('#graph > circle').getBoundingClientRect().top")
    expect(-50 < on < 900, f'node off screen after resize: {on}')
    no_errors(pg)
    pg.close()


@check
def texture(c):
    pg = c.page('/')
    bg = pg.eval_on_selector('#grain', 'e => getComputedStyle(e).backgroundImage')
    expect(bg.startswith('url("data:image/png'), f'grain has no tile: {bg[:40]}')
    t1 = pg.eval_on_selector('#grain', 'e => e.style.transform')
    pg.wait_for_timeout(400)
    t2 = pg.eval_on_selector('#grain', 'e => e.style.transform')
    expect(t1 != t2, 'grain is not moving')
    lit = pg.evaluate("""() => { const c = document.getElementById('stars'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n }""")
    expect(lit > 100, f'starfield is empty ({lit} lit pixels)')
    no_errors(pg)
    pg.close()
    pg = c.page('/', reduced=True)
    t1 = pg.eval_on_selector('#grain', 'e => e.style.transform')
    pg.wait_for_timeout(400)
    expect(t1 == pg.eval_on_selector('#grain', 'e => e.style.transform') == '', 'grain moves under reduced motion')
    pg.close()


@check
def vim_keys(c):
    pg = c.page('/')
    y0 = pg.evaluate('() => scrollY')
    pg.keyboard.press('j')
    pg.wait_for_timeout(300)
    expect(pg.evaluate('() => scrollY') == y0, 'j moved the page outside normal mode')
    pg.keyboard.press('Escape')
    expect(pg.text_content('#mode') == '-- NORMAL --', f"mode shows {pg.text_content('#mode')!r}")
    pg.keyboard.press('Shift+J')
    pg.wait_for_timeout(2500)
    row = pg.evaluate('() => { const g = __site.graph; return g.rows[g.index].kind }')
    expect(row == 'project', f'J landed on a {row} row')
    expect(pg.inner_text('#pos').startswith('HEAD~'), f"pos shows {pg.inner_text('#pos')!r}")
    pg.keyboard.press(':')
    expect(pg.is_visible('#cmdi'), 'command line did not open')
    pg.keyboard.type('q')
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(100)
    expect("can't quit" in pg.inner_text('#msg'), f"msg shows {pg.inner_text('#msg')!r}")
    pg.keyboard.press('i')
    expect(pg.text_content('#mode') != '-- NORMAL --', 'i did not leave normal mode')
    clk = pg.inner_text('#clk')
    expect(clk != '--:--' and ':' in clk, f'clock shows {clk!r}')
    no_errors(pg)
    pg.close()
    pg = c.page('/about/')
    pg.keyboard.press('Escape')
    pg.keyboard.press(':')
    pg.keyboard.type('help')
    pg.keyboard.press('Enter')
    pg.wait_for_url('**/help/')
    pg.close()


@check
def attachments_reachable(c):
    pg = c.page('/')
    reached = set()
    for _ in range(60):
        pg.keyboard.press('Tab')
        href = pg.evaluate("() => document.activeElement.matches('a.pc-att') ? document.activeElement.getAttribute('href') : null")
        if href:
            reached.add(href)
    total = pg.eval_on_selector_all('a.pc-att', 'els => els.length')
    expect(total > 0 and len(reached) == total, f'Tab reached {len(reached)} of {total} attachments')
    snap = pg.locator('main').aria_snapshot()
    for title in pg.eval_on_selector_all('.pc .ttl', 'els => els.map(e => e.textContent)'):
        word = title.split()[0]
        expect(word in snap, f'project "{title}" missing from the accessibility tree')
    expect(pg.evaluate("() => window.find('Servers for real')"), 'find-in-page cannot see the project rows')
    no_errors(pg)
    pg.close()


@check
def attachment_click(c):
    pg = c.page('/')
    pg.click('#configurator-framework .pc-att')
    pg.wait_for_timeout(600)
    expect(pg.url.endswith('/projects/configurator-framework/'), f'click stayed on {pg.url}')
    pg.close()


@check
def enter_opens_project(c):
    pg = c.page('/')
    pg.keyboard.press('Escape')
    pg.keyboard.press('Shift+J')
    pg.wait_for_timeout(2500)
    slug = pg.evaluate("() => { const g = __site.graph; return g.rows[g.index].el.closest('.entry').id }")
    # Before the navigation: headless Chromium logs an aborted cross-document view transition on any page change.
    no_errors(pg)
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(600)
    expect(pg.url.endswith(f'/projects/{slug}/'), f'Enter on {slug} ended on {pg.url}')
    pg.close()


@check
def enter_on_link(c):
    pg = c.page('/about/')
    pg.focus('#bar a[href="/work/"]')
    pg.keyboard.press('Escape')
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(600)
    expect(pg.url.endswith('/work/'), f'Enter in normal mode on a link stayed on {pg.url}')
    pg.close()


def contrast(a, b):
    def lum(c):
        ch = [v / 255 for v in c[:3]]
        ch = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in ch]
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


@check
def cover_contrast(c):
    from io import BytesIO
    from PIL import Image
    slugs = sorted(d.name for d in (DIST / 'projects').iterdir() if d.is_dir())
    expect(slugs, 'no project pages in dist/')
    for w, h in ((844, 390), (1280, 800), (390, 844)):
        for slug in slugs:
            pg = c.page(f'/projects/{slug}/', w, h)
            pg.evaluate("() => document.querySelector('.hero .cv-copy').scrollIntoView({ block: 'center', behavior: 'instant' })")
            pg.wait_for_timeout(100)
            boxes = pg.evaluate('''() => [...document.querySelectorAll('.hero .cv-title, .hero .cv-title em, .hero .cv-lede')].map(e => {
              const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
              return [e.className || e.tagName, r.left, r.top, r.right, r.bottom, s.color, parseFloat(s.fontSize)] })''')
            pg.add_style_tag(content='#grain{display:none} .cv-copy, .cv-copy *{color:transparent!important;border-color:transparent!important}')
            pg.wait_for_timeout(100)
            img = Image.open(BytesIO(pg.screenshot())).convert('RGB')
            for name, l, t, r, b, color, size in boxes:
                rgb = [int(v) for v in color[color.index('(') + 1:color.index(')')].split(',')[:3]]
                vals = sorted(contrast(rgb, img.getpixel((x, y)))
                              for x in range(max(0, int(l)), min(w, int(r)), 3)
                              for y in range(max(0, int(t)), min(h, int(b)), 3))
                if not vals:
                    continue
                p1 = vals[len(vals) // 100]
                need = 3 if size >= 24 else 4.5
                expect(p1 >= need, f'{w}x{h} {slug} {name}: 1st percentile contrast {p1:.2f} < {need}')
            pg.close()


@check
def contact_everywhere(c):
    for path in ('/projects/configurator-framework/', '/work/', '/about/', '/help/', '/'):
        pg = c.page(path, 390, 844)
        mail = pg.eval_on_selector_all('a[href^="mailto:"]', 'els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" }).length')
        expect(mail > 0, f'{path}: no visible mail link at 390px')
        small = pg.eval_on_selector_all('#bar a', 'els => els.map(e => e.getBoundingClientRect().height).filter(h => h > 0 && h < 44)')
        expect(not small, f'{path}: status bar targets under 44px: {small}')
        pg.close()


@check
def base_path(c):
    import subprocess, tempfile
    root = tempfile.mkdtemp()
    subprocess.run(['node', '-e', f"import('./scripts/build.mjs').then(m => m.build({{ outDir: '{root}/portfolio', base: '/portfolio' }}))"],
                   cwd=ROOT, check=True)

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{srv.server_address[1]}'
    try:
        pg = c.browser.new_page(viewport={'width': 1280, 'height': 800})
        missing = []
        pg.on('response', lambda r: r.status >= 400 and 'fonts.g' not in r.url and missing.append(r.url))
        pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pg.goto(base + '/portfolio/')
        pg.wait_for_timeout(600)
        expect(not missing, f'404s under /portfolio/: {missing}')
        expect(pg.evaluate('() => !!window.__site && !!window.__site.graph'), 'main.js did not run under /portfolio/')
        pg.keyboard.press('Escape')
        pg.keyboard.press(':')
        pg.keyboard.type('help')
        pg.keyboard.press('Enter')
        pg.wait_for_url('**/portfolio/help/')
        pg.goto(base + '/portfolio/projects/configurator-framework/')
        pg.wait_for_timeout(300)
        expect(not missing, f'404s on a project page: {missing}')
        pg.close()
    finally:
        srv.shutdown()


@check
def screenshots(c):
    SHOTS.mkdir(exist_ok=True)
    for w, h in ((1280, 800), (390, 844)):
        for reduced_motion in (False, True):
            tag = f"{w}{'-reduced' if reduced_motion else ''}"
            pg = c.page('/', w, h, reduced_motion)
            pg.screenshot(path=str(SHOTS / f'home-top-{tag}.png'))
            pg.goto(c.base + '/#configurator-framework'); pg.wait_for_timeout(350)
            pg.screenshot(path=str(SHOTS / f'home-dwell-{tag}.png'))
            pg.goto(c.base + '/projects/ba-art-direction/'); pg.wait_for_timeout(350)
            pg.screenshot(path=str(SHOTS / f'project-{tag}.png'))
            no_errors(pg)
            pg.close()


def connect(p):
    """Remote Playwright server when $PW_WS is set (it reaches our servers via <loopback>), else local Chrome."""
    if os.environ.get('PW_WS'):
        return p.chromium.connect(os.environ['PW_WS'], expose_network='<loopback>')
    return p.chromium.launch(executable_path=CHROME, args=['--disable-gpu'])


def main(names):
    expect(DIST.exists(), 'dist/ missing: run npm run build first')
    srv, base = serve()
    failed = 0
    with sync_playwright() as p:
        browser = connect(p)
        c = Ctx(browser, base)
        for name, fn in CHECKS.items():
            if names and name not in names:
                continue
            try:
                fn(c)
                print(f'ok   {name}', flush=True)
            except Exception as e:  # noqa: BLE001
                failed += 1
                print(f'FAIL {name}: {e}', flush=True)
        browser.close()
    srv.shutdown()
    print(f'{len(CHECKS) if not names else len(names)} checks, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
