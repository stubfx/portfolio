# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live prototype with a zero-dependency static build of the same pages (minus the 3D viewer), with a media pipeline for photos, silent loops, longer videos and click-to-load embeds, ready for Luca's real projects.

**Architecture:** `build.mjs` loads `content/` into a site model (`lib/site.mjs`): Markdown parsed into blocks (`lib/parse.mjs`, `lib/inline.mjs`), media resolved through `content/media.json` (`lib/media.mjs`), history read from git (`lib/history.mjs`). `lib/validate.mjs` collects every problem; `lib/render.mjs` and `lib/page.mjs` turn valid pages into HTML inside `site/template.html`. `media.mjs` (local, ffmpeg) writes web media and the manifest; the build only checks them.

**Tech Stack:** Node 22+ built-ins (`node:fs`, `node:path`, `node:child_process`, `node:http`, `node:crypto`, `node:zlib`, `node:test`), plain CSS and ES modules in the browser. Local-only tools: ffmpeg/ffprobe, Python through `uv` (fontTools, Playwright).

**Spec:** `docs/superpowers/specs/2026-11-27-foundation-design.md` (approved Nov 27, 2026). Read it with this plan; `docs/` (after Task 1) is the contract.

## Global Constraints

- **Zero dependencies (a must):** no npm packages, no `package.json` dependencies, no framework or bundler, nothing running live. Local tools on Luca's machine are fine (ffmpeg/ffprobe, `uv run --with …`); their outputs are committed and CI never needs them.
- Build and tests: Node 22+, built-in modules only, run with `node --test` from the repo root. Node's default test patterns run every `.mjs` under `test/`, so only tests and `test/_*.mjs` helpers live there.
- **The site's build and tests call `git` directly** (Luca's exemption). Every version-control command typed by hand uses `gitt` (or `zsh -ic 'gitt …'`).
- Privacy: no request to another origin until a visitor presses play on an embed. Every page has the CSP `<meta>` from Task 9, so markup has no inline `style` attributes and no inline scripts besides `HEAD_SCRIPT` and the JSON-LD data block.
- Every commit message ends with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` line (the `-m` texts below are the subject lines).
- Embeds: YouTube and Vimeo only. Iframes: `https://www.youtube-nocookie.com/embed/<id>?autoplay=1` and `https://player.vimeo.com/video/<id>?autoplay=1&dnt=1` (plus `&h=<hash>`).
- Media caps (MB = 1024 × 1024 bytes): loop variant 10 MB (warning above 6 MB), player variant 60 MB, photo variant 600 KB, all media in `content/` 700 MB.
- Page budgets: HTML+CSS under 40 KB uncompressed per page; JS under 3 KB gzipped on pages without video or embeds; fonts under 150 KB in total.
- Origin `https://lucamolluso.com`, no `BASE_PATH`; history links go to `https://github.com/stubfx/portfolio/commits/main/content/<path>`.
- File names in `content/`: `^[a-z0-9][a-z0-9._-]*$` per path segment.
- Design values (tokens, type scale, layout) are DESIGN.md's; the prototype's CSS is the starting point.
- Site copy follows CONTENT.md voice: first person, no em dashes.
- Browser checks use the host Playwright server (global CLAUDE.md): `H=$(ip route | awk '/^default/{print $3; exit}')`, probe `timeout 5 bash -c "</dev/tcp/$H/3333"`, connect with `chromium.connect(f'ws://{H}:3333/', expose_network='<loopback>')`, client `uv run --with playwright==1.64.1`. If the port is closed, tell Luca and do non-browser work meanwhile.
- The push token can't change `.github/workflows/*`; Luca pushes that commit. Pushing `main` deploys.

## Review Focus

1. **Windows line endings, a BOM, trailing spaces** in a `.md` file: the same blocks as the clean file (test in Task 2).
2. **A page that is new and not committed yet:** builds, and its status line says `not committed yet` (tests in Tasks 5 and 9).
3. **Quotes, `<`, `&`, emoji in alt text, titles, link text and notes:** escaped in text and in every attribute (`alt`, `aria-label`, `title`, `data-*`) (test in Task 3).
4. **Spaces, capitals or accents in a content file name:** a clear build error, not a broken URL (test in Task 6).
5. **Long words and URLs on a 360 px screen:** no horizontal scrolling (check in Task 12).

---

### Task 1: Bring `docs/` in line with the design

**Files:**
- Modify: `docs/INTENTIONS.md`, `docs/SPEC.md`, `docs/DESIGN.md`, `docs/CONTENT.md`, `docs/BUILD.md`, `docs/README.md`, `README.md`

**Interfaces:**
- Produces: the contract every later task follows. Where this plan names a value, the docs carry the same value.

- [ ] **Step 1: INTENTIONS.md (v8).** Replace intention 6 with showing work through footage (silent loops and photos in the page, longer videos on YouTube or Vimeo that load on click). "What it must prove: I make it run" is proven by footage of shipped work and years of software. Remove the "Images that run" bullet and three.js from intention 12. "Done means": replace "Something real-time runs on the homepage" with "A loop of real work plays on the homepage". History paragraph: add "the live 3D viewer was dropped; the site shows footage". Replace the open-questions section with a link to SPEC section 6.
- [ ] **Step 2: SPEC.md.**
  - Principles: 6 becomes footage. Add the zero-dependency definition ("no npm packages, nothing running live; local tools are fine"). 10 becomes "no trackers; no request to another site until you press play on a video".
  - Decisions table: the 3D row becomes Media (repo files through `media.mjs`, YouTube/Vimeo behind click-to-load). The History row says `log` blocks are optional. The Agents row says "follows the llms.txt structure". Add the live 3D viewer to "Tried and dropped".
  - Scope: loops, photos and embeds.
  - Open questions: the single list. Remove production mono (JetBrains Mono, decided), rendered/raw (switch, decided) and 3D stage. Keep italics, first case, mods, Twitch dates, AAA by day.
  - Launch checklist: drop three.js; "WIP banner goes by itself at three real cases".
- [ ] **Step 3: DESIGN.md.**
  - §2: "Images and video keep their own colours".
  - §4: mono is JetBrains Mono.
  - §6: the file list shows a hanging `-` per row.
  - §7: remove 3D viewer. Add **Index** (file list; planned rows: title in `--grey`, no underline, not a link), **Loop** (no chrome; `pause`/`play` tag on hover and focus, kept while paused), **Player** (native controls), **Embed** (poster, `▶`, tag `YouTube · loads on play` / `Vimeo · loads on play`).
  - WIP banner: automatic below three real cases.
  - File bar: rendered/raw switch with JavaScript, a `raw` link without.
  - §9: grain and loops are the only motion; both stop with reduced motion.
- [ ] **Step 4: CONTENT.md.**
  - Replace §2 with the full grammar from the spec, section 6: blocks, inline, links, errors.
  - Add the file-list format and the planned/sample rules from spec section 7.
  - Rewrite §4 Assets around `media.mjs`: commands, outputs, budgets, the file-name rule.
  - Update the index and case templates: a file list, `buoy.mp4` in place of `.glb`.
  - `log` blocks are optional.
- [ ] **Step 5: BUILD.md.**
  - §1: zero-dependency definition, plus a Tools table: Media `media.mjs`+ffmpeg, Fonts `scripts/fonts.py` via uv, Browser checks `test/e2e/check.py` via uv; all local only.
  - §2 repository layout: `build.mjs`, `media.mjs`, `lib/`, `site/`, `scripts/fonts.py`, `content/media.json`, `test/`, `test/e2e/`, `test/fixtures/`.
  - §3 commands.
  - Delete `BASE_PATH`.
  - §4 pipeline gains the manifest checks.
  - §5 renderer: media rows (photo, loop, player, embed) and the file list.
  - §7: `filter: blob:none`; untracked files read as `not committed yet`.
  - §10 becomes "Media on the page".
  - §11 grain: no toggle.
  - §12: the media caps.
  - §13 tests: local `node --test` plus browser checks.
  - §14: the workflow is build and deploy only, no test job. The interim note stays until Task 13.
  - New §15 CSP: the exact policy from Task 9.
- [ ] **Step 6: docs/README.md and README.md.** Docs v2 (Nov 27, 2026). The root README mentions `media.mjs` and the zero-dependency rule.
- [ ] **Step 7: Verify.**
  Run: `grep -rniE "glb|three\.js|vendor/three|viewer|BASE_PATH" docs/*.md README.md`
  Expected: matches only in "Tried and dropped" or history lines.
  Run: `grep -n "^## .*Open questions" docs/*.md`
  Expected: `docs/SPEC.md` only.
- [ ] **Step 8: Commit.**
  `gitt add docs README.md && gitt commit -m "docs: the contract follows the foundation design"`

---

### Task 2: Markdown parser (blocks and inline)

**Files:**
- Create: `lib/parse.mjs`, `lib/inline.mjs`
- Test: `test/parse.test.mjs`, `test/inline.test.mjs`

**Interfaces:**
- Produces: `parse(md: string) → { blocks: Block[], errors: {line: number, message: string}[] }`. Lines are 1-based. Block types:
  - `heading {level, text}`, `quote {text}`, `para {text}`, `punch {text}` (no `==`)
  - `list {ordered, items: [{text, n?, line}]}`
  - `files {items: [{title, href: string|null, note, year: string|null, line}]}`
  - `table {head: string[], rows: string[][]}`, `media {alt, src}`, `code {lang, lines: string[]}`
  - `hr {}`, `comment {raw, text}`
  - Every block also has `line`.
- Produces: `parseInline(text: string) → { nodes: Inline[], errors: string[] }`, with `Inline = {t:'text', v} | {t:'strong', v} | {t:'code', v} | {t:'link', text, href}`.
- Produces: `renderInline(nodes: Inline[], link: (href) => {href, external}) → string`. HTML-escaped text; `<strong>`, `<code>`, `<a>` (external gets `target="_blank" rel="noopener"`).

- [ ] **Step 1: Write the failing tests** in `test/parse.test.mjs`:

```js
test('each block type', () => {
  const { blocks, errors } = parse(fixture); // fixture: one of every construct from CONTENT.md §2
  assert.deepEqual(errors, []);
  assert.deepEqual(blocks.map((b) => b.type),
    ['heading','quote','para','punch','list','list','files','table','media','code','hr','comment']);
});
test('file list: linked, planned, year', () => {
  const { blocks } = parse('- [A](a.md): Idea one. (2026)\n- B, still: Idea two. (2025)\n- [C](c.md): No year\n');
  assert.deepEqual(blocks[0].items.map(({ title, href, note, year }) => [title, href, note, year]),
    [['A','a.md','Idea one.','2026'], ['B, still', null, 'Idea two.','2025'], ['C','c.md','No year', null]]);
});
test('a list with no linked .md item stays a list', () => {
  assert.equal(parse('- Machine: tools\n- Me: decisions\n').blocks[0].type, 'list');
});
test('punch only when the paragraph is exactly ==text==', () => {
  assert.equal(parse('==Yes.==\n').blocks[0].type, 'punch');
  assert.equal(parse('Not ==this== one.\n').blocks[0].type, 'para');
});
test('outside the grammar fails with a line', () => {
  for (const [md, line, msg] of [
    ['# T\n\n#### Deep\n', 3, 'heading level'], ['- a\n  - nested\n', 2, 'nested'],
    ['<div>x</div>\n', 1, 'HTML'], ['```js\nx\n```\n', 1, 'language'], ['```\nx\n', 1, 'unclosed'],
    ['<!-- open\n', 1, 'unclosed'], ['* star\n', 1, 'use -'], ['![a](b.jpg) trailing\n', 1, 'alone'],
    ['    indented\n', 1, 'indented'], ['| a |\n| b |\n', 1, 'separator']]) {
    const { errors } = parse(md);
    assert.equal(errors[0]?.line, line, md); assert.match(errors[0].message, new RegExp(msg, 'i'));
  }
});
test('CRLF, BOM and trailing spaces parse like the clean file', () => {
  const clean = '# T\n\n> d\n\n- a\n';
  assert.deepEqual(parse('﻿# T  \r\n\r\n> d\r\n\r\n- a \r\n'), parse(clean));
});
```

  And in `test/inline.test.mjs`:

```js
test('strong, code, link; markers dropped', () => {
  assert.deepEqual(parseInline('a **b** `c` [d](e.md)').nodes.map((n) => n.t), ['text','strong','text','code','text','link']);
});
test('code spans keep markup literally', () => {
  const { nodes, errors } = parseInline('`a==b *c* <d>`'); assert.deepEqual(errors, []); assert.equal(nodes[0].v, 'a==b *c* <d>');
});
test('escapes', () => { assert.equal(parseInline('\\*x\\* \\[y\\]').nodes[0].v, '*x* [y]'); });
test('rejected inline', () => {
  for (const [s, msg] of [['*em*','italics'], ['_em_','italics'], ['a ==b== c','punch'], ['<b>x</b>','HTML'],
    ['**open','unclosed'], ['[x](javascript:alert(1))','scheme'], ['[x](data:text/html,1)','scheme']])
    assert.match(parseInline(s).errors.join(' '), new RegExp(msg, 'i'), s);
});
test('snake_case is not italics', () => { assert.deepEqual(parseInline('file_name_here').errors, []); });
test('renderInline escapes and marks external links', () => {
  const html = renderInline(parseInline('<&> [x](https://a.b)').nodes, (h) => ({ href: h, external: true })); // "<" not followed by a letter or "/" is text
  assert.match(html, /&lt;&amp;&gt;/); assert.match(html, /target="_blank" rel="noopener"/);
});
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node --test test/parse.test.mjs test/inline.test.mjs`
  Expected: FAIL (modules not found).
- [ ] **Step 3: Implement `parse` and `parseInline`/`renderInline`.** Line-based, after normalising (strip BOM, CRLF to LF, trailing spaces). Port the prototype's `render()` block loop (`prototype/index.html`, "a small markdown renderer") as the starting point, producing blocks instead of HTML.
  - **File list:** a `-` list where every item matches `^\[(.+?)\]\(([^)\s]+\.md)\):\s*(.+?)(?:\s*\((\d{4})\))?$` or the planned form `^([^\[\]:]+):\s*(.+?)(?:\s*\((\d{4})\))?$`, with at least one linked item.
  - **Italics:** single `*…*`, or `_…_` at word boundaries.
  - **Allowed schemes:** `https:`, `http:`, `mailto:`, or none (relative or `#`).
- [ ] **Step 4: Run the tests to verify they pass.**
  Run: `node --test test/parse.test.mjs test/inline.test.mjs`
  Expected: PASS.
- [ ] **Step 5: Commit.**
  `gitt add lib/parse.mjs lib/inline.mjs test/parse.test.mjs test/inline.test.mjs && gitt commit -m "feat: Markdown subset parser with line-numbered errors"`

---

### Task 3: Block renderer

**Files:**
- Create: `lib/render.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: `Block`, `parseInline`, `renderInline` (Task 2).
- Produces: `renderBlocks(blocks: Block[], ctx: {link(href) → {href, external}, media(block) → MediaRef}) → string`.
- Produces: `slug(text) → string` (lowercase, runs of non-alphanumerics to `-`, trimmed) and `anchors(blocks) → string[]` (heading ids in order, repeats get `-2`, `-3`).
- Consumes: the `MediaRef` shape defined in Task 4:
  - `photo {src, width, height, narrow, avif:[{src,w}], jpg:[{src,w}]}`
  - `loop` / `player {src, width, height, poster:{jpg, avif}, sources:[{src, type}]}`
  - `embed {service, url, iframe, poster: photo}`

  Tests pass literal objects.

- [ ] **Step 1: Write the failing tests.** One test per block type, asserting the HTML from BUILD.md §5 as updated in Task 1. The key ones:

```js
const ctx = { link: (h) => ({ href: h.replace(/\.md$/, '/'), external: /^https?:/.test(h) }), media: (b) => refs[b.src] };
test('heading with hanging marker and id', () => {
  assert.equal(renderBlocks(parse('## Work\n').blocks, ctx), '<h2 id="work"><span class="mk hang" aria-hidden="true">##</span>Work</h2>');
});
test('duplicate headings get unique ids', () => { assert.deepEqual(anchors(parse('## A\n\n## A\n').blocks), ['a', 'a-2']); });
test('file list renders the index table', () => {
  const html = renderBlocks(parse('- [A](a.md): Idea. (2026)\n- B: Later. (2025)\n').blocks, ctx);
  assert.match(html, /<th class="c0">#<\/th><th class="c1">case<\/th><th class="c2">idea<\/th><th class="c3">year<\/th>/);
  assert.match(html, /<td class="c0"><span class="mk hang" aria-hidden="true">-<\/span>01<\/td><td class="c1"><a href="a\/">A<\/a>/);
  assert.match(html, /<span class="planned">B<\/span><\/td><td class="c2">Later\.<\/td><td class="c3">2025<\/td>/);
});
test('photo: picture with avif and jpg srcsets, caption shows the line', () => { /* figcaption aria-hidden with ![ alt ]( src ), <source type="image/avif" srcset="…800w, …1600w, …2400w">, <img … width height alt loading> */ });
test('loop: muted loop playsinline controls, av1 source first, poster', () => {
  const html = renderBlocks([{ type: 'media', alt: 'Turn', src: 'l.mp4', line: 1 }], ctx);
  assert.match(html, /<video class="loop" muted loop playsinline preload="metadata" controls poster="\/l\.jpg" width="1920" height="1080" aria-label="Turn">/);
  assert.ok(html.indexOf('av01') < html.indexOf('avc1'));
});
test('player: preload none, controls, not .loop', () => { /* class="player" preload="none" controls, no autoplay */ });
test('embed: a link to the video with poster, play mark and tag', () => {
  const html = renderBlocks([{ type: 'media', alt: 'Film', src: 'https://youtu.be/abc', line: 1 }], ctx);
  assert.match(html, /<a class="embed" href="https:\/\/youtu\.be\/abc" data-embed="https:\/\/www\.youtube-nocookie\.com\/embed\/abc\?autoplay=1" data-title="Film" aria-label="Play: Film \(YouTube\)">/);
  assert.match(html, /YouTube · loads on play/);
});
test('the first media block is eager, the rest lazy', () => { /* first <img> loading="eager" fetchpriority="high"; later loading="lazy" */ });
test('special characters are escaped in text and attributes', () => {
  const html = renderBlocks([{ type: 'media', alt: `"<&>' 🙂`, src: 'p.jpg', line: 1 }], ctx);
  assert.match(html, /alt="&quot;&lt;&amp;&gt;&#39; 🙂"/);                       // attribute
  assert.match(html, /<span class="alt">&quot;&lt;&amp;&gt;&#39; 🙂<\/span>/);    // caption text
  // same for an embed: data-title and aria-label carry the escaped alt
});
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node --test test/render.test.mjs`
  Expected: FAIL.
- [ ] **Step 3: Implement `renderBlocks`, `slug`, `anchors`** following BUILD.md §5. Code blocks keep the prototype's `logic`/`yaml`/`log` colouring (`codeHTML` in the prototype). Comments render as `<p class="comment">` with `raw` escaped. Generic tables keep the hanging `|`. The embed tag says `YouTube` or `Vimeo`.
- [ ] **Step 4: Run the tests to verify they pass.**
  Run: `node --test test/render.test.mjs`
  Expected: PASS.
- [ ] **Step 5: Commit.**
  `gitt add lib/render.mjs test/render.test.mjs && gitt commit -m "feat: block renderer: visible syntax, index, media"`

---

### Task 4: Media model (manifest, embeds, kinds, checks)

**Files:**
- Create: `lib/media.mjs`, `test/_site.mjs` (helper)
- Test: `test/media.test.mjs`

**Interfaces:**
- Produces: `LIMITS = {loop: 10*MB, loopWarn: 6*MB, player: 60*MB, photo: 600*1024, total: 700*MB}`, with `MB = 1024*1024`. Also `NAME_RE = /^[a-z0-9][a-z0-9._-]*$/` and `MEDIA_EXT = /\.(jpe?g|png|webp|avif|mp4)$/i`.
- Produces: `loadManifest(contentDir) → Manifest`. Returns `{}` when `content/media.json` is missing. Keys are content-relative POSIX paths:
  - Photo entry: `{kind:'photo', width, height, sample?, master, variants:[{file, width, bytes, type}]}`.
  - Video entry: `{kind:'video', width, height, duration, audio, sample?, master, variants:[{file, bytes, type}], poster:{jpg:{file,bytes}, avif:{file,bytes}}}`. Variants are AV1 first.
  - The key itself is one of the variants: the 2400 px JPEG, or the H.264 mp4.
- Produces: `parseEmbed(url) → {service:'youtube'|'vimeo', id, hash?, start?} | null`. Accepts `https://youtu.be/ID`, `https://www.youtube.com/watch?v=ID` (optional `t=`), `https://vimeo.com/ID` and `https://vimeo.com/ID/HASH`.
- Produces: `embedSrc(e) → string` (the Global Constraints URLs, `&start=` for YouTube `t`) and `embedPosterKey(pageDir, e) → string` (`${pageDir}/youtube-ID.jpg` or `vimeo-ID.jpg`).
- Produces: `videoKind(entry) → 'loop'|'player'`: loop when `!audio && duration <= 30`.
- Produces: `mediaRef(manifest, key) → MediaRef`, with root-relative, percent-encoded URLs.
- Produces: `checkManifest(manifest, contentDir) → {errors:[{file, message}], warnings:[{file, message}]}`.
- Produces (test helper): `tmpSite(files: Record<string, string|Buffer>, {git = false} = {}) → root`. It writes `root/content/...`; with `git`, it runs `git init`, sets a local user, and commits everything.

- [ ] **Step 1: Write the failing tests.**

```js
test('embed URL forms', () => {
  assert.deepEqual(parseEmbed('https://youtu.be/abc_1-2'), { service: 'youtube', id: 'abc_1-2' });
  assert.deepEqual(parseEmbed('https://www.youtube.com/watch?v=abc&t=42'), { service: 'youtube', id: 'abc', start: 42 });
  assert.deepEqual(parseEmbed('https://vimeo.com/123/ff00aa'), { service: 'vimeo', id: '123', hash: 'ff00aa' });
  assert.equal(parseEmbed('https://dailymotion.com/x'), null);
  assert.equal(embedSrc({ service: 'vimeo', id: '123', hash: 'ff' }), 'https://player.vimeo.com/video/123?autoplay=1&dnt=1&h=ff');
});
test('loop or player', () => {
  assert.equal(videoKind({ audio: false, duration: 30 }), 'loop');
  assert.equal(videoKind({ audio: false, duration: 31 }), 'player');
  assert.equal(videoKind({ audio: true, duration: 5 }), 'player');
});
test('manifest check: missing file, wrong size, unlisted media, over budget', () => {
  // tmpSite with: an entry whose variant is missing; one whose bytes differ; a stray content/work/x/y.jpg not in the manifest;
  // a loop variant of 11 MB (sparse file via fs.truncateSync); a 7 MB loop (warning only)
  const { errors, warnings } = checkManifest(loadManifest(dir), dir);
  for (const m of ['missing', 'size changed', 'not in media.json', 'over 10 MB']) assert.ok(errors.some((e) => e.message.includes(m)), m);
  assert.ok(warnings.some((w) => w.message.includes('over 6 MB')));
});
test('total media budget', () => { /* entries summing past LIMITS.total → error mentioning 700 MB */ });
test('mediaRef encodes and orders', () => { /* video: sources[0].type includes av01; photo: avif widths [800,1600,2400]; portrait (height > width) → narrow */ });
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node --test test/media.test.mjs`
  Expected: FAIL.
- [ ] **Step 3: Implement `lib/media.mjs` and `test/_site.mjs`** to the interfaces above. `checkManifest` walks `content/` for `MEDIA_EXT` files that no entry lists. The size check compares `fs.statSync().size` with `bytes`.
- [ ] **Step 4: Run the tests to verify they pass.**
  Run: `node --test test/media.test.mjs`
  Expected: PASS.
- [ ] **Step 5: Commit.**
  `gitt add lib/media.mjs test/_site.mjs test/media.test.mjs && gitt commit -m "feat: media manifest, embeds and budgets"`

---

### Task 5: History from git

**Files:**
- Create: `lib/history.mjs`
- Test: `test/history.test.mjs`

**Interfaces:**
- Produces: `fileHistory(repoDir, relPath) → {edits: number, last: string|null}` (`last` is `YYYY-MM-DD`). It runs `git log --follow --format=%h|%cs -- <relPath>`; outside a repo, or with no commits for the file, it returns `{edits: 0, last: null}`.
- Produces: `commitExists(repoDir, hash) → boolean`, via `git cat-file -e <hash>^{commit}`.

- [ ] **Step 1: Write the failing tests.**

```js
test('counts edits across a rename', () => {
  // tmpSite({ 'a.md': '# A\n' }, { git: true }); edit + commit; git mv content/a.md content/b.md + commit
  assert.equal(fileHistory(root, 'content/b.md').edits, 3);
  assert.match(fileHistory(root, 'content/b.md').last, /^\d{4}-\d{2}-\d{2}$/);
});
test('untracked file and non-repo', () => {
  assert.deepEqual(fileHistory(root, 'content/new.md'), { edits: 0, last: null });
  assert.deepEqual(fileHistory(os.tmpdir(), 'x.md'), { edits: 0, last: null });
});
test('commitExists', () => {
  assert.equal(commitExists(root, headShort), true); assert.equal(commitExists(root, 'deadbee'), false);
});
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node --test test/history.test.mjs`
  Expected: FAIL.
- [ ] **Step 3: Implement it** with `spawnSync('git', …, {cwd: repoDir, encoding: 'utf8'})`. A non-zero status means "no history".
- [ ] **Step 4: Run the tests to verify they pass.**
  Run: `node --test test/history.test.mjs`
  Expected: PASS.
- [ ] **Step 5: Commit.**
  `gitt add lib/history.mjs test/history.test.mjs && gitt commit -m "feat: file history and commit checks from git"`

---

### Task 6: Site model and validation

**Files:**
- Create: `lib/site.mjs`, `lib/validate.mjs`
- Test: `test/site.test.mjs`, `test/validate.test.mjs`

**Interfaces:**
- Consumes: `parse`, `parseInline` (Task 2); `anchors` (Task 3); `loadManifest`, `parseEmbed`, `embedPosterKey`, `mediaRef`, `videoKind`, `checkManifest`, `NAME_RE` (Task 4); `fileHistory`, `commitExists` (Task 5).
- Produces: `loadSite({contentDir, repoDir}) → Site`:
  - `Site = {contentDir, repoDir, manifest, pages: Page[], byPath: Map<string, Page>, parseProblems: Problem[]}`
  - `Page = {path, url, raw, md, blocks, title, description, sample, history}`
  - `Problem = {file, line, message}`, where `file` is repo-relative (`content/work/x.md`).
- Produces: `pageUrl(path) → string`: `index.md` → `/`, `404.md` → `/404.html`, `a/b.md` → `/a/b/`.
- Produces: `isSample(page, manifest) → boolean`: a comment whose `text` starts with `sample` (case-insensitive), or any media entry with `sample: true`.
- Produces: `realCases(site) → number`: linked items in `index.md`'s file lists whose target page exists and isn't sample.
- Produces: `resolveHref(site, page, href) → {href, external, page?, anchor?} | {error}`. Internal `.md` links become the target's `url` plus `#anchor`. Other relative links must name an existing file under `content/`.
- Produces: `resolveMedia(site, page, src) → {ref: MediaRef} | {error}`: by extension through the manifest, or an embed through `parseEmbed` plus its poster key.
- Produces: `validate(site) → Problem[]` (every problem, sorted by file, then line) and `formatProblems(problems) → string` (`file:line: message` per line).

- [ ] **Step 1: Write the failing tests.** In `test/validate.test.mjs`, one fixture per rule. Each builds a `tmpSite` and asserts one problem with the right file, line and message:

```js
const RULES = [
  ['no H1', 'Just text.\n', 1, 'one H1'],
  ['two H1s', '# A\n\n> d\n\n# B\n', 5, 'one H1'],
  ['H1 not first', 'Text.\n\n# A\n', 1, 'first block'],
  ['no description', '# A\n\nText.\n', 3, 'blockquote'],
  ['two punch lines', '# A\n\n> d\n\n==x==\n\n==y==\n', 7, 'one punch'],
  ['empty alt', '# A\n\n> d\n\n![](p.jpg)\n', 5, 'alt'],
  ['.glb', '# A\n\n> d\n\n![m](m.glb)\n', 5, 'not a supported'],
  ['media not in manifest', '# A\n\n> d\n\n![p](p.jpg)\n', 5, 'media.mjs'],
  ['embed host', '# A\n\n> d\n\n![v](https://dailymotion.com/x)\n', 5, 'YouTube or Vimeo'],
  ['embed without poster', '# A\n\n> d\n\n![v](https://youtu.be/abc)\n', 5, 'youtube-abc.jpg'],
  ['broken link', '# A\n\n> d\n\n[x](nope.md)\n', 5, 'nope.md'],
  ['broken anchor', '# A\n\n> d\n\n[x](#nowhere)\n', 5, '#nowhere'],
  ['table columns', '# A\n\n> d\n\n| a | b |\n|---|---|\n| 1 |\n', 7, 'columns'],
  ['log format', '# A\n\n> d\n\n```log\nnot a commit line\n```\n', 6, 'log line'],
  ['log hash on a real page', '# A\n\n> d\n\n```log\ndeadbee  msg  Nov 1\n```\n', 6, 'deadbee'],
];
for (const [name, md, line, msg] of RULES) test(name, () => { /* tmpSite({ 'x.md': md }, { git: true }) → validate → one problem at content/x.md:line matching msg */ });
test('log hashes are not checked on sample pages', () => { /* same log page + "<!-- sample -->" → [] */ });
test('file names: lowercase, digits, dots, dashes', () => {
  // pages 'work/My Case.md' and 'work/café.md' → each one problem naming the path and the rule
});
test('parse errors and rule errors all come back in one run', () => { /* two files, three problems, sorted */ });
test('manifest problems surface with the media file', () => { /* checkManifest errors are mapped to {file: 'content/…', line: 0} */ });
test('formatProblems', () => { assert.equal(formatProblems([{ file: 'content/a.md', line: 3, message: 'm' }]), 'content/a.md:3: m'); });
```

  In `test/site.test.mjs`: `pageUrl` cases; `isSample` both ways (comment, sample media); `realCases` counting linked non-sample targets (planned rows and sample targets don't count); `resolveHref` for `../index.md` from `work/x.md` (→ `/`), `now.md#top`, `mailto:`, and an existing PDF.

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node --test test/site.test.mjs test/validate.test.mjs`
  Expected: FAIL.
- [ ] **Step 3: Implement `lib/site.mjs` and `lib/validate.mjs`.** `title` is the H1 text and `description` the first quote's text, both inline-stripped to plain text. `log` lines must match `^([0-9a-f]{7,40})\s{2,}(.+?)\s{2,}(\S.*)$`.
- [ ] **Step 4: Run the tests to verify they pass.**
  Run: `node --test test/site.test.mjs test/validate.test.mjs`
  Expected: PASS.
- [ ] **Step 5: Commit.**
  `gitt add lib/site.mjs lib/validate.mjs test/site.test.mjs test/validate.test.mjs && gitt commit -m "feat: site model and validation: every problem, file and line"`

---

### Task 7: Fonts

**Files:**
- Create: `scripts/fonts.py`, `site/fonts/` (`archivo-black.woff2`, `dm-sans.woff2`, `jetbrains-mono.woff2`, `fonts.css`, `coverage.json`, `OFL-ArchivoBlack.txt`, `OFL-DMSans.txt`, `OFL-JetBrainsMono.txt`)
- Test: `test/fonts.test.mjs`

**Interfaces:**
- Consumes: `parse` (Task 2) to classify characters.
- Produces:
  - `site/fonts/fonts.css`: `@font-face` for `"Archivo Black"` (400), `"DM Sans"` (variable, weight 400–700, optical size kept) and `"JetBrains Mono"` (400), plus metric-matched fallbacks `"Archivo Black fallback"`, `"DM Sans fallback"` and `"JetBrains Mono fallback"` (`local()` faces with `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override`).
  - `coverage.json`: `{ "<file>.woff2": { "sha256": "<hex>", "codepoints": [<int>…] } }`.

- [ ] **Step 1: Write the failing test** `test/fonts.test.mjs`:

```js
test('coverage.json matches the font files', () => { /* sha256 of each woff2 equals coverage.json */ });
test('every character in the content has a glyph in the font that renders it', () => {
  // walk content/**/*.md with parse(): headings + punch → archivo-black; para/list/quote/files/table text → dm-sans;
  // code lines, media alt+src (captions), comment raw → jetbrains-mono. Report every missing character with its file.
});
test('fonts under 150 KB', () => { /* sum of site/fonts/*.woff2 sizes < 150 * 1024 */ });
```

- [ ] **Step 2: Run it to verify it fails.**
  Run: `node --test test/fonts.test.mjs`
  Expected: FAIL (no `site/fonts`).
- [ ] **Step 3: Write `scripts/fonts.py`,** adapted from `5ed1192:scripts/fonts.py` (download from google/fonts at a pinned commit, subset, write OFL texts).
  - Sources: `ofl/archivoblack/ArchivoBlack-Regular.ttf`, `ofl/dmsans/DMSans[opsz,wght].ttf`, `ofl/jetbrainsmono/JetBrainsMono[wght].ttf`.
  - DM Sans: limit weight to 400–700. JetBrains Mono: instance at 400.
  - Every font gets Latin basic, Latin-1, `‘ ’ “ ” – — … · • € ™ ← ↑ → ↓` and every character in `content/**/*.md`. The mono also gets U+2500–257F and `▲ ▶ ▼ ◀`.
  - Write `fonts.css` with `font-display: swap` and the fallback faces, metrics computed from each font's `hhea`/`OS/2` against Arial (sans) and Courier New (mono). Then write `coverage.json`.
- [ ] **Step 4: Run the script and the test.**
  Run: `uv run -q --with fonttools --with brotli python -I scripts/fonts.py && node --test test/fonts.test.mjs`
  Expected: the script lists three fonts and the total size; the test PASSES. If a glyph is missing, the test names it. Fix the subset, not the test.
- [ ] **Step 5: Commit.**
  `gitt add scripts/fonts.py site/fonts test/fonts.test.mjs && gitt commit -m "feat: self-hosted subset fonts with coverage and fallbacks"`

---

### Task 8: Styles, template and client scripts

**Files:**
- Create: `site/style.css`, `site/template.html`, `site/main.js`, `site/theme.js`, `site/copy.js`, `site/grain-core.mjs`, `site/grain.js`, `site/media.js`, `lib/contrast.mjs`, `static/favicon.svg`
- Test: `test/contrast.test.mjs`, `test/grain.test.mjs`

**Interfaces:**
- Produces: `site/template.html` with these placeholders, filled by Task 9: `{{title}}`, `{{head}}` (metas, links, CSP, inline script, JSON-LD), `{{banner}}`, `{{path}}`, `{{main}}`, `{{status}}`, `{{scripts}}`. Element ids from the prototype: `grain`, `path`, `copy`, `t-day`, `t-night`, `viewseg`, `v-rendered`, `v-raw`, `page`, `raw`, `raw-pre`, `status`; plus `a.rawlink` (shown without JS).
- Produces: `site/main.js` imports and starts `theme.js`, `copy.js` and `grain.js`. `site/media.js` (loaded only on pages with video or embeds) exports and runs `initLoops(root = document)` and `initEmbeds(root = document)`.
- Produces: `lib/contrast.mjs`: `luminance(hex)` and `contrastRatio(fg, bg)` (ported from `5ed1192:src/build/contrast.mjs`), plus `readTokens(css) → {day: {paper, ink, grey, red, …}, night: {…}}` from the `:root{…}` and `html[data-theme="night"]{…}` rules.

- [ ] **Step 1: Write the failing tests.**

```js
// test/contrast.test.mjs: DESIGN.md §3, enforced
const { day, night } = readTokens(fs.readFileSync('site/style.css', 'utf8'));
test('main text AAA in both themes', () => {
  assert.equal(contrastRatio(day.ink, day.paper), 18.57); assert.equal(contrastRatio(night.ink, night.paper), 14);
});
test('secondary: AA by day, AAA by night', () => {
  assert.ok(contrastRatio(day.grey, day.paper) >= 4.5); assert.ok(contrastRatio(night.grey, night.paper) >= 7);
});
test('punch line: AA large by day, AAA large by night', () => {
  assert.ok(contrastRatio(day.red, day.paper) >= 3); assert.ok(contrastRatio(night.red, night.paper) >= 4.5);
});
// test/grain.test.mjs: the two tests from 5ed1192:test/texture.test.mjs ("grain tile shape", "grain offsets stay within one tile"),
// unchanged except the import path '../site/grain-core.mjs'
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node --test test/contrast.test.mjs test/grain.test.mjs`
  Expected: FAIL.
- [ ] **Step 3: Port the grain.** Port `site/grain-core.mjs` from `5ed1192:src/client/grain-core.mjs`, with `rng` copied in from `5ed1192:src/client/sky-core.mjs`. Port `site/grain.js` from `5ed1192:src/client/grain.js` unchanged; `main.js` calls it without a `toggle`.
- [ ] **Step 4: Write `site/style.css`** from the prototype's `<style>`.
  - Font stacks: `--display: "Archivo Black","Archivo Black fallback",sans-serif`; `--sans: "DM Sans","DM Sans fallback",sans-serif`; `--mono: "JetBrains Mono","JetBrains Mono fallback",ui-monospace,monospace`.
  - Drop the `.viewer` rules.
  - Add:
    - `.planned` (`--grey`, no underline)
    - per-row hanging `-` in `.tbl.index`
    - `figure video` (full width, `height:auto`, `background: var(--line)`)
    - `.loop` focus outline and `.loop-tag` (mono 11 px, bottom right, shown on `:hover`, `:focus-visible` and `[data-paused]`)
    - `.embed` (poster, centred `▶` in mono, `.tag`)
    - `html:not(.js)` rules hiding `#copy`, the theme switch and `#viewseg`; `.js .rawlink{display:none}`
    - `:focus-visible{outline:2px solid var(--ink);outline-offset:2px}`
    - `@media print` hiding the bar, the banner and `#grain`
- [ ] **Step 5: Write `site/template.html`** from the prototype's body. It has no inline markdown, no inline scripts except `{{head}}`'s theme script, and no `draft v14 · sample content` note in the bar.
- [ ] **Step 6: Write the client scripts.**
  - `theme.js`: the prototype's `applyTheme`, plus keeping `<meta name="theme-color">` in step (`#eff1f5` day, `#1c1917` night).
  - `copy.js`: copy `.md` and the raw switch, both fetching the `link[rel=alternate][type="text/markdown"]` href. On a clipboard failure, show raw and select it, as in the prototype.
  - `media.js`, loops (spec 5.3):
    - remove `controls`, then play while the loop is at least half on screen (`IntersectionObserver` threshold 0.5)
    - pause off screen and when the tab is hidden; with reduced motion, keep the poster and controls
    - make it focusable (`tabindex="0"`, `role="button"`, `aria-pressed`); click, Enter or Space toggles it and sets `data-paused`
    - add the `.loop-tag`
  - `media.js`, embeds: on click, `preventDefault` and replace the link with `<iframe src="{data-embed}" title="{data-title}" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>`, same 16:9 box.
- [ ] **Step 7: `static/favicon.svg`:** a grey mono `#` on Latte paper, about 300 bytes.
- [ ] **Step 8: Run the tests to verify they pass.**
  Run: `node --test test/contrast.test.mjs test/grain.test.mjs`
  Expected: PASS.
- [ ] **Step 9: Commit.**
  `gitt add site lib/contrast.mjs static/favicon.svg test/contrast.test.mjs test/grain.test.mjs && gitt commit -m "feat: styles, template, client scripts; contrast enforced by a test"`

---

### Task 9: Page assembly, agent files, build and dev server

**Files:**
- Create: `lib/page.mjs`, `lib/csp.mjs`, `lib/outputs.mjs`, `build.mjs`
- Test: `test/build.test.mjs`, `test/llms.test.mjs`, `test/serve.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 2–8.
- Produces: `HEAD_SCRIPT`, the exact inline script string (in `lib/page.mjs`): `try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"day"}catch(e){document.documentElement.dataset.theme="day"}document.documentElement.classList.add("js")`.
- Produces: `csp(inlineScripts: string[]) → string`:
  `default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; font-src 'self'; script-src 'self' 'sha256-<base64 per script>'; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; object-src 'none'; base-uri 'none'; form-action 'none'`
- Produces: `renderPage(page, site, {dev = false} = {}) → string`.
  - Title: `Luca Molluso` on the home page; elsewhere, the H1 without its trailing period, then ` · Luca Molluso`.
  - Head: `meta description`; `link rel=canonical`; `link rel=alternate type=text/markdown`; Open Graph (`og:title`, `og:description`, `og:url`, `og:type`, `og:image` as an absolute URL: the first photo's canonical JPEG, or a video poster, or `/og.jpg`) and `twitter:card` `summary_large_image`; `theme-color` `#eff1f5`; `link rel=icon /favicon.svg`; preloads for `archivo-black.woff2` and `dm-sans.woff2`; the CSP meta; `HEAD_SCRIPT`.
  - JSON-LD `Person` on the home page only, with `name`, `jobTitle "Technical Artist"`, `url`, `email "mailto:info@lucamolluso.com"`, `sameAs` LinkedIn and `address` Rome, IT.
  - Banner when `realCases(site) < 3`.
  - Path: breadcrumb `lucamolluso.com/<path>`.
  - Status line: the file's name, `<n> edits`, `last edit <Mon D, YYYY>`, the history link, and `sample data` when sample. An uncommitted file shows `not committed yet` instead of edits and date.
  - Scripts: `<script type="module" src="/assets/main.js">`, plus `/assets/media.js` only when the page has video or embeds; plus `/__reload.js` when `dev`.
- Produces: `ORIGIN`, `llmsFull(site) → string` (index first, then the file-list targets in order, then the other pages by path; 404 excluded; each section starts `Source: <ORIGIN><raw>`), `sitemap(site)` (every page except 404, `lastmod` from history) and `robots()`.
- Produces: `build({contentDir='content', siteDir='site', staticDir='static', outDir='dist', repoDir='.', dev=false} = {}) → Promise<{ok, problems, pages}>`. Outputs:
  - `outDir` emptied first
  - `<url>index.html` and the raw `.md` at `raw`
  - `llms.txt` (byte-identical to `index.md`), `llms-full.txt`, `sitemap.xml`, `robots.txt`, `404.html`, `.nojekyll`
  - `/assets/style.css` (`fonts.css` + `style.css`), `/assets/*.js`, `/assets/grain-core.mjs`, `/assets/fonts/*`
  - every file the manifest lists, at its content path
  - `static/*` at the root
- Produces: `serve({outDir, port = 8080}) → Promise<{url, close}>`. It serves MIME types for `html css js mjs md txt xml json svg jpg avif mp4 woff2`, handles `Range` (206), and adds `/__reload` (Server-Sent Events) plus `/__reload.js` when watching.
- Produces the CLI:
  - `node build.mjs` prints `formatProblems` and exits 1 on any problem; on success it prints the page count and time.
  - `node build.mjs --serve [--port N]` builds, serves, and watches `content/`, `site/` and `static/` (recursive `fs.watch`). It rebuilds after 100 ms of quiet and reloads open pages.
  - Run directly only (`import.meta.url` check), so tests can import it.

- [ ] **Step 1: Write the failing tests.**

```js
// test/build.test.mjs: a fixture site in a tmp git repo: index.md (file list: 1 linked, 1 planned; a loop), now.md,
// work/a.md (sample comment, a photo), 404.md, content/media.json + tiny real files whose bytes match
test('outputs', () => { /* exists: index.html, now/index.html, work/a/index.html, index.md, now.md, work/a.md, llms.txt,
  llms-full.txt, sitemap.xml, robots.txt, 404.html, .nojekyll, assets/style.css, assets/main.js, the media variants */ });
test('llms.txt is index.md byte for byte', () => { assert.ok(read('dist/llms.txt').equals(read('content/index.md'))); });
test('every page has the CSP and the hash matches HEAD_SCRIPT', () => { /* sha256 of HEAD_SCRIPT appears in each page's CSP meta */ });
test('no page references another origin except the embed data-attribute and the history/external links', () => {
  // in src= / href= of link, script, img, source, video: only root-relative URLs
});
test('banner while fewer than three real cases', () => { /* fixture: 0 real → banner on every page; a variant with 3 linked non-sample cases → no banner */ });
test('status line: sample, edits, uncommitted', () => { /* a.md: "sample data"; an extra uncommitted page: "not committed yet" */ });
test('media.js only where needed; JSON-LD only on home', () => {});
test('a problem stops the build', async () => { /* broken link → ok false, problems[0] has file and line, dist untouched */ });
// test/llms.test.mjs: the reference parser's rules (llms_txt: sections by "## ", items by
// /^-\s*\[(?<title>[^\]]+)\]\((?<url>[^)]+)\)(?::\s*(?<desc>.*))?$/) on the built llms.txt of the fixture:
test('Work and Contact parse as file lists', () => { /* Work has the linked case; Contact has the mailto and LinkedIn */ });
// test/serve.test.mjs
test('range requests and types', async () => { /* serve tmp dir; GET Range bytes=0-9 of a .mp4 → 206, 10 bytes, video/mp4; .md → text/markdown; charset=utf-8 */ });
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node --test test/build.test.mjs test/llms.test.mjs test/serve.test.mjs`
  Expected: FAIL.
- [ ] **Step 3: Implement `lib/csp.mjs`, `lib/outputs.mjs`, `lib/page.mjs` and `build.mjs`** to the interfaces above.
- [ ] **Step 4: Run the tests to verify they pass.**
  Run: `node --test`
  Expected: PASS, the whole suite.
- [ ] **Step 5: Commit.**
  `gitt add lib build.mjs test && gitt commit -m "feat: build.mjs: pages, agent files, CSP, dev server"`

---

### Task 10: `media.mjs` (local, ffmpeg)

**Files:**
- Create: `media.mjs`
- Test: `test/encode.test.mjs`

**Interfaces:**
- Consumes: `NAME_RE`, the manifest shape and `parseEmbed`/`embedPosterKey` (Task 4).
- Produces:
  - `codecString(stream) → string` (from ffprobe stream JSON)
  - `photoArgs(master, out, width, format: 'avif'|'jpg') → string[]`
  - `videoArgs(master, out, codec: 'av1'|'h264', {audio}) → string[]`
  - `posterArgs(master, out, seconds, format) → string[]`
  - `encode(master, contentPath, {contentDir = 'content', poster = 0, sample = false}) → Promise<entry>`
  - `embedPoster(url, pageDir, {contentDir = 'content', from = null, sample = false}) → Promise<entry>`
  - `writeManifestEntry(contentDir, key, entry)`: keys sorted, 2-space JSON, trailing newline
- Produces the CLI:
  - `node media.mjs <master> <content path> [--poster <s>] [--sample]`
  - `node media.mjs --embed <url> <page dir> [--from <still>] [--sample]`
  - Run directly only.
- Starting encoder values (the builder may tune; the budgets test is what matters):
  - Scale `-vf scale='min(<W>,iw)':-2:flags=lanczos` (no upscaling), `-map_metadata -1`, `-pix_fmt yuv420p`, `-movflags +faststart` on video.
  - H.264: `-c:v libx264 -preset slow -crf 23 -profile:v high`.
  - AV1: `-c:v libsvtav1 -preset 6 -crf 35`.
  - Audio: `-an` when silent, otherwise `-c:a aac -b:a 128k`.
  - AVIF stills: `-c:v libaom-av1 -still-picture 1 -crf 28 -cpu-used 4`. JPEG: `-q:v 3`.
  - Photo widths 800, 1600, 2400; video at most 1920.

- [ ] **Step 1: Write the failing tests.**

```js
test('codec strings', () => {
  assert.equal(codecString({ codec_name: 'h264', profile: 'High', level: 40 }), 'avc1.640028');
  assert.equal(codecString({ codec_name: 'h264', profile: 'Main', level: 31 }), 'avc1.4d001f');
  assert.equal(codecString({ codec_name: 'av1', profile: 'Main', level: 8, pix_fmt: 'yuv420p' }), 'av01.0.08M.08');
});
test('args: no upscaling, no metadata, silent loops have no audio', () => {
  const a = videoArgs('m.mov', 'o.mp4', 'h264', { audio: false });
  assert.ok(a.includes('-an') && a.includes('-map_metadata') && a.join(' ').includes("min(1920,iw)"));
});
test('rejects bad names', async () => { await assert.rejects(encode('m.png', 'work/x/My Hero.jpg'), /lowercase/); });
const hasFfmpeg = spawnSync('ffprobe', ['-version']).status === 0;
test('encodes a silent clip into a loop entry', { skip: !hasFfmpeg }, async () => {
  // ffmpeg -f lavfi -i testsrc=size=640x360:rate=30 -t 2 master.mp4 → encode(master, 'work/t/clip.mp4', { contentDir })
  // entry.kind 'video', audio false, duration ≈ 2, variants[0].type includes av01, poster files exist, media.json has the key
});
test('encodes a photo into three widths, never upscaled', { skip: !hasFfmpeg }, async () => {
  // testsrc 3000x2000 frame → widths [800,1600,2400]; a 1000 px master → only 800 and 1000 (canonical)
});
test('embed poster from a local still', { skip: !hasFfmpeg }, async () => { /* --from still → key work/t/youtube-abc.jpg */ });
```

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `node --test test/encode.test.mjs`
  Expected: FAIL.
- [ ] **Step 3: Implement `media.mjs`.**
  - Probe with `ffprobe -v error -print_format json -show_streams -show_format`. Hash masters with sha256 and skip unchanged ones.
  - Fetch embed thumbnails with `fetch`: YouTube `https://i.ytimg.com/vi/<id>/maxresdefault.jpg`, falling back to `hqdefault.jpg`; Vimeo `https://vimeo.com/api/oembed.json?url=<url>` → `thumbnail_url`. Fetching happens only when there's no `from`.
- [ ] **Step 4: Run the tests to verify they pass.**
  Run: `node --test test/encode.test.mjs`
  Expected: PASS, with the ffmpeg tests running on this VM.
- [ ] **Step 5: Check the codec strings against a real encode.**
  Run: `ffprobe -v error -show_streams` on the test outputs.
  Expected: profile and level match what `codecString` produced.
- [ ] **Step 6: Commit.**
  `gitt add media.mjs test/encode.test.mjs && gitt commit -m "feat: media.mjs: photos, loops, players and embed posters via ffmpeg"`

---

### Task 11: Sample content through the real pipeline

**Files:**
- Modify: `content/index.md`, `content/work/direction-as-code.md`
- Create: `content/404.md`, `content/media.json`, `content/portrait.jpg` (+ variants), `content/work/direction-as-code/{hero,sheet}.jpg` (+ variants), `content/work/direction-as-code/buoy.mp4` (+ `buoy.av1.mp4`, `buoy.jpg`, `buoy.avif`), `static/og.jpg`
- Test: `test/content.test.mjs`, `test/budgets.test.mjs`

**Interfaces:**
- Consumes: `media.mjs` (Task 10), `build` (Task 9), `loadSite`/`validate` (Task 6).

- [ ] **Step 1: Write the failing tests.**

```js
// test/content.test.mjs
test('the real content is valid', () => {
  assert.equal(formatProblems(validate(loadSite({ contentDir: 'content', repoDir: '.' }))), '');
});
// test/budgets.test.mjs: build the real content into a tmp outDir once (before hook)
test('HTML + CSS under 40 KB per page', () => {});
test('JS under 3 KB gzipped on pages without video or embeds', () => { /* sum gzip of main.js and its imports */ });
test('fonts under 150 KB', () => {});
test('media within its caps', () => { /* checkManifest(...).errors is empty */ });
```

- [ ] **Step 2: Run them to verify they fail.**
  Run: `node --test test/content.test.mjs test/budgets.test.mjs`
  Expected: FAIL (`buoy.glb`, the missing media, the broken `live.md` link).
- [ ] **Step 3: Make the masters (scratch, not committed), under the session scratchpad.**
  - (a) Render the prototype's placeholder SVGs (`lineup()`, `sheet()`, `portrait()` are globals in `prototype/index.html`) to PNG at 2400 px wide, in a Playwright page.
  - (b) Record the buoy: in a scratch page reusing the prototype's globals `buoyMesh`, `M4`, `VS` and `FS`, draw 360 frames at yaw `2π·i/360` (12 s at 30 fps, a seamless turn) on the `.viewer` gradient and contact shadow at 1920×1080. Screenshot each frame and assemble a master with `ffmpeg -framerate 30 -i f%04d.png -c:v libx264 -crf 12 buoy-master.mp4`.
- [ ] **Step 4: Encode them as sample media.**
  Run:
  `node media.mjs <scratch>/lineup.png work/direction-as-code/hero.jpg --sample`
  `node media.mjs <scratch>/sheet.png work/direction-as-code/sheet.jpg --sample`
  `node media.mjs <scratch>/portrait.png portrait.jpg --sample`
  `node media.mjs <scratch>/buoy-master.mp4 work/direction-as-code/buoy.mp4 --sample`
  Expected: four manifest entries; the buoy is a loop (silent, 12 s).
- [ ] **Step 5: Edit the content.**
  - `index.md`: the hero becomes `![Prop 01 from "Direction as code", turning. Sample footage.](work/direction-as-code/buoy.mp4)`. Work becomes the file list: case 01 linked, with `(2026)`; cases 02–05 planned, with the notes and years from today's table. Keep the existing comments.
  - `work/direction-as-code.md`: the `.glb` line becomes `![Prop 01, the buoy, turning. Sample footage.](direction-as-code/buoy.mp4)`, and the last nav line becomes `[index](../index.md)`.
  - `404.md`: `# Not here.`, `> This page doesn't exist, or it moved.`, `[index](index.md)`.
- [ ] **Step 6: Make `static/og.jpg`** (1200×630): the home page's top typeset in day theme, captured once with Playwright from a build, then compressed with ffmpeg. Keep it under 200 KB.
- [ ] **Step 7: Run the tests to verify they pass.**
  Run: `node --test`
  Expected: PASS, the whole suite.
- [ ] **Step 8: Commit.**
  `gitt add content static/og.jpg test/content.test.mjs test/budgets.test.mjs && gitt commit -m "feat: sample content through the real pipeline; budgets on the real build"`

---

### Task 12: Browser checks and parity

**Files:**
- Create: `test/e2e/check.py`, `test/fixtures/e2e/content/` (index with an embed, a player and a loop; tiny media made with `media.mjs` from ffmpeg `testsrc`; YouTube poster `--from` a local still; its own `media.json`)
- Modify: `.gitignore` (add `test/e2e/shots/`, `__pycache__/`), plus whatever the checks show is wrong

**Interfaces:**
- Consumes: `build` and `serve` (Task 9). `check.py` runs `node build.mjs` for `dist/`, builds the e2e fixture into a temp `outDir` with the real `site/` and `static/`, and serves both with `node -e "import('./build.mjs').then(m => m.serve(...))"`.
- Produces: `uv run -q --with playwright==1.64.1 python test/e2e/check.py [name …]`. It exits non-zero on any failed check and writes screenshots to `test/e2e/shots/`.

- [ ] **Step 1: Capture prototype references,** while `prototype/index.html` still exists: home and case, at 1440×900 and 390×844, day and night, into `test/e2e/shots/reference/`.
- [ ] **Step 2: Write `check.py`** with these named checks:
  - `shots`: the same views of `dist/` into `test/e2e/shots/`
  - `console`: no console errors or page errors on any page
  - `offsite`: no request to an origin other than the local server, while loading and scrolling every page, on both builds
  - `embed`: no iframe before a click; after a click, one iframe whose `src` starts with `https://www.youtube-nocookie.com/embed/`
  - `loops`: playing when scrolled into view; paused when scrolled away; `Space` on the focused loop pauses it and shows the tag; with `reduced_motion='reduce'`, paused with `controls`
  - `nojs`: `java_script_enabled=False`; every page's text present, `a.rawlink` visible, videos paused with `controls`, no theme or copy buttons
  - `cls`: layout shift under 0.05 at 1440×900 and 390×844, fresh context, fonts loading (`PerformanceObserver` `layout-shift`, buffered, after `load` plus 1 s)
  - `overflow`: `document.documentElement.scrollWidth <= innerWidth` on every page at 360×740
  - `focus`: Tab through the file bar, links, loops and embed; each focused element has an outline of at least 2 px
- [ ] **Step 3: Run it.**
  Run: probe the host port (Global Constraints), then `uv run -q --with playwright==1.64.1 python test/e2e/check.py`
  Expected: every check prints `ok`.
- [ ] **Step 4: Compare `shots/` with `shots/reference/` by eye,** page by page and theme by theme. Expected differences: the 3D stage replaced by the loop's poster or frame, the index's per-row `-`, the planned rows in grey, the mono font, the bar without the `draft v14` note. Anything else is a regression: fix it in `site/style.css` or `lib/render.mjs`.
- [ ] **Step 5: Fix what the checks found,** re-running `node --test` and `check.py` until both are green.
- [ ] **Step 6: Commit.**
  `gitt add test/e2e test/fixtures .gitignore site lib && gitt commit -m "test: browser checks for privacy, loops, no-JS, layout shift; parity fixes"`

---

### Task 13: Switch over

**Files:**
- Modify: `.github/workflows/pages.yml`, `docs/BUILD.md` (§14 interim note), `docs/README.md`, `README.md`
- Delete: `prototype/`

**Interfaces:**
- Consumes: a green `node --test`, a green `check.py`, and `node build.mjs` with no problems.

- [ ] **Step 1: Rewrite the workflow:** BUILD.md §14's YAML minus `node --test` and minus `BASE_PATH`. Checkout v5 with `fetch-depth: 0` and `filter: blob:none`; `setup-node` v5 with Node 22; `node build.mjs`; `upload-pages-artifact` v4 with `path: dist`; then `deploy-pages` v4.
- [ ] **Step 2: Delete `prototype/`** and every reference to it. Remove the interim notes from BUILD.md §14, `docs/README.md` and `README.md`. Check with `grep -rn "prototype" docs/*.md README.md` (expected: history mentions only).
- [ ] **Step 3: Full verification from a clean tree.**
  Run: `rm -rf dist && node --test && node build.mjs && uv run -q --with playwright==1.64.1 python test/e2e/check.py`
  Expected: all PASS; `build.mjs` reports the page count and no problems.
- [ ] **Step 4: Commit.**
  `gitt add -A .github docs README.md && gitt rm -r -q prototype && gitt commit -m "feat: the built site replaces the prototype"`
- [ ] **Step 5: Hand-off.** Final whole-branch review, then superpowers:finishing-a-development-branch. Tell Luca that merging and pushing `main` switches lucamolluso.com to the build, and that the workflow commit needs his push (or the Workflows permission on the token).
- [ ] **Step 6: After the first deploy:** open the live site. Check the status lines show real edit counts and dates (proof that `fetch-depth: 0` with `filter: blob:none` works) and that the Pages run took about as long as a normal build. Run `check.py`'s `offsite` and `console` checks against `https://lucamolluso.com`.
