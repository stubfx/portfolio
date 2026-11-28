"""Browser checks against the built site, in Chromium on the host's Playwright server (see the global CLAUDE.md).

Local only, never in CI. Builds dist/ and the fixture site (test/fixtures/e2e: an embed and a clip with sound,
which the real content doesn't have yet), serves both with build.mjs's server (Range support for video), and runs:

  shots     home and case, 1440x900 and 390x844, day and night, into test/e2e/shots/
  reference the same views of prototype/index.html (restore it from commit 8a73210), into test/e2e/shots/reference/
  console   no console errors or page errors
  offsite   no request to another origin while loading and scrolling every page
  embed     no iframe before a click; after one, a single youtube-nocookie iframe (the player itself is stubbed)
  loops     play when on screen, pause off screen, Space toggles with the tag shown, reduced motion keeps controls
  nojs      readable without JavaScript: text, raw link, videos paused with controls, no JS-only buttons
  cls       layout shift under 0.05 while fonts load (fonts delayed 800 ms), 1440 and 390 wide
  overflow  no horizontal scrolling at 360 px
  focus     every Tab stop shows an outline of at least 2 px
  graph     logic graphs: hidden until in view, then drawn in full; finished at once with reduced motion or without JavaScript
  header    the file bar is the same on a world page (a hostile one in the fixture) as on the homepage: type, size, layout, on top
  words     no word splits across two lines (Luca: "alexand - er") in any heading, punch line, quote or text, at 360 to 1920 px;
            breaking at a hyphen, dash or slash is fine
  rows      timeline rows span the screen edge to edge, show no scrollbar, never scroll the page, keep long titles inside cards; arrows scroll

Usage: uv run -q --with playwright==1.64.1 python test/e2e/check.py [name ...]   (no names: all but reference)
"""
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / 'test' / 'e2e' / 'shots'
FIXTURE = ROOT / 'test' / 'fixtures' / 'e2e' / 'content'
VIEWS = ((1440, 900), (390, 844))
CHECKS = {}
NODE_SERVE = "import('./build.mjs').then(async (m) => { const s = await m.serve({ outDir: process.argv[1], port: 0 }); console.log(s.url); })"
NODE_BUILD = ("import('./build.mjs').then(async (m) => { const r = await m.build({ contentDir: process.argv[1], outDir: process.argv[2] });"
              " if (!r.ok) { console.error(JSON.stringify(r.problems)); process.exit(1); } })")


def check(fn):
    CHECKS[fn.__name__] = fn
    return fn


def host():
    return subprocess.check_output("ip route | awk '/^default/{print $3; exit}'", shell=True, text=True).strip()


def serve(directory):
    p = subprocess.Popen(['node', '-e', NODE_SERVE, str(directory)], cwd=ROOT, stdout=subprocess.PIPE, text=True)
    return p, p.stdout.readline().strip()


def pages(base, out):
    return [base + ('/' if p == 'index.html' else '/' + p.removesuffix('index.html')) for p in
            sorted(str(f.relative_to(out)) for f in Path(out).rglob('*.html'))]


class Run:
    def __init__(self, browser, dist_url, dist_dir, fix_url, fix_dir):
        self.browser, self.dist, self.fix = browser, dist_url, fix_url
        self.dist_pages = pages(dist_url, dist_dir)
        self.fix_pages = pages(fix_url, fix_dir)
        self.failures = []

    def fail(self, name, msg):
        self.failures.append(f'{name}: {msg}')

    def page(self, w=1440, h=900, **ctx):
        context = self.browser.new_context(viewport={'width': w, 'height': h}, **ctx)
        return context, context.new_page()

    def scroll_through(self, pg):
        pg.evaluate("""async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
            scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); }""")


@check
def shots(r):
    SHOTS.mkdir(parents=True, exist_ok=True)
    for path, name in (('/', 'home'), ('/work/direction-as-code/', 'case')):
        for w, h in VIEWS:
            for theme in ('day', 'night'):
                ctx, pg = r.page(w, h, reduced_motion='reduce')
                pg.goto(r.dist + path, wait_until='networkidle')
                if theme == 'night':
                    pg.click('#t-night')
                r.scroll_through(pg)
                pg.evaluate("Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))])")
                pg.screenshot(path=SHOTS / f'{name}-{w}-{theme}.png', full_page=True)
                ctx.close()


@check
def reference(r):
    if not (ROOT / 'prototype').exists():
        print('  the prototype is deleted; restore it from git history (commit 8a73210) to compare')
        return
    out = SHOTS / 'reference'
    out.mkdir(parents=True, exist_ok=True)
    proto, url = serve(ROOT / 'prototype')
    try:
        for frag, name in (('', 'home'), ('#/work/direction-as-code.md', 'case')):
            for w, h in VIEWS:
                for theme in ('day', 'night'):
                    ctx, pg = r.page(w, h, reduced_motion='reduce')
                    pg.goto(f'{url}/index.html{frag}', wait_until='networkidle')
                    if theme == 'night':
                        pg.click('#t-night')
                    pg.wait_for_timeout(300)
                    pg.screenshot(path=out / f'{name}-{w}-{theme}.png', full_page=True)
                    ctx.close()
    finally:
        proto.terminate()


@check
def console(r):
    for url in r.dist_pages + r.fix_pages:
        ctx, pg = r.page()
        errors = []
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(url, wait_until='networkidle')
        r.scroll_through(pg)
        pg.wait_for_timeout(300)
        ctx.close()
        if errors:
            r.fail('console', f'{url}: {errors[:3]}')


@check
def offsite(r):
    for url in r.dist_pages + r.fix_pages:
        ctx, pg = r.page()
        seen = []
        pg.on('request', lambda q: q.url.startswith('http') and not q.url.startswith('http://127.0.0.1') and seen.append(q.url))
        pg.goto(url, wait_until='networkidle')
        r.scroll_through(pg)
        pg.wait_for_timeout(300)
        ctx.close()
        if seen:
            r.fail('offsite', f'{url}: {seen[:3]}')


@check
def embed(r):
    ctx, pg = r.page()
    pg.route('https://www.youtube-nocookie.com/**', lambda route: route.fulfill(status=200, content_type='text/html', body='<p>player stub</p>'))
    pg.goto(r.fix + '/', wait_until='networkidle')
    if pg.locator('iframe').count():
        r.fail('embed', 'an iframe before any click')
    a = pg.locator('a.embed')
    if a.get_attribute('href') != 'https://youtu.be/e2etest01':
        r.fail('embed', 'the embed is not a link to the video')
    a.scroll_into_view_if_needed()
    a.click()
    pg.wait_for_timeout(500)
    srcs = [f.get_attribute('src') for f in pg.locator('iframe').all()]
    if len(srcs) != 1 or not srcs[0].startswith('https://www.youtube-nocookie.com/embed/e2etest01'):
        r.fail('embed', f'after a click: {srcs}')
    ctx.close()


@check
def loops(r):
    ctx, pg = r.page()
    pg.goto(r.dist + '/', wait_until='networkidle')
    v = pg.locator('video.loop').first
    v.scroll_into_view_if_needed()
    pg.wait_for_timeout(1200)
    state = lambda: pg.evaluate("v => ({paused: v.paused, controls: v.controls, time: v.currentTime, tag: v.nextElementSibling?.textContent, flag: v.hasAttribute('data-paused')})", v.element_handle())
    s = state()
    if s['paused'] or s['controls'] or s['time'] <= 0:
        r.fail('loops', f'on screen it should play with no controls: {s}')
    pg.evaluate('scrollTo(0, document.body.scrollHeight)')
    pg.wait_for_timeout(600)
    if not state()['paused']:
        r.fail('loops', 'still playing off screen')
    v.scroll_into_view_if_needed()
    pg.wait_for_timeout(600)
    v.focus()
    pg.keyboard.press(' ')
    pg.wait_for_timeout(300)
    s = state()
    if not (s['paused'] and s['flag'] and s['tag'] == 'play'):
        r.fail('loops', f'Space should pause it and show "play": {s}')
    visible = pg.evaluate("v => getComputedStyle(v.nextElementSibling).visibility", v.element_handle())
    if visible != 'visible':
        r.fail('loops', 'the tag is hidden while paused')
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(600)
    if state()['paused']:
        r.fail('loops', 'Enter should play it again')
    ctx.close()
    ctx, pg = r.page(reduced_motion='reduce')
    pg.goto(r.dist + '/', wait_until='networkidle')
    pg.wait_for_timeout(800)
    s = pg.evaluate("() => { const v = document.querySelector('video.loop'); return {paused: v.paused, controls: v.controls}; }")
    if not (s['paused'] and s['controls']):
        r.fail('loops', f'reduced motion should keep the poster and controls: {s}')
    ctx.close()


@check
def nojs(r):
    for url in r.dist_pages + r.fix_pages:
        ctx, pg = r.page(java_script_enabled=False)
        pg.goto(url, wait_until='networkidle')
        if not pg.locator('main h1').is_visible():
            r.fail('nojs', f'{url}: no visible H1')
        if not pg.locator('a.rawlink').is_visible():
            r.fail('nojs', f'{url}: the raw link is hidden')
        for sel in ('#copy', '#themeseg', '#viewseg'):
            if pg.locator(sel).is_visible():
                r.fail('nojs', f'{url}: {sel} shows without JavaScript')
        for vid in pg.locator('video').all():
            if vid.get_attribute('controls') is None or vid.get_attribute('autoplay') is not None:
                r.fail('nojs', f'{url}: a video without controls or with autoplay')
        ctx.close()


@check
def cls(r):
    for w, h in VIEWS:
        for url in (r.dist + '/', r.dist + '/work/direction-as-code/'):
            ctx, pg = r.page(w, h)
            pg.route('**/*.woff2', lambda route: (time.sleep(0.8), route.continue_()))
            pg.goto(url, wait_until='load')
            value = pg.evaluate("""() => new Promise(done => { let cls = 0;
                new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; })
                  .observe({ type: 'layout-shift', buffered: true });
                document.fonts.ready.then(() => setTimeout(() => done(cls), 1000)); })""")
            ctx.close()
            print(f'  cls {w} {url.removeprefix(r.dist)}: {value:.4f}')
            if value >= 0.05:
                r.fail('cls', f'{url} at {w}: {value:.3f}')


@check
def overflow(r):
    for url in r.dist_pages + r.fix_pages:
        ctx, pg = r.page(360, 740)
        pg.goto(url, wait_until='networkidle')
        sw, iw = pg.evaluate('[document.documentElement.scrollWidth, innerWidth]')
        ctx.close()
        if sw > iw:
            r.fail('overflow', f'{url}: {sw}px wide at {iw}px')


@check
def focus(r):
    for url in (r.dist + '/', r.fix + '/'):
        ctx, pg = r.page()
        pg.goto(url, wait_until='networkidle')
        seen = set()
        for _ in range(40):
            pg.keyboard.press('Tab')
            info = pg.evaluate("""() => { const e = document.activeElement; if (!e || e === document.body) return null;
                const s = getComputedStyle(e); return { id: e.tagName + (e.id ? '#' + e.id : '') + ':' + (e.getAttribute('href') || e.className),
                outline: s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth) }; }""")
            if not info or info['id'] in seen:
                continue
            seen.add(info['id'])
            if info['outline'] < 2:
                r.fail('focus', f'{url}: {info["id"]} has no visible focus ({info["outline"]}px)')
        ctx.close()
        if len(seen) < 5:
            r.fail('focus', f'{url}: only {len(seen)} tab stops')


@check
def rows(r):
    for base in (r.dist, r.fix):
        for w, h in ((1440, 900), (390, 844), (360, 740)):
            ctx, pg = r.page(w, h)
            pg.goto(base + '/', wait_until='networkidle')
            where = f'{base}/ at {w}'
            box = pg.evaluate("(() => { const e = document.querySelector('.row'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.right]; })()")
            if box is None:
                r.fail('rows', f'{where}: no row')
                ctx.close()
                continue
            if abs(box[0]) > 1 or abs(box[1] - w) > 1:
                r.fail('rows', f'{where}: the row spans {box}, not 0 to {w}')
            sw, cw = pg.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
            if sw > cw:
                r.fail('rows', f'{where}: the page scrolls sideways ({sw} > {cw})')
            bar = pg.evaluate("(() => { const c = document.querySelector('.cards'); return [getComputedStyle(c).scrollbarWidth, c.offsetHeight - c.clientHeight]; })()")
            if bar != ['none', 0]:
                r.fail('rows', f'{where}: the row shows a scrollbar ({bar})')
            over = pg.evaluate("[...document.querySelectorAll('.card')].filter(c => c.scrollWidth > c.clientWidth + 1).length")
            if over:
                r.fail('rows', f'{where}: {over} card(s) wider than their box')
            if w == 1440:
                pg.locator('.row').first.scroll_into_view_if_needed()
                pg.wait_for_timeout(200)
                state = pg.evaluate("(() => { const r = document.querySelector('.row'); return { prev: r.querySelector('.row-btn.prev').disabled, at: r.querySelector('.cards').scrollLeft }; })()")
                pg.locator('.row .row-btn.next').first.click()
                pg.wait_for_timeout(900)
                after = pg.evaluate("document.querySelector('.row .cards').scrollLeft")
                if not state['prev']:
                    r.fail('rows', f'{where}: the back arrow is enabled at the start')
                if after <= state['at']:
                    r.fail('rows', f'{where}: the next arrow did not scroll ({state["at"]} -> {after})')
                pg.focus('.row .row-btn.next')
                for _ in range(12):
                    if pg.evaluate("document.querySelector('.row .row-btn.next').disabled"):
                        break
                    pg.keyboard.press('Enter')
                    pg.wait_for_timeout(700)
                active = pg.evaluate("document.activeElement.className")
                if 'prev' not in active:
                    r.fail('rows', f'{where}: at the end of the row, keyboard focus went to "{active or 'the page'}", not the back arrow')
            ctx.close()


SPLIT_WORDS = r"""(() => {
  const out = [];
  for (const el of document.querySelectorAll('main h1, main h2, main h3, main .punch, main blockquote, main p, main li, main td')) {
    if (el.closest('figcaption, pre, .code')) continue;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      for (const m of n.data.matchAll(/[^\s\-‐‑–—\/]+/g)) {
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const tops = new Set([...range.getClientRects()].filter((b) => b.width > 0).map((b) => Math.round(b.top)));
        if (tops.size > 1) out.push(`${el.tagName.toLowerCase()} "${m[0]}"`);
      }
    }
  }
  return [...new Set(out)];
})()"""


@check
def words(r):
    for w in (360, 390, 768, 1024, 1280, 1440, 1920, 2560):
        for url in r.dist_pages:
            ctx, pg = r.page(w, 900)
            pg.goto(url, wait_until='networkidle')
            pg.wait_for_timeout(150)
            split = pg.evaluate(SPLIT_WORDS)
            ctx.close()
            if split:
                r.fail('words', f'{url.replace(r.dist, "")} at {w}: {", ".join(split[:6])}')


GRAPH_STATE = """(() => { const g = document.querySelector('svg.graph'); if (!g) return null;
  const op = [...g.querySelectorAll('.t, .h')].map((e) => +getComputedStyle(e).opacity);
  const off = [...g.querySelectorAll('.s')].map((e) => parseFloat(getComputedStyle(e).strokeDashoffset) || 0);
  return { cls: g.getAttribute('class'), hidden: op.filter((o) => o < 0.99).length, undrawn: off.filter((o) => Math.abs(o) > 0.001).length, n: op.length + off.length };
})()"""


@check
def graph(r):
    url = r.dist + '/work/direction-as-code/'
    ctx, pg = r.page()
    pg.goto(url, wait_until='networkidle')
    before = pg.evaluate(GRAPH_STATE)
    if before is None:
        r.fail('graph', 'no logic graph on /work/direction-as-code/')
        ctx.close()
        return
    if 'armed' not in before['cls'] or 'play' in before['cls'] or before['hidden'] == 0:
        r.fail('graph', f'off screen it should wait, armed and hidden: {before}')
    pg.evaluate("document.querySelector('svg.graph').scrollIntoView({block: 'center'})")
    pg.wait_for_timeout(4500)
    after = pg.evaluate(GRAPH_STATE)
    if 'play' not in after['cls'] or after['hidden'] or after['undrawn']:
        r.fail('graph', f'in view it should end fully drawn: {after}')
    ctx.close()
    for name, opts in (('reduced motion', {'reduced_motion': 'reduce'}), ('no JavaScript', {'java_script_enabled': False})):
        ctx, pg = r.page(**opts)
        pg.goto(url, wait_until='networkidle')
        st = pg.evaluate(GRAPH_STATE)
        if st['hidden'] or st['undrawn']:
            r.fail('graph', f'{name}: it should be there, finished, without playing: {st}')
        ctx.close()


HEADER_PROBE = """(() => {
  const b = document.querySelector('.bar'), c = document.getElementById('copy'), v = document.querySelector('#viewseg button');
  const s = getComputedStyle(b), k = getComputedStyle(c), t = getComputedStyle(v);
  return { font: s.fontFamily, size: s.fontSize, spacing: s.letterSpacing, transform: s.textTransform, height: b.offsetHeight,
    pad: s.paddingLeft, copy: [c.offsetWidth, c.offsetHeight, k.fontFamily, k.fontSize, k.letterSpacing, k.padding],
    view: [t.fontFamily, t.fontSize, t.letterSpacing, t.padding], theme: getComputedStyle(document.getElementById('themeseg')).display };
})()"""


@check
def header(r):
    for w, h in VIEWS:
        ctx, pg = r.page(w, h)
        pg.goto(r.fix + '/', wait_until='networkidle')
        home = pg.evaluate(HEADER_PROBE)
        pg.goto(r.fix + '/worldly/', wait_until='networkidle')
        world = pg.evaluate(HEADER_PROBE)
        pg.evaluate('window.scrollTo(0, 1500)')
        pg.wait_for_timeout(100)
        on_top = pg.evaluate('(() => { const b = document.querySelector(".bar").getBoundingClientRect();'
                             ' return scrollY > 0 && !!document.elementFromPoint(innerWidth / 2, b.top + b.height / 2)?.closest(".bar"); })()')
        ctx.close()
        if world.pop('theme') != 'none':
            r.fail('header', f'{w}: the theme switch shows on a world page')
        home.pop('theme')
        diff = {k: (home[k], world[k]) for k in home if home[k] != world[k]}
        if diff:
            r.fail('header', f'{w}: the world page moved the header: {diff}')
        if not on_top:
            r.fail('header', f'{w}: the world page covers the header')


def main(names):
    unknown = [n for n in names if n not in CHECKS]
    if unknown:
        sys.exit(f'unknown checks: {unknown}; known: {list(CHECKS)}')
    names = names or [n for n in CHECKS if n != 'reference']
    # its own builds, so a dev server rebuilding dist/ meanwhile can't pull files from under the checks
    dist_dir = tempfile.mkdtemp(prefix='e2e-dist-')
    subprocess.run(['node', '-e', NODE_BUILD, str(ROOT / 'content'), dist_dir], cwd=ROOT, check=True)
    fix_dir = tempfile.mkdtemp(prefix='e2e-')
    subprocess.run(['node', '-e', NODE_BUILD, str(FIXTURE), fix_dir], cwd=ROOT, check=True)
    dist, dist_url = serve(dist_dir)
    fix, fix_url = serve(fix_dir)
    h = host()
    try:
        with sync_playwright() as p:
            browser = p.chromium.connect(f'ws://{h}:3333/', expose_network='<loopback>')
            r = Run(browser, dist_url, dist_dir, fix_url, fix_dir)
            for n in names:
                before = len(r.failures)
                CHECKS[n](r)
                print(f'{n}: ' + ('ok' if len(r.failures) == before else 'FAIL'))
            browser.close()
    finally:
        dist.terminate()
        fix.terminate()
    for f in r.failures:
        print(f'  {f}')
    sys.exit(1 if r.failures else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
