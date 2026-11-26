"""Trace helpers shared by perf.py and check.py: the scroll sweep, and what a trace says about the site's own scripts."""
import bisect

CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame']
SITE_PATH = '/assets/'  # script urls under this path are the site's own

SWEEP = '''step => new Promise(done => {
  scrollTo(0, 0);
  requestAnimationFrame(function tick() {
    if (scrollY >= document.documentElement.scrollHeight - innerHeight - 1) return done();
    scrollBy(0, step);
    requestAnimationFrame(tick);
  });
})'''


def spans(events, name):
    """Per thread, the sorted (start, end) of every complete event with this name."""
    out = {}
    for e in events:
        if e.get('name') == name and e.get('ph') == 'X':
            out.setdefault((e['pid'], e['tid']), []).append((e['ts'], e['ts'] + e.get('dur', 0)))
    return {k: sorted(v) for k, v in out.items()}


def inside(span_list, ts):
    i = bisect.bisect_right(span_list, (ts, float('inf'))) - 1
    return i >= 0 and span_list[i][0] <= ts <= span_list[i][1]


def metrics(events):
    """forced/maxScript/scriptTotal count the site's scripts (url under /assets/) only; layouts
    forced from the harness's own scroll driver are reported apart as forced_harness.

    forcedInRaf is the gate: layouts forced from site code inside animation-frame callbacks, the write
    phase, where a read lands after this frame's writes (thrash). A read in an event handler (scroll)
    comes before any write of its frame and only moves work the frame does anyway."""
    raf = spans(events, 'FireAnimationFrame')
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
    forced = forced_harness = forced_in_raf = 0
    forced_by = {}
    for e in events:
        if e.get('name') in ('Layout', 'UpdateLayoutTree') and e.get('ph') == 'X':
            k = (e['pid'], e['tid'])
            cs = by_thread.get(k, [])
            i = bisect.bisect_right(starts.get(k, []), e['ts']) - 1
            while i >= 0 and reach[k][i] >= e['ts']:
                if cs[i]['ts'] + cs[i].get('dur', 0) >= e['ts']:
                    if is_site(cs[i]):
                        forced += 1
                        forced_in_raf += inside(raf.get(k, []), e['ts'])
                        d = cs[i].get('args', {}).get('data', {})
                        where = f"{e['name']} in {(d.get('url') or '').rsplit('/', 1)[-1]}:{d.get('lineNumber', '?')} {d.get('functionName') or '(anonymous)'}"
                        forced_by[where] = forced_by.get(where, 0) + 1
                    else:
                        forced_harness += 1
                    break
                i -= 1
    durs = [e.get('dur', 0) / 1000 for e in calls if is_site(e)]
    return {'siteCalls': len(durs), 'frames': frames, 'dropped': dropped,
            'droppedPct': 100 * dropped / frames if frames else 0.0,
            'forced': forced, 'forcedInRaf': forced_in_raf, 'forced_harness': forced_harness,
            'forcedBy': dict(sorted(forced_by.items(), key=lambda kv: -kv[1])),
            'maxScript': max(durs, default=0.0), 'scriptTotal': sum(durs)}


def is_site(call):
    return SITE_PATH in (call.get('args', {}).get('data', {}).get('url') or '')
