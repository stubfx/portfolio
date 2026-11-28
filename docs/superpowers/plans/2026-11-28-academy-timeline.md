# Academy Pages and Homepage Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The homepage gets the career timeline back, with the academy projects as an edge-to-edge row of cards, and the first three academy pages (Frammenti, WAYLAY, Bricks of the Future) go live with Luca's name in their media metadata.

**Architecture:** The timeline reuses existing Markdown: `###` headings inside a `## Timeline` section are entries, and a file list inside that section renders as a row of cards whose covers come from each linked page's first media. A tiny separate script (`rows.js`) adds arrow buttons. `media.mjs` writes author metadata and flattens transparency onto the paper colour. The pages are content, written from the recovered Readymag archive.

**Tech Stack:** Node 22 built-ins (`node --test`), ffmpeg/ffprobe, the host Playwright server for browser checks (`uv run --with playwright==1.64.1`).

**Spec:** `docs/superpowers/specs/2026-11-28-academy-timeline-design.md`

## Global Constraints

- Zero dependencies: Node built-ins and local tools only; nothing from npm, nothing running live.
- Version control by hand: `gitt`, never `git`. The site's own build and tests may spawn `git`.
- Every HTTP request: `carlo`, never `curl`, and no other HTTP client. `media.mjs --embed` must always get `--from <local still>`, so its own `fetch` never runs.
- Browser checks: the host Playwright server (`H=$(ip route | awk '/^default/{print $3; exit}')`, port 3333, probe it first).
- The Markdown grammar stays closed. No new markup: the timeline and the rows use headings, paragraphs and file lists.
- File names: `^[a-z0-9][a-z0-9._-]*$`.
- Author strings: `Artist: Luca Molluso`, `Copyright: Luca Molluso, lucamolluso.com` (EXIF ASCII has no ©), and `<meta name="author" content="Luca Molluso">`.
- Budgets (BUILD.md section 12): HTML+CSS under 40 KB per page; core JS under 3 KB gzipped on pages without video; `rows.js` under 1 KB gzipped; photo files 600 KB, loop files 10 MB (warning at 6 MB), all media 700 MB.
- Voice (CONTENT.md section 8): first person ("we" for group work), short declarative lines, no em dashes, no adjectives that can't be proved. Academy brand briefs say they were academy briefs.
- Masters never enter the repo. The Readymag archive is at `~/porcofolio/readymag-archive/`; the current sample media's masters move to `~/porcofolio/masters/`.

## Review Focus

1. A timeline row item linking to a page that has no media must render as a text card with an empty cover, not crash or drop the card (test in Task 3).
2. A timeline year typed with a hyphen (`2022-2025`) must fail with `file:line` and say to use an en dash (test in Task 2).
3. Long card titles and notes at 360 px must wrap inside the card, and the row must never give the page a horizontal scroll (browser check in Task 8).
4. A PNG master with transparency must keep it: transparent pixels stay transparent in the WebP and PNG outputs and opaque ones keep their colour. As `.jpg` it must be refused without `--bg`, and flattened with it (tests in Task 1, with a real alpha channel).
5. The same `## Timeline` grammar must work on any page, not only `index.md`, since the grammar is general (test in Task 2).

---

### Task 1: Author metadata and kept transparency in media.mjs; author meta on every page

**Files:**
- Modify: `media.mjs` (photo, video and poster encoding), `lib/media.mjs` (`mediaRef` photo shape), `lib/site.mjs` (`resolveMedia` accepts `.png`), `lib/render.mjs` (`picture()`), `lib/page.mjs` (head, `ogImage`), `docs/BUILD.md`
- Test: `test/encode.test.mjs`, `test/media.test.mjs`, `test/render.test.mjs`, `test/build.test.mjs`

**Interfaces:**
- Produces:
  - `export const AUTHOR = 'Luca Molluso'`, `export const COPYRIGHT = 'Luca Molluso, lucamolluso.com'`.
  - `export function withExif(jpeg: Buffer): Buffer`: the JPEG with an APP1 Exif segment holding Artist 0x013B and Copyright 0x8298, inserted right after SOI.
  - `export function withPngText(png: Buffer): Buffer`: tEXt chunks `Author` and `Copyright` inserted after IHDR, with CRC from `zlib.crc32`.
  - `encode(..., { bg = null })` and CLI `--bg <hex>`.
  - `mediaRef` for a photo returns `{kind: 'photo', src, width, height, narrow, modern: [{type: 'image/avif'|'image/webp', set: [{src, w}]}], fallback: [{src, w}]}`, where `fallback` is the JPEG or PNG list, ascending. `picture()` emits one `<source>` per `modern` entry and the `<img>` from `fallback`. Later tasks (the card cover) use this shape.

- [ ] **Step 1: Write the failing tests** in `test/encode.test.mjs`:
  - `test('photos carry the author in EXIF; clips in their tags')`: encode a PNG and a 1 s clip; `fs.readFileSync(<jpg>).includes('Luca Molluso')` for the canonical and every JPEG width; ffprobe `format_tags=artist,copyright` on both MP4 variants equals `Luca Molluso` and `Luca Molluso, lucamolluso.com`; the video posters' JPEG includes the name too.
  - `test('withExif writes Artist and Copyright after SOI')`: on a tiny JPEG, the output starts with `ff d8 ff e1`, contains `Exif\0\0`, `Luca Molluso` and `lucamolluso.com`, and ffmpeg still decodes it (a 1-frame decode exits 0).
  - The test master for transparency: a 200×100 RGBA PNG, transparent red outside and opaque blue at (50..149, 25..74), made with the geq filter `color=c=red:s=200x100,format=rgba,geq=r='if(between(X\,50\,149)*between(Y\,25\,74)\,0\,255)':g='0':b='if(...\,255\,0)':a='if(...\,255\,0)'`. Read pixels with ffmpeg `format=rgba,crop=1:1:x:y` to raw RGBA.
  - `test('a transparent master keeps its transparency as .png')`: `encode(alpha, 'p.png')` writes `p.png` and `p.200.webp`, but not `p.800.webp` (never upscaled: widths are 800/1600/2400 filtered below the master, plus the canonical). In both, the pixel at (5,5) has alpha 0 and the one at (100,50) has alpha 255, blue over 230 and red under 20. `p.png` contains `Luca Molluso` (`withPngText`). The entry's variants are `image/webp` and `image/png`.
  - `test('a transparent master as .jpg is refused without --bg, flattened with it')`: `encode(alpha, 'p.jpg')` rejects with `/transparen.*\.png.*--bg/`. `encode(alpha, 'p.jpg', { bg: '#000000' })` gives a corner under 10 and the blue kept.
  - `test('an opaque master as .png is refused')`: rejects with `/no transparency.*\.jpg/`.
  - `test/media.test.mjs`: `mediaRef` of a JPEG photo entry gives `modern: [{type: 'image/avif', …}]` and a JPEG `fallback`; of a PNG entry, `modern: [{type: 'image/webp', …}]` and a PNG `fallback`. `test/render.test.mjs`: a `.png` photo renders `<source type="image/webp"` and an `<img src="…png"`.
  - In `test/build.test.mjs`: every built page's HTML contains `<meta name="author" content="Luca Molluso">`. A fixture page with `![a](t.png)` builds, and `resolveMedia` accepts `.png`.
- [ ] **Step 2: Run them and watch them fail.** `node --test test/encode.test.mjs test/media.test.mjs test/render.test.mjs test/build.test.mjs`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - `withExif`: a little-endian TIFF with one IFD of two ASCII entries (type 2, count includes the trailing NUL, values stored at offsets after the IFD). The APP1 length is big-endian. Insert after the first two bytes. Apply it to every JPEG `media.mjs` writes (photo widths inside the quality loop, before the size check, and video posters).
  - `withPngText`: insert after the IHDR chunk (8-byte signature plus 25 bytes).
  - MP4: add `-metadata artist=<AUTHOR> -metadata copyright=<COPYRIGHT>` after `-map_metadata -1` in `videoArgs`. AVIF and WebP stay bare (spec).
  - Transparency check: ffprobe `pix_fmt` matches `/a|pal8/` (`rgba`, `ya8`, `yuva420p`, `bgra`, `pal8`), and for `pal8`, a tiny `format=rgba` decode shows any alpha under 255.
  - `.png` path (alpha required): WebP per width `-c:v libwebp -pix_fmt yuva420p -quality 85`, and the canonical PNG `-c:v png -compression_level 9`, stepping its width down (canonical, then 1600, 1200, 800) until it fits `LIMITS.photo`. The entry `width` and `height` are the canonical PNG's.
  - `.jpg` path from a transparent master: without `bg`, throw `this master has transparency: name it .png to keep it, or pass --bg <hex> to flatten it onto a colour`. With `bg`, flatten via a second input `-f lavfi -i color=c=0x<bg>:s=<W>x<H>` and `-filter_complex "[1:v][0:v]overlay=format=auto:shortest=1,<scale>"`, with W×H the display size (checked 2026-11-28 that this keeps opaque pixels).
  - `mediaRef`, `picture()` and `ogImage` (a PNG photo's og image is its canonical PNG) move to the new shape. `resolveMedia`'s extension check accepts `.png`, and its error text lists it.
  - `lib/page.mjs`: push `<meta name="author" content="Luca Molluso">` into `head`, after the description.
  - CLI: `--bg <hex>` passes through to `encode`. The usage line and CONTENT.md section 4 describe `.png` and `--bg` (CONTENT in Task 4).
- [ ] **Step 4: Run the whole suite.** `node --test`. Expected: all pass.
- [ ] **Step 5: Move the sample masters and re-encode the existing media.** `mkdir -p ~/porcofolio/masters` and copy, from the scratch `masters/` folder and `outcomes.mkv`: `lineup.png` (hero), `sheet.png`, `portrait.png`, `buoy-master.mp4`, `outcomes.mkv`. Re-encode each with `--force`, keeping `--sample` and the stored `--poster` (`outcomes.mp4 --poster 5.4`, buoy as in media.json). Then `node build.mjs` and `node --test`. Expected: built, all pass; `grep -c "Luca Molluso" content/portrait.jpg` ≥ 1.
- [ ] **Step 6: Commit.** `gitt add media.mjs lib/page.mjs test/encode.test.mjs test/build.test.mjs content docs/BUILD.md && gitt commit -m "feat: media carries Luca's name; transparency flattens onto the paper"`

### Task 2: The timeline grammar: entries and validation

**Files:**
- Create: `lib/timeline.mjs`
- Modify: `lib/validate.mjs`
- Test: `test/timeline.test.mjs` (new), `test/validate.test.mjs`

**Interfaces:**
- Produces: `export const ENTRY_RE = /^(\d{4}(?:–(?:\d{4})?)?): (.+)$/` (U+2013 en dash); `export function timelineMask(blocks: object[]): boolean[]` (true for each block after a level-2 heading whose inline text is exactly `Timeline`, up to the next heading of level 1 or 2); `export function entry(text: string): {year: string, title: string} | null`.

- [ ] **Step 1: Write the failing tests.**
  - `timelineMask`: for `# T / > d / ## Timeline / ### 2017: A. / para / - [x](x.md): n / ## Now / para`, the mask is false, false, false, true, true, true, false, false (the `## Timeline` heading itself is false).
  - `entry('2017: Hired at IBM.')` → `{year: '2017', title: 'Hired at IBM.'}`; `'2022–2025: AANT.'` → year `2022–2025`; `'2015–: Mods.'` → year `2015–`; `'2022-2025: AANT.'` → null; `'Hired at IBM.'` → null.
  - Validation (`test/validate.test.mjs`): a page with `## Timeline` then `### 2022-2025: AANT.` gives a problem at that line containing `en dash`; `### Hired at IBM.` gives a problem containing `### YYYY: Title`; a `###` outside the Timeline section is never checked; the same rule fires on a page that isn't `index.md` (`work/x.md`).
- [ ] **Step 2: Run them and watch them fail.** `node --test test/timeline.test.mjs test/validate.test.mjs`. Expected: FAIL (no module, no rule).
- [ ] **Step 3: Implement** `lib/timeline.mjs` and, in `checkPage`, for each level-3 heading in the mask with `entry()` null: if the text matches `/^\d{4}-\d{4}/`, add `a timeline year range uses an en dash: 2022–2025`, otherwise `a timeline entry is "### YYYY: Title" (or YYYY–YYYY, or YYYY–)`.
- [ ] **Step 4: Run the whole suite.** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit.** `gitt add lib/timeline.mjs lib/validate.mjs test/timeline.test.mjs test/validate.test.mjs && gitt commit -m "feat: timeline entries: ### YYYY: Title inside ## Timeline, validated"`

### Task 3: Rendering the timeline and the rows of cards

**Files:**
- Modify: `lib/render.mjs`, `lib/page.mjs`
- Create: `site/rows.js`
- Modify: `site/style.css`, `docs/BUILD.md` (section 12 budget row)
- Test: `test/render.test.mjs`, `test/build.test.mjs`, `test/budgets.test.mjs`, `test/style.test.mjs`

**Interfaces:**
- Consumes: `timelineMask`, `entry` (Task 2); the photo ref shape `{src, width, height, modern, fallback}` and `picture()` (Task 1).
- Produces: `ctx.card(href: string) → {href: string, file: string, cover: object|null}`, where `file` is the target page's file name (`frammenti.md`) and `cover` is a photo-shaped ref from the target page's first media, or null:
  - a photo: as is
  - an embed: its poster
  - a loop or player: `{src: poster.jpg, width, height, modern: [{type: 'image/avif', set: [{src: poster.avif, w: width}]}], fallback: [{src: poster.jpg, w: width}]}` The markup classes `entry`, `when`, `row`, `cards`, `card`, `card planned`, `cover`, `file`, `title`, `note`, `row-btn prev`, `row-btn next` (CSS and `rows.js` rely on them). `site/rows.js` runs on load and exports nothing.

- [ ] **Step 1: Write the failing tests** in `test/render.test.mjs`, with a stub `ctx.card`:
  - An entry: `## Timeline` + `### 2017: Hired at IBM.` + para renders `<section class="entry"><p class="when">2017</p><h3 id="2017-hired-at-ibm">` with the hanging `###` and the text `Hired at IBM.` (no year inside the h3), the paragraph inside the same section, and the section closes before the next `###` or `##`.
  - A file list inside the Timeline renders `<div class="row">` with `<ul class="cards">`, one `<li class="card">` per linked item containing `<a href="/work/x/">`, `<span class="file">x.md</span>`, the title and the note, and a `<picture>` with `loading="lazy"` and `alt=""` when the card has a cover. A planned item renders `<li class="card planned">` with no `<a>` and an empty `<span class="cover"></span>`. A linked item whose `cover` is null renders the empty cover too (Review Focus 1). Two `<button class="row-btn ...">` with `aria-label`s `Scroll left` and `Scroll right`.
  - A file list outside the Timeline still renders the index table (`class="tbl index"`).
  - `test/build.test.mjs`, on a fixture site: the home links a page whose first media is a photo and another with only text. The card for the first has that photo's `srcset`, the second has an empty cover; the home HTML loads `/assets/rows.js`, and a page without rows doesn't.
  - `test/budgets.test.mjs`: `rows.js` gzipped under 1024 bytes. The "pages without video" check accepts `['main.js']`, or `['main.js', 'rows.js']` on a page with a row.
  - `test/style.test.mjs`: `.row` sets negative left and right margins from `--bleed-l` and `--bleed-r`; `.cards` has `scroll-snap-type:x mandatory`; `body` has `overflow-x:clip`; `html:not(.js) .row-btn` is `display:none`.
- [ ] **Step 2: Run them and watch them fail.** `node --test test/render.test.mjs test/build.test.mjs test/budgets.test.mjs test/style.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `renderBlocks`: compute the mask once. Inside it, open `<section class="entry">` at each level-3 heading (closing the previous one) and close it at the end of the masked run; the entry heading renders as above; `files` blocks in the mask render as the row; everything else renders as today.
  - `picture()` gains an optional `sizes` argument; cards use `(min-width: 720px) 22rem, 72vw`.
  - `page.mjs`: add `ctx.card` (via `resolveHref`, then `refs(site, target)[0]`, mapped to a picture ref), and add `<script type="module" src="/assets/rows.js">` when the page has a `files` block inside a Timeline.
  - `site/rows.js`: for each `.row`, the buttons scroll `.cards` by 90% of its width (`behavior: 'smooth'`, or `'auto'` under `prefers-reduced-motion: reduce`); on `scroll` (passive) and once at start, set `disabled` on prev at the start and next at the end (1 px tolerance).
  - CSS (values within DESIGN.md's tokens):
    - `.entry` is a grid `10ch 1fr` (gap 1.5rem) with `.when` in column 1 (mono 13px, `--mk`, padding-top to sit on the h3's first line) and other children in column 2. Below 720 px it's a single column, with `.when` above the h3.
    - `.row`, in grid column 1 / -1: `--bleed-l: calc(max(0px, (100vw - 1560px) / 2) + var(--pad) + var(--hw))` and `--bleed-r: calc(max(0px, (100vw - 1560px) / 2) + var(--pad))`, `margin: 1.2em calc(-1 * var(--bleed-r)) 2.2em calc(-1 * var(--bleed-l))`, position relative.
    - `.cards`: flex, gap 16px, `overflow-x: auto`, `scroll-snap-type: x mandatory`, `padding: 0 var(--bleed-r) 12px calc(var(--bleed-l) + 10ch + 1.5rem)` and a matching `scroll-padding-left`. Below 720 px it's `padding-left: var(--bleed-l)`.
    - `.card`: `flex: 0 0 22rem`, 72vw below 720 px, `scroll-snap-align: start`. `.cover` is 4:3 with `background: var(--line)` and `overflow: hidden`, and its img uses `object-fit: cover`.
    - `.file`: mono 12px `--mk`. `.title`: body size. `.note`: `--grey`, smaller. Planned cards' title is `--grey`.
    - Hover on `a`: `.cover img` scales 1.03 over 150 ms (none with reduced motion), `.title` turns `--red`. Focus-visible outline on the link.
    - `.row-btn`: absolute, vertically centred on the covers, left and right inside the viewport edge, ink 1 px border, paper background, mono; shown only `@media (hover: hover)`; `html:not(.js) .row-btn{display:none}`; `[disabled]` at opacity .3.
    - `body{overflow-x:clip}`.
  - BUILD.md section 12: add the row "`rows.js` (pages with a card row) | under 1 KB gzipped".
- [ ] **Step 4: Run the whole suite.** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit.** `gitt add lib/render.mjs lib/page.mjs site/rows.js site/style.css docs/BUILD.md test && gitt commit -m "feat: timeline entries and edge-to-edge rows of cards"`

### Task 4: The homepage timeline, and the docs

**Files:**
- Modify: `content/index.md`, `docs/CONTENT.md`, `docs/DESIGN.md`
- Test: `node --test` (the real-content and budget tests), `node build.mjs`

- [ ] **Step 1: Replace `## Work` in `content/index.md`** with the `## Timeline` text from the spec, verbatim (section "The timeline"), except that rows for pages not written yet stay planned (no link). In this task all three academy links are planned too; Tasks 5 to 7 turn them into links as each page lands.
- [ ] **Step 2: Build.** `node build.mjs`. Expected: `built N pages`, no problems.
- [ ] **Step 3: Update the docs.**
  - CONTENT.md: section 2, a row "`### YYYY: Title` inside `## Timeline` | A timeline entry | YYYY, YYYY–YYYY or YYYY– (en dash); only inside the Timeline", and under file lists, "Inside `## Timeline` a file list renders as a row of cards; the cover is the linked page's first media". Section 4: author metadata and `--bg`. Section 5: the index format with the Timeline. A new subsection "Academy pages": the closing line `Academy project, AANT, BA in Art Direction. [index](../index.md)`, the academy-brief line, "we" for group work. Section 10: the academy entry replaces "Before the machines", and the first three pages are listed.
  - DESIGN.md section 7: **Timeline** and **Row of cards** components, as built in Task 3.
- [ ] **Step 4: Run the whole suite.** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit.** `gitt add content/index.md docs/CONTENT.md docs/DESIGN.md && gitt commit -m "feat: the career timeline is back on the homepage"`

### Tasks 5, 6, 7: The academy pages (one task each: Frammenti, WAYLAY, Bricks of the Future)

**Files (per page `<slug>` = `frammenti`, `waylay`, `bricks-of-the-future`):**
- Create: `content/work/<slug>.md`, media in `content/work/<slug>/` (via `media.mjs`)
- Modify: `content/index.md` (the row item becomes a link)
- Source: `~/porcofolio/readymag-archive/pages/18-rai-frammenti.md`, `11-waylay-black-mirror.md` and `12-bricks-of-the-future.md`, with their `images/` and `videos/`

- [ ] **Step 1: Write the page** in English from the archive note: the H1 (the project's idea), the intro blockquote, sections following the original's own structure, at most one punch line, credits as "we" where the original says "abbiamo", and the closing `---` line. Brand briefs (WAYLAY: Netflix, Black Mirror; Bricks: LEGO and OpenAI) say "An academy brief: …" in the intro or the first paragraph. Frammenti says it was made with RAI Cultura, and links the RaiPlay broadcast URL from the archive.
- [ ] **Step 2: Encode the media it uses** (only those that carry the page), into `content/work/<slug>/` with lowercase descriptive names:
  - photos: `node media.mjs <archive image> work/<slug>/<name>.jpg`
  - silent clips of 30 s or less: `.mp4` loops
  - clips with sound: players, or with the audio dropped first when the sound is incidental (`ffmpeg -an` into a scratch master)
  - Vimeo films: `node media.mjs --embed <vimeo url> work/<slug> --from ~/porcofolio/readymag-archive/images/<page>/vimeo-<id>.jpg`

  No `--sample`.
- [ ] **Step 3: Link it from the row** in `content/index.md`.
- [ ] **Step 4: Build and test.** `node build.mjs && node --test`. Expected: built, all pass (budgets included). After the third page, the WIP banner is gone from the built pages (`grep -L 'class="wip"' dist/index.html` prints the file).
- [ ] **Step 5: Look at it** in the host browser at 1440 and 390, day and night: a screenshot of the page and of the home row.
- [ ] **Step 6: Commit.** `gitt add content && gitt commit -m "content: <Title>, an academy project"`

### Task 8: Browser checks for the rows; finish

**Files:**
- Modify: `test/e2e/check.py`, `test/fixtures/e2e/content/index.md` (a Timeline with a row of three linked pages and one planned item, one title long enough to wrap)
- Test: `uv run -q --with playwright==1.64.1 python test/e2e/check.py`

- [ ] **Step 1: Add a `rows` check** to `check.py` (fixture and real build, at 1440, 390 and 360):
  - the first `.row`'s bounding box spans x 0 to the viewport width (±1 px)
  - `document.documentElement.scrollWidth <= clientWidth` (no page scroll)
  - at 1440 with hover, `.row-btn.next` scrolls `.cards` (scrollLeft increases) and `.prev` starts disabled
  - Tab to the first card shows a focus outline of 2 px or more
  - long titles stay inside their card (card `scrollWidth <= clientWidth`)
- [ ] **Step 2: Run it and watch it fail** before Task 3's CSS is right, or confirm it passes once it is (it runs after Tasks 3 to 7). Expected at the end: all checks ok, including `cls`, `overflow`, `focus` and `offsite`.
- [ ] **Step 3: Final whole-branch review,** then fixes per executing-plans.
- [ ] **Step 4: Merge to main and push** (Luca: "you can publish those on git"); check the Pages run and the live site (console, offsite, rows), all HTTP through `carlo` or the host browser.
