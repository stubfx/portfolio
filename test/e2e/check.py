"""End-to-end checks against dist/ in headless Chrome.

Usage: python3 test/e2e/check.py [name ...]   (no names: run all)
Needs: Python Playwright and Chrome at /usr/bin/google-chrome (or $CHROME).
Web fonts are blocked so runs are offline and deterministic.
"""
import functools
import http.server
import os
import signal
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
# Landscape and portrait phones, tablets both ways, a near-square window: every shape a cover takes.
VIEWPORTS = ((1280, 800), (390, 844), (360, 740), (844, 390), (1024, 1366), (1366, 1024), (1000, 900))


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

    def page(self, path='/', w=1280, h=800, reduced=False, init=None, js=True, abort=None, wait=350):
        """A fresh page. init: a script run at the start of every document; abort: a URL glob that fails to load."""
        pg = self.browser.new_page(viewport={'width': w, 'height': h}, java_script_enabled=js,
                                   reduced_motion='reduce' if reduced else 'no-preference')
        pg.errors = []
        pg.on('pageerror', lambda e: pg.errors.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and 'net::' not in m.text and pg.errors.append(m.text))
        pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pg.route('**/fonts.gstatic.com/**', lambda r: r.abort())
        if abort:
            pg.route(abort, lambda r: r.abort())
        if init:
            pg.add_init_script(init)
        pg.goto(self.base + path)
        pg.wait_for_timeout(wait)
        return pg


def expect(cond, msg):
    if not cond:
        raise AssertionError(msg)


def no_errors(pg):
    expect(not pg.errors, f'page errors: {pg.errors}')


if os.environ.get('CHECK_SELFTEST'):
    @check
    def selftest_stall(c):
        """Hangs on purpose (a promise that never settles): proves the watchdog fails a stuck check by name
        and that the next check still runs, on a fresh connection.
        Registered first so the checks after it prove the reconnect."""
        pg = c.page('/')
        pg.evaluate('() => new Promise(() => {})')


# Motion helpers. "Visible" means computed opacity exactly 1 on the element and every ancestor:
# a row mid-fade counts as not visible.
JS_VISIBLE = """el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement)
  if (getComputedStyle(e).opacity !== '1') return false; return true }"""
JS_ROWS_IN_VIEW = """() => [...document.querySelectorAll('.log > .row')].filter(r => {
  const b = r.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight })"""
JS_SWEEP = """async step => { while (scrollY + innerHeight < document.documentElement.scrollHeight - 1) {
  scrollBy(0, step); await new Promise(r => setTimeout(r, 150)) } }"""


def hidden_in_view(pg):
    """Hashes of rows intersecting the viewport that are not fully visible."""
    return pg.evaluate(f"""() => {{ const vis = {JS_VISIBLE};
      return ({JS_ROWS_IN_VIEW})().filter(r => !vis(r)).map(r => r.querySelector('[data-hash]').dataset.hash) }}""")


def row_of(pg, sel):
    return pg.evaluate(f"""() => {{ const r = document.querySelector({sel!r}).closest('.row');
      return {{ cls: r.className, opacity: getComputedStyle(r).opacity, visible: ({JS_VISIBLE})(r) }} }}""")


@check
def hash_lands(c):
    """A hash link lands its entry at the top, hairline and crop mark included, and shows it at once."""
    probe = f"""addEventListener('load', () => setTimeout(() => {{
      window.__hashVisible = ({JS_VISIBLE})(document.getElementById(location.hash.slice(1))) }}, 150))"""
    for w, h in ((1280, 800), (390, 844)):
        pg = c.page('/#configurator-framework', w, h, init=probe, wait=600)
        top = pg.evaluate("() => [document.getElementById('configurator-framework').getBoundingClientRect().top, innerHeight]")
        # The entry's top is its hairline; its crop mark reaches 4px above that. scroll-margin keeps both on screen.
        expect(4 <= top[0] <= 0.5 * top[1], f'{w}: #configurator-framework top at {top[0]} of {top[1]}')
        expect(pg.evaluate('() => window.__hashVisible') is True, f'{w}: hash target not visible 150 ms after load')
        no_errors(pg)
        pg.close()


@check
def fold_never_hidden(c):
    """Nothing in view at startup is ever hidden: rows above the fold are visible on the first frame and never get rv."""
    probe = f"""document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => {{
      const vis = {JS_VISIBLE};
      window.__fold = ({JS_ROWS_IN_VIEW})().map(r => [r.querySelector('[data-hash]').dataset.hash, vis(r)]) }}))"""
    for w, h in ((1280, 800), (390, 844)):
        pg = c.page('/', w, h, init=probe, wait=1000)
        fold = pg.evaluate('() => window.__fold')
        expect(fold, f'{w}: no rows in view at startup')
        expect(all(v for _, v in fold), f'{w}: hidden on the first frame: {[k for k, v in fold if not v]}')
        later = pg.evaluate("hs => hs.filter(h => document.querySelector(`[data-hash='${h}']`).closest('.row').classList.contains('rv'))",
                            [k for k, _ in fold])
        expect(not later, f'{w}: fold rows got rv: {later}')
        no_errors(pg)
        pg.close()


@check
def reveal_on_scroll(c):
    pg = c.page('/')
    r = row_of(pg, '#c-1a7c3e9')
    expect('rv' in r['cls'].split() and r['opacity'] == '0', f'below the fold at load: {r}')
    pg.evaluate("() => document.getElementById('c-1a7c3e9').scrollIntoView({ block: 'center' })")
    pg.wait_for_timeout(1200)
    r = row_of(pg, '#c-1a7c3e9')
    expect('in' in r['cls'].split() and r['opacity'] == '1', f'after scrolling to it: {r}')
    no_errors(pg)
    pg.close()


@check
def no_hidden_after_sweep(c):
    pg = c.page('/')
    pg.evaluate(JS_SWEEP, 300)
    pg.wait_for_timeout(1200)
    left = pg.evaluate("() => document.querySelectorAll('.log > .row.rv:not(.in)').length")
    expect(left == 0, f'{left} rows still hidden after a full sweep')
    no_errors(pg)
    pg.close()


@check
def jump_clean(c):
    pg = c.page('/')
    for key in ('End', 'Home'):
        pg.keyboard.press(key)
        pg.wait_for_timeout(1200)
        bad = hidden_in_view(pg)
        expect(not bad, f'after {key}: not visible in view: {bad}')
    no_errors(pg)
    pg.close()


@check
def focus_reveals(c):
    pg = c.page('/')
    pending = set(pg.evaluate("""() => [...document.querySelectorAll('.log > .row')]
      .map((r, i) => r.classList.contains('rv') && !r.classList.contains('in') ? i : -1).filter(i => i >= 0)"""))
    expect(pending, 'no hidden rows to tab into')
    for _ in range(80):
        pg.keyboard.press('Tab')
        i = pg.evaluate("() => { const r = document.activeElement.closest('.log > .row'); return r ? [...document.querySelectorAll('.log > .row')].indexOf(r) : -1 }")
        if i in pending:
            pg.wait_for_timeout(100)
            ok = pg.evaluate(f"() => ({JS_VISIBLE})(document.querySelectorAll('.log > .row')[{i}])")
            expect(ok, f'row {i} not visible 100 ms after Tab focused it')
            break
    else:
        raise AssertionError('Tab never reached a hidden row')
    no_errors(pg)
    pg.close()


@check
def vim_jump_reveals(c):
    pg = c.page('/')
    pg.keyboard.press('Escape')
    pg.keyboard.press('G')
    pg.wait_for_timeout(150)
    cls = pg.evaluate("() => { const g = __site.graph; return g.rows[g.index].el.closest('.row').className }")
    expect('in' in cls.split(), f'G target row is {cls!r} 150 ms later')
    no_errors(pg)
    pg.close()


@check
def reload_restores(c):
    pg = c.page('/')
    pg.evaluate('() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.6)')
    pg.wait_for_timeout(1200)
    pg.reload()
    pg.wait_for_timeout(200)
    expect(pg.evaluate('() => scrollY') > 0, 'reload did not restore the scroll position')
    bad = hidden_in_view(pg)
    expect(not bad, f'200 ms after reload, not visible in view: {bad}')
    no_errors(pg)
    pg.close()


@check
def back_restores(c):
    pg = c.page('/')
    pg.evaluate("() => document.querySelector('#ba-art-direction .pc-att').scrollIntoView({ block: 'center' })")
    pg.wait_for_timeout(1200)
    pg.click('#ba-art-direction .pc-att')
    pg.wait_for_url('**/projects/ba-art-direction/')
    pg.go_back()
    pg.wait_for_timeout(200)
    bad = hidden_in_view(pg)
    expect(not bad, f'200 ms after Back, not visible in view: {bad}')
    no_errors(pg)
    pg.close()


@check
def tall_row_reveals(c):
    pg = c.page('/', 360, 740)
    pg.evaluate("() => { const r = document.getElementById('configurator-framework').closest('.row');"
                " scrollBy(0, r.getBoundingClientRect().top - innerHeight * 0.8) }")
    pg.wait_for_timeout(1200)
    r = row_of(pg, '#configurator-framework')
    expect('in' in r['cls'].split(), f'tall row with its top at 80% not revealed: {r}')
    no_errors(pg)
    pg.close()


@check
def print_shows_all(c):
    pg = c.page('/')
    pg.emulate_media(media='print')
    pg.wait_for_timeout(100)
    bad = pg.evaluate(f"() => [...document.querySelectorAll('.log > .row')].filter(r => !({JS_VISIBLE})(r)).length")
    expect(bad == 0, f'{bad} rows not visible in print')
    pg.close()


@check
def reduced(c):
    pg = c.page('/', reduced=True)
    rv = lambda: pg.evaluate("() => document.querySelectorAll('.log > .row.rv').length")  # noqa: E731
    expect(rv() == 0, 'reduced motion: rows got rv at load')
    pg.evaluate(JS_SWEEP, 400)
    pg.wait_for_timeout(300)
    expect(rv() == 0, 'reduced motion: rows got rv after a sweep')
    anim = pg.eval_on_selector('.pc-att .l-back', 'e => getComputedStyle(e).animationName')
    expect(anim == 'none', f'reduced motion: attachment drift runs ({anim})')
    moved = pg.evaluate("() => [...document.querySelectorAll('.log > .row')].filter(r => r.style.transform || getComputedStyle(r).transform !== 'none').length")
    expect(moved == 0, f'reduced motion: {moved} rows carry a transform')
    no_errors(pg)
    pg.close()


@check
def nojs(c):
    pg = c.page('/', js=False)
    ops = pg.evaluate("() => [...document.querySelectorAll('.log > .row')].map(r => getComputedStyle(r).opacity)")
    expect(ops and all(o == '1' for o in ops), f'without JS, row opacities: {ops}')
    pg.close()


@check
def script_fails(c):
    pg = c.page('/', abort='**/assets/main.js', wait=100)
    bad = hidden_in_view(pg)
    expect(not bad, f'main.js failed: not visible in view: {bad}')
    expect(pg.evaluate("() => document.querySelectorAll('.log > .row.rv').length") == 0, 'main.js failed: rows got rv')
    pg.wait_for_timeout(4500)
    expect(pg.evaluate("() => document.documentElement.classList.contains('js')") is False, 'js class kept after main.js failed')
    pg.close()


@check
def attachment_effects(c):
    pg = c.page('/')
    sel = '#servers-and-mods .pc-att'
    before = pg.eval_on_selector(f'{sel} .sphere', 'e => getComputedStyle(e).opacity')
    expect(before == '0', f'sphere before reveal: opacity {before}')
    pg.evaluate(f"() => document.querySelector({sel!r}).scrollIntoView({{ block: 'center' }})")
    # The orbit draws in over 2.6 s after a .35 s delay: 3.4 s leaves room for the observer to fire.
    pg.wait_for_timeout(3400)
    after = pg.eval_on_selector(f'{sel} .sphere', 'e => getComputedStyle(e).opacity')
    dash = pg.eval_on_selector(f'{sel} .orbit', 'e => getComputedStyle(e).strokeDashoffset')
    expect(after == '1', f'sphere after reveal: opacity {after}')
    expect(dash in ('0', '0px'), f'orbit after reveal: stroke-dashoffset {dash}')
    no_errors(pg)
    pg.close()


@check
def drift_runs(c):
    pg = c.page('/')
    sel = '#configurator-framework .pc-att'
    pg.evaluate(f"() => document.querySelector({sel!r}).scrollIntoView({{ block: 'center' }})")
    pg.wait_for_timeout(300)
    name = pg.eval_on_selector(f'{sel} .l-back', 'e => getComputedStyle(e).animationName')
    expect(name != 'none', 'attachment art has no drift animation')
    t1 = pg.eval_on_selector(f'{sel} .l-back', 'e => getComputedStyle(e).transform')
    pg.evaluate('() => scrollBy(0, 200)')
    pg.wait_for_timeout(300)
    t2 = pg.eval_on_selector(f'{sel} .l-back', 'e => getComputedStyle(e).transform')
    expect(t1 != t2, f'drift did not move with scroll: {t1}')
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
    no_errors(pg)
    pg.close()


# Records, on the next document, whether it was revealed inside a cross-document view transition.
VT_PROBE = """addEventListener('pagereveal', e => {
  window.__vt = e.viewTransition ? 'started' : 'none';
  if (e.viewTransition) e.viewTransition.finished.then(() => { window.__vt = 'finished' });
})"""


@check
def view_transition_runs(c):
    """Page changes run a cross-document view transition (the attachment's cover morphs into the hero):
    the new page is revealed inside a transition that finishes, with and without reduced motion
    (where it is an instant fade). The opt-in used to live only in site.css and lost a race with
    the module graph, so the new page revealed without it."""
    navs = (('/', '#configurator-framework .pc-att', '/projects/configurator-framework/'),
            ('/about/', '#bar a[href="/work/"]', '/work/'))
    for reduced in (False, True):
        for start, link, dest in navs:
            pg = c.page(start, reduced=reduced)
            pg.add_init_script(VT_PROBE)
            pg.click(link)
            pg.wait_for_url(f'**{dest}')
            pg.wait_for_timeout(1500)
            vt = pg.evaluate('() => window.__vt')
            expect(vt == 'finished', f"reduced={reduced} {start} -> {dest}: revealed with view transition {vt!r}, want 'finished'")
            no_errors(pg)
            pg.close()


@check
def enter_opens_project(c):
    pg = c.page('/')
    pg.keyboard.press('Escape')
    pg.keyboard.press('Shift+J')
    pg.wait_for_timeout(2500)
    slug = pg.evaluate("() => { const g = __site.graph; return g.rows[g.index].el.closest('.entry').id }")
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(600)
    expect(pg.url.endswith(f'/projects/{slug}/'), f'Enter on {slug} ended on {pg.url}')
    no_errors(pg)
    pg.close()


@check
def enter_on_link(c):
    pg = c.page('/about/')
    pg.focus('#bar a[href="/work/"]')
    pg.keyboard.press('Escape')
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(600)
    expect(pg.url.endswith('/work/'), f'Enter in normal mode on a link stayed on {pg.url}')
    no_errors(pg)
    pg.close()


def contrast(a, b):
    def lum(c):
        ch = [v / 255 for v in c[:3]]
        ch = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in ch]
        return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def project_slugs():
    slugs = sorted(d.name for d in (DIST / 'projects').iterdir() if d.is_dir())
    expect(slugs, 'no project pages in dist/')
    return slugs


@check
def cover_contrast(c):
    from io import BytesIO
    from PIL import Image
    slugs = project_slugs()
    for w, h in VIEWPORTS:
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
            names = [box[0] for box in boxes]
            expect('cv-title' in names and 'cv-lede' in names, f'{w}x{h} {slug}: hero has no title or lede to measure ({names})')
            for name, l, t, r, b, color, size in boxes:
                rgb = [int(v) for v in color[color.index('(') + 1:color.index(')')].split(',')[:3]]
                vals = sorted(contrast(rgb, img.getpixel((x, y)))
                              for x in range(max(0, int(l)), min(w, int(r)), 3)
                              for y in range(max(0, int(t)), min(h, int(b)), 3))
                # No samples means the text is off screen: that would pass without measuring anything.
                expect(vals, f'{w}x{h} {slug} {name}: no on-screen pixels to sample')
                p1 = vals[len(vals) // 100]
                need = 3 if size >= 24 else 4.5
                expect(p1 >= need, f'{w}x{h} {slug} {name}: 1st percentile contrast {p1:.2f} < {need}')
            pg.close()


# How much of the planet's sphere lies on its own cover, and whether it has the size cover.css gives it:
# in portrait a radius of 26-38% of the width, in landscape the radius the 160x90 plate slice gave it.
# Measured at rest: the sphere's own animations (its reveal) finish first, for at most 2 s.
# Null for covers without a generative plate.
PLANET_ON_COVER = '''async cover => {
  const s = cover.querySelector('.l-planet .sphere');
  if (!s) return cover.querySelector('.plate') ? 'no sphere' : null;
  await Promise.race([Promise.all(s.getAnimations().map(a => a.finished)), new Promise(r => setTimeout(r, 2000))]);
  const a = s.getBoundingClientRect(), b = cover.getBoundingClientRect();
  if (!(a.width * a.height)) return 'empty sphere';
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  // The plate at rest: its layer's layout size, which ignores the drift's transform (it scales the art).
  const plate = cover.querySelector('.plate').parentElement;
  const rad = parseFloat(getComputedStyle(s).getPropertyValue('--rad')) * Math.max(plate.offsetWidth / 160, plate.offsetHeight / 90);
  const [lo, hi] = b.width < b.height ? [0.26 * b.width, 0.38 * b.width] : [rad - 1, rad + 1];
  return { share: w * h / (a.width * a.height), r: a.width / 2, lo, hi };
}'''


@check
def planet_on_screen(c):
    slugs = project_slugs()
    bad = []
    for w, h in VIEWPORTS:
        # Every cover counts as seen; only generative ones have a planet to measure (real art has none).
        seen = {'hero': 0, 'card': 0, 'attachment': 0}

        def measure(pg, kind, cover, label, scroll=False):
            if scroll:
                cover.scroll_into_view_if_needed()
                pg.wait_for_timeout(150)
            m = cover.evaluate(PLANET_ON_COVER)
            seen[kind] += 1
            if m is None:
                return
            if isinstance(m, str):
                bad.append(f'{w}x{h} {kind} {label}: {m}')
            elif m['share'] < 0.6:
                bad.append(f'{w}x{h} {kind} {label}: {m["share"]:.0%} of the sphere on its cover')
            elif not m['lo'] <= m['r'] <= m['hi']:
                bad.append(f'{w}x{h} {kind} {label}: sphere radius {m["r"]:.1f}px, want {m["lo"]:.1f} to {m["hi"]:.1f}')

        for slug in slugs:
            pg = c.page(f'/projects/{slug}/', w, h)
            measure(pg, 'hero', pg.query_selector('.hero .cover'), slug)
            no_errors(pg)
            pg.close()
        pg = c.page('/work/', w, h)
        for card in pg.query_selector_all('a.card'):
            measure(pg, 'card', card.query_selector('.cover'), card.get_attribute('href'))
        no_errors(pg)
        pg.close()
        pg = c.page('/', w, h)
        for att in pg.query_selector_all('a.pc-att'):
            measure(pg, 'attachment', att.query_selector('.cover'), att.get_attribute('href'), scroll=True)
        no_errors(pg)
        pg.close()
        expect(all(n == len(slugs) for n in seen.values()), f'{w}x{h}: saw {seen} covers, want {len(slugs)} of each')
    expect(not bad, '; '.join(bad))


@check
def attachment_corners(c):
    """The git show chip owns the attachment's bottom-left corner: no crop mark is drawn there or under it."""
    for w, h in ((1280, 800), (390, 844)):
        pg = c.page('/', w, h)
        found = pg.evaluate('''() => [...document.querySelectorAll('a.pc-att')].map(a => {
          const chip = a.querySelector('.pc-chip').getBoundingClientRect();
          const shown = [...a.querySelectorAll('.k')].filter(k => { const r = k.getBoundingClientRect(); return r.width > 0 && r.height > 0 });
          const under = shown.filter(k => { const r = k.getBoundingClientRect();
            return r.left < chip.right && r.right > chip.left && r.top < chip.bottom && r.bottom > chip.top });
          return [a.getAttribute('href'), shown.map(k => k.className), under.map(k => k.className)] })''')
        expect(found, f'{w}: no attachments on /')
        for href, shown, under in found:
            expect('k k3' not in shown, f'{w} {href}: bottom-left crop mark .k3 is drawn')
            expect(not under, f'{w} {href}: crop marks under the chip: {under}')
            expect(len(shown) == 3, f'{w} {href}: want 3 crop marks, got {shown}')
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


# The remote browser occasionally stops answering mid-check. Rather than hang the whole run,
# a check that takes longer than this fails by name and the next one gets a fresh connection.
CHECK_TIMEOUT = int(os.environ.get('CHECK_TIMEOUT', '240'))


class Stalled(Exception):
    pass


def _stalled(signum, frame):
    raise Stalled(f'stalled: no result within {CHECK_TIMEOUT} s')


def main(names):
    expect(DIST.exists(), 'dist/ missing: run npm run build first')
    unknown = [n for n in names if n not in CHECKS]
    expect(not unknown, f'unknown checks: {unknown}')
    srv, base = serve()
    failed = 0
    signal.signal(signal.SIGALRM, _stalled)
    with sync_playwright() as p:
        browser = connect(p)
        c = Ctx(browser, base)
        for name, fn in CHECKS.items():
            if names and name not in names:
                continue
            signal.alarm(CHECK_TIMEOUT)
            try:
                fn(c)
                print(f'ok   {name}', flush=True)
            except Exception as e:  # noqa: BLE001
                failed += 1
                print(f'FAIL {name}: {e}', flush=True)
                if isinstance(e, Stalled):
                    signal.alarm(20)  # closing a stuck connection can hang too
                    try:
                        browser.close()
                    except Exception:  # noqa: BLE001
                        pass
                    signal.alarm(0)
                    browser = c.browser = connect(p)
            finally:
                signal.alarm(0)
        browser.close()
    srv.shutdown()
    print(f'{len(CHECKS) if not names else len(names)} checks, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
