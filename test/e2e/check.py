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
