# Fluid Flight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page's slide-like cover transitions with overlapping, continuously moving choreography (aperture from the planet, copy that only fades, shared stars, graph behind covers) and make it measurably jank-free.

**Architecture:** All timing lives in one pure module (`src/client/choreo.mjs`) that maps a segment's scroll progress to per-element values; it is unit-tested, including the no-empty-frame invariant. A single frame loop (`src/client/loop.js`) runs measure (on resize/fonts only), then read, then write for every subsystem, so no frame forces layout. Cover markup gains an aperture wrapper, a separate copy layer and a planet layer positioned with container-query units; flight, stars and graph join the loop and write only `transform` and `opacity`.

**Tech Stack:** Node 22 built-ins (`node:test`), vanilla ES modules and CSS; Python Playwright 1.64.1 + Pillow (venv outside the repo) driving the host's Chromium 156 over `ws://172.29.160.1:3333/`.

**Spec:** `docs/superpowers/specs/2026-11-25-fluid-flight-design.md` (extends `docs/superpowers/specs/2026-11-25-portfolio-design.md`).

## Global Constraints

- Version control with `gitt` (alias for git), branch `feat/fluid-flight`, **local commits only, never push**. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Zero npm dependencies; home JS under 25 KB gzipped (`node scripts/budget.mjs dist`).
- Per frame, write only `transform` and `opacity` (plus `will-change` class toggles when a segment enters or leaves its active range). Layout reads happen only in `measure`.
- Native scroll only. No wheel or touch handlers that change scrolling.
- Cover copy (meta line, title, lede, land link, backing pool) animates opacity only: never scales, translates or moves in depth, in any phase, at any viewport.
- Log rows fade with at most a 3vh vertical drift; no depth, no zoom.
- `prefers-reduced-motion: reduce`: no aperture growth, no drift, no stagger movement, stars static; covers and logs crossfade.
- Contrast: the build's palette check and the e2e `cover-contrast` check pass at 844×390, 1280×800 and 390×844.
- Performance budgets (`test/e2e/perf.py --assert`, median of 3 runs, sweep log → cover → cover → log at 1280×800): dropped frames under 2% at 1× CPU and under 10% at 4×; zero forced layouts; no script task over 4 ms at 1×.
- Copy text in the site has no em dashes.
- Browser environment for every e2e step:

  ```sh
  VENV=/tmp/claude-1000/-home-luca-porcofolio-portfolio-public/5cc2a8f6-3d49-429b-8db5-af58c9c94b2f/scratchpad/venv
  PY=$VENV/bin/python      # if missing: python3 -m venv $VENV && $VENV/bin/pip install playwright==1.64.1 pillow
  export PW_WS=ws://172.29.160.1:3333/
  npm run build && $PY test/e2e/check.py            # all checks; append names to run some
  ```

  Luca watches `http://172.29.169.57:8080/` (miniserve over `dist/`; restart with `miniserve dist --index index.html -i 0.0.0.0 -p 8080` from the repo root if it is down). Every `npm run build` updates what he sees.

## Review Focus

- Resizing or rotating mid-cover must re-measure the aperture, the planet focal point and every cached position; the aperture must still cover all four corners at dwell (Task 5, `resize-mid-cover`).
- Reloading or restoring the page mid-transition must paint the correct state on the first frame, before any scroll (Task 5, `reload-mid-transition`).
- Jumps that skip whole segments in one frame (End, Home, `G`, `gg`, hash links) must leave every other segment at rest: no half-open aperture, no faded row (Task 5, `jump-clean`).
- Late font swaps or any reflow after the first measure must trigger a re-measure, so cached positions never go stale (Task 5, `fonts-reflow`).
- Real-art covers whose image fails to load, or with no planet layer, must still open from `cover.origin` without script errors (Task 4, fixture `broken-image`).

---

### Task 1: Browser tooling on the host's Playwright

**Files:**
- Modify: `test/e2e/check.py` (`main`)
- Create: `test/e2e/perf.py`, `test/e2e/strip.py`
- Modify: `README.md` ("Run it"), `package.json` (scripts `perf`, `strip`)

**Interfaces:**
- Produces: `PW_WS` env var honoured by all three scripts; `perf.py` CLI `--cpu 1 4 --runs 3 --route home|control --assert --json PATH`; `strip.py` CLI `--out DIR --video`. Both import `serve()` and `DIST` from `check.py` (same directory; run them without `-I`).

- [ ] **Step 1: Make `check.py` connect when `PW_WS` is set**

In `main`: `browser = p.chromium.connect(os.environ['PW_WS'], expose_network='<loopback>')` when `PW_WS` is set, else the current `launch`. The `base_path` check's second server is on 127.0.0.1 too, so `<loopback>` covers it.

- [ ] **Step 2: Run the suite against the host**

Run: `npm run build && $PY test/e2e/check.py`
Expected: 17 `ok` lines, `17 checks, 0 failed`.

- [ ] **Step 3: Write `perf.py`**

Sweep: 1280×800, `Emulation.setCPUThrottlingRate` via `context.new_cdp_session(page)`, wait for load + 500 ms, `browser.start_tracing(page=page, categories=['devtools.timeline', 'disabled-by-default-devtools.timeline.frame'])`, then an in-page `requestAnimationFrame` loop doing `scrollBy(0, 12)` from `top(first .seg) - 0.5*innerHeight` to `top(#seg-configurator-framework) + its offsetHeight + innerHeight`. Route `control` sweeps `/about/` top to bottom instead (the floor for this browser and host).

Metrics from the trace events:
- `frames` = count of `BeginFrame`; `dropped` = count of `DroppedFrame`; report `dropped / frames` as a percent.
- `forced` = `Layout` or `UpdateLayoutTree` events whose `ts` falls inside a `FunctionCall` event's `[ts, ts + dur]` on the same `pid`/`tid`.
- `maxScript` = longest `FunctionCall` `dur` in ms; `scriptTotal` = sum.

Print one line per CPU rate (median of `--runs`). With `--assert`, exit 1 unless: 1× dropped < 2%, 4× dropped < 10%, `forced == 0`, 1× `maxScript <= 4`. If the `control` route's own dropped percent is above a budget, print `FLOOR: control drops N% at Rx` so the budget can't silently be blamed on the site.

- [ ] **Step 4: Record the baseline**

Run: `npm run build && $PY test/e2e/perf.py --cpu 1 4 --runs 3` and `... --route control`
Expected: home roughly 28% dropped at 1× and 59% at 4×, forced > 0 (today's site). Paste both outputs into the commit message body.

- [ ] **Step 5: Write `strip.py`**

For each viewport `(1280, 800)` and `(390, 844)` and each transition:
- `log-cover-log`: agentic, from its top minus 0.5 vh to its end plus 0.5 vh.
- `cover-cover`: BA's p = 0.6 to configurator's p = 0.45.
- `cover-log`: configurator's p = 0.6 to its end plus 0.8 vh.

Capture 24 evenly spaced frames (wait 250 ms each), tile 6×4 with Pillow at 1/4 scale, and label each frame with its index and the active segment's `p`. Save as `<out>/<transition>-<w>.png` (default out `test/e2e/shots/strips`, gitignored). `--video` records a WebM of a steady scroll through the whole home page at 1280×800 (`record_video_dir`, saved with `page.video.save_as`).

- [ ] **Step 6: Run it**

Run: `$PY test/e2e/strip.py --video`
Expected: 6 PNG sheets plus `home-1280.webm` in `test/e2e/shots/strips/`. Open two sheets with the Read tool to confirm they're legible.

- [ ] **Step 7: Document and commit**

README "Run it": the venv recipe, `PW_WS`, `perf.py`, `strip.py`. `package.json`: `"perf": "python3 test/e2e/perf.py"`, `"strip": "python3 test/e2e/strip.py"`.

```bash
gitt add test/e2e/check.py test/e2e/perf.py test/e2e/strip.py README.md package.json
gitt commit -m "test: run browser checks on a remote Playwright, add perf trace and frame strips" -m "<baseline numbers>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Choreography maths

**Files:**
- Create: `src/client/choreo.mjs`
- Test: `test/choreo.test.mjs`

**Interfaces:**
- Produces (all pure, no DOM):
  - `TRACKS`: frozen object with `prevOut [0, .26]`, `ap [.04, .30]`, `groundIn [.04, .30]`, `groundOut [.82, 1]`, `planetIn [.06, .40]`, `copyIn [.18, .36]`, `copyOut [.74, .86]`, `fill [.80, 1]`, `planetOut [.78, 1]`, `nextIn [.84, 1]`, and `reduced: { prevOut [0, .12], coverIn [0, .12], coverOut [.88, 1], nextIn [.88, 1] }`.
  - `clamp(v, a = 0, b = 1)`, `span(p, [a, b])` → `clamp((p - a) / (b - a))`, cubic `easeInOut(t)`, `easeOut(t)`, `easeIn(t)`.
  - `progressAt(scrollY, top, height, vh): number`: unclamped `(scrollY - top) / (height - vh)`; when `height <= vh`, `scrollY >= top ? 1 : 0`.
  - `coverFrame(p, { reduced = false, compact = false, chainPrev = false, chainNext = false } = {}): CoverFrame` where `CoverFrame = { ap, ring, fill, ground, graph, planet: { s, o, drift, out }, word, copy: [meta, title, lede, land], pool, live, current, visible }`, all numbers rounded to 3 decimals.
  - `rowFrame(p, i, n, side: 'out' | 'in', { reduced = false } = {}): { o, y }` (`y` in vh).
  - `holdOffset(p, run): number` px, `(p - 1) * run` when `p > 1`, else 0, rounded to 2 decimals.
  - Every number these functions return is rounded (3 decimals unless stated) and never `-0` (`Math.round(v * 1000) / 1000 + 0`).
  - `chainFill(nextAp): number` = `1 - nextAp`.
  - `presence(p, opts): number` = max of outgoing rows (n = 3), cover (`max(copy)` or `ap * fill`) and incoming rows (n = 3). On a chained side the neighbouring cover counts instead of rows: with `chainPrev` the previous cover adds `chainFill(ap)`; with `chainNext` nothing extra is needed because `fill` stays 1 through p = 1.
  - `apertureGeometry(ox, oy, w, h): { R, x, y, d }`: `R` = distance to the farthest corner + 2; `x = ox - R`, `y = oy - R`, `d = 2R`.
  - `apertureTransforms(ap, geo): { outer, inner, ring, show }`: `s = max(ap, 0.001)`, `outer = ring = 'scale(s)'`, `inner = 'scale(1/s)'`, `show = ap > 0.001`.
  - `planetTransform(planet, { cx, cy, w, h }): string`.
  - `isCurrent(p)`: `p >= TRACKS.copyIn[0] && p <= TRACKS.copyOut[1]`.

Values `coverFrame` must produce (non-reduced):
- `ap = easeInOut(span(p, ap))`; `ring = min(span(p, [.04, .08]), 1 - span(ap, [.8, 1]))`.
- `fill = chainNext ? 1 : 1 - easeInOut(span(p, fill))`.
- `ground`: 1 when `chainPrev && p < .5` or `chainNext && p >= .5`; otherwise `easeInOut(span(p, groundIn))` for `p < .5` and `1 - easeInOut(span(p, groundOut))` after.
- `graph = 1 - ap * fill`.
- `planet.s = lerp(compact ? .7 : .55, 1, easeOut(span(p, planetIn)))`; `planet.o = easeOut(span(p, planetIn)) * (1 - span(p, [.94, 1]))`; `planet.drift = lerp(1, -1, clamp(p))` (linear); `planet.out = easeIn(span(p, planetOut))`.
- `word = lerp(1, -1, clamp(p))` (linear).
- `copy[k] = min(easeInOut(span(p, [.18 + .03k, .27 + .03k])), 1 - easeInOut(span(p, [.74 + .02k, .80 + .02k])))` for k = 0..3.
- `pool = max(copy)`; `live = copy[3] > .5`; `current = isCurrent(p)`; `visible = ap > 0 || pool > 0`.

Reduced: `fade = min(span(p, coverIn), 1 - span(p, coverOut))`; `ap = fade > 0 ? 1 : 0`, `fill = copy[k] = pool = planet.o = fade`, `planet.s = 1`, `drift = out = word = ring = 0`, `ground = fade` (1 on a chained side as above), `graph = 1 - fade`.

`rowFrame`: `out`: duration `.14`, row `i` starts at `i * (.26 - .14) / max(1, n - 1)`; `o = 1 - easeInOut(t)`, `y = -3 * easeIn(t)`. `in`: duration `.10`, starts at `.84 + i * .06 / max(1, n - 1)`; `o = easeInOut(t)`, `y = 3 * (1 - easeOut(t))`. Reduced: `out` `o = 1 - span(p, [0, .12])`, `in` `o = span(p, [.88, 1])`, `y = 0`.

`planetTransform`: `tx = drift * .015 * w`, `ty = drift * .01 * h`; direction = unit vector from `(w/2, h/2)` to `(cx, cy)` (use `(1, -.3)` normalised if zero); `dist = out * .35 * max(w, h)`; `scale = s * (1 + .9 * out)`; returns `translate3d(Xpx, Ypx, 0) scale(S)` with 2-decimal numbers.

- [ ] **Step 1: Write the failing tests**

```js
// test/choreo.test.mjs
import { TRACKS, span, progressAt, coverFrame, rowFrame, holdOffset, chainFill, presence,
  apertureGeometry, apertureTransforms, planetTransform, isCurrent } from '../src/client/choreo.mjs';

const steps = (a, b, d = 0.005) => Array.from({ length: Math.round((b - a) / d) + 1 }, (_, i) => +(a + i * d).toFixed(4));

test('no empty frame: something is always on screen', () => {
  for (const opts of [{}, { chainPrev: true }, { chainNext: true }, { reduced: true }, { compact: true }])
    for (const p of steps(0, 1)) assert.ok(presence(p, opts) >= 0.5, `${JSON.stringify(opts)} p=${p}: ${presence(p, opts)}`);
});
test('chained covers hand over without a gap', () => {
  for (const p of steps(0, 0.4)) { const ap = coverFrame(p, { chainPrev: true }).ap; assert.ok(Math.max(ap, chainFill(ap)) >= 0.5); }
  assert.equal(coverFrame(0.95, { chainNext: true }).fill, 1);
});
test('copy only fades, in order, and holds still in the middle', () => {
  const f = coverFrame(0.55);
  assert.deepEqual(f.copy, [1, 1, 1, 1]); assert.equal(f.pool, 1); assert.equal(f.live, true);
  const a = coverFrame(0.23).copy; assert.ok(a[0] > a[1] && a[1] > a[2] && a[2] >= a[3]);
  const b = coverFrame(0.79).copy; assert.ok(b[0] < b[1] && b[1] < b[2] && b[2] <= b[3]);
  assert.deepEqual(coverFrame(0.1).copy, [0, 0, 0, 0]); assert.deepEqual(coverFrame(0.9).copy, [0, 0, 0, 0]);
  assert.equal(coverFrame(0.3).live, false); assert.equal(coverFrame(0.4).live, true);
  for (const p of steps(0, 1, 0.05)) assert.ok(coverFrame(p).copy.every((v) => typeof v === 'number' && v >= 0 && v <= 1)); // opacities only, no positions
});
test('aperture opens with the planet and the graph fades with it', () => {
  assert.equal(coverFrame(0.02).ap, 0); assert.equal(coverFrame(0.3).ap, 1);
  assert.equal(coverFrame(0).graph, 1); assert.equal(coverFrame(0.55).graph, 0); assert.equal(coverFrame(1).graph, 1);
  assert.ok(coverFrame(0.17).graph > 0 && coverFrame(0.17).graph < 1);
  assert.equal(coverFrame(0.55).fill, 1); assert.equal(coverFrame(1).fill, 0);
});
test('background never stops moving', () => {
  const d = steps(0, 1, 0.1).map((p) => coverFrame(p).planet.drift);
  for (let i = 1; i < d.length; i++) assert.ok(d[i] < d[i - 1]);
  assert.ok(coverFrame(0.5).word < coverFrame(0.4).word);
});
test('rows leave and arrive top first, never zoom', () => {
  assert.ok(rowFrame(0.1, 0, 3, 'out').o < rowFrame(0.1, 2, 3, 'out').o);
  assert.ok(rowFrame(0.9, 0, 3, 'in').o > rowFrame(0.9, 2, 3, 'in').o);
  assert.deepEqual(rowFrame(0, 1, 3, 'out'), { o: 1, y: 0 }); assert.deepEqual(rowFrame(1, 2, 3, 'in'), { o: 1, y: 0 });
  for (const p of steps(0, 1, 0.05)) for (const side of ['out', 'in']) assert.ok(Math.abs(rowFrame(p, 1, 3, side).y) <= 3);
});
test('reduced motion has no growth, drift or movement', () => {
  for (const p of steps(0, 1, 0.05)) {
    const f = coverFrame(p, { reduced: true });
    assert.ok(f.ap === 0 || f.ap === 1); assert.equal(f.planet.drift, 0); assert.equal(f.planet.out, 0);
    assert.equal(f.word, 0); assert.equal(f.planet.s, 1); assert.equal(rowFrame(p, 1, 3, 'out', { reduced: true }).y, 0);
  }
});
test('geometry and transforms', () => {
  assert.deepEqual(apertureGeometry(0, 0, 300, 400), { R: 502, x: -502, y: -502, d: 1004 });
  const t = apertureTransforms(0.5, apertureGeometry(100, 100, 300, 400));
  assert.equal(t.outer, 'scale(0.5)'); assert.equal(t.inner, 'scale(2)'); assert.equal(t.show, true);
  assert.equal(apertureTransforms(0, apertureGeometry(1, 1, 2, 2)).show, false);
  assert.match(planetTransform({ s: 1, o: 1, drift: 0, out: 1 }, { cx: 900, cy: 200, w: 1000, h: 800 }), /scale\(1\.9\)$/);
  const far = planetTransform({ s: 1, o: 1, drift: 0, out: 1 }, { cx: 900, cy: 400, w: 1000, h: 800 });
  assert.match(far, /^translate3d\(350px, 0px, 0\)/);
  assert.equal(progressAt(1000, 500, 2400, 800), 0.3125); assert.equal(holdOffset(1.1, 1600), 160); assert.equal(holdOffset(0.9, 1600), 0);
  assert.equal(isCurrent(0.17), false); assert.equal(isCurrent(0.55), true);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/choreo.test.mjs`
Expected: FAIL, cannot find module `../src/client/choreo.mjs`.

- [ ] **Step 3: Implement `src/client/choreo.mjs`** with the exports and values above.

If `no empty frame` fails, move `TRACKS` windows (never the 0.5 threshold) and update the spec's timeline table in the same commit.

- [ ] **Step 4: Run to see them pass**

Run: `node --test test/choreo.test.mjs && npm test`
Expected: all pass (old `phases` tests still pass; `phases.mjs` is untouched until Task 5).

- [ ] **Step 5: Commit**

```bash
gitt add src/client/choreo.mjs test/choreo.test.mjs
gitt commit -m "feat: choreography maths with a no-empty-frame invariant" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The planet on every screen, and a softer copy backing

**Files:**
- Modify: `src/build/cover.mjs` (split `generative` into `plate(p, id, { stars })` and `planetLayer(p, id)`; add `planetGeometry(hash)`)
- Modify: `src/styles/cover.css` (`.cover` container, `.l-planet` placement, `.cv-pool`)
- Test: `test/cover.test.mjs` (create), `test/build.test.mjs`, `test/e2e/check.py` (`planet-on-screen`)

**Interfaces:**
- Produces: `planetGeometry(hash: string): { land: { cx, cy, rad, tilt }, port: { x, y, r } }`. `land` uses the same seeded draws, in the same order, as today's `generative()` (first four `r()` calls), so landscape placement does not move. `port` uses its own generator `seeded(hash + ':port')`: `x` 55–80, `y` 18–32 (percent of the cover), `r` 26–38 (percent of the cover's width).
- Produces markup (every mode): `<div class="layer l-planet" data-role="planet" style="--cx:…;--cy:…;--rad:…;--tilt:…deg;--px:…;--py:…;--pr:…"><svg …>sphere + orbit</svg></div>` after the plate. `--cx`/`--cy` are offsets from the plate centre (`cx - 80`, `cy - 45`). The plate keeps stars only when `stars` is true.
- Produces markup: `.cv-copy` gets a first child `<i class="cv-pool" aria-hidden="true"></i>` replacing the `::before` pool.

CSS decisions:
- `.cover { container: cover / size; }`.
- `.l-planet`: `--u: max(calc(100cqw / 160), calc(100cqh / 90))`, radius `calc(var(--rad) * var(--u))`, centre `left: min(calc(50cqw + var(--cx) * var(--u)), calc(100cqw - 1.1 * radius))`, `top: calc(50cqh + var(--cy) * var(--u))`. This reproduces today's slice placement on landscape.
- `@container cover (aspect-ratio < 1)`: centre `var(--px)` cqw / `var(--py)` cqh, radius `var(--pr)` cqw.
- Centre the SVG with left/top/margins, **not** a transform: Task 5 writes `transform` on this layer.
- `.cv-pool`: an oversized element behind the copy with a soft radial or elliptical feather of `var(--p-bg)`, solid under the text and fading over at least 220 px. No hard straight edge anywhere.

- [ ] **Step 1: Write the failing tests**

```js
// test/cover.test.mjs
test('planet geometry: landscape unchanged, portrait in range, deterministic', () => {
  const g = planetGeometry('7be2104');
  assert.deepEqual(g, planetGeometry('7be2104'));
  for (const h of ['a3f9c1e', '4d01c9a', '7be2104', 'b3e0f17']) {
    const { land, port } = planetGeometry(h);
    assert.ok(land.cx >= 96 && land.cx <= 136 && land.rad >= 14 && land.rad <= 24);
    assert.ok(port.x >= 55 && port.x <= 80 && port.y >= 18 && port.y <= 32 && port.r >= 26 && port.r <= 38);
  }
});
test('every cover mode has a planet layer; seg plate has no stars', () => {
  for (const mode of ['seg', 'hero', 'card']) assert.match(renderCover(fixture, { mode }), /class="layer l-planet" data-role="planet"/);
  assert.match(renderCover(fixture, { mode: 'card' }), /<circle cx=[^>]+opacity=/);
  assert.match(renderCover(fixture, { mode: 'seg' }), /class="cv-pool" aria-hidden="true"/);
});
```

Also add to `test/build.test.mjs` (`home structure is semantic`): `assert.match(html, /--px:\d/)`.

In `check.py`, `planet-on-screen`: for viewports `(1280,800) (390,844) (360,740) (844,390) (1024,1366) (1366,1024) (1000,900)`, at home mid-dwell (`seg_scroll(pg, slug, 0.55)`) for every slug, on `/projects/<slug>/`, and for every card on `/work/`: the sphere's box (`.l-planet svg circle[fill^="url"]`, `getBoundingClientRect`) overlaps its cover's box by at least 60% of its area.

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/cover.test.mjs` → FAIL (`planetGeometry` not exported). Run: `npm run build && $PY test/e2e/check.py planet-on-screen` → FAIL at 390×844 (planet off screen).

- [ ] **Step 3: Implement** the split, `planetGeometry`, the markup and the CSS above. Remove `.cv-copy::before`.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run build && $PY test/e2e/check.py`
Expected: all pass, including `planet-on-screen` and `cover-contrast` at all three of its viewports.

- [ ] **Step 5: Look at it**

Screenshot home mid-dwell, `/projects/configurator-framework/` and `/work/` at 1280×800 and 390×844 (use `strip.py` or a short script) and Read them. The planet must sit in the upper part of portrait screens, and the copy backing must show no straight edge across the planet. Fix and repeat until both hold.

- [ ] **Step 6: Commit**

```bash
gitt add src/build/cover.mjs src/styles/cover.css test/cover.test.mjs test/build.test.mjs test/e2e/check.py
gitt commit -m "feat: planet layer on screen at every aspect ratio, soft copy backing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cover structure: aperture, copy layer, star slots, art roles

**Files:**
- Modify: `src/build/cover.mjs`, `src/styles/cover.css`, `src/build/timeline.mjs` (validate `cover.origin`), `scripts/build.mjs` (`contentDir`, `publicDir` options)
- Create: `test/fixtures/layered/log.mjs`, `test/fixtures/layered/about.md`, `test/fixtures/layered/projects/{layered,single,broken-image}.md`, `test/fixtures/layered/public/media/layered/{back,mid,front}.svg`, `test/fixtures/layered/public/media/single/sky.svg`
- Test: `test/build.test.mjs`, `test/timeline.test.mjs`, `test/e2e/check.py` (`layered-fixture`)

**Interfaces:**
- Consumes: Task 3's `planetLayer`, `plate`.
- Produces markup (every mode):

  ```html
  <div class="cover" style="view-transition-name:…" data-ox="…" data-oy="…">  <!-- origin %, only when cover.origin is set -->
    <div class="ap" aria-hidden="true"><div class="ap-in">
      sky: plate (generative) | first art layer | video     (data-role="sky")
      <div class="layer l-stars"><i class="st s0"></i><i class="st s1"></i><i class="st s2"></i></div>   (seg mode only)
      planet layer (generative) | middle art layers (data-role="mid") | last art layer (data-role="planet")
      word layer
    </div></div>
    <i class="ap-ring" aria-hidden="true"></i>                                  (seg mode only)
    <div class="l-front"> corners + .cv-copy: .cv-pool, then .cp pieces: meta, title, lede, land </div>
  </div>
  ```

  For art covers, stars sit before the first art layer (beneath all art). With one layer it is the sky.
- Produces CSS: `.ap-ring` is a circle with the aperture's geometry, `border: calc(1px / .4) solid var(--p-accent)`, scaled together with the aperture. It is transform-only, so its line reads about 1 px around 40% open, thinner before and thicker only once it is off screen. Its opacity comes from `ring`; it is hidden in hero and card modes.
- Produces CSS: by default `.ap` is `position: absolute; inset: 0`, with no rounding and no transform (fully open). That keeps the no-JS page, the project hero and the cards identical. `.ap.live` (set by Task 5) is the round wrapper (`border-radius: 50%; overflow: hidden`) with geometry from inline px. `.ap-in` carries `background: var(--p-bg)`; `.cover` has no background. `.l-front` and `.cp` have no transforms in any rule (the old `--dwell` parallax on `.layer` no longer applies to `.l-front`).
- Produces: `build({ outDir, base, contentDir = join(ROOT, 'content'), publicDir = join(ROOT, 'public') })`; `log.mjs` is loaded with a dynamic `import(pathToFileURL(join(contentDir, 'log.mjs')))`.
- Produces: `loadProjects` rejects `cover.origin` unless it is two numbers in 0–100: `Project "<slug>": cover.origin must be [x, y] in 0–100`.

Fixture: one `main` branch, three project commits separated by slim commits. `layered` uses `layers: [/media/layered/back.svg, /media/layered/mid.svg, /media/layered/front.svg]` and `origin: [30, 40]`. `single` uses `image: /media/single/sky.svg`. `broken-image` uses `image: /media/missing.webp` and no origin. The SVGs are hand-written: `back` is a half-transparent gradient (so stars show through), `mid` and `front` are transparent with one shape each. All fixture palettes must pass the contrast gate.

- [ ] **Step 1: Write the failing tests**

```js
// test/build.test.mjs
test('cover structure: aperture, copy pieces outside it, star slots on home only', async () => {
  const html = await page('index.html');
  const seg = html.slice(html.indexOf('id="seg-configurator-framework"'));
  assert.match(seg, /<div class="ap" aria-hidden="true"><div class="ap-in">/);
  assert.match(seg, /<\/div><\/div><i class="ap-ring" aria-hidden="true"><\/i><div class="layer l-front"/);
  assert.equal(seg.slice(0, seg.indexOf('</section>')).match(/class="cp[ "]/g).length, 4);
  assert.match(seg, /class="layer l-stars"><i class="st s0"><\/i><i class="st s1"><\/i><i class="st s2"><\/i>/);
  assert.doesNotMatch(await page('projects/ba-art-direction/index.html'), /l-stars|ap-ring/);
});
test('fixture: art layers take roles in order, stars beneath art', async () => {
  const out = mkdtempSync(join(tmpdir(), 'site-fx-'));
  await build({ outDir: out, contentDir: 'test/fixtures/layered', publicDir: 'test/fixtures/layered/public' });
  const html = await readFile(join(out, 'index.html'), 'utf8');
  const seg = html.slice(html.indexOf('id="seg-layered"'), html.indexOf('</section>', html.indexOf('id="seg-layered"')));
  assert.match(seg, /data-ox="30" data-oy="40"/);
  assert.ok(seg.indexOf('l-stars') < seg.indexOf('data-role="sky"'));
  assert.ok(seg.indexOf('data-role="sky"') < seg.indexOf('data-role="mid"') && seg.indexOf('data-role="mid"') < seg.indexOf('data-role="planet"'));
});
```

```js
// test/timeline.test.mjs
test('cover.origin is validated', () => {
  // write a temp project with origin [120, 5] → loadProjects throws /cover\.origin must be \[x, y\] in 0–100/
  // and with origin [30, 40] → loads, cover.origin deep-equals [30, 40]
});
```

In `check.py`, `layered-fixture`: build the fixture into a temp dir (as `base_path` does) and serve it. At 1280×800, with no page errors other than the one 404 for `missing.webp`, each cover reaches `ap == 1` mid-dwell (Task 5's state API; until Task 5 exists, only assert it renders with no script errors). Task 5 extends this check.

- [ ] **Step 2: Run to see them fail**

Run: `npm test` → the new build/timeline tests FAIL.

- [ ] **Step 3: Implement** the markup, CSS defaults, `contentDir`/`publicDir`, origin validation, fixture files.

- [ ] **Step 4: Run everything, including today's flight**

Run: `npm test && npm run build && $PY test/e2e/check.py`
Expected: all pass. The old `flight.js` still drives `.cover` opacity and transform, so behaviour is unchanged. Screenshot hero and card at 1280 and 390 and Read them: they must look as they did after Task 3.

- [ ] **Step 5: Commit**

```bash
gitt add -A src/build src/styles/cover.css scripts/build.mjs test
gitt commit -m "feat: cover structure with aperture, separate copy layer, star slots and art roles" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: One frame loop, and the new flight

**Files:**
- Create: `src/client/loop.js`, `test/loop.test.mjs`
- Rewrite: `src/client/flight.js`
- Modify: `src/client/main.js`, `src/client/graph.js` (imports only: `progressAt`, `isCurrent` from `choreo.mjs`; its `dwellIndex` uses `isCurrent`), `src/styles/log.css` (`#graph { z-index: 3 }`), `src/styles/cover.css` (`.seg.on` and `.row.mv` promotion, `.l-front` pointer events, `.ap.live`)
- Delete: `src/client/phases.mjs`, `test/phases.test.mjs`
- Test: `test/e2e/check.py`

**Interfaces:**
- Consumes: Task 2's `choreo.mjs`; Task 4's markup.
- Produces: `createLoop(win, doc): Loop` with `Loop = { add(part), schedule(), invalidate(), frame() }`.
  - `part = { measure?(ctx), read?(ctx), write?(ctx) }`; `ctx = { y, vw, vh, reduced, compact, docH }`, with `compact = vw < 600`.
  - Inside one `requestAnimationFrame`: when invalidated, every `measure`; then every `read`; then every `write`.
  - Invalidates on: `resize`, `orientationchange`, `pageshow`, `load`, `hashchange`, `document.fonts.ready`, a `ResizeObserver` on `.page`, and the reduced-motion media change.
  - Schedules on: `scroll` (passive).
  - `frame()` runs one synchronously (for focus handling and first paint).
- Produces: `startFlight(loop, doc): { state(): FlightState } | null`. `FlightState = { ground, graph, segs: [{ slug, p, ap, fill, copy, live, hold, current, show }] }`, holding the values written in the last frame.
- Produces: `window.__site = { graph, flight, loop }`.

Flight behaviour:
- **measure:**
  - For every `.seg`: layout top (offsetTop chain), height, run (`height - vh`), chain flags (neighbour is a `.seg`), focal point and planet centre.
    - Focal point: the `[data-role=planet]` sphere centre from `offsetLeft`/`offsetTop`/`offsetWidth`/`offsetHeight` within the cover, or `data-ox`/`data-oy` percentages, or the cover centre.
    - Then `apertureGeometry`. Write `.ap.live` left/top/width/height, `.ap-in` left/top (`-geo.x`, `-geo.y`), width/height (`vw`, `vh`) and transform-origin (`ox`, `oy`), and `.ap-ring` geometry. These are measure-time writes, done after all measure reads.
  - For each log section next to a segment: the rows (`.row`) whose layout top lies in that segment's overlap screen, in order.
- **write** (per segment with `p` in [-0.6, 1.6], else rest state once):
  - `coverFrame(p, { reduced, compact, chainPrev, chainNext })`.
  - `.ap`, `.ap-in`, `.ap-ring` transforms from `apertureTransforms`; ring opacity; `.ap` opacity 0 when `!show`.
  - `.ap-in` opacity = `fill`, or `chainFill(next.ap)` while held.
  - Planet-role layer: transform from `planetTransform`, opacity `planet.o`. `.l-word` translateX(`word * 3`%).
  - Each `.cp` opacity = `copy[k]`, `.cv-pool` opacity = `pool`, `.l-front` `pointer-events` via the `.live` class.
  - Rows: `rowFrame` opacity and `translate3d(0, y vh, 0)`, `.mv` class while `0 < o < 1`; the whole log section at opacity 0 once all its rows are out (so rows above the overlap screen never flash).
  - `.stage` transform `translate3d(0, holdOffset(p, run) px, 0)` for a chained previous cover while the next cover's `ap < 1`, then cleared and hidden.
  - `.seg.on` while in range.
  - `.cover` opacity 1 while `visible`, else 0. CSS keeps `.js .seg .cover { opacity: 0 }` for the moment before the script runs, and the 4 s no-JS fallback still shows plain covers.
  - `#ground` opacity = max ground; `#graph` opacity = min graph over visible segments; video play/pause on `show && fill > 0` (and paused under reduced).
- **Focus reveal** keeps its rules, with cached metrics: a focus target in a cover at `p < .36` or `p > .74` scrolls to `p = .55`; a focus target in a faded log section scrolls into its readable range. Then `loop.frame()`.

- [ ] **Step 1: Write the failing loop test**

```js
// test/loop.test.mjs: a fake window with a manual rAF queue, scrollY, innerWidth/innerHeight, matchMedia, addEventListener
test('measure only when invalidated, then reads before writes', () => {
  const log = []; const loop = createLoop(fakeWin, fakeDoc);
  loop.add({ measure: () => log.push('m1'), read: () => log.push('r1'), write: () => log.push('w1') });
  loop.add({ read: () => log.push('r2'), write: () => log.push('w2') });
  loop.invalidate(); flushRaf();
  assert.deepEqual(log, ['m1', 'r1', 'r2', 'w1', 'w2']);
  log.length = 0; fakeWin.fire('scroll'); fakeWin.fire('scroll'); flushRaf();
  assert.deepEqual(log, ['r1', 'r2', 'w1', 'w2']);  // one frame for two scroll events, no measure
});
```

- [ ] **Step 2: Write the failing browser checks** in `check.py` (names, then assertions):
  - `graph-behind`: `int(zIndex(#graph)) < int(zIndex(.stage))`. Graph opacity is 1 at agentic p = 0, strictly between 0 and 1 at p = 0.17, and 0 at p = 0.55.
  - `copy-never-moves`: at 1280×800 and 390×844, for every segment and p in `[.2, .3, .4, .55, .7, .8, .85]`, every `.cp` rect equals its p = .55 rect within 0.5 px. Computed `transform` is `none` on `.l-front`, `.cv-copy` and every `.cp`.
  - `no-empty-frame`: at 1280×800 and 390×844, sweep the home page in 40 px steps. At each step the max of these is at least 0.5, and the check lists every failing y:
    - effective opacity of rows intersecting the viewport (row opacity × log section opacity);
    - `max(copy)` of segments with `show`;
    - `ap * fill` of segments with `show`.
  - `chain-handoff`: at configurator p = 0.1, BA's `fill > 0` and BA `.stage` rect top within 1 px of 0, and configurator's `0 < ap < 1`. At configurator p = 0.35, BA is not shown and its `.stage` `style.transform == ''`.
  - `resize-mid-cover`: at configurator p = 0.55 (1280×800), resize to 390×844, then 844×390. After 400 ms each time: `ap == 1`, `.ap` box contains all four viewport corners, and the `.ap` centre is within 1 px of the planet sphere's centre.
  - `reload-mid-transition`: at agentic p = 0.12 read `state()`, `page.reload()`, wait 400 ms with no scrolling. `ap` and `ground` are within 0.02 of before.
  - `jump-clean`: from the top press `End`. After 400 ms every segment has `show == False` or `fill == 0`, every row in the viewport has effective opacity 1, and ground is 0. Then `Home`: the same holds at the top.
  - `fonts-reflow`: after load, inject `.entry{padding-bottom:240px}`. Scroll each segment to p = 0.55 using its new layout: `ap == 1` and `copy == [1, 1, 1, 1]`.
  - `reduced-live-toggle`: at configurator p = 0.55, switch to `reduced_motion='reduce'`. No element under `.seg` has an inline transform containing `scale(` other than `scale(1)`, and the `.cp` rects are unchanged. Switch back: `ap == 1`.

  Update the existing checks:
  - `mid-dwell-load`: also `ap == 1`, `fill == 1`, `copy == [1, 1, 1, 1]`.
  - `approach-darkens`: `0 < ap < 1` and some row's effective opacity strictly between 0 and 1, at p = 0.12.
  - `reduced`: also rows carry no transform.
  - `land-click`: p values `0.40` and `0.55`. At p = 0.2, computed `pointer-events` of `.l-front` is `none`.
  - `focus-reveals`: precondition on effective row opacity.
  - `layered-fixture`: each fixture cover reaches `ap == 1` mid-dwell. The `layered` cover's `.ap` centre is at (30%, 40%) of the viewport within 1 px.

- [ ] **Step 3: Run to see them fail**

Run: `node --test test/loop.test.mjs` → FAIL (no module). Run: `npm run build && $PY test/e2e/check.py graph-behind copy-never-moves no-empty-frame` → FAIL.

- [ ] **Step 4: Implement** `loop.js`, the new `flight.js`, the `main.js` wiring, the `graph.js` imports and the CSS. Delete `phases.mjs` and `test/phases.test.mjs`.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run build && node scripts/budget.mjs dist && $PY test/e2e/check.py`
Expected: every unit test and every browser check passes; budget line under 25 KB.

- [ ] **Step 6: Look at it**

Run: `$PY test/e2e/strip.py`
Read all six sheets. Confirm:
- No frame is empty.
- No rectangle ever scales in.
- The copy never moves.
- The planet arrives, drifts and leaves.

Fix and repeat.

- [ ] **Step 7: Commit**

```bash
gitt add -A src/client src/styles test
gitt commit -m "feat: one frame loop and the overlapping flight (aperture, copy fades, graph behind covers)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Shared stars that move, not redraw

**Files:**
- Rewrite: `src/client/stars.js`
- Modify: `src/client/stars-core.mjs` (add `layerOffsets`), `src/build/layout.mjs` (`#stars` becomes `<div id="stars" aria-hidden="true"><i class="st s0"></i><i class="st s1"></i><i class="st s2"></i></div>`), `src/styles/hud.css` (`#stars` container keeps its column mask; `.st` rules), `src/client/main.js`
- Test: `test/texture.test.mjs`, `test/e2e/check.py`

**Interfaces:**
- Consumes: `createLoop` (Task 5), `.l-stars .st` slots (Task 4).
- Produces: `layerOffsets(scrollY: number, h: number, reduced: boolean): [number, number, number]` (each equals `starOffset(scrollY, layer, h, reduced)`).
- Produces: `startStars(loop, doc): { urls(): string[] }`.
  - `measure`: when the viewport size or DPR changes, render each depth layer once into a canvas (`w*dpr` × `h*dpr`, `makeStars` with seed 2015, same alphas `[0.32, 0.5, 0.78]`, colour `#cdd6f4`). Export each with `toBlob` to an object URL, revoke the old ones, and set `--stars0..2` on `document.documentElement` (resize-time only).
  - `write`: `translate3d(0, -offset px, 0)` on the three site `.st` elements and on the three `.st` in every segment with `.on` (skipped under reduced).
  - `.st` is `position: absolute; left: 0; top: 0; width: 100%; height: 200%; background: var(--starsN) 0 0 / 100% 50% repeat-y`, so the wrap is seamless.

- [ ] **Step 1: Write the failing tests**

```js
// test/texture.test.mjs
test('layer offsets match the per-layer drift and stay in range', () => {
  assert.deepEqual(layerOffsets(1000, 800, false), [0, 1, 2].map((l) => starOffset(1000, l, 800)));
  assert.deepEqual(layerOffsets(1000, 800, true), [0, 0, 0]);
});
```

In `check.py`:
- Update `texture`. Each `#stars .st` has a computed `background-image` starting `url("blob:`. Loading `--stars2` into an `Image` gives `naturalWidth == innerWidth * devicePixelRatio` and some lit pixels. The `.st` transforms change after `scrollBy(0, 400)` and stay `''` under reduced motion. Grain assertions are unchanged.
- New `stars-align`: at agentic p = 0.15, for k in 0..2, the site `.st.s{k}` and the cover's `.st.s{k}` have identical inline transforms and bounding rects within 0.5 px.

- [ ] **Step 2: Run to see them fail**

Run: `node --test test/texture.test.mjs` → FAIL (`layerOffsets` missing).

- [ ] **Step 3: Implement** as above.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run build && $PY test/e2e/check.py && $PY test/e2e/perf.py --cpu 1 4 --runs 3`
Expected: all checks pass; `stars.js` no longer appears among the top script costs.

- [ ] **Step 5: Commit**

```bash
gitt add -A src/client src/build/layout.mjs src/styles/hud.css test
gitt commit -m "feat: shared starfield rendered once and moved with transforms, continuous inside covers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The graph joins the loop

**Files:**
- Modify: `src/client/graph.js`, `src/client/graph-core.mjs`
- Test: `test/graph.test.mjs`, `test/e2e/check.py` (unchanged checks must pass), `test/e2e/perf.py`

**Interfaces:**
- Consumes: `createLoop`, `progressAt`, `isCurrent`.
- Produces: `coverCurrent(segs: { index, top, height }[], y, vh): number`, the row index of the segment whose `isCurrent(progressAt(y, top, height, vh))` holds, else -1. It replaces `dwellIndex`'s DOM reads.
- Produces: `startGraph(loop, doc)`, with the same returned object as today (`rows`, `index`, `go`, `step`, `project`, `land`).
  - `measure` runs today's `layout()` and also caches the page top, segment metrics and `docH`.
  - `read` runs `detect` using only `ctx` and cached values.
  - Branch nodes and ticks are created once per `layout()`. The spring frame only updates attributes: the node group's `transform` follows lane x, tick `x1`, and opacities. No `innerHTML` and no DOM reads per frame.
  - Graph opacity stays owned by the flight.

- [ ] **Step 1: Write the failing test**

```js
// test/graph.test.mjs
test('cover current follows the copy window', () => {
  const segs = [{ index: 3, top: 1000, height: 2400 }];
  assert.equal(coverCurrent(segs, 1000 + 0.17 * 1600, 800), -1);
  assert.equal(coverCurrent(segs, 1000 + 0.55 * 1600, 800), 3);
  assert.equal(coverCurrent(segs, 1000 + 0.9 * 1600, 800), -1);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test test/graph.test.mjs` → FAIL (`coverCurrent` missing).

- [ ] **Step 3: Implement** as above.

- [ ] **Step 4: Run everything and measure**

Run: `npm test && npm run build && $PY test/e2e/check.py && $PY test/e2e/perf.py --cpu 1 4 --runs 3`
Expected: all checks pass (`graph-cursor`, `go-stays`, `resize`, `vim-keys` included); perf reports `forced 0` at both rates.

- [ ] **Step 5: Commit**

```bash
gitt add src/client/graph.js src/client/graph-core.mjs test/graph.test.mjs
gitt commit -m "perf: graph detection on the shared loop, no DOM building per frame" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Hit the performance budgets

**Files:**
- Modify: whatever the trace points at (expected: `src/styles/cover.css`, `src/styles/log.css`, `src/styles/hud.css` promotion rules; `src/client/flight.js` write paths)
- Test: `test/e2e/perf.py --assert`

**Interfaces:**
- Consumes: everything above. Produces no new API.

- [ ] **Step 1: Measure the floor and the site**

Run: `npm run build && $PY test/e2e/perf.py --route control --cpu 1 4 --runs 3 && $PY test/e2e/perf.py --cpu 1 4 --runs 3 --json test/e2e/shots/perf.json`
Expected: numbers printed. If the control floor is already above a budget, stop and report the floor to Luca with the numbers. Do not relax a budget silently.

- [ ] **Step 2: Loop until the assertions pass**

Repeat until `$PY test/e2e/perf.py --cpu 1 4 --runs 3 --assert` exits 0:
1. Find the largest cost in the trace (top `FunctionCall`, `Paint` or `UpdateLayoutTree` totals).
2. Fix that one cost. Likely levers:
   - `will-change` only on `.seg.on` parts and `.row.mv`, removed at rest;
   - skip writes whose value hasn't changed since the last frame;
   - round transform numbers to avoid sub-pixel re-raster;
   - promote `#ground` and `#graph` for opacity.
3. Rerun the trace.

After each fix, the full `check.py` must still pass.

- [ ] **Step 3: Record before and after**

Add a "Performance" block to `docs/STATUS.md`: baseline numbers from Task 1, final numbers, the control floor and the host/Chromium version.

- [ ] **Step 4: Commit**

```bash
gitt add -A src docs/STATUS.md
gitt commit -m "perf: flight within budget at 1x and 4x CPU" -m "<before/after table>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tune by eye, hand to Luca

**Files:**
- Modify: `src/client/choreo.mjs` (`TRACKS` values only), `docs/superpowers/specs/2026-11-25-fluid-flight-design.md` (timeline table if windows move), `docs/STATUS.md`, `README.md`

**Interfaces:**
- Consumes everything; changes only constants.

- [ ] **Step 1: Produce the review material**

Run: `npm run build && $PY test/e2e/strip.py --video`
Read every sheet at both viewports. Judge each transition against the spec's intent:
- the neighbours overlap;
- the cover opens from its planet;
- the pieces arrive separately;
- motion never stops;
- the text holds still and only fades.

- [ ] **Step 2: Tune**

Adjust `TRACKS` windows and easing choices only. After each change run `npm test` (the invariant must hold) and re-run `strip.py`. Keep the spec's timeline table in sync.

- [ ] **Step 3: Full verification**

Run: `npm test && npm run build && node scripts/budget.mjs dist && $PY test/e2e/check.py && $PY test/e2e/perf.py --cpu 1 4 --runs 3 --assert`
Expected: everything passes; paste the outputs into the commit body.

- [ ] **Step 4: Update the docs**

- `README.md`: `cover.origin`, layer roles for real art (first = sky, last = planet's role, stars beneath art), how to run the strips and the trace.
- `docs/STATUS.md`: mark the graph-over-covers issue resolved. Remove the deferred items this work fixed ("Video covers would preload…" stays unless fixed; "image layers are not lazy-loaded" stays). Add new decisions with their costs.

- [ ] **Step 5: Commit, then hand over**

```bash
gitt add -A src/client/choreo.mjs docs README.md
gitt commit -m "feat: tuned flight timeline; docs and status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Tell Luca it is live at `http://172.29.169.57:8080/`. Show him the strips and the before/after performance table. Ask him to scroll it on his own screen and a phone, and collect his notes for a tuning round.
