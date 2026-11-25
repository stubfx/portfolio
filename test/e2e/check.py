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
def mid_dwell_load(c):
    for w, h in ((1280, 800), (390, 844)):
        pg = c.page('/#configurator-framework', w, h)
        r = pg.eval_on_selector('#seg-configurator-framework .cover', 'e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom, getComputedStyle(e).opacity] }')
        expect(abs(r[0]) <= 2 and abs(r[1]) <= 2 and abs(r[2] - w) <= 2 and abs(r[3] - h) <= 2, f'{w}: cover rect {r[:4]}')
        expect(float(r[4]) == 1, f'{w}: cover opacity {r[4]}')
        no_errors(pg)
        pg.close()


@check
def focus_reveals(c):
    pg = c.page('/#configurator-framework')
    first = pg.evaluate("() => getComputedStyle(document.querySelector('.logseg')).opacity")
    expect(float(first) < 1, f'precondition: first log should be faded mid-dwell, is {first}')
    found = None
    for _ in range(25):
        pg.keyboard.press('Tab')
        found = pg.evaluate("() => { const a = document.activeElement; return a && a.closest('.logseg') ? true : null }")
        if found:
            break
    expect(found, 'never focused a link inside the log')
    pg.wait_for_timeout(300)
    op = pg.evaluate("() => getComputedStyle(document.activeElement.closest('.logseg')).opacity")
    expect(float(op) == 1, f'focused log is at opacity {op}')
    box = pg.evaluate("() => { const b = document.activeElement.getBoundingClientRect(); return [b.top, b.bottom, innerHeight] }")
    expect(box[0] >= 0 and box[1] <= box[2], f'focused element off screen {box}')
    no_errors(pg)
    pg.close()


@check
def reduced(c):
    pg = c.page('/#configurator-framework', reduced=True)
    op = pg.eval_on_selector('#seg-configurator-framework .cover', 'e => getComputedStyle(e).opacity')
    expect(float(op) == 1, f'reduced motion still crossfades the cover in; opacity {op}')
    tf = pg.eval_on_selector_all('.seg .cover', "els => els.map(e => e.style.transform)")
    expect(all('scale(' not in t or 'scale(1)' in t for t in tf), f'transforms under reduced motion: {tf}')
    logs = pg.eval_on_selector_all('.logseg', "els => els.map(e => e.style.transform)")
    expect(all(t == '' for t in logs), f'log transforms under reduced motion: {logs}')
    no_errors(pg)
    pg.close()


@check
def approach_darkens(c):
    pg = c.page('/')
    top = pg.evaluate("() => { const s = document.querySelector('.seg'); return s.getBoundingClientRect().top + scrollY }")
    pg.evaluate(f'() => scrollTo(0, {top} + 0.1 * (document.querySelector(".seg").offsetHeight - innerHeight))')
    pg.wait_for_timeout(200)
    st = pg.evaluate("() => [getComputedStyle(document.body).getPropertyValue('--ground'), getComputedStyle(document.querySelector('.seg .cover')).opacity, getComputedStyle(document.querySelector('.logseg')).opacity]")
    expect(0 < float(st[0]) < 1, f'ground mid-approach {st[0]}')
    expect(0 < float(st[1]) < 1, f'cover mid-approach {st[1]}')
    expect(0 < float(st[2]) < 1, f'log mid-approach {st[2]}')
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


def main(names):
    expect(DIST.exists(), 'dist/ missing: run npm run build first')
    srv, base = serve()
    failed = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--disable-gpu'])
        c = Ctx(browser, base)
        for name, fn in CHECKS.items():
            if names and name not in names:
                continue
            try:
                fn(c)
                print(f'ok   {name}')
            except Exception as e:  # noqa: BLE001
                failed += 1
                print(f'FAIL {name}: {e}')
        browser.close()
    srv.shutdown()
    print(f'{len(CHECKS) if not names else len(names)} checks, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
