# Build

How the site is built, served and deployed.

## 1. No framework

**We do not use a framework, a bundler or a package manager.** No Astro, 11ty, Next, React or Tailwind, and no `npm install`.

- The site is a handful of Markdown files in a small, fixed subset ([CONTENT.md](CONTENT.md) section 2). Our own renderer is a few hundred lines; a framework would bring hundreds of dependencies to do less.
- The renderer is part of the design: it decides which syntax stays visible, how a table becomes the index, how a `.glb` image becomes a viewer. Owning it beats bending a framework's Markdown pipeline.
- Zero dependencies: nothing to update or audit, and a build that still works in five years.
- The previous version of this repo already worked this way (Node built-ins only).

| Need | Solution |
| --- | --- |
| Build | `build.mjs`, Node 22+, built-in modules only (`node:fs`, `node:path`, `node:child_process`, `node:http`) |
| Markdown | `site/render.mjs`, our renderer for the subset |
| Styles | One hand-written `site/style.css`, CSS custom properties |
| Client JS | `site/copy.js`, `site/theme.js`, `site/grain.js`, `site/viewer.js`. Content never needs JS |
| 3D | three.js (MIT), **vendored** as plain ES modules in `site/vendor/three/`, loaded with an import map, only on pages with a `.glb` |
| Dev server | `node build.mjs --serve`, or `python3 -m http.server -d dist` |
| Tests | `node --test` |
| Deploy | GitHub Actions to GitHub Pages |

## 2. Repository

```
content/                  the site, in Markdown (see CONTENT.md)
site/
  template.html           page shell
  style.css
  render.mjs              Markdown subset to HTML (build time only)
  copy.js                 copy .md
  theme.js                day/night switch
  grain.js                film grain (ported)
  viewer.js               lazy 3D viewer
  fonts/                  subset woff2 + OFL licences
  vendor/three/           three.module.min.js, GLTFLoader, LICENSE (pinned version)
static/                   copied as-is: CNAME, favicon.svg
build.mjs
test/
.github/workflows/pages.yml
docs/
prototype/index.html      reference prototype
```

## 3. Commands

```sh
node build.mjs            # content/ + site/ + static/ → dist/
node build.mjs --serve    # build, serve dist/ on :8080, rebuild on change
node --test               # renderer, build and grain tests
```

`BASE_PATH` (env) prefixes every URL while the site lives at `stubfx.github.io/portfolio/`; it is empty once lucamolluso.com is connected.

## 4. Pipeline

1. Read `content/**/*.md` and each file's git history.
2. **Validate** (any failure stops the build with a clear message): one H1 per page; at most one punch line; no inline `==`; non-empty alt text; a poster for every `.glb`; every `log` hash exists; every internal link resolves; nothing outside the Markdown subset.
3. Render each file with `site/render.mjs` into `site/template.html`; write `dist/<path>/index.html`; copy the raw `.md` next to it.
4. Write `llms.txt`, `llms-full.txt`, `sitemap.xml`, `robots.txt`, `404.html`.
5. Copy `site/` assets, content images and models, and `static/`.
6. Write `.nojekyll`.

## 5. Renderer

| Markdown | HTML |
| --- | --- |
| `# T` | `<h1><span class="mk hang" aria-hidden="true">#</span>T</h1>` (same pattern for `##`, `###`) |
| `> q` | `<blockquote>` with a hanging `>` |
| Paragraph | `<p>` |
| Paragraph that is only `==t==` | `<p class="punch">` with `<mark>t</mark>` and visible `==` markers |
| `**b**` | `<strong>` (markers hidden) |
| `[t](x.md)` | `<a href="/x/">` (`.md` rewritten to the pretty URL; external links get `target="_blank" rel="noopener"`) |
| `` `c` `` | `<code>` |
| `- i` / `1. i` | `<ul>` / `<ol>`, each `<li>` with a hanging marker |
| Table | `<div class="tbl">` with a hanging `|`, then `<table>`; cells get `c0`, `c1`… classes |
| `![a](f.jpg)` | `<figure>` with `<figcaption aria-hidden="true">` showing the whole line, then `<img alt="a" width height loading>`; `class="narrow"` for portrait images |
| `![a](f.glb)` | `<figure>` with the caption, then `<div class="viewer" data-src="f.glb" role="img" aria-label="a">` containing `<img src="f.jpg" alt="a">` and the tag |
| Fenced code | `<div class="code">` with visible fences and `<pre>`; `logic`, `yaml`, `log` get their colouring spans |
| `---` | `<div class="hr" aria-hidden="true">---</div>` |
| `<!-- c -->` | `<p class="comment">` with the escaped comment |

All text is HTML-escaped. Headings get `id`s from their text for in-page links.

## 6. Outputs

| Source | HTML | Raw |
| --- | --- | --- |
| `content/index.md` | `/` | `/index.md`, `/llms.txt` |
| `content/now.md` | `/now/` | `/now.md` |
| `content/cv.md` | `/cv/` | `/cv.md` |
| `content/work/<case>.md` | `/work/<case>/` | `/work/<case>.md` |
| all pages | | `/llms-full.txt` (every page in index order, each preceded by `Source: <absolute .md URL>`) |

Every page's `<head>`: `<title>` from the H1; `<meta name="description">` from the first blockquote; `<link rel="alternate" type="text/markdown" href="….md">`; Open Graph tags (first image, or a default); `<meta name="theme-color">` per theme. Homepage only: JSON-LD `Person` (name, jobTitle "Technical Artist", url, email, sameAs LinkedIn, address Rome).

## 7. History from git

- For each content file: `git log --follow --format=%h|%cs -- content/<path>` gives the edit count and the last edit date for the status line.
- The status line links to `https://github.com/stubfx/portfolio/commits/main/content/<path>`.
- `log` blocks: each hash is checked with `git cat-file -e <hash>`; a missing hash fails the build.
- CI must check out with `fetch-depth: 0`, or the history is empty.

## 8. Agent layer

- `/llms.txt` is `content/index.md`, byte for byte.
- `/llms-full.txt` and raw `.md` for every page, linked with `rel="alternate"`.
- **copy .md** (`copy.js`): copies the page's Markdown with `navigator.clipboard.writeText` (the raw text is fetched from the `.md` URL); on failure it opens the raw file. The label reads "copied" for 1.6 s.
- Clean semantic HTML, `lang="en"`.

## 9. Theme switch

- `theme.js` sets `data-theme="night"` or `"day"` on `<html>`; all colours are CSS custom properties per theme ([DESIGN.md](DESIGN.md) section 2).
- **Default: day.** The choice is stored in `localStorage` under `theme` (wrapped in try/catch).
- A tiny inline script in `<head>` applies the stored theme before the first paint, so there is no flash.
- Without JavaScript the page renders in day.

## 10. 3D viewer

- `viewer.js` loads only when a `.viewer` nears the viewport (IntersectionObserver), then imports three.js through the import map.
- WebGLRenderer (alpha, antialias), ACES filmic tone mapping, sRGB output, a small neutral HDRI (CC0) through PMREM, camera framed from the model's bounding box, soft contact shadow.
- Drag to rotate (yaw free, pitch clamped), slow auto-turn when idle, render loop paused off-screen, device pixel ratio capped at 2.
- Reduced motion: no auto-turn. Any failure leaves the poster image in place and sets the tag to "still". The poster is replaced only after the first frame renders.
- The prototype's viewer draws a procedural buoy in raw WebGL; production loads the real `.glb` with three.js.

## 11. Grain

Port, don't rewrite. From this repo's history at commit `5ed1192`: `src/client/grain-core.mjs`, `src/client/grain.js`, the `rng` function from `src/client/sky-core.mjs`, the `#grain` rules in `src/styles/hud.css`, and their tests. Theme-specific opacity and blending are in [DESIGN.md](DESIGN.md) section 8. `prototype/index.html` runs exactly this code.

## 12. Budgets

| Area | Target |
| --- | --- |
| Content without JS | 100% readable, all links work |
| HTML + CSS per page | under 40 KB uncompressed, excluding images |
| Fonts | under 150 KB total |
| JS on pages without 3D | `copy.js` + `theme.js` + `grain.js`, under 3 KB gzipped |
| JS on pages with 3D | plus `viewer.js` under 10 KB and three.js, loaded lazily |
| Lighthouse (mobile) | 95+ in all four categories |
| Privacy | no trackers, no analytics, no third-party requests |

## 13. Tests

- Renderer: one test per row of the table in section 5, plus escaping and link rewriting.
- Validation: one failing fixture per rule in section 4.
- Build: a fixture folder in, the outputs of section 6 checked.
- Grain: the ported tests, unchanged.

## 14. Deploy

`.github/workflows/pages.yml`:

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
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - run: node --test
      - id: pages
        uses: actions/configure-pages@v5
      - run: node build.mjs
        env:
          BASE_PATH: ${{ steps.pages.outputs.base_path }}
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

**Domain:** `static/CNAME` holds `lucamolluso.com`. Connect it in the repo's Pages settings, then enforce HTTPS. Until the workflow is added, nothing deploys and the last published version of the old site stays live.
