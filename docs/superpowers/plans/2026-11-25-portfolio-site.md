# Portfolio Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build lucamolluso.com: a dark, scroll-driven "flight through space" home page where project covers fly in from depth, plus project, work, about and help pages, deployable to GitHub Pages.

**Architecture:** A zero-dependency Node build (`scripts/build.mjs`) reads `content/log.mjs` and `content/projects/*.md`, renders pages with template-literal functions, and writes `dist/`. Browser behaviour is plain ES modules in `src/client/`. Every piece of logic lives in a pure function (phase mapping, cursor spring, graph geometry, vim keys, grain, stars) that Node unit-tests, and a thin DOM layer applies it.

**Tech Stack:** Node 22 (built-ins only, `node:test`), vanilla ES modules, CSS, Python Playwright + Chrome for end-to-end checks, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-25-portfolio-design.md`

## Global Constraints

- No npm dependencies: `package.json` has no `dependencies` or `devDependencies`; only Node built-ins.
- Dark only, Catppuccin Mocha: base `#1e1e2e`, mantle `#181825`, crust `#11111b`, text `#cdd6f4`, subtext0 `#a6adc8`, surface0 `#313244`, overlay0 `#6c7086`, mauve `#cba6f7`, crema `#d4a77a`; branches main=`#cdd6f4`, ibm=`#89b4fa`, accenture=`#cba6f7`, school=`#fab387`, twitch=`#f38ba8`, mods=`#94e2d5`.
- Contrast: body text ≥ 7:1, labels, refs and links ≥ 4.5:1, graph lines and nodes ≥ 3:1, all against `#1e1e2e` and `#000`.
- Fonts: Atkinson Hyperlegible Next (text), Atkinson Hyperlegible Mono (HUD), Fraunces italic (accent word only).
- Animate only `transform` and `opacity`; never animate filters or blend modes.
- Native scroll only: no `wheel`/`touchmove` handlers that change scrolling.
- `prefers-reduced-motion: reduce` disables depth, drift and grain animation.
- Letter shortcuts work only in normal mode (entered with `Esc`).
- Home JS ≤ 25 KB gzipped; fonts ≤ 120 KB total.
- Copy has no em dashes; NDA work is never named.
- Commits end with the attribution lines given in the session (Co-Authored-By and Claude-Session).

## Review Focus

- A project file missing optional fields (no `cover`, no `palette`, no `segmentHeight`) must still build and render a full-screen generative cover (Task 3 test `project defaults`).
- Loading or restoring the page mid-segment (back button, `#hash` link) must show the correct phase immediately, not after the first scroll (Task 5 e2e `mid-dwell load`).
- Tabbing to a link inside a faded log layer must bring that layer into view, not focus something invisible (Task 5 e2e `focus reveals`).
- Resizing or rotating mid-scroll must recompute segment metrics and graph geometry (Task 6 e2e `resize`).
- Markdown with `<`, `&` or quotes in text must be escaped, while block-level raw HTML lines pass through (Task 1 tests).

---

### Task 1: Content parsing (frontmatter + Markdown subset)

**Files:**
- Create: `package.json`, `src/build/frontmatter.mjs`, `src/build/markdown.mjs`
- Test: `test/frontmatter.test.mjs`, `test/markdown.test.mjs`

**Interfaces:**
- Produces: `parseFrontmatter(text: string): { data: object, body: string }` and `renderMarkdown(md: string): string`.

`package.json`: `"type": "module"`, scripts `build: node scripts/build.mjs`, `test: node --test test/`, `e2e: python3 test/e2e/check.py`. No dependencies.

- [ ] **Step 1: Write failing tests**

```js
// test/frontmatter.test.mjs
test('scalars, lists, nested map, booleans, numbers', () => {
  const { data, body } = parseFrontmatter(`---
title: Configurator framework
accent: framework
nda: true
segmentHeight: 300
tags: [3d, luxury]
palette:
  bg: "#0b0d12"
  fg: "#e8e6e1"
---
Body here.`);
  assert.deepEqual(data, { title: 'Configurator framework', accent: 'framework', nda: true,
    segmentHeight: 300, tags: ['3d', 'luxury'], palette: { bg: '#0b0d12', fg: '#e8e6e1' } });
  assert.equal(body.trim(), 'Body here.');
});
test('no frontmatter returns empty data', () => { assert.deepEqual(parseFrontmatter('Hi').data, {}); });
test('unterminated frontmatter throws', () => { assert.throws(() => parseFrontmatter('---\na: 1'), /frontmatter/); });
```

```js
// test/markdown.test.mjs
test('headings, paragraphs, emphasis, links, code', () => {
  assert.equal(renderMarkdown('## Look-dev\n\nA *soft* **pass** with `PBR` and [notes](/x).'),
    '<h2>Look-dev</h2>\n<p>A <em>soft</em> <strong>pass</strong> with <code>PBR</code> and <a href="/x">notes</a>.</p>');
});
test('lists', () => {
  assert.equal(renderMarkdown('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(renderMarkdown('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
});
test('image becomes figure with caption from alt', () => {
  assert.equal(renderMarkdown('![Final frame](/media/a.webp)'),
    '<figure><img src="/media/a.webp" alt="Final frame" loading="lazy"><figcaption>Final frame</figcaption></figure>');
});
test('escapes text', () => { assert.equal(renderMarkdown('a < b & "c"'), '<p>a &lt; b &amp; &quot;c&quot;</p>'); });
test('raw HTML block lines pass through', () => { assert.equal(renderMarkdown('<div class="x">hi</div>'), '<div class="x">hi</div>'); });
```

- [ ] **Step 2: Run** `node --test test/` and confirm it fails (modules not found).
- [ ] **Step 3: Implement both modules.** Frontmatter: a YAML subset (`key: value`, `[a, b]` lists, one level of 2-space-indented maps, `true`/`false`, numbers, double-quoted strings). Markdown: blocks split on blank lines. A block whose first line starts with `<` is raw HTML. Inline escaping runs before the inline rules.
- [ ] **Step 4: Run** `node --test test/` and confirm all tests pass.
- [ ] **Step 5: Commit** `feat: content parsing for frontmatter and markdown`.

### Task 2: Design tokens and contrast gate

**Files:**
- Create: `src/build/contrast.mjs`, `src/build/tokens.mjs`, `src/styles/tokens.css`, `src/styles/base.css`
- Test: `test/contrast.test.mjs`

**Interfaces:**
- Produces: `contrastRatio(fg: string, bg: string): number` (WCAG 2.x relative luminance, 2 decimals); `TOKENS` (object of name → hex, the Global Constraints palette) and `CONTRAST_CHECKS: Array<{ what: string, fg: string, rule: 'AAA'|'AA'|'graphics' }>`; `contrastTable(): Array<{ what, rule, onBase: number, onBlack: number, pass: boolean }>`.

`tokens.css` declares every token as a custom property (`--base`, `--mantle`, `--crust`, `--text`, `--sub`, `--line`, `--tick`, `--mauve`, `--crema`, `--b-main`, `--b-ibm`, `--b-accenture`, `--b-school`, `--b-twitch`, `--b-mods`) plus `--gw: 76px` (40px under 600px). `base.css` holds body type (17px/1.6 Atkinson Hyperlegible Next), `.hud` labels (13px mono, uppercase, `letter-spacing: .08em`, `--sub`), focus ring (2px `--mauve`), skip link, the hairline rails and crop-mark ticks from the prototype, and `@view-transition { navigation: auto; }`.

- [ ] **Step 1: Write failing tests**

```js
test('known ratio', () => { assert.equal(contrastRatio('#cdd6f4', '#1e1e2e'), 11.34); });
test('every check passes on base and on black', () => {
  for (const row of contrastTable()) assert.ok(row.pass, `${row.what}: ${row.onBase}/${row.onBlack}`);
});
test('thresholds', () => {
  const min = { AAA: 7, AA: 4.5, graphics: 3 };
  for (const r of contrastTable()) assert.ok(Math.min(r.onBase, r.onBlack) >= min[r.rule]);
});
```

- [ ] **Step 2: Run** `node --test test/contrast.test.mjs` and confirm it fails.
- [ ] **Step 3: Implement.** `CONTRAST_CHECKS`: body text `--text` AAA; labels `--sub` AA; git refs `--crema` AA; cursor and links `--mauve` AA; each branch colour graphics.
- [ ] **Step 4: Run** the tests and confirm they pass. If the known-ratio value differs, assert the computed value to 2 decimals and keep the threshold tests.
- [ ] **Step 5: Commit** `feat: mocha tokens with contrast gate`.

### Task 3: Content model and timeline

**Files:**
- Create: `content/log.mjs`, `content/projects/configurator-framework.md`, `content/projects/agentic-texture-pipeline.md`, `content/projects/ba-art-direction.md`, `content/projects/servers-and-mods.md`, `src/build/timeline.mjs`
- Test: `test/timeline.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter`, `renderMarkdown` (Task 1).
- Produces: `loadProjects(dir: string): Project[]` where `Project = { slug, title, accent, hash, branch, year, tags: string[], nda: boolean, palette: { bg, fg, accent }, cover: { image?, video?, layers?: string[] }, segmentHeight: number, order: number, html: string }`; `buildTimeline({ commits, branches }, projects): { rows: Row[], branches: Branch[] }` where `Row` is a commit plus `project?: Project`, and `Branch = { name, color, fork?: hash, merge?: hash }`.

`content/log.mjs` exports `branches` and `commits` (newest first) carrying the prototype's history: HEAD "This site", the planned agentic pipeline (project), the Accenture special commit with tags `palestre`, `ai-way-of-work` and `gaming-corner`, the BA merge (project `ba-art-direction`), the configurator framework (project), the art school fork (slim), `merge 'ibm', fork 'accenture'` (slim, 2021), Twitch since 2019, the Android apps, hired at IBM, servers and mods (project), and the initial commit with the pocket-money line. Commit `kind` is one of `head|big|slim|merge|fork|root|project`. Project files use placeholder text marked as sample.

- [ ] **Step 1: Write failing tests**

```js
test('rows keep log order and attach projects', () => {
  const t = buildTimeline(log, loadProjects('content/projects'));
  assert.equal(t.rows[0].hash, 'HEAD');
  assert.equal(t.rows.at(-1).kind, 'root');
  assert.equal(t.rows.find(r => r.kind === 'project' && r.project.slug === 'configurator-framework').project.nda, true);
});
test('validation errors name the problem', () => {
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }], commits: [{ hash: 'a', branch: 'nope', kind: 'big' }] }, []), /unknown branch "nope"/);
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }], commits: [{ hash: 'a', branch: 'main', kind: 'project', project: 'x' }] }, []), /unknown project "x"/);
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }, { name: 'b', merge: 'zz' }], commits: [{ hash: 'a', branch: 'main', kind: 'big' }] }, []), /merge "zz"/);
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }], commits: [{ hash: 'a', branch: 'main', kind: 'big' }, { hash: 'a', branch: 'main', kind: 'big' }] }, []), /duplicate hash "a"/);
});
test('project defaults', () => {
  const p = loadProjects('test/fixtures/minimal-project')[0];
  assert.deepEqual(p.palette, { bg: '#000000', fg: '#cdd6f4', accent: '#cba6f7' });
  assert.equal(p.segmentHeight, 300);
  assert.deepEqual(p.cover, {});
});
```

Add `test/fixtures/minimal-project/minimal.md` with only `title`, `slug`, `hash`, `branch`, `year`.

- [ ] **Step 2: Run** and confirm it fails.
- [ ] **Step 3: Implement** `loadProjects` (reads `*.md`, applies defaults, renders the body to `html`) and `buildTimeline` (validates in the order the tests expect).
- [ ] **Step 4: Run** and confirm it passes.
- [ ] **Step 5: Commit** `feat: content model and timeline validation`.

### Task 4: Build script and page templates

**Files:**
- Create: `scripts/build.mjs`, `src/build/layout.mjs`, `src/build/pages/home.mjs`, `src/build/pages/project.mjs`, `src/build/pages/work.mjs`, `src/build/pages/about.mjs`, `src/build/pages/help.mjs`, `src/build/cover.mjs`, `src/styles/log.css`, `src/styles/cover.css`, `src/styles/hud.css`, `src/styles/pages.css`, `public/CNAME` (`lucamolluso.com`), `public/favicon.svg`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces: `build({ outDir: string }): Promise<string[]>` (written file paths) exported from `scripts/build.mjs`, which also runs it when executed directly. `layout({ title, page, body, branch? }): string` is the shell: skip link, `<svg id="graph" aria-hidden="true">`, `<canvas id="stars" aria-hidden="true">`, `<div id="grain" aria-hidden="true">`, `<nav id="bar" aria-label="Pages and status">` with tabs `1 log` → `/`, `2 work` → `/work/`, `3 about` → `/about/`, `4 :help` → `/help/` (current tab `aria-current="page"`), `#mode`, `#pos`, `#clk`, mail link, `<div id="cmd" hidden>`. `renderCover(project): string` returns `<section class="seg" data-slug data-height style="--seg-h:300vh;--p-bg;--p-fg;--p-accent">` holding a sticky `.stage` with `.cover` (`view-transition-name: cover-<slug>`), a generative placeholder when no image or video exists, title with `<em>` accent, and the focusable link `<a class="land" href="/projects/<slug>/">Land on this project</a>`.

Home: log rows grouped into `.logseg` blocks (an `ol` of `li > article` with `.eb` eyebrow, `time`, hash in `.ref`, spec cells as `dl`), split by project commits, each of which renders `renderCover`. Fonts: if `public/fonts/fonts.css` exists, link it and render the colophon line "no third-party requests"; otherwise link the Google Fonts stylesheet and omit that line. The Help page is the colophon: `contrastTable()` (Task 2) as a table, the fonts, the motion policy (what reduced motion turns off), the key map, and the line "no cookies, no tracking".

- [ ] **Step 1: Write failing tests**

```js
test('build writes every page', async () => {
  const files = await build({ outDir: tmp });
  for (const f of ['index.html', 'work/index.html', 'about/index.html', 'help/index.html',
    'projects/configurator-framework/index.html', 'CNAME', 'assets/main.js'])
    assert.ok(files.some(p => p.endsWith(f)), f);
});
test('home structure is semantic', async () => {
  const html = await readFile(join(tmp, 'index.html'), 'utf8');
  assert.match(html, /<ol class="log"/); assert.match(html, /<time datetime="2015">/);
  assert.match(html, /class="land" href="\/projects\/configurator-framework\/"/);
  assert.match(html, /aria-current="page"[^>]*>.*log/s);
  assert.doesNotMatch(html, /—/);
});
test('help lists live contrast values', async () => {
  const html = await readFile(join(tmp, 'help/index.html'), 'utf8');
  for (const r of contrastTable()) assert.ok(html.includes(r.onBase.toFixed(2)));
  assert.match(html, /no cookies, no tracking/);
});
test('nda project never prints a client name field', async () => {
  const html = await readFile(join(tmp, 'projects/configurator-framework/index.html'), 'utf8');
  assert.match(html, /Client under NDA/);
});
```

- [ ] **Step 2: Run** and confirm it fails.
- [ ] **Step 3: Implement** the templates and the build, which copies `public/` to `dist/` and `src/client/*.js` plus `*.mjs` to `dist/assets/` and concatenates `src/styles/*.css` in a fixed order (tokens, base, log, cover, hud, pages) into `dist/assets/site.css`.
- [ ] **Step 4: Run** `node --test test/` and confirm it passes; `node scripts/build.mjs` prints the written count.
- [ ] **Step 5: Commit** `feat: static build and page templates`.

### Task 5: Flight engine

**Files:**
- Create: `src/client/phases.mjs`, `src/client/flight.js`
- Test: `test/phases.test.mjs`, `test/e2e/check.py` (scenarios added here)

**Interfaces:**
- Produces: `phaseAt(p: number): { stage: 'approach'|'arrival'|'dwell'|'departure', t: number }` (boundaries 0.2, 0.3, 0.8; `p` clamped to 0..1). `flightFrame(p: number, { reduced: boolean }): { prev: { y: number, z: number, opacity: number }, cover: { scale: number, z: number, opacity: number }, next: { y: number, z: number, opacity: number }, ground: number, graphDim: number }`, with `y` in vh, `z` in px, `ground` 0 (Mocha base) to 1 (black). `startFlight(root: Document): () => void` (returns a stop function) and `groundColor(g: number): string`.

Values (easeInOutCubic inside each stage):
- approach: prev y 0 → -40, z 0 → -600, opacity 1 → 0; cover scale 0.18 → 0.9, z -1200 → -150, opacity 0 → 1; ground 0 → 1.
- arrival: cover scale 0.9 → 1, z -150 → 0; ground 1.
- dwell: cover scale 1, opacity 1; graphDim 0.2 (1 elsewhere, linear across arrival and departure).
- departure: cover scale 1 → 1.6, opacity 1 → 0; next y 40 → 0, z -600 → 0, opacity 0 → 1; ground 1 → 0.
- reduced: every `y`, `z` = 0 and `scale` = 1; opacities and ground as above.

`flight.js` reads each `.seg`'s progress from `getBoundingClientRect()` in one rAF loop, writes transforms on `.logseg` neighbours and `.cover`, sets `--ground` on `body`, and runs once on load, `resize`, `pageshow` and `hashchange`. A `focusin` inside a faded `.logseg` scrolls that element into view. Segments use 200vh under 600px width.

- [ ] **Step 1: Write failing tests**

```js
test('stage boundaries', () => {
  assert.deepEqual(phaseAt(0), { stage: 'approach', t: 0 });
  assert.equal(phaseAt(0.25).stage, 'arrival');
  assert.equal(phaseAt(0.5).stage, 'dwell');
  assert.equal(phaseAt(0.9).stage, 'departure');
  assert.equal(phaseAt(2).stage, 'departure');
});
test('dwell fills the screen and dims the graph', () => {
  const f = flightFrame(0.55, { reduced: false });
  assert.equal(f.cover.scale, 1); assert.equal(f.ground, 1); assert.equal(f.graphDim, 0.2);
});
test('approach start is the plain log', () => {
  const f = flightFrame(0, { reduced: false });
  assert.deepEqual(f.prev, { y: 0, z: 0, opacity: 1 }); assert.equal(f.cover.opacity, 0);
});
test('reduced motion never moves in depth', () => {
  for (const p of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
    const f = flightFrame(p, { reduced: true });
    assert.equal(f.prev.z, 0); assert.equal(f.cover.scale, 1); assert.equal(f.next.y, 0);
  }
});
test('ground colour endpoints', () => { assert.equal(groundColor(0), '#1e1e2e'); assert.equal(groundColor(1), '#000000'); });
```

E2E (in `test/e2e/check.py`; it serves `dist/` with `http.server` and uses Chrome at `/usr/bin/google-chrome` or `$CHROME`): `mid-dwell load` (open `/#configurator-framework`, wait 300 ms, the `.cover` rect covers the viewport ±2px); `focus reveals` (scroll to mid-dwell, press Tab until a `.logseg a` is focused, then its computed opacity is 1); `reduced` (emulate reduced motion, no `.cover` transform contains `scale(` other than `scale(1)`).

- [ ] **Step 2: Run** `node --test test/phases.test.mjs` and confirm it fails.
- [ ] **Step 3: Implement** `phases.mjs` and `flight.js`.
- [ ] **Step 4: Run** the unit tests, then `npm run build && npm run e2e`, and confirm they pass.
- [ ] **Step 5: Commit** `feat: scroll-driven flight between log and covers`.

### Task 6: Git graph and Neovide cursor

**Files:**
- Create: `src/client/graph-core.mjs`, `src/client/graph.js`, `src/client/cursor-core.mjs`
- Test: `test/graph.test.mjs`, `test/cursor.test.mjs`

**Interfaces:**
- Consumes: the timeline rows rendered as `data-hash`, `data-branch`, `data-kind` on each `.eb`, `.slim` and `.seg` anchor (Task 4), plus `graphDim` from `flightFrame` (Task 5).
- Produces: `focusReducer(state: { focus: string, ghost: string|null }, next: string): { focus, ghost }`; `laneTarget(name, state, narrow: boolean): { lane: 1|2|0, opacity: number, draw: 0|1 }` (focus: lane 1, opacity 1, draw 1; ghost: lane 1 if focus is `main` else lane 2, opacity 0.3, draw 1, hidden on narrow unless focus is `main`; others: opacity 0, draw 0); `branchPath(geo: { mY: number|null, fY: number, top: number }, x: number, x0: number, r = 20): string`; `stepCursor(c: { x, top, bot }, target: { x, y }, k = { lead: 0.5, trail: 0.24, x: 0.4 }): { x, top, bot }` (half height 11, snaps when within 0.002); `startGraph(doc): void`.

Lane x: `L1 = gw - 22` (`gw - 18` when narrow), `L2 = gw - 46`, rail `x0 = gw + 0.5`. Branches draw in with `pathLength="1"` dash offset, easing 0.12 per frame; x and opacity ease 0.16. Main commits sit on the rail (ring for head, merge and root); special commits are diamonds. The cursor is a 14×22 rect in `--mauve` with a `--base` dot on the node. Clicking within 16px of a node scrolls to its anchor. The current row is the last anchor whose top is at or above 60% of the viewport height (the last row at the page bottom); during a cover's dwell it is that project's commit.

- [ ] **Step 1: Write failing tests**

```js
test('focus moves the old branch to ghost', () => {
  assert.deepEqual(focusReducer({ focus: 'accenture', ghost: null }, 'school'), { focus: 'school', ghost: 'accenture' });
  assert.deepEqual(focusReducer({ focus: 'main', ghost: 'school' }, 'school'), { focus: 'school', ghost: null });
  assert.deepEqual(focusReducer({ focus: 'school', ghost: 'accenture' }, 'main'), { focus: 'main', ghost: 'school' });
});
test('at most two lanes visible, one on narrow', () => {
  const s = { focus: 'twitch', ghost: 'school' };
  assert.equal(laneTarget('school', s, false).lane, 2);
  assert.equal(laneTarget('school', s, true).opacity, 0);
  assert.equal(laneTarget('ibm', s, false).opacity, 0);
});
test('merged branch path starts on the rail at the merge row', () => {
  assert.match(branchPath({ mY: 100, fY: 400, top: 0 }, 54, 76.5), /^M76\.5 100C/);
  assert.match(branchPath({ mY: null, fY: 400, top: 10 }, 54, 76.5), /^M54 10V380/);
});
test('cursor smears down then settles on the node', () => {
  let c = { x: 0, top: 89, bot: 111 };
  c = stepCursor(c, { x: 0, y: 300 });
  assert.ok(c.bot - c.top > 22);
  for (let i = 0; i < 60; i++) c = stepCursor(c, { x: 0, y: 300 });
  assert.deepEqual(c, { x: 0, top: 289, bot: 311 });
});
```

E2E `resize`: at 1280 wide, record the cursor rect's centre against the current node; resize to 390 and confirm the centre matches the new node within 1px.

- [ ] **Step 2: Run** and confirm it fails.
- [ ] **Step 3: Implement** the cores and `graph.js` (geometry from anchors' `offsetTop` relative to `.main`, recomputed on `ResizeObserver` and `document.fonts.ready`; the animation loop stops when settled).
- [ ] **Step 4: Run** the unit tests and e2e, and confirm they pass.
- [ ] **Step 5: Commit** `feat: focused git graph with neovide cursor`.

### Task 7: Starfield and film grain

**Files:**
- Create: `src/client/stars-core.mjs`, `src/client/stars.js`, `src/client/grain-core.mjs`, `src/client/grain.js`
- Test: `test/texture.test.mjs`

**Interfaces:**
- Produces: `makeStars({ count: number, layers: number, seed: number, w: number, h: number }): Array<{ x, y, r, layer }>` (deterministic, even split across layers); `grainTile(size: number, seed: number): Uint8ClampedArray` (RGBA length `size*size*4`, grey noise, alpha 255); `startStars(canvas, { reduced })`, `startGrain(el, { reduced })`.

Stars: 3 layers (2 under 600px), 180 stars at 1280×800 scaled by area, drift speeds 0.02 / 0.05 / 0.1 of scroll delta, canvas masked out behind the reading column like the prototype's dot fade, DPR-aware, paused on `visibilitychange`. Grain: a 128px tile drawn once to a canvas, set as the `#grain` background (`opacity: .05`), with `background-position` jumping to a random offset every 125 ms; static when reduced.

- [ ] **Step 1: Write failing tests**

```js
test('stars are deterministic and split by layer', () => {
  const a = makeStars({ count: 90, layers: 3, seed: 7, w: 1280, h: 800 });
  assert.deepEqual(a, makeStars({ count: 90, layers: 3, seed: 7, w: 1280, h: 800 }));
  assert.equal(a.filter(s => s.layer === 2).length, 30);
});
test('grain tile shape', () => {
  const t = grainTile(128, 3); assert.equal(t.length, 128 * 128 * 4);
  assert.equal(t[3], 255); assert.equal(t[0], t[1]);
});
```

- [ ] **Step 2: Run** and confirm it fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** and confirm it passes; e2e reports no console errors.
- [ ] **Step 5: Commit** `feat: starfield and film grain`.

### Task 8: Vim mode and status bar

**Files:**
- Create: `src/client/vim-core.mjs`, `src/client/vim.js`, `src/client/hud.js`, `src/client/main.js`
- Test: `test/vim.test.mjs`

**Interfaces:**
- Consumes: `startFlight`, `startGraph`, `startStars`, `startGrain`.
- Produces: `vimKey(state: { normal: boolean, lastG: number }, key: string, now: number): { state, action: null | { type: 'next'|'prev'|'nextProject'|'prevProject'|'top'|'bottom'|'land'|'openCmd'|'exitNormal' } }`; `runCommand(text: string): { message: string, action?: 'help' }`; `main.js` starts everything on `DOMContentLoaded`.

Keys (normal mode only): `j`/`k` commit, `J`/`K` project, `gg` within 450 ms, `G`, `Enter` land, `:` opens the command line, `i` leaves. No `/` search and no `:colo` (single theme, per spec). `Esc` always toggles. Modifier keys and focus in inputs are ignored. The status bar shows `-- NORMAL --` or `esc · normal`, `HEAD~n · <branch>`, and a Rome clock (`Intl.DateTimeFormat`, `Europe/Rome`, refreshed every 30 s).

- [ ] **Step 1: Write failing tests**

```js
test('letters do nothing outside normal mode', () => {
  assert.equal(vimKey({ normal: false, lastG: 0 }, 'j', 0).action, null);
});
test('esc toggles, gg needs two presses', () => {
  const on = vimKey({ normal: false, lastG: 0 }, 'Escape', 0); assert.equal(on.state.normal, true);
  const g1 = vimKey(on.state, 'g', 1000); assert.equal(g1.action, null);
  assert.deepEqual(vimKey(g1.state, 'g', 1300).action, { type: 'top' });
  assert.equal(vimKey(g1.state, 'g', 2000).action, null);
});
test('project jumps and land', () => {
  const s = { normal: true, lastG: 0 };
  assert.deepEqual(vimKey(s, 'J', 0).action, { type: 'nextProject' });
  assert.deepEqual(vimKey(s, 'Enter', 0).action, { type: 'land' });
});
test('commands', () => {
  assert.equal(runCommand('q').message, "You can't quit. You just can't stop.");
  assert.equal(runCommand('help').action, 'help');
  assert.equal(runCommand('colo latte').message, 'E492: Not an editor command: colo latte');
  assert.equal(runCommand('foo bar').message, 'E492: Not an editor command: foo bar');
});
```

- [ ] **Step 2: Run** and confirm it fails.
- [ ] **Step 3: Implement**, including the `#cmd` line (`role="status"` messages, cleared after 3.5 s).
- [ ] **Step 4: Run** the unit tests and e2e (`Esc` then `J` scrolls to the next `.seg`), and confirm they pass.
- [ ] **Step 5: Commit** `feat: vim normal mode and tmux status bar`.

### Task 9: Deploy pipeline and budgets

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`, `scripts/budget.mjs`
- Test: `test/budget.test.mjs`

**Interfaces:**
- Consumes: `build` (Task 4).
- Produces: `measure(outDir): { homeJsGzip: number, fontsBytes: number }` using `node:zlib`.

Workflow: on push to `main` and manual dispatch; `actions/checkout@v4`, `actions/setup-node@v4` with Node 22, `node --test test/`, `node scripts/build.mjs`, `actions/upload-pages-artifact@v3` (path `dist`), `actions/deploy-pages@v4`; permissions `contents: read`, `pages: write`, `id-token: write`. The README covers adding a project (frontmatter fields from Task 3), self-hosting fonts into `public/fonts/` with a `fonts.css`, running tests, and DNS for the custom domain.

- [ ] **Step 1: Write failing test**

```js
test('budgets', async () => {
  await build({ outDir: tmp });
  const m = measure(tmp);
  assert.ok(m.homeJsGzip <= 25 * 1024, `home js ${m.homeJsGzip}`);
  assert.ok(m.fontsBytes <= 120 * 1024, `fonts ${m.fontsBytes}`);
});
test('no dependencies', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.dependencies, undefined); assert.equal(pkg.devDependencies, undefined);
});
```

- [ ] **Step 2: Run** and confirm it fails.
- [ ] **Step 3: Implement** `measure`, the workflow and the README.
- [ ] **Step 4: Run** `npm test && npm run build && npm run e2e`, all green; e2e saves screenshots of home (top, mid-dwell) and one project page at 390×844 and 1280×800, with motion on and off, into `test/e2e/shots/` (gitignored).
- [ ] **Step 5: Commit** `chore: pages deploy workflow, budgets, readme`.
