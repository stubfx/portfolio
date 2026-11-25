"""Scroll-sweep performance trace against dist/.

Usage: python3 test/e2e/perf.py [--cpu 1 4] [--runs 3] [--route home|control] [--assert] [--json PATH]
Run it without -I: it imports serve() and DIST from check.py next to it.
home sweeps the flight (first segment to the end of the configurator); control sweeps /about/
top to bottom, the floor for this browser and host. Set PW_WS to use a remote Playwright.
"""
import argparse
import bisect
import json
import statistics
import sys

from playwright.sync_api import sync_playwright

from check import DIST, connect, expect, serve

CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame']
BUDGET = {1: 2.0, 4: 10.0}  # max dropped %, by CPU rate
MAX_SCRIPT_MS = 4.0

SWEEP = '''([route, step]) => new Promise(done => {
  const seg = document.querySelector('.seg');
  const top = e => { let t = 0; for (; e; e = e.offsetParent) t += e.offsetTop; return t };
  const cfg = document.getElementById('seg-configurator-framework');
  const a = route === 'home' ? top(seg) - 0.5 * innerHeight : 0;
  const b = route === 'home' ? top(cfg) + cfg.offsetHeight + innerHeight : document.documentElement.scrollHeight;
  scrollTo(0, a);
  requestAnimationFrame(function tick() {
    if (scrollY >= b - 1 || scrollY >= document.documentElement.scrollHeight - innerHeight - 1) return done();
    scrollBy(0, step);
    requestAnimationFrame(tick);
  });
})'''


def metrics(events):
    """forced/maxScript/scriptTotal count the site's scripts (url under /assets/) only; layouts
    forced from the harness's own scroll driver are reported apart as forced_harness."""
    frames = sum(1 for e in events if e.get('name') == 'BeginFrame')
    dropped = sum(1 for e in events if e.get('name') == 'DroppedFrame')
    calls = [e for e in events if e.get('name') == 'FunctionCall' and e.get('ph') == 'X']
    by_thread = {}
    for e in sorted(calls, key=lambda e: e['ts']):
        by_thread.setdefault((e['pid'], e['tid']), []).append(e)
    starts = {k: [c['ts'] for c in cs] for k, cs in by_thread.items()}
    # running max of call end times lets the backwards scan stop once nothing earlier can contain a ts
    reach = {}
    for k, cs in by_thread.items():
        m, reach[k] = 0, []
        for c in cs:
            m = max(m, c['ts'] + c.get('dur', 0))
            reach[k].append(m)
    forced = forced_harness = 0
    for e in events:
        if e.get('name') in ('Layout', 'UpdateLayoutTree') and e.get('ph') == 'X':
            k = (e['pid'], e['tid'])
            cs = by_thread.get(k, [])
            i = bisect.bisect_right(starts.get(k, []), e['ts']) - 1
            while i >= 0 and reach[k][i] >= e['ts']:
                if cs[i]['ts'] + cs[i].get('dur', 0) >= e['ts']:
                    if is_site(cs[i]):
                        forced += 1
                    else:
                        forced_harness += 1
                    break
                i -= 1
    durs = [e.get('dur', 0) / 1000 for e in calls if is_site(e)]
    return {'frames': frames, 'dropped': dropped,
            'droppedPct': 100 * dropped / frames if frames else 0.0,
            'forced': forced, 'forced_harness': forced_harness,
            'maxScript': max(durs, default=0.0), 'scriptTotal': sum(durs)}


def is_site(call):
    return '/assets/' in (call.get('args', {}).get('data', {}).get('url') or '')


def run_once(browser, base, route, rate):
    pg = browser.new_page(viewport={'width': 1280, 'height': 800})
    pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    pg.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    pg.goto(base + ('/' if route == 'home' else '/about/'))
    cdp = pg.context.new_cdp_session(pg)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
    pg.wait_for_load_state('load')
    pg.wait_for_timeout(500)
    browser.start_tracing(page=pg, categories=CATEGORIES)
    pg.evaluate(SWEEP, [route, 12])
    events = json.loads(browser.stop_tracing())['traceEvents']
    pg.close()
    return metrics(events)


def median(runs):
    return {k: statistics.median(r[k] for r in runs) for k in runs[0]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cpu', type=int, nargs='+', default=[1, 4])
    ap.add_argument('--runs', type=int, default=3)
    ap.add_argument('--route', choices=['home', 'control'], default='home')
    ap.add_argument('--assert', dest='check', action='store_true')
    ap.add_argument('--json')
    args = ap.parse_args()
    expect(DIST.exists(), 'dist/ missing: run npm run build first')
    srv, base = serve()
    results = {}
    with sync_playwright() as p:
        browser = connect(p)
        for rate in args.cpu:
            m = median([run_once(browser, base, args.route, rate) for _ in range(args.runs)])
            results[rate] = m
            print(f"{args.route} {rate}x: frames={m['frames']:.0f} dropped={m['dropped']:.0f} ({m['droppedPct']:.1f}%) "
                  f"forced={m['forced']:.0f} forced_harness={m['forced_harness']:.0f} maxScript={m['maxScript']:.1f}ms scriptTotal={m['scriptTotal']:.0f}ms")
        browser.close()
    srv.shutdown()
    if args.json:
        with open(args.json, 'w') as f:
            json.dump({str(k): v for k, v in results.items()}, f, indent=2)
    failed = []
    for rate, m in results.items():
        budget = BUDGET.get(rate)
        if args.route == 'control':
            if budget is not None and m['droppedPct'] > budget:
                print(f"FLOOR: control drops {m['droppedPct']:.0f}% at {rate}x")
            continue
        if budget is not None and m['droppedPct'] >= budget:
            failed.append(f"{rate}x dropped {m['droppedPct']:.1f}% >= {budget}%")
        if m['forced'] != 0:
            failed.append(f"{rate}x forced layouts {m['forced']:.0f} != 0")
        if rate == 1 and m['maxScript'] > MAX_SCRIPT_MS:
            failed.append(f"1x maxScript {m['maxScript']:.1f}ms > {MAX_SCRIPT_MS}ms")
    if args.check and failed:
        print('FAIL ' + '; '.join(failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
