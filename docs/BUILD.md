# Build

How the site is built, served and deployed.

## 1. No framework, zero dependencies

**Zero dependencies is a must:** no npm packages, and nothing running live. **We do not use a framework, a bundler or a package manager.** No Astro, 11ty, Next, React or Tailwind, and no `npm install`.

- The site is a handful of Markdown files in a small, fixed subset ([CONTENT.md](CONTENT.md) section 2). Our own renderer is a few hundred lines; a framework would bring hundreds of dependencies to do less.
- The renderer is part of the design: it decides which syntax stays visible, how a file list becomes the index, how an image line becomes a photo, a loop or an embed. Owning it beats bending a framework's Markdown pipeline.
- Zero dependencies: nothing to update or audit, and a build that still works in five years.
- Tools on Luca's own machine are fine: they prepare files that get committed, and neither CI nor the site needs them.

| Need | Solution |
| --- | --- |
| Build | `build.mjs`, Node 22+, built-in modules only |
| Markdown | `lib/parse.mjs`, `lib/inline.mjs`, `lib/render.mjs`: our parser and renderer for the subset |
| Styles | One hand-written `site/style.css`, CSS custom properties |
| Client JS | `site/main.js` (theme, copy and raw, grain) and `site/media.js` (loops and embeds, only on pages with video). Content never needs JS |
| Dev server | `node build.mjs --serve` |
| Tests | `node --test`, run locally before every merge |
| Deploy | GitHub Actions to GitHub Pages: build and deploy only |

**Local tools** (Luca's machine only; outputs committed):

| Tool | What for | Needs |
| --- | --- | --- |
| `media.mjs` | Photos, transparent images (WebP and PNG, transparency kept), loops, players, embed posters, the manifest. Names Luca as author in every JPEG, PNG and MP4 it writes. Masters stay outside the repo (`~/porcofolio/masters/`, `~/porcofolio/readymag-archive/`) | ffmpeg and ffprobe |
| `scripts/fonts.py` | Subsetting the fonts, fallback metrics, glyph coverage | `uv run --with fonttools --with brotli` |
| `scripts/outcomes/` | The homepage loop: a 2D canvas animation, rendered frame by frame, then through `media.mjs` | `uv run --with playwright==1.64.1`, the Playwright server on the host, ffmpeg |
| `test/e2e/check.py` | Browser checks | `uv run --with playwright==1.64.1` and the Playwright server on the host |

## 2. Repository

```
content/                  the site, in Markdown (see CONTENT.md)
  media.json              the media manifest (written by media.mjs)
lib/                      build-time modules
  parse.mjs  inline.mjs   Markdown subset → blocks
  render.mjs              blocks → HTML
  media.mjs               manifest, embeds, budgets
  history.mjs             edit counts and commit checks from git
  site.mjs                the site model: pages, links, media, states
  validate.mjs            every problem, file and line
  page.mjs  csp.mjs  outputs.mjs  contrast.mjs
site/
  template.html           page shell
  style.css
  main.js  theme.js  copy.js  grain.js  grain-core.mjs  media.js
  fonts/                  subset woff2, fonts.css, coverage.json, OFL licences
static/                   copied as-is: CNAME, favicon.svg, og.jpg
build.mjs
media.mjs
scripts/fonts.py
scripts/outcomes/         the homepage loop: index.html (the animation), render.py
test/                     node --test files, fixtures, test/e2e/ (browser checks)
.github/workflows/pages.yml
docs/
```

## 3. Commands

```sh
node build.mjs            # content/ + site/ + static/ → dist/ (validates first)
node build.mjs --serve    # build, serve dist/ on :8080, rebuild and reload on change
                          # --host 0.0.0.0 to open it from another machine; --port N
node --test               # every test
node media.mjs …          # encode media (CONTENT.md section 4)
uv run -q --with fonttools --with brotli python -I scripts/fonts.py
uv run -q --with playwright==1.64.1 python -I scripts/outcomes/render.py   # usage in its docstring
uv run -q --with playwright==1.64.1 python test/e2e/check.py
```

Every URL is root-relative; absolute URLs use `https://lucamolluso.com`.

## 4. Pipeline

1. Read `content/**/*.md`, `content/media.json` and each file's git history.
2. **Validate** (any failure stops the build; every problem is reported at once as `file:line: message`): the Markdown subset; one H1 first, then the description; at most one punch line; no inline `==`; non-empty alt text; supported media only, each in the manifest; every manifest file present with its recorded size; no media file missing from the manifest; budgets; embed hosts and posters; every internal link and anchor resolves; `log` lines well formed, and their hashes real on pages that aren't sample; file names.
3. Render each file into `site/template.html`; write `dist/<path>/index.html`; copy the raw `.md` next to it.
4. Write `llms.txt`, `llms-full.txt`, `sitemap.xml`, `robots.txt`, `404.html`.
5. Copy `site/` assets to `/assets/`, every file the manifest lists, and `static/`.
6. Write `.nojekyll`.

## 5. Renderer

| Markdown | HTML |
| --- | --- |
| `# T` | `<h1 id="t"><span class="mk hang" aria-hidden="true">#</span>T</h1>` (same pattern for `##`, `###`) |
| `> q` | `<blockquote>` with a hanging `>` |
| Paragraph | `<p>` |
| Paragraph that is only `==t==` | `<p class="punch">` with `<mark>t</mark>` and visible `==` markers |
| `**b**` | `<strong>` (markers hidden) |
| `[t](x.md)` | `<a href="/x/">` (`.md` rewritten to the pretty URL; external links get `target="_blank" rel="noopener"`) |
| `` `c` `` | `<code>` |
| `- i` / `1. i` | `<ul>` / `<ol>`, each `<li>` with a hanging marker |
| File list | `<div class="tbl index">` with a `<table>`: labels `# · case · idea · year`; each row a hanging `-`, the number, the title (a link, or `<span class="planned">`), the note, the year |
| Table | `<div class="tbl">` with a hanging `|`, then `<table>`; cells get `c0`, `c1`… classes |
| `![a](f.jpg)` | `<figure>` with `<figcaption aria-hidden="true">` showing the whole line, then `<picture>` (AVIF `srcset`) with `<img src srcset alt width height loading decoding>`; `class="narrow"` for portrait orientation. The page's first media is eager |
| `![a](f.mp4)`, loop | `<video class="loop" muted loop playsinline preload="metadata" controls poster width height aria-label>` with the AV1 `<source>` first, then H.264 |
| `![a](f.mp4)`, player | `<video class="player" preload="none" controls poster width height aria-label>`, same sources |
| `![a](YouTube or Vimeo URL)` | `<a class="embed" href="<url>" data-embed="<player URL>" data-title="a" aria-label="Play: a (YouTube)">` holding the poster `<picture>`, a `▶` and the tag |
| Fenced code | `<div class="code">` with visible fences and `<pre>`; `logic`, `yaml`, `log` get their colouring spans |
| `---` | `<div class="hr" aria-hidden="true">---</div>` |
| `<!-- c -->` | `<p class="comment">` with the escaped comment |

All text and every attribute is HTML-escaped. Headings get `id`s from their text for in-page links; repeats get `-2`, `-3`.

## 6. Outputs

| Source | HTML | Raw |
| --- | --- | --- |
| `content/index.md` | `/` | `/index.md`, `/llms.txt` (byte for byte) |
| `content/now.md` | `/now/` | `/now.md` |
| `content/cv.md` | `/cv/` | `/cv.md` |
| `content/404.md` | `/404.html` | `/404.md` |
| `content/work/<case>.md` | `/work/<case>/` | `/work/<case>.md` |
| all pages | | `/llms-full.txt` (index first, then the cases in index order, then the rest; each preceded by `Source: <absolute .md URL>`) |

Every page's `<head>`: `<title>` from the H1; `<meta name="description">` from the blockquote; `<link rel="canonical">`; `<link rel="alternate" type="text/markdown" href="….md">`; Open Graph tags (the first photo or poster, or `/og.jpg`); `<meta name="theme-color">`; the CSP (section 15); preloads for the display and text fonts. Homepage only: JSON-LD `Person` (name, jobTitle "Technical Artist", url, email, sameAs LinkedIn, address Rome).

## 7. History from git

The site's build and tests call `git` directly (Luca's exemption from the machine's `gitt` rule).

- For each content file: `git log --follow --format=%h|%cs -- content/<path>` gives the edit count and the last edit date for the status line. A file with no commits yet reads `not committed yet`.
- The status line links to `https://github.com/stubfx/portfolio/commits/main/content/<path>`.
- `log` blocks: each hash is checked with `git cat-file -e <hash>^{commit}` on pages that aren't sample.
- CI checks out with `fetch-depth: 0` (or the history is empty) and `filter: blob:none` (history without old media files).

## 8. Agent layer

- `/llms.txt` is `content/index.md`, byte for byte. Its Work and Contact sections are link lists, so they parse as llms.txt file lists.
- `/llms-full.txt` and raw `.md` for every page, linked with `rel="alternate"`.
- **copy .md** (`copy.js`): copies the page's Markdown with `navigator.clipboard.writeText` (the raw text is fetched from the `.md` URL); on failure it shows the raw view and selects it. The label reads "copied" for 1.6 s.
- Clean semantic HTML, `lang="en"`.

## 9. Theme switch and raw view

- `theme.js` sets `data-theme="night"` or `"day"` on `<html>`; all colours are CSS custom properties per theme ([DESIGN.md](DESIGN.md) section 2). It keeps `<meta name="theme-color">` in step.
- **Default: day.** The choice is stored in `localStorage` under `theme` (wrapped in try/catch).
- A tiny inline script in `<head>` applies the stored theme before the first paint (no flash) and adds the `js` class to `<html>`.
- Without JavaScript the page renders in day, copy and the theme switch are hidden, and a plain `raw` link replaces the rendered/raw switch.
- The raw view fetches the `.md` on first use and shows it in place.

## 10. Media on the page

- **Loops** (`media.js`): controls removed; play while at least half on screen (IntersectionObserver), pause otherwise and when the tab is hidden. Focusable: click, Enter or Space toggles; a `pause`/`play` tag shows on hover and focus and stays while paused. Reduced motion: poster with native controls. Without JavaScript: poster with native controls.
- **Players:** native controls, `preload="none"`, never autoplay.
- **Embeds:** a link to the video, holding the poster. On click, `media.js` swaps in `https://www.youtube-nocookie.com/embed/<id>?autoplay=1` or `https://player.vimeo.com/video/<id>?autoplay=1&dnt=1` (plus `&h=<hash>` for unlisted Vimeo), with `title`, `allow="autoplay; fullscreen; picture-in-picture"` and `referrerpolicy="strict-origin-when-cross-origin"`. Without JavaScript the link opens the video.

## 11. Grain

Port, don't rewrite. From this repo's history at commit `5ed1192`: `src/client/grain-core.mjs`, `src/client/grain.js`, the `rng` function from `src/client/sky-core.mjs`, the `#grain` rules in `src/styles/hud.css`, and the grain tests in `test/texture.test.mjs`. No toggle: the new file bar has none, so the toggle code path and the `nograin` head script are left out. Theme-specific opacity and blending are in [DESIGN.md](DESIGN.md) section 8.

## 12. Budgets

| Area | Target |
| --- | --- |
| Content without JS | 100% readable, all links work |
| HTML + CSS per page | under 40 KB uncompressed, excluding media |
| Fonts | under 150 KB total |
| JS on pages without video or embeds | under 3 KB gzipped |
| `rows.js` (pages with a row of cards) | under 1 KB gzipped |
| Media (MB = 1024 × 1024 bytes) | a loop file 10 MB (warning above 6 MB), a player file 60 MB, a photo file 600 KB, all media 700 MB |
| Layout shift | under 0.05 while fonts load, at 1440 and 390 px |
| Lighthouse (mobile) | 95+ in all four categories, checked by hand before launch |
| Privacy | no trackers, no analytics, no request to another site before a visitor presses play |

## 13. Tests

Run locally before every merge; CI doesn't run them.

- `node --test`: the parser and renderer (one test per grammar row, escaping, links); validation (one failing fixture per rule; all problems in one run); the media manifest, embeds and budgets; history; the build (a fixture site in, the outputs of section 6 out; the CSP; the banner; status lines); llms.txt parsing; contrast from the tokens; glyph coverage; page budgets on the real build; the ported grain tests.
- `test/e2e/check.py`: no console errors; no request to another origin; embeds load only on click; loops play, pause, honour reduced motion and the keyboard; no-JS rendering; layout shift; no horizontal scrolling at 360 px; visible focus.

## 14. Deploy

`.github/workflows/pages.yml`, build and deploy only:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
          filter: blob:none
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - uses: actions/configure-pages@v5
      - run: node build.mjs
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Domain:** `static/CNAME` holds `lucamolluso.com`. With Actions deploys, GitHub ignores the CNAME file: the domain is set in the repo's Pages settings (Source: GitHub Actions; Custom domain: lucamolluso.com), then enforce HTTPS.

## 15. Content Security Policy

Every page carries it as a `<meta http-equiv="Content-Security-Policy">`, so the browser itself blocks any accidental third-party request:

```
default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; font-src 'self';
script-src 'self' 'sha256-<the inline theme script>'; connect-src 'self';
frame-src https://www.youtube-nocookie.com https://player.vimeo.com;
object-src 'none'; base-uri 'none'; form-action 'none'
```

`data:` images are the grain's noise tile, drawn in the page. Markup has no inline `style` attributes and no inline scripts besides the theme script and the JSON-LD data block.
