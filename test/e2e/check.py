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
DIST = Path(os.environ.get('SITE_DIST') or ROOT / 'dist')  # SITE_DIST: check another build (e.g. one with real art)
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
def malformed_hash(c):
    """A broken fragment (/#%, /#%E0%A4%A) is just an unknown target: the site still starts and nothing stays hidden."""
    for frag in ('%', '%E0%A4%A', 'no-such-entry'):
        pg = c.page(f'/#{frag}', wait=600)
        expect(pg.evaluate('() => !!(window.__site && window.__site.graph)'), f'#{frag}: the site script did not start')
        bad = hidden_in_view(pg)
        expect(not bad, f'#{frag}: not visible in view: {bad}')
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
        later = pg.evaluate("hs => hs.filter(h => document.querySelector(`.log [data-hash='${h}']`).closest('.row').classList.contains('rv'))",
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


JS_PLANETS = """() => [...document.querySelectorAll('.pc-att')].filter(a => a.querySelector('.sphere')).map(a => {
  const s = getComputedStyle(a.querySelector('.sphere')), o = getComputedStyle(a.querySelector('.orbit'));
  return [a.getAttribute('href'), s.opacity, s.transform, o.strokeDashoffset] })"""


def planets_at_rest(pg):
    """Attachments whose planet is not fully at rest (sphere opaque and unscaled, orbit drawn)."""
    return [p for p in pg.evaluate(JS_PLANETS) if not (p[1] == '1' and p[2] in ('none', 'matrix(1, 0, 0, 1, 0, 0)') and p[3] in ('0', '0px'))]


@check
def print_shows_all(c):
    """Printing shows every entry, and every planet and orbit at rest: the beforeprint path a real print
    takes, and print media on its own."""
    for fire in (True, False):
        pg = c.page('/')
        if fire:
            pg.evaluate("() => dispatchEvent(new Event('beforeprint'))")
        pg.emulate_media(media='print')
        pg.wait_for_timeout(100)
        bad = pg.evaluate(f"() => [...document.querySelectorAll('.log > .row')].filter(r => !({JS_VISIBLE})(r)).length")
        expect(bad == 0, f'beforeprint={fire}: {bad} rows not visible in print')
        expect(pg.evaluate(JS_PLANETS), 'no planets to check')
        moving = planets_at_rest(pg)
        expect(not moving, f'beforeprint={fire}: planets not at rest in print: {moving}')
        pg.close()


@check
def jump_planet_at_rest(c):
    """A jump shows its row at once, planet included: no planet rising or orbit drawing after the jump."""
    pg = c.page('/')
    pg.evaluate("() => { const g = __site.graph; g.go(g.rows.findIndex(r => r.hash === 'b3e0f17')) }")
    pg.wait_for_timeout(150)
    row = pg.evaluate("() => { const a = document.querySelector('#servers-and-mods .pc-att'); const s = getComputedStyle(a.querySelector('.sphere')), o = getComputedStyle(a.querySelector('.orbit')); return [a.closest('.row').className, s.opacity, s.transform, o.strokeDashoffset] }")
    expect('now' in row[0].split(), f'jump target not revealed at once: {row[0]}')
    expect(row[1] == '1' and row[2] in ('none', 'matrix(1, 0, 0, 1, 0, 0)') and row[3] in ('0', '0px'), f'150 ms after the jump the planet is still moving: {row[1:]}')
    no_errors(pg)
    pg.close()


@check
def reduced(c):
    pg = c.page('/', reduced=True)
    rv = lambda: pg.evaluate("() => document.querySelectorAll('.log > .row.rv').length")  # noqa: E731
    expect(rv() == 0, 'reduced motion: rows got rv at load')
    pg.evaluate(JS_SWEEP, 400)
    pg.wait_for_timeout(300)
    expect(rv() == 0, 'reduced motion: rows got rv after a sweep')
    anims = pg.eval_on_selector_all('.pc-att :is(.l-back, .l-img, .l-planet, .l-word span)', 'els => els.map(e => getComputedStyle(e).animationName)')
    expect(anims and all(a == 'none' for a in anims), f'reduced motion: attachment drift runs ({anims})')
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
    """The last attachment with a generative planet, below the fold: its planet rises and its orbit draws in.
    Picked by markup, not by slug, so real covers on other projects don't break it."""
    pg = c.page('/')
    slug = pg.evaluate("() => { const a = [...document.querySelectorAll('.pc-att')].filter(a => a.querySelector('.sphere')).pop(); return a && a.closest('.pc').id }")
    if slug is None:  # every project has real art: no planet to animate
        expect(pg.evaluate("() => !document.querySelector('.pc-att .l-planet')"), 'planet layers without spheres')
        pg.close()
        return
    sel = f'#{slug} .pc-att'
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
    """Every attachment's art drifts with the scroll, generated planets and real art (image, layers, video) alike."""
    pg = c.page('/')
    hrefs = pg.eval_on_selector_all('.pc-att', 'els => els.map(e => e.getAttribute("href"))')
    expect(hrefs, 'no attachments')
    for href in hrefs:
        art = f'.pc-att[href="{href}"] :is(.l-back, .l-img)'
        pg.evaluate(f"() => document.querySelector({art!r}).closest('.pc-att').scrollIntoView({{ block: 'center' }})")
        pg.wait_for_timeout(300)
        name = pg.eval_on_selector(art, 'e => getComputedStyle(e).animationName')
        expect(name != 'none', f'{href}: art has no drift animation')
        t1 = pg.eval_on_selector(art, 'e => getComputedStyle(e).transform')
        pg.evaluate('() => scrollBy(0, 200)')
        pg.wait_for_timeout(300)
        t2 = pg.eval_on_selector(art, 'e => getComputedStyle(e).transform')
        expect(t1 != t2, f'{href}: drift did not move with scroll: {t1}')
    no_errors(pg)
    pg.close()


def cursor_vs_node(pg):
    return pg.evaluate("""() => {
      const r = document.querySelector('#graph > rect').getBoundingClientRect();
      const d = document.querySelector('#graph > circle').getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2, d.left + d.width / 2, d.top + d.height / 2, r.height];
    }""")


JS_CURSOR_VIS = "() => [...document.querySelectorAll('#graph > rect, #graph > circle')].map(e => getComputedStyle(e).visibility)"
JS_TWO_FRAMES = '() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'


def on_node(v):
    return abs(v[0] - v[2]) <= 1 and abs(v[1] - v[3]) <= 1


@check
def graph_cursor(c):
    """The block cursor shows only in Vim normal mode (Esc), and snaps from node to node: on the new
    current node within two frames, never sliding after the scroll."""
    pg = c.page('/')
    pg.wait_for_timeout(600)
    expect(pg.evaluate(JS_CURSOR_VIS) == ['hidden', 'hidden'], f'cursor shown outside normal mode: {pg.evaluate(JS_CURSOR_VIS)}')
    pg.keyboard.press('Escape')
    pg.evaluate(JS_TWO_FRAMES)
    expect(pg.evaluate(JS_CURSOR_VIS) == ['visible', 'visible'], 'Esc did not show the cursor')
    v = cursor_vs_node(pg)
    expect(on_node(v), f'cursor not on node in normal mode: {v}')
    for key in ('j', 'j', 'k'):
        before = v
        pg.keyboard.press(key)
        pg.evaluate(JS_TWO_FRAMES)
        v = cursor_vs_node(pg)
        expect(abs(v[1] - before[1]) > 5, f'{key} did not move the cursor (a frozen graph would pass): {before} -> {v}')
        expect(on_node(v), f'two frames after {key}, the cursor has not reached its node: {v}')
        expect(abs(v[4] - 22) < 0.5, f'the cursor is smeared ({v[4]:.1f} px tall), it should be a 22 px block')
    pg.keyboard.press('Escape')
    pg.evaluate(JS_TWO_FRAMES)
    expect(pg.evaluate(JS_CURSOR_VIS) == ['hidden', 'hidden'], 'leaving normal mode did not hide the cursor')
    paths = pg.eval_on_selector_all('#graph > g:first-child > g', "gs => gs.filter(g => +g.getAttribute('opacity') > 0.01).length")
    expect(paths <= 2, f'{paths} branches visible, max is 2')
    no_errors(pg)
    pg.close()


@check
def go_stays(c):
    for w, h in ((1280, 800), (390, 844)):
        pg = c.page('/', w, h)
        pg.keyboard.press('Escape')  # the cursor shows in normal mode
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
    pg.keyboard.press('Escape')  # the cursor shows in normal mode
    pg.evaluate("() => scrollTo(0, document.querySelector('.log [data-hash=\\'1a7c3e9\\']').getBoundingClientRect().top + scrollY - innerHeight * 0.3)")
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
    sky_ready(pg)
    colours = pg.evaluate(f"() => {JS_SKY_COLOURS}(0, 1)")
    expect(colours >= 4, f'the sky is flat ({colours} colours)')
    no_errors(pg)
    pg.close()
    pg = c.page('/', reduced=True)
    t1 = pg.eval_on_selector('#grain', 'e => e.style.transform')
    pg.wait_for_timeout(400)
    expect(t1 == pg.eval_on_selector('#grain', 'e => e.style.transform') == '', 'grain moves under reduced motion')
    pg.close()


# The sky: distinct colours in a band of canvas columns (fractions of its width), read from the canvas itself.
JS_SKY_COLOURS = """((a, b) => { const c = document.getElementById('sky'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const set = new Set(); for (let y = 0; y < c.height; y++) for (let x = Math.floor(a * c.width); x < Math.ceil(b * c.width); x++) {
    const i = (y * c.width + x) * 4; set.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]) } return set.size })"""
JS_LANE = """() => { const c = document.getElementById('sky'), r = document.querySelector('main .frame').getBoundingClientRect(), s = __site.sky.state().scale;
  return [Math.ceil(r.left / s), Math.floor(r.right / s), c.width] }"""
JS_BRIGHT = """((x0, x1, rgb) => { const c = document.getElementById('sky'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = x0; x < x1; x++) { const i = (y * c.width + x) * 4;
    if (d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) n++ } return n })"""
def sky_ready(pg):
    """The sky streams in a few dozen rows per frame after load: wait until it has filled the screen."""
    pg.wait_for_function('() => window.__site && __site.sky && !__site.sky.state().pending', timeout=5000)


METEOR_HEAD = [245, 224, 220]
STAR_HI = [205, 214, 244]


@check
def sky_renders(c):
    """Every page has the sky: a canvas a third of the screen's size, scaled up with hard pixels, with real texture."""
    for path in ('/', '/work/', '/projects/ba-art-direction/'):
        pg = c.page(path)
        sky_ready(pg)
        r = pg.evaluate("""() => { const c = document.getElementById('sky'), s = getComputedStyle(c);
          return [c.width, c.height, s.imageRendering, s.position, parseFloat(s.width), innerWidth, !!window.__site.sky] }""")
        expect(r[6], f'{path}: no sky')
        expect(abs(r[0] - -(-r[5] // 3)) <= 1 and r[2] == 'pixelated' and r[3] == 'fixed', f'{path}: sky canvas {r}')
        expect(abs(r[4] - r[0] * 3) < 1, f'{path}: not scaled x3: {r}')
        colours = pg.evaluate(f"() => {JS_SKY_COLOURS}(0, 0.12)")
        expect(colours >= 3, f'{path}: the sky margin is flat ({colours} colours)')
        no_errors(pg)
        pg.close()


@check
def sky_lane_calm(c):
    """Behind the reading column the sky is nearly flat (the page base, a whisper of dither) with no stars."""
    pg = c.page('/')
    sky_ready(pg)
    a, b, w = pg.evaluate(JS_LANE)
    dist = pg.evaluate(f"""() => {{ const c = document.getElementById('sky'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, m = new Map(); let n = 0;
      for (let y = 0; y < c.height; y++) for (let x = {a + 8}; x < {b - 8}; x++) {{ const i = (y * c.width + x) * 4, k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; m.set(k, (m.get(k) || 0) + 1); n++ }}
      return [...m].map(([k, v]) => [k, v / n]).sort((p, q) => q[1] - p[1]) }}""")
    base = pg.evaluate("() => getComputedStyle(document.body).backgroundColor").replace('rgb(', '').replace(')', '').replace(' ', '')
    expect(len(dist) <= 3, f'{len(dist)} colours behind the text: {dist[:5]}')
    expect(dist[0][0] == base and dist[0][1] >= 0.95, f'behind the text: {dist[0][1]:.1%} is {dist[0][0]}, want at least 95% page base {base}')
    stars = pg.evaluate(f"() => {JS_BRIGHT}({a + 8}, {b - 8}, {STAR_HI})")
    expect(stars == 0, f'{stars} bright star pixels behind the text')
    outer = pg.evaluate(f"() => {JS_SKY_COLOURS}(0, {max(1, a - 45) / w})")
    expect(outer >= 4, f'the margin sky is too flat ({outer} colours)')
    no_errors(pg)
    pg.close()


@check
def sky_meteor(c):
    """A shooting star shows in the margin and passes behind the reading column, never over the text."""
    pg = c.page('/')
    sky_ready(pg)
    a, b, w = pg.evaluate(JS_LANE)
    pg.evaluate("() => __site.sky.meteor({ x: 4, y: 6, vx: 1.2, vy: 0.8 })")
    pg.wait_for_timeout(250)
    head = pg.evaluate(f"() => {JS_BRIGHT}(0, {max(1, a - 45)}, {METEOR_HEAD})")
    expect(head > 0, 'no shooting star in the margin')
    pg.evaluate(f"() => __site.sky.meteor({{ x: {(a + b) // 2}, y: 6, vx: 0.4, vy: 0.9 }})")
    for _ in range(5):
        pg.wait_for_timeout(120)
        inside = pg.evaluate(f"() => {JS_BRIGHT}({a + 8}, {b - 8}, {METEOR_HEAD})")
        expect(inside == 0, f'a shooting star drawn over the text ({inside} px)')
    no_errors(pg)
    pg.close()


@check
def sky_reduced(c):
    """With reduced motion the sky is a still picture: no twinkle, breathing, parallax or shooting stars."""
    pg = c.page('/', reduced=True)
    sky_ready(pg)
    snap = "() => { const c = document.getElementById('sky'); return c.toDataURL().length + ':' + c.getContext('2d').getImageData(0, 0, c.width, c.height).data.reduce((h, v, i) => (h * 31 + v * (i % 97 + 1)) >>> 0, 7) }"
    first = pg.evaluate(snap)
    pg.evaluate("() => __site.sky.meteor({ x: 4, y: 6, vx: 1.2, vy: 0.8 })")
    pg.mouse.wheel(0, 600)
    pg.wait_for_timeout(900)
    expect(pg.evaluate(snap) == first, 'the sky changed under reduced motion')
    expect(pg.evaluate("() => getComputedStyle(document.getElementById('sky')).transform") in ('none', 'matrix(1, 0, 0, 1, 0, 0)'), 'the sky scrolled under reduced motion')
    no_errors(pg)
    pg.close()


@check
def sky_print(c):
    pg = c.page('/')
    pg.emulate_media(media='print')
    expect(pg.eval_on_selector('#sky', 'e => getComputedStyle(e).display') == 'none', 'the sky prints')
    pg.close()


@check
def sky_nojs(c):
    """Without JavaScript there is no sky: the page shows its plain background."""
    pg = c.page('/', js=False)
    r = pg.evaluate("() => { const c = document.getElementById('sky'); return [c.width, c.height] }")
    expect(r == [300, 150], f'the sky canvas was drawn without JavaScript: {r}')
    pg.close()


@check
def sky_resize(c):
    """Resizing rebuilds the buffer and the lane: a phone-sized sky, then back, without errors."""
    pg = c.page('/')
    for w, h in ((390, 844), (1280, 800)):
        pg.set_viewport_size({'width': w, 'height': h})
        pg.wait_for_timeout(300)
        sky_ready(pg)
        st = pg.evaluate('() => __site.sky.state()')
        expect(st['w'] == -(-w // 3), f'{w}: sky width {st["w"]}, want {-(-w // 3)}')
        a, b, cw = pg.evaluate(JS_LANE)
        stars = pg.evaluate(f"() => {JS_BRIGHT}({a + 8}, {max(a + 9, b - 8)}, {STAR_HI})")
        expect(stars == 0, f'{w}: stars behind the text after a resize')
    no_errors(pg)
    pg.close()


@check
def grain_toggle(c):
    """The grain segment in the status bar switches the film grain off and on, by mouse and keyboard; off
    removes the layer and stops its timer, and the choice survives a reload without a flash of grain."""
    first_paint = """document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => {
      window.__grainAtPaint = getComputedStyle(document.getElementById('grain')).display }))"""
    pg = c.page('/', init=first_paint)
    btn = '#grainbtn'
    expect(pg.is_visible(btn), 'no grain toggle in the bar')
    expect(pg.get_attribute(btn, 'aria-pressed') == 'true', 'grain toggle not pressed at first')

    def moving():
        return pg.evaluate("""async () => { const g = document.getElementById('grain'), a = g.style.transform;
          await new Promise(r => setTimeout(r, 400)); return a !== g.style.transform }""")
    expect(moving(), 'grain not moving while on')
    pg.click(btn)
    expect(pg.get_attribute(btn, 'aria-pressed') == 'false', 'click did not switch the grain off')
    expect(pg.eval_on_selector('#grain', 'e => getComputedStyle(e).display') == 'none', 'grain layer still rendered when off')
    expect(not moving(), 'grain timer still running when off')
    expect(pg.evaluate("() => localStorage.getItem('grain')") == 'off', 'choice not saved')
    pg.reload()
    pg.wait_for_timeout(300)
    expect(pg.evaluate('() => window.__grainAtPaint') == 'none', 'grain flashed on at first paint after reload')
    expect(pg.get_attribute(btn, 'aria-pressed') == 'false', 'saved off state not restored')
    pg.focus(btn)
    pg.keyboard.press('Space')
    expect(pg.get_attribute(btn, 'aria-pressed') == 'true', 'Space did not switch the grain back on')
    expect(pg.eval_on_selector('#grain', 'e => getComputedStyle(e).display') != 'none', 'grain layer not back')
    expect(moving(), 'grain not moving again')
    expect(pg.evaluate("() => localStorage.getItem('grain')") == 'on', 'on not saved')
    no_errors(pg)
    pg.close()
    pg = c.page('/', 390, 844)
    expect(not pg.is_visible('#grainbtn'), 'grain toggle shown in the full phone bar')
    pg.close()
    pg = c.page('/', js=False)
    expect(not pg.is_visible('#grainbtn'), 'grain toggle shown without JavaScript (it cannot work)')
    pg.close()


@check
def clock_rome(c):
    """The status-bar clock is Luca's time in Rome, wherever the visitor is: a small easter egg that says so."""
    from datetime import datetime
    from zoneinfo import ZoneInfo
    pg = c.browser.new_page(viewport={'width': 1280, 'height': 800}, timezone_id='America/Los_Angeles')
    pg.goto(c.base + '/')
    pg.wait_for_timeout(300)
    now = lambda: datetime.now(ZoneInfo('Europe/Rome')).strftime('%H:%M')  # noqa: E731
    before = now()
    shown = pg.inner_text('#clkt')
    rome = {before, now()}  # a minute may turn between the two reads
    expect(shown in rome, f'clock shows {shown!r}, Rome is {rome}')
    expect(pg.evaluate("() => new Date().getTimezoneOffset()") != 0, 'the test browser is not in another time zone')
    expect(pg.get_attribute('#clk', 'title') == 'My time in Rome', f"clock title {pg.get_attribute('#clk', 'title')!r}")
    expect('My time in Rome' in pg.locator('#bar').aria_snapshot(), 'screen readers are not told whose time it is')
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
    clk = pg.inner_text('#clkt')
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


# Worlds: each project and work entry tints the log while it is the current row.
# Worlds: while a project or work entry is the current row, the sky's palette fades to that world.
WORLD_ROWS = ('a3f9c1e', '5c2e91b', '4d01c9a', '7be2104', 'c7d41ab', 'e8d77f0', '1a7c3e9', 'b3e0f17')
JS_GO = "h => { const g = __site.graph; g.go(g.rows.findIndex(r => r.hash === h)) }"
JS_WORLDS = "() => JSON.parse(document.getElementById('worlds').textContent)"
PAGE_SKY = {'base': '#1e1e2e', 'accent': '#b4befe'}


def world_of(worlds, h):
    w = next((w for w in worlds if h in w['hashes']), None)
    return {'base': w['base'], 'accent': w['accent']} if w else PAGE_SKY


@check
def world_enters(c):
    """Each world row fades the sky to its colours; rows of one world change nothing; a merge brings back
    the page's own sky; a real scroll ends in the world of the row it lands on."""
    for w, h in ((1280, 800), (390, 844)):
        pg = c.page('/', w, h)
        sky_ready(pg)
        worlds = pg.evaluate(JS_WORLDS)
        for row in WORLD_ROWS:
            pg.evaluate(JS_GO, row)
            pg.wait_for_timeout(1600)
            st = pg.evaluate('() => __site.sky.state()')
            expect(st['target'] == world_of(worlds, row) and not st['fading'], f'{w}: at {row}: sky {st["target"]} fading={st["fading"]}')
        pg.evaluate(JS_GO, 'e8d77f0')
        pg.wait_for_timeout(1600)
        pg.evaluate(JS_GO, '1a7c3e9')  # the same IBM world
        pg.wait_for_timeout(100)
        expect(not pg.evaluate('() => __site.sky.state().fading'), f'{w}: moving within the IBM world started a fade')
        pg.evaluate(JS_GO, '2e6a8d1')  # a merge: the page's own sky
        pg.wait_for_timeout(1600)
        expect(pg.evaluate('() => __site.sky.state().target') == PAGE_SKY, f'{w}: a merge did not bring the page sky back')
        pg.reload()
        pg.wait_for_timeout(500)
        delta = pg.evaluate("() => { const r = document.getElementById('ba-art-direction').closest('.row').getBoundingClientRect(); return r.top + r.height / 2 - innerHeight / 2 }")
        pg.mouse.move(w / 2, h / 2)
        pg.mouse.wheel(0, delta)
        pg.wait_for_timeout(2000)
        cur = pg.evaluate('() => { const g = __site.graph; return g.rows[g.index].hash }')
        expect(cur == '4d01c9a', f'{w}: wheel to BA left the cursor on {cur}')
        st = pg.evaluate('() => __site.sky.state()')
        expect(st['target'] == world_of(pg.evaluate(JS_WORLDS), '4d01c9a') and not st['fading'], f'{w}: after scrolling to BA the sky is {st["target"]}')
        no_errors(pg)
        pg.close()


@check
def world_contrast(c):
    """Inside every world, text keeps the site's contrast rules: body text AAA (7:1), labels AA (4.5:1)."""
    from io import BytesIO
    from PIL import Image
    pg = c.page('/')
    sky_ready(pg)
    for row in WORLD_ROWS:
        pg.evaluate(JS_GO, row)
        pg.wait_for_timeout(1700)
        boxes = pg.evaluate("""h => { const row = document.querySelector(`.log [data-hash='${h}']`).closest('.row');
          return [...row.querySelectorAll('.ds, .cells dd, .cells dt')].map(e => { const r = e.getBoundingClientRect();
            return [e.tagName + '.' + e.className, r.left, r.top, r.right, r.bottom, getComputedStyle(e).color] }) }""", row)
        expect(any(b[0].startswith('P.') for b in boxes) and any(b[0].startswith('DD') for b in boxes), f'{row}: no lede or cells to measure')
        tag = pg.add_style_tag(content='#grain{display:none} .log *{color:transparent!important}')
        pg.wait_for_timeout(100)
        img = Image.open(BytesIO(pg.screenshot())).convert('RGB')
        tag.evaluate('e => e.remove()')
        for name, l, t, r, b, color in boxes:
            rgb = [int(v) for v in color[color.index('(') + 1:color.index(')')].split(',')[:3]]
            vals = sorted(contrast(rgb, img.getpixel((x, y)))
                          for x in range(max(0, int(l)), min(1280, int(r)), 3)
                          for y in range(max(0, int(t)), min(800, int(b)), 3))
            expect(vals, f'{row} {name}: no on-screen pixels to sample')
            need = 4.5 if name.startswith('DT') else 7
            p1 = vals[len(vals) // 100]
            expect(p1 >= need, f'{row} {name}: 1st percentile contrast {p1:.2f} < {need}')
    no_errors(pg)
    pg.close()


@check
def world_reduced(c):
    """With reduced motion a world is still a colour change, only quicker (0.45 s)."""
    pg = c.page('/', reduced=True)
    sky_ready(pg)
    pg.evaluate(JS_GO, '4d01c9a')
    pg.wait_for_timeout(600)
    st = pg.evaluate('() => __site.sky.state()')
    expect(st['target'] == world_of(pg.evaluate(JS_WORLDS), '4d01c9a') and not st['fading'], f'reduced motion: at BA after 0.6 s: {st}')
    no_errors(pg)
    pg.close()


@check
def sky_project_palette(c):
    """A project page's sky is its own palette: the page background and the cover's accent."""
    pg = c.page('/projects/ba-art-direction/')
    sky_ready(pg)
    want = pg.evaluate("() => { const s = getComputedStyle(document.body); return { base: s.getPropertyValue('--bg').trim(), accent: s.getPropertyValue('--p-accent').trim() } }")
    st = pg.evaluate('() => __site.sky.state()')
    expect(st['target'] == want, f"project sky {st['target']}, want {want}")
    no_errors(pg)
    pg.close()


def css_alpha(col):
    """Alpha of a computed CSS colour: rgba(r, g, b, a), or any space syntax with ' / a'."""
    if '/' in col:
        return float(col[col.rindex('/') + 1:].strip(' )'))
    if col.startswith('rgba('):
        return float(col[col.rindex(',') + 1:-1])
    return 1.0


@check
def cells_see_through(c):
    """Spec cells let the world show through; their 1px hairlines stay, drawn by outlines or borders, not a backing fill."""
    for path in ('/', '/projects/configurator-framework/'):
        pg = c.page(path)
        r = pg.evaluate("""() => [...document.querySelectorAll('.cells')].map(d => [getComputedStyle(d).backgroundColor,
          [...d.children].map(c => { const s = getComputedStyle(c);
            return [s.backgroundColor, [s.outlineWidth, s.outlineStyle, s.outlineColor], [s.borderTopWidth, s.borderTopStyle, s.borderTopColor]] })])""")
        expect(r, f'{path}: no cells')
        # Each page keeps its hairline colour (the log's --line, a project page's palette): 1px, solid, and
        # opaque: neighbouring cells paint their shared gap twice, so a translucent line comes out uneven.
        line = lambda w, s, col: w == '1px' and s == 'solid' and css_alpha(col) == 1  # noqa: E731
        for bg, cells in r:
            expect(css_alpha(bg) == 0, f'{path}: .cells has a backing fill {bg}')
            for cbg, outline, border in cells:
                expect(0 < css_alpha(cbg) < 1, f'{path}: cell fill not see-through: {cbg}')
                expect(line(*outline) or line(*border), f'{path}: cell hairline outline {outline} border {border}')
        pg.close()


@check
def graph_no_churn(c):
    """While you scroll, the graph only moves what it already drew: no nodes are created or removed
    in #graph frame after frame (they are built once per layout)."""
    pg = c.page('/', wait=800)
    churn = pg.evaluate("""async () => {
      let added = 0, removed = 0;
      const mo = new MutationObserver(ms => { for (const m of ms) { added += m.addedNodes.length; removed += m.removedNodes.length } });
      mo.observe(document.getElementById('graph'), { childList: true, subtree: true });
      for (let i = 0; i < 120; i++) { scrollBy(0, 30); await new Promise(r => requestAnimationFrame(r)) }
      await new Promise(r => setTimeout(r, 1500));
      mo.disconnect();
      return [added, removed] }""")
    expect(churn == [0, 0], f'the graph added {churn[0]} and removed {churn[1]} nodes while scrolling')
    no_errors(pg)
    pg.close()


@check
def no_forced_layout(c):
    """Scrolling the whole log (worlds switching, rows revealing, the graph following) never makes the
    site's own scripts read layout after a write: no layout forced from /assets/ inside an animation
    frame, the write phase (spec, Performance budgets). Scroll handlers may read: that comes first."""
    import json
    from tracing import CATEGORIES, SWEEP, metrics
    pg = c.page('/', wait=800)
    c.browser.start_tracing(page=pg, categories=CATEGORIES)
    pg.evaluate(SWEEP, 16)
    m = metrics(json.loads(c.browser.stop_tracing())['traceEvents'])
    expect(m['siteCalls'] > 0, 'no site script ran during the sweep')
    expect(m['forcedInRaf'] == 0, f"{m['forcedInRaf']} layouts forced inside animation frames (after writes) during a scroll sweep: {m['forcedBy']}")
    # Script time swings with the shared host's load: perf.py gates it on a median of 3 runs.
    no_errors(pg)
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
def fonts_self_hosted(c):
    """Fonts come from the site itself: no request leaves the origin, and both faces are in use after load."""
    for path in ('/', '/about/', '/projects/ba-art-direction/'):
        pg = c.browser.new_page(viewport={'width': 1280, 'height': 800})
        foreign = []
        pg.on('request', lambda r: not r.url.startswith(c.base) and not r.url.startswith('data:') and foreign.append(r.url))
        pg.goto(c.base + path, wait_until='load')
        pg.evaluate('() => document.fonts.ready')
        expect(not foreign, f'{path}: requests leave the site: {foreign}')
        for face in ('16px "Atkinson Hyperlegible Next"', 'italic 400 40px "Fraunces"', '13px "Atkinson Hyperlegible Mono"'):
            expect(pg.evaluate('f => document.fonts.check(f)', face), f'{path}: {face} not loaded')
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
        pg.evaluate('() => document.fonts.ready')
        expect(not missing, f'404s under /portfolio/: {missing}')
        preloads = pg.eval_on_selector_all('link[rel="preload"][as="font"]', 'ls => ls.map(l => l.getAttribute("href"))')
        expect(preloads and all(h.startswith('/portfolio/fonts/') for h in preloads), f'font preloads without the prefix: {preloads}')
        loaded = pg.evaluate("() => performance.getEntriesByType('resource').filter(e => e.name.includes('/fonts/')).map(e => new URL(e.name).pathname)")
        expect(any(u.startswith('/portfolio/fonts/') and u.endswith('.woff2') for u in loaded), f'no fonts loaded under /portfolio/fonts/: {loaded}')
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
