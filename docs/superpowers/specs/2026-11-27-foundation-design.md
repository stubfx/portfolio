# Foundation: the real build, ready for real projects

Nov 27, 2026 · design for approval

## 1. Intent

The live site (`prototype/index.html`, deployed from `main`) is the new foundation. Build the real site from it and from `docs/`, and make the foundation strong enough that adding a project later means writing one Markdown file and running one media command, with no re-engineering. Luca brings the projects later; until then the sample content stays as a clearly marked placeholder.

**What the projects will be (Luca):** mostly videos and photos of previous projects, nothing interactive. Mostly short silent loops, a couple per project, plus a one-to-two-minute video here and there.

This design changes the build contract in `docs/`. Once it is approved, the plan's first step brings `docs/` in line with it, and from then on `docs/` is the contract again.

## 2. Decisions Luca made

1. The live prototype is the foundation; the Astro migration is discarded (branch deleted).
2. **No 3D viewer.** No `.glb` in the Markdown, no three.js. "I make it run" is proven by footage of shipped work.
3. **Media lives in the repo, or comes as embed links from YouTube or Vimeo** (those two only).
4. Embeds load only on click (below, 5.4). Proposed, then approved with "go ahead".
5. Everything in `docs/` not touched by this design stands: no framework, zero-dependency Node build, Catppuccin Latte with black text by day, warm neutral night, grain as the only effect, the case format, the voice.

## 3. Goals, non-goals, anti-goals

**Goals**

1. `node build.mjs` turns `content/` into a static `dist/` that looks like the prototype, page for page (minus the 3D viewer), and deploys to GitHub Pages in place of the prototype.
2. A media pipeline for photos, silent loops, longer videos and embeds, with the build refusing anything that skipped it.
3. A written, closed Markdown grammar. Anything outside it fails the build with a file and line number.
4. Honesty enforced by the build: sample and planned content is marked, and real pages are held to real data.
5. Privacy enforced by the browser, not by promise.
6. A test suite that proves the contract's claims (contrast, budgets, grammar, privacy, layout stability), plus browser checks.
7. `docs/` updated and consolidated so it matches what is built.

**Non-goals**

- Real project content, the portrait, `cv.md` text: later, from Luca.
- Open content questions: first real case, mods strip, Twitch dates, italics.
- Anything in SPEC's out-of-scope list (blog, CMS, analytics, search, MCP server…).

**Anti-goals** (failure even if it works)

- Any npm package, framework or bundler in the site or the build.
- Any request to another origin before a visitor presses play on an embed.
- A visible regression from the prototype's typesetting.
- Sample data that can pass as real.
- Effects creeping back (sky, dither, scroll animation, page transitions).

## 4. Constraints

- **Zero dependencies, as Luca defines it (a must):** no npm packages, and nothing running live (no runtime services, no third-party code on the page). Tools on Luca's own machine are fine.
- **Build and tests:** Node 22+, built-in modules only, `node --test`.
- **Media, fonts and browser checks:** local scripts may call system tools (`ffmpeg`/`ffprobe`, and Python through `uv run --with …` for fontTools and Playwright). They run on Luca's machine, never in CI; their outputs are committed. The site still installs nothing.
- **GitHub Pages:** published site up to 1 GB, files up to 100 MB, soft bandwidth 100 GB/month; no custom headers.
- **CI needs full history** (status lines come from git), so checkout uses `fetch-depth: 0`.
- **The site's own build and tests call `git` directly** (Luca, Nov 27: exempt from the machine's `gitt` rule), on this VM and in CI. Build tests may create throwaway fixture repos with real commits. Version-control commands typed by hand still use `gitt`.
- **The push token lacks the Workflows permission.** Changing `.github/workflows/pages.yml` needs Luca to push that commit or grant the permission.
- **Browser checks** use the Playwright server on the host (see the global CLAUDE.md), driven with `uv run --with playwright==1.64.1`.

## 5. Media

### 5.1 Approaches considered

| Approach | Trade-off | Outcome |
| --- | --- | --- |
| **A. Files in the repo**, encoded by a local ffmpeg script | One place, offline previews, the build can check every file; history keeps every re-encode, and the 1 GB Pages cap is the ceiling | **Chosen** (Luca) |
| **B. A bucket on Luca's domain** (e.g. Cloudflare R2) | No size ceiling; needs an account, an upload step with credentials, media in two places | Not chosen |
| Git LFS | Pages can't serve LFS files directly; every deploy downloads them against a quota | Dropped |
| **Embeds** (YouTube, Vimeo) | Streaming at the right quality, no repo weight; third-party by nature | **Chosen** (Luca) for longer videos, behind click-to-load |

Rule of thumb that follows: **loops and photos in the repo; long videos as embeds**, in the repo only when they stay under budget. Every media URL is resolved in one place in the build, so moving files to a bucket later is a one-line change.

### 5.2 The media script: `media.mjs`

`node media.mjs <master> <content path> [--poster <seconds>] [--sample]`

- Reads a master file from anywhere on disk (masters never enter the repo) and writes web files next to the page that uses them, e.g. `content/work/<case>/`.
- Records each output in `content/media.json` (the manifest): kind, width, height, duration, audio yes/no, the variants with their byte sizes and codec strings, a hash of the master, and `sample: true` when asked.
- Skips work when the master's hash is unchanged; re-encoding is explicit.
- Strips all metadata (no camera data, no GPS).

**Photos** (`.jpg`, `.png`, `.webp`, `.tif` masters) produce:

- `name.jpg`: the canonical file, at most 2400 px wide. This is what the Markdown points at, what raw readers open, and the Open Graph image.
- `name.<w>.avif` and `name.<w>.jpg` at 800, 1600 and 2400 px, never upscaled.

**Video** (any ffmpeg-readable master) produces:

- `name.mp4`: H.264, plays everywhere. The canonical file, the one the Markdown points at.
- `name.av1.mp4`: AV1, smaller, used where the browser can decode it. Safari decodes AV1 only on recent hardware, so H.264 stays as the fallback.
- `name.jpg` plus `name.avif`: the poster frame, from `--poster` seconds or the first frame.
- At most 1920 px wide, `+faststart`, no audio track when the master is silent.

**Kinds**, decided from the manifest: a video with no audio and at most 30 s is a **loop**; anything else is a **player**.

**Budgets**, checked by a test against the manifest and the files:

| Item | Cap |
| --- | --- |
| A loop, per variant | 10 MB (warning above 6 MB) |
| A player video, per variant | 60 MB |
| A photo variant | 600 KB |
| All media in `content/` | 700 MB (Pages cap is 1 GB) |

The numbers are starting points the builder can tune after encoding real material; the test is what matters.

### 5.3 Videos on the page

A loop:

```html
<figure>
  <figcaption aria-hidden="true">![alt](loop.mp4)</figcaption>
  <video class="loop" muted loop playsinline preload="metadata" controls
         poster="loop.jpg" width="1920" height="1080" aria-label="alt">
    <source src="loop.av1.mp4" type='video/mp4; codecs="av01…"'>
    <source src="loop.mp4" type='video/mp4; codecs="avc1…"'>
  </video>
</figure>
```

- **Without JavaScript:** poster and native controls; nothing plays by itself.
- **With JavaScript and motion allowed:** controls are removed; the loop plays while at least half of it is on screen and pauses otherwise, and pauses when the tab is hidden.
- **Reduced motion:** stays on the poster with native controls.
- **Pause mechanism** (WCAG 2.2.2: anything moving by itself for more than 5 s needs a way to stop it): the loop is focusable; click, Enter or Space toggles it. A small mono tag in the corner (`pause` / `play`, in the style of the old `3D · drag to turn` tag) shows on hover and keyboard focus, and stays while paused. Otherwise the loop shows no chrome.

A player (long video in the repo): same markup, `preload="none"`, native controls always, never autoplays.

### 5.4 Embeds

Markdown: `![alt](https://youtu.be/ID)`, `![alt](https://www.youtube.com/watch?v=ID)`, `![alt](https://vimeo.com/ID)` or `https://vimeo.com/ID/HASH` (unlisted). Any other host fails the build.

- **The build requires a local poster**: `content/…/youtube-ID.jpg` or `vimeo-ID.jpg`, processed like a photo. `node media.mjs --embed <url> <content path>` fetches the service's thumbnail once, at authoring time, or Luca passes his own still.
- **On the page:** a link to the video, holding the poster, a play mark and the tag `YouTube · loads on play`. Without JavaScript it is just that link.
- **On click:** JavaScript swaps in the iframe, privacy-enhanced: `https://www.youtube-nocookie.com/embed/ID?autoplay=1` or `https://player.vimeo.com/video/ID?autoplay=1&dnt=1` (plus `h=HASH`), with `title` from the alt text, `allow="autoplay; fullscreen; picture-in-picture"` and `referrerpolicy="strict-origin-when-cross-origin"`.
- **Raw readers and agents** see a plain link.

### 5.5 Privacy, enforced

Every page carries a Content-Security-Policy `<meta>`: everything `'self'`, the inline theme script allowed by hash, `img-src 'self' data:` (the ported grain draws its tile to a `data:` URL; `data:` never leaves the page), and `frame-src` limited to `https://www.youtube-nocookie.com https://player.vimeo.com`. The browser itself then blocks any accidental third-party request. The privacy line in SPEC becomes: **"no trackers; no request to another site until you press play on a video."**

## 6. The Markdown grammar

CONTENT.md gets a complete grammar: every construct, what it renders, and what fails. Highlights and changes:

**Blocks**

| Write | Rules |
| --- | --- |
| `# Title` | Exactly one, the first block |
| `> line` | The first blockquote must directly follow the H1; it becomes the page description |
| `## Section`, `### Sub` | No deeper levels |
| Paragraph | Lines join with a space; no hard breaks |
| `==One line.==` alone | At most one per page, never inside a sentence |
| `- item`, `1. item` | One level, no nesting |
| **File list** (new) | A list where every item is `[Title](page.md): note`, optionally ending in `(YYYY)`. Renders as the index table: number from position, title, note as the idea, year. See 7. Visible syntax (my call): a hanging `-` on each row, true to the source, in place of the prototype's single `|`. The small mono column labels (`# · case · idea · year`) stay as typesetting, like the numbers, which also aren't in the file |
| Table | Kept, with the index table's look; every row has the header's column count |
| `![alt](file)` alone on a line | Photo, video or embed, decided by the target (5). Alt text required. `.glb` and unknown types fail |
| Fenced code | Language is `logic`, `yaml`, `log` or none; anything else fails |
| `---`, `<!-- comment -->` | A comment may span lines. Any other HTML fails |

**Inline:** `**bold**`, `` `code` ``, `[text](url)`, backslash escapes for the markup characters. `*emphasis*` and `_emphasis_` fail until the italics question is decided.

**Links:** relative links must reach a content file, and `#anchor` must exist on the target page. Allowed schemes: `https:`, `http:`, `mailto:`. Anything else (`javascript:`, `data:`…) fails.

**Errors:** validation collects every problem in one run and prints `file:line: message`, then exits non-zero.

## 7. Honesty states: planned and sample

- **Planned:** an index item without a link, e.g. `- Live, in the browser: A luxury object, directed and running in real time. (2026)`. It renders as an index row with the title in `--grey` and no underline, and needs no file. The build passes with today's content, and llms.txt parsers skip it.
- **Sample:** a page carrying a comment that starts `<!-- sample`, or using media whose manifest entry says `sample: true`. Effects:
  - its status line ends with `sample data`;
  - `log` hashes are checked only on pages that are not sample, so the sample case keeps working while real pages must cite real commits.
- **The WIP banner is automatic:** it shows on every page while fewer than three cases are real (linked and not sample). SPEC's "remove the banner at launch" item becomes a consequence, not a chore. The bar's `draft v14 · sample content` note goes.

## 8. History from git

- Status line as in BUILD.md: edit count and last edit from `git log --follow`, link to the file's history on GitHub.
- `log` blocks become optional; past projects won't have them. Where present on a non-sample page, every hash must exist in this repo.
- CI: `fetch-depth: 0` with `filter: blob:none`, so the history comes without old media files. The builder measures that the status lines stay right and the checkout stays fast.

## 9. Agent layer

- `/llms.txt` stays `content/index.md`, byte for byte, and `/` and `/index.md` serve the same file.
- **Correction:** with a table for Work, the homepage wasn't a valid llms.txt; the format's sections are lists of links. With Work as a file list (6), the Work and Contact sections parse as file lists in the reference parser, and the prose sections are ignored. The docs say "follows the llms.txt structure", not "valid".
- Unchanged: `/llms-full.txt`, raw `.md` next to every page with `rel="alternate" type="text/markdown"`, sitemap, robots, JSON-LD `Person` on the homepage, `copy .md`.
- A test parses `/llms.txt` with the reference parser's rules and checks the cases and contact links come out.

## 10. Type and layout stability

- **Fonts self-hosted** as subset woff2 with their OFL files: Archivo Black 400, DM Sans variable (weight and optical size), and one mono. A one-off script (`scripts/fonts.py`, fontTools via `uv`) subsets them and writes metric-matched fallback faces (`size-adjust`, `ascent-override`, `descent-override`). Its outputs are committed.
- **The mono** (an open question in SPEC): **JetBrains Mono.** The logic diagrams use `─ │ └ ┘ ▲ ▶ ▼ ◀`. Checked Nov 27, 2026: IBM Plex Mono 2.5.0 (latest) has the box-drawing lines but not the four solid triangles, and JetBrains Mono 2.304 has all of them. A mono that lacks a glyph falls back to another font, and the diagram columns drift. Plex would only work if the diagrams switched to `↑ → ↓ ←`, which it does have. The system mono stack in the prototype differs per OS, and the markers are the signature, so it can't stay.
- **Glyph coverage test:** every character in the content must exist in the font that will render it (mono contexts in the mono, text in DM Sans, display in Archivo Black). This catches the curly-quote problem the old site hit.
- **No layout jump:** the display and text fonts are preloaded; with the matched fallbacks, cumulative layout shift stays under 0.05 at 1440 and 390 px, measured in the browser checks. Swapping fonts at 184 px is the biggest jump risk on the page.

## 11. Smaller calls

- **Raw view** (an open question in SPEC): keep the prototype's rendered/raw switch. It fetches the `.md` on first use, the same fetch `copy .md` uses. Without JavaScript the switch is replaced by a plain `raw` link to the `.md`. Chromium shows `text/markdown` inline (checked), so the link works.
- **Tokens:** `site/style.css` holds them. A contrast test reads it and enforces DESIGN.md's contrast table for both themes, porting the WCAG maths from the old `src/build/contrast.mjs`. The AAA claims become a test, not a promise.
- **Grain:** ported from `5ed1192` as BUILD.md says (`grain-core.mjs`, `grain.js`, `rng`, the `#grain` rules, the grain tests in `test/texture.test.mjs`). The grain toggle and the `nograin` head script are left out, because the new bar has no toggle.
- **Theme:** as BUILD.md (day default, stored choice, no flash); JavaScript keeps `<meta name="theme-color">` in step with the switch.
- **`BASE_PATH` goes.** lucamolluso.com is connected, so every URL is root-relative and absolute URLs use `https://lucamolluso.com`.
- **404:** from `content/404.md`, through the same renderer.
- **Open Graph:** the page's first photo or poster; a default `static/og.jpg` for pages without one. The builder makes the default once, typeset like the site.
- **The prototype is deleted** once the built site reaches parity and is live, so there is only one renderer. It stays in git history.
- **Dev loop:** `node build.mjs --serve` rebuilds on change and reloads the page (dev only).

## 12. Sample content after this

The placeholder must exercise the real pipeline, not bypass it:

- The prototype's SVG placeholders (props line-up, contact sheet, portrait) are rendered to PNG masters once and run through `media.mjs --sample`.
- The homepage hero and the sample case's proof, which were the 3D buoy, become one **sample loop**: the prototype's buoy recorded turning (browser frames to ffmpeg) before the prototype goes, run through `media.mjs --sample`.
- The index lists case 01 as a sample link and cases 02 to 05 as planned items.
- Embeds are covered by test fixtures, not by live content.

## 13. Tests and checks

**`node --test`** (runs locally before every merge; CI only builds and deploys, Luca, Nov 27):

- Renderer: one test per grammar row, plus escaping and link rewriting.
- Validation: one failing fixture per rule, plus "all errors in one run".
- Build: a fixture site in, the outputs of BUILD.md section 6 out.
- Media: the manifest matches the files (exist, byte sizes), budgets, kinds, embed posters present, embed URL forms.
- Budgets: HTML+CSS per page under 40 KB; JS under 3 KB gzipped on pages without embeds or video; fonts under 150 KB.
- Contrast from tokens; glyph coverage; llms.txt parse; a CSP on every page; the ported grain tests.

**Browser checks** (`test/e2e/`, Python Playwright through `uv`, against the host server; run before merging, not in CI):

- Screenshots at 1440 and 390, day and night, home and case, compared by eye with the prototype until it's deleted.
- No console errors; **no request to another origin on load**; the embed iframe appears only after a click.
- Loops: play when visible, pause off-screen, honour reduced motion, toggle with keyboard.
- No-JS render: all content readable, no autoplay, raw link present.
- Layout shift under 0.05; visible focus on every control.

**Before launch, by hand:** Lighthouse mobile 95+ in all four categories, on a phone and a wide screen.

## 14. Docs

- Every doc updated for: no viewer, video and embeds, the media script, planned and sample states, the file-list index, the full grammar, the privacy wording, the mono, no `BASE_PATH`, the tests.
- **One open-questions list**, in SPEC; INTENTIONS links to it. Today the two lists already differ.
- INTENTIONS keeps the why; facts and rules live in one place each.
- The interim deploy notes go once the real workflow is live.

## 15. Delivery

- Work on `feat/foundation`, merged to `main` after the browser checks and a final review.
- **Merging to `main` deploys.** The switch from prototype to built site happens on that push. The workflow change needs Luca's push, or the Workflows permission on the token (4).
- **The only CI change** is the deploy step: run `node build.mjs` (which validates) instead of copying the prototype. No test job.

## 16. Left to the builder

Exact encoder settings and codec strings; image quality values; the fallback font metrics; the file names inside `site/`; the dev reload mechanism; the default Open Graph image; how the buoy gets recorded; the order of work, as long as each step leaves the build green.
