"""Scroll-sweep performance trace against dist/.

Usage: python3 test/e2e/perf.py [--cpu 1 4] [--runs 3] [--route home|control] [--assert] [--json PATH]
Run it without -I: it imports serve() and DIST from check.py next to it.
home sweeps the whole log top to bottom; control sweeps /about/ top to bottom, the floor
for this browser and host. Set PW_WS to use a remote Playwright.
"""
import argparse
import json
import os
import signal
import sys

from playwright.sync_api import sync_playwright

from check import DIST, connect, expect, serve
from tracing import CATEGORIES, SITE_PATH, SWEEP, metrics

# Resized 2026-11-26 (spec, Performance budgets): this host renders with SwiftShader, so dropped frames
# are information here; the gates are the numbers that don't depend on the GPU, at 1x CPU.
GATE_RATE = 1
MAX_SCRIPT_MS = 4.0
RUN_TIMEOUT = int(os.environ.get('PERF_RUN_TIMEOUT', '300'))  # a stalled remote browser fails the run, not the session


def run_once(browser, base, route, rate):
    pg = browser.new_page(viewport={'width': 1280, 'height': 800})
    try:
        pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        pg.route('**/fonts.gstatic.com/**', lambda r: r.abort())
        pg.goto(base + ('/' if route == 'home' else '/about/'))
        cdp = pg.context.new_cdp_session(pg)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
        pg.wait_for_load_state('load')
        pg.wait_for_timeout(500)
        browser.start_tracing(page=pg, categories=CATEGORIES)
        pg.evaluate(SWEEP, 12)
        trace = json.loads(browser.stop_tracing())
    finally:
        pg.close()
    expect('traceEvents' in trace, 'trace has no traceEvents')
    m = metrics(trace['traceEvents'])
    # an empty trace would pass every budget; refuse it
    expect(m['frames'] > 0, 'trace has no BeginFrame events')
    expect(route != 'home' or m['siteCalls'] > 0, f'no FunctionCall from {SITE_PATH} scripts in the trace')
    return m


def median(runs):
    """The run with the median dropped percent, whole, so printed numbers come from one run."""
    return sorted(runs, key=lambda r: r['droppedPct'])[len(runs) // 2]


class Stalled(Exception):
    pass


def _stalled(signum, frame):
    raise Stalled(f'stalled: a run took over {RUN_TIMEOUT} s (the remote browser stopped answering)')


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
    try:
        with sync_playwright() as p:
            browser = connect(p)
            try:
                signal.signal(signal.SIGALRM, _stalled)
                for rate in args.cpu:
                    runs = []
                    for _ in range(args.runs):
                        signal.alarm(RUN_TIMEOUT)
                        try:
                            runs.append(run_once(browser, base, args.route, rate))
                        finally:
                            signal.alarm(0)
                    m = median(runs)
                    results[rate] = m
                    print(f"{args.route} {rate}x: frames={m['frames']:.0f} dropped={m['dropped']:.0f} ({m['droppedPct']:.1f}%) "
                          f"forced={m['forced']:.0f} forcedInRaf={m['forcedInRaf']:.0f} forced_harness={m['forced_harness']:.0f} maxScript={m['maxScript']:.1f}ms scriptTotal={m['scriptTotal']:.0f}ms")
            finally:
                browser.close()
    finally:
        srv.shutdown()
    if args.json:
        with open(args.json, 'w') as f:
            json.dump({str(k): v for k, v in results.items()}, f, indent=2)
    # Gates (spec, Performance budgets, resized 2026-11-26): at 1x CPU, no site-forced layout and no site
    # script task over 4 ms. Dropped frames are printed above as information: this host renders in software.
    failed = []
    m = results.get(GATE_RATE)
    if args.check and args.route == 'home':
        expect(m is not None, f'--assert needs --cpu {GATE_RATE} in the run')
        if m['forcedInRaf'] != 0:
            failed.append(f"{GATE_RATE}x layouts forced inside animation frames {m['forcedInRaf']:.0f} != 0: {m['forcedBy']}")
        if m['maxScript'] > MAX_SCRIPT_MS:
            failed.append(f"{GATE_RATE}x maxScript {m['maxScript']:.1f}ms > {MAX_SCRIPT_MS}ms")
    if args.check and failed:
        print('FAIL ' + '; '.join(failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
