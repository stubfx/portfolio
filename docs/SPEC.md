# lucamolluso.com · Portfolio spec

Nov 27, 2026 · v1 · Build from scratch from this document.

The reference prototype is `prototype/index.html` (open it in a browser, no server needed). Draft content lives in `content/`. The reasoning behind every decision is in the Career project doc "Portfolio intentions" (v6); this file is the build contract.

---

## 1. What we are building

A personal portfolio where **every page is a Markdown file**. People read it typeset like a bold journal page; agents read the exact same file. One source, two readers, nothing to keep in sync.

- **Who:** Luca Molluso, Technical Artist, AI and real-time 3D. Presented as the figure in the middle: an art director who can build what he directs.
- **For:** AI Technical Artist, real-time 3D Technical Artist and Creative Technologist roles, plus the agents that read on their behalf.
- **Message:** the idea and the logic are the work; the outcome is proof. AI is a tool, not a goal.
- **Not:** a configurator showcase, a cleanup reel ("I fixed this"), a one-prompt pretty site, or a default GitHub README.

## 2. Decision: no framework

**We do not use a framework, a bundler or a package manager.** No Astro, no 11ty, no Next, no React, no Tailwind, no `npm install`.

Why:

- The site is a handful of Markdown files rendered with a small, fixed subset of Markdown. A framework would add hundreds of dependencies to do less than ~300 lines of our own code.
- The renderer is part of the design: it decides which syntax stays visible, how tables become a project index, how a `.glb` image becomes a live viewer. Owning it is easier than bending a framework's Markdown pipeline.
- Zero dependencies means nothing to update, nothing to audit, and a build that still works in five years. It is also FOSS-friendly and fast.
- The previous version of this repo already worked this way (Node built-ins only), so the approach is proven here. Its code is in git history before this commit if anything is worth reusing (for example `scripts/fonts.py` for subsetting and `scripts/budget.mjs` for weight budgets).

What we use instead:

| Need | Solution |
| --- | --- |
| Build | One script, `build.mjs`, Node 22+, built-in modules only (`node:fs`, `node:path`, `node:child_process`, `node:http`) |
| Markdown | Our own renderer, `site/render.mjs`, for the subset in section 6 |
| Styles | One hand-written `site/style.css` with CSS custom properties |
| Client JS | Two small files: `site/copy.js` (copy .md) and `site/viewer.js` (3D). Content never needs JS |
| 3D | three.js (MIT), **vendored** as plain ES module files in `site/vendor/three/`, loaded with an import map, only on pages that contain a `.glb` |
| Dev server | `node build.mjs --serve` (node:http plus fs.watch), or `python3 -m http.server -d dist` |
| Tests | `node --test` (built in) |
| Deploy | GitHub Actions to GitHub Pages |

The single third-party file set is three.js, copied in at a pinned version with its licence. It is not installed, not bundled and not loaded on pages without 3D.

## 3. Repository structure

```
content/                  the site, as Markdown (source of truth for every page)
  index.md                homepage; also served as /llms.txt and /index.md
  now.md                  what I'm doing this month
  cv.md                   master CV (from the profile doc)
  portrait.jpg            About portrait
  work/
    <case>.md             one file per case
    <case>/               that case's images, .glb models and poster stills
site/                     the typesetting
  template.html           page shell
  style.css
  render.mjs              Markdown subset to HTML (used by build.mjs only)
  copy.js                 "copy .md" button
  viewer.js               lazy 3D viewer
  fonts/                  self-hosted woff2 + OFL licence files
  vendor/three/           three.module.min.js, GLTFLoader, RGBELoader, LICENSE (pinned version)
  env/studio.hdr          small neutral HDRI (CC0, e.g. Poly Haven, 1k)
static/                   copied to dist/ as-is (CNAME, favicon.svg, robots.txt)
build.mjs                 the build
test/                     node:test files
.github/workflows/pages.yml
docs/SPEC.md              this file
prototype/index.html      the reference prototype (sample content)
```

`static/CNAME` already contains `lucamolluso.com`.

## 4. URLs and outputs

Links inside Markdown are always written as relative `.md` paths (`work/direction-as-code.md`). The build rewrites them to pretty URLs in the HTML. The raw `.md` copies keep their `.md` links, which resolve to the raw files, so agents can walk the site in Markdown.

| Source | HTML | Raw |
| --- | --- | --- |
| `content/index.md` | `/` | `/index.md` and `/llms.txt` |
| `content/now.md` | `/now/` | `/now.md` |
| `content/cv.md` | `/cv/` | `/cv.md` |
| `content/work/<case>.md` | `/work/<case>/` | `/work/<case>.md` |
| all pages | | `/llms-full.txt` (every page, in index order, each preceded by its URL) |

Also generated: `/sitemap.xml`, `/robots.txt` (allow all), `/404.html` (a Markdown 404 page in the same style).

Every HTML page carries in its `<head>`:

- `<title>` from the H1; `<meta name="description">` from the first blockquote.
- `<link rel="alternate" type="text/markdown" href="…/<page>.md">`.
- Open Graph tags (title, description, image: the page's first image or a default).
- On the homepage only: JSON-LD `Person` (name, jobTitle "Technical Artist", url, email, sameAs LinkedIn, address Rome).

No front matter in the Markdown files. They stay pure, so the raw file reads cleanly to people and agents. Title and description come from the H1 and blockquote; dates come from git.

## 5. Page anatomy

Every page has three parts:

1. **File bar** (sticky, top): the path as breadcrumbs (`lucamolluso.com/work/direction-as-code.md`, last segment in ink), a **copy .md** button and a **raw** link to the `.md` file. (The prototype's rendered/raw toggle is replaced by the raw link: simpler, no JS.)
2. **The page:** the rendered Markdown.
3. **Status line** (bottom, mono, grey): file name · N edits · last edit date · `history` link to `https://github.com/stubfx/portfolio/commits/main/content/<path>`. Built from git (section 9).

## 6. Markdown subset and rendering rules

The renderer supports exactly this subset. Anything else is a build error, so content can't silently drift.

**Visible syntax.** Block-level Markdown markers stay on the page in light grey mono: `#`, `##`, `###`, `>`, `-`, `1.`, `|` (tables), code fences, `---`, HTML comments, image lines and the `==` of a highlight. On wide screens, block markers **hang in the left margin** so the text edge stays clean. Inline markers (`**`, link brackets, URLs, backticks) are **not** shown. Every marker is `aria-hidden="true"`.

| Markdown | Renders as |
| --- | --- |
| `# H1` | Display face, huge; one per page; hanging `#` |
| `## H2` | Display face, large; hanging `##` |
| `### H3` | Text face, bold, body size plus 20%; hanging `###` |
| Paragraph | Body text, measure about 29 em |
| `> quote` | Larger text (intro line); hanging `>` |
| Paragraph that is only `==text==` | The **punch line**: display face, very large, red; grey `==` both sides. **Max one per page** (build error if more) |
| `==text==` inside a paragraph | Red text, grey `==` |
| `**bold**` | Bold, no visible markers |
| `[text](url)` | Underlined link; `.md` links rewritten; external links open in a new tab |
| `` `code` `` | Mono |
| `- item` / `1. item` | List with hanging grey markers |
| Table | See "Index table" below |
| `![alt](file.jpg)` | Figure; the full `![alt](file)` line in grey mono above the image as its caption; image at full content width |
| `![alt](file.glb)` | Live 3D viewer (section 8), same caption line |
| ```` ```logic ```` | Monospace diagram: characters left of column 28 in ink (Me lane), right of it in mid grey (Machine lane) |
| ```` ```yaml ```` | Keys in grey, values in ink |
| ```` ```log ```` | Git log lines: hash and date in grey, message in ink. Hashes are verified (section 9) |
| ```` ``` ```` (no language) | Plain mono block |
| `---` | Grey `---` line with space above |
| `<!-- comment -->` | Shown as small grey mono text (it is part of the file) |

**Index table.** A table renders as a project index. Header row in small grey mono caps over a black rule; rows separated by hairlines. Column 1 (number) and the last column (year) in grey mono; column 2 (the case link) at large body size; column 3 (the idea) smaller, mid grey. On small screens each row becomes a stacked card: number, title, year on one line, the idea below. The header row is hidden on small screens.

**Images.** The build reads each image's dimensions (PNG/JPEG headers, no dependency) and writes `width`/`height` to prevent layout shift. Portrait-orientation images render narrower (max 440 px); landscape images take the full content width. Empty alt text is a build error: alt text is the caption people see and the only thing agents get, so it is written as a caption.

## 7. Visual system

**Mood.** Bold, punchy, editorial: a journal page set in README formatting. Huge headlines across the screen, large body text, generous white space, one red line of conviction per page. Typography carries the page; images and live 3D carry the proof. The look alone is not the differentiator (type minimalism is a 2026 trend and AI site builders sell monospace templates); the ideas, the live 3D and the real history are.

**Colour tokens**

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#FDFDFC` | Background (cool near-white, never cream) |
| `--ink` | `#111111` | Text: me |
| `--grey` | `#6F6F6F` | Machine output, secondary text (passes AA) |
| `--mk` | `#A6A6A6` | Syntax markers (decorative, `aria-hidden`) |
| `--line` | `#E4E4E1` | Hairlines |
| `--red` | `#D33A16` | The punch line and `==highlights==` only. About 4.8:1 on paper. Never on buttons, links or hover states except link hover |

**Type**

- Display: **Archivo Black** (OFL), weight 400, tracking about -0.045em.
- Text: **DM Sans** (OFL), variable, optical sizing on.
- Mono: system mono stack in the prototype; production picks one FOSS mono and self-hosts it (candidates: IBM Plex Mono, JetBrains Mono).
- Self-host everything as subset woff2 with the OFL files. **No Google Fonts requests** (GDPR).
- Final pairing is still an open question (section 14); the prototype values are the default.

**Scale** (fluid, from the prototype)

| Element | Size | Line height |
| --- | --- | --- |
| H1 | `clamp(46px, 11.2vw, 184px)` | 0.9 |
| H2 | `clamp(32px, 5.4vw, 88px)` | 0.95, 1.45em space above |
| Punch line | `clamp(32px, 5.6vw, 92px)` | 0.98, max 13em wide |
| Blockquote | `clamp(24px, 2.9vw, 46px)` | 1.12, max 20em |
| Body, list items | `clamp(19px, 2vw, 30px)` | 1.3, max 29em |
| Captions, file bar, status | 12 to 13 px mono | |

**Layout.** Max width 1560 px. Side padding `clamp(18px, 7vw, 120px)`. A left gutter of 3.6 rem holds the hanging markers on screens wider than 720 px; below that, markers sit inline and small. Images and the 3D viewer take the full content width; text keeps its measure.

**Motion.** Only the 3D viewer moves. No scroll effects, no page transitions.

## 8. Live 3D: images that run

Writing `![alt](model.glb)` in Markdown produces a live, art-directed 3D viewer for people, and a still image with alt text for agents and readers without JavaScript or WebGL.

**Content rule.** Every `model.glb` needs a poster still `model.jpg` next to it (same name). The build fails if it's missing.

**HTML output (no JS needed to see something):**

```html
<figure>
  <figcaption aria-hidden="true">![alt](model.glb)</figcaption>
  <div class="viewer" data-src="model.glb" role="img" aria-label="alt">
    <img src="model.jpg" alt="alt" width="…" height="…">
    <span class="tag">3D · drag to turn</span>
  </div>
</figure>
```

**viewer.js behaviour**

- Loads only when a `.viewer` is near the viewport (IntersectionObserver), then imports three.js through the import map.
- three.js setup: WebGLRenderer (alpha, antialias), ACES filmic tone mapping, sRGB output, environment from `site/env/studio.hdr` (PMREM), a soft contact shadow under the model, camera framed automatically from the model's bounding box.
- Interaction: drag to rotate (yaw free, pitch clamped), slow auto-turn when idle, pause rendering when off-screen.
- `prefers-reduced-motion`: no auto-turn; drag still works.
- Device pixel ratio capped at 2.
- Any failure (no WebGL, load error) leaves the poster image in place and sets the tag to "still".
- The poster image is replaced by the canvas only after the first frame renders, so there is no blank flash.

**Art direction of the 3D.** Same neutral overcast-studio look as the stills: grey gradient backdrop, soft key from top left, matte materials. The viewer is a stage, not a tech demo: no grid, no axes, no orbit gizmo, no zoom.

**Budgets.** `.glb` 4 MB or less (compress textures; KTX2/Draco only if the decoder cost is worth it). Homepage carries one viewer at most.

## 9. History from git

The status line and the `log` blocks prove process with real data.

- At build time, for each content file: `git log --follow --format=%h|%cs -- content/<path>` gives the edit count and the last edit date (and first date, for "since").
- GitHub Actions must check out with `fetch-depth: 0`, or history will be empty.
- ```` ```log ```` blocks are written by hand from real `git log` output (for example the commits of a case's direction file). The build verifies each hash with `git cat-file -e <hash>` and **fails** if a hash doesn't exist. No fake history, ever.
- Every direction file, brief and prompt set that a case talks about is committed as it evolves. That is the raw material for the log blocks.

## 10. Agent layer

- `/llms.txt` is `content/index.md`, byte for byte. The homepage is written to be a valid llms.txt: H1 name, blockquote summary, then sections whose links point to `.md` files.
- `/llms-full.txt`: every page concatenated in index order, each preceded by `Source: <absolute URL of the .md>`.
- Every page available as raw `.md` at a predictable URL, linked with `rel="alternate" type="text/markdown"`.
- **copy .md** button on every page: copies the page's Markdown with `navigator.clipboard.writeText`; on failure, opens the raw file. The button label changes to "copied" for 1.6 s.
- JSON-LD `Person` on the homepage.
- Clean semantic HTML: one H1, real headings, real lists and tables, `figure`/`figcaption`, `lang="en"`.
- Context to keep us honest: in May 2026 Ahrefs found that 97% of published llms.txt files received no requests. Agent readiness is a signal of craft to human readers first; it costs us nothing because the homepage already is the file.

## 11. Quality budgets

| Area | Target |
| --- | --- |
| Content without JS | 100% readable, all links work |
| HTML + CSS per page | under 40 KB uncompressed, excluding images |
| Fonts | under 150 KB total, subset woff2 |
| JS on pages without 3D | `copy.js` only, under 2 KB |
| JS on pages with 3D | `viewer.js` under 10 KB, plus three.js loaded lazily |
| Images | JPEG/WebP, 2400 px wide max, width/height set, `loading="lazy"` below the fold |
| Lighthouse (mobile) | 95+ in Performance, Accessibility, Best Practices, SEO |
| Contrast | All text tokens pass WCAG AA on paper; markers are decorative |
| Motion | Respects `prefers-reduced-motion` |
| Privacy | No trackers, no analytics, no third-party requests |

## 12. Build, run, deploy

```sh
node build.mjs            # content/ + site/ + static/ → dist/
node build.mjs --serve    # build, serve dist/ on :8080, rebuild on change
node --test               # renderer and build tests
```

`build.mjs` steps:

1. Read `content/**/*.md`; read git history for each file.
2. Validate: one H1 per page, max one punch line, non-empty alt text, posters for every `.glb`, verified `log` hashes, links that resolve. Fail with a clear message on any violation.
3. Render each file with `site/render.mjs` into `site/template.html`; write `dist/<path>/index.html` and copy the raw `.md`.
4. Write `llms.txt`, `llms-full.txt`, `sitemap.xml`, `robots.txt`, `404.html`.
5. Copy `site/` assets (CSS, JS, fonts, vendor, env), content images and models, and `static/`.
6. Write `.nojekyll`.

**Tests** (`node --test`): every row of the table in section 6 has a renderer test; one build test runs against a fixture folder and checks the outputs in section 4.

**Deploy** (`.github/workflows/pages.yml`): on push to `main`, checkout with `fetch-depth: 0`, setup Node 22, `node --test`, `node build.mjs`, upload `dist/`, deploy to Pages. No `npm install` step.

**Domain.** `lucamolluso.com` via `static/CNAME`. Connect it in the repo's Pages settings, then enforce HTTPS.

**Note.** Until the new workflow is added, nothing deploys, and the last published version of the old site stays live on GitHub Pages.

## 13. Content

**Voice.** First person, short declarative sentences, one idea per line. No narration of process, no self-congratulation, no adjectives you can't prove, no em dashes. Name sectors, never clients (NDA). Avoid the shapes of a chat answer: no "**Label:** text" bullets, no lists of three for rhythm. Margin of honesty: everything on the site must be defensible live in an interview.

**Pages**

- `index.md`: name; one-line summary (blockquote); the middle paragraph; one punch line; one live `.glb`; **Work** as an index table (#, Case, Idea, Year); **Now** (two lines plus a link to `now.md`); **About** with the portrait and the short bio; **Contact**. See `content/index.md`.
- `now.md`: what I'm doing this month, updated date in the blockquote. A "now page" after Derek Sivers' idea (nownownow.com). See `content/now.md`.
- `cv.md`: the master CV from the Career project's profile doc, in Markdown.
- `work/<case>.md`: Idea · Logic · Proof (below).

**Case format: Idea · Logic · Proof**

1. **Idea:** H1 title; blockquote subtitle; one line of context; the "what if" as the page's punch line; hero image.
2. **Logic:** `## Logic`, a ```` ```logic ```` two-lane diagram (Me left, Machine right), one line of point of view, one artifact that shows the thinking (a direction file in ```` ```yaml ````, a node graph image, a script excerpt).
3. **Proof:** `## Proof`, contact sheet or hero image, one live `.glb`, one line of real numbers (kept, candidates, redirects, machine time, my time), the redirects as a verified ```` ```log ```` block, `## Credits` (Machine: tools; Me: decisions), then links to index and the next case.

**Rules**

- No button fixes: never show a fix a tool does with one click.
- Direction over retouch: drift is fixed by changing the direction, and that change is a commit.
- Not a configurator portfolio: real-time 3D for global brands appears as capability, never as the hero.
- Every number and every commit is real.

**Case slots** (titles and ideas are working drafts)

| # | Case | Idea | Status |
| --- | --- | --- | --- |
| 01 | Direction as code | What if the art direction were the input, not the review? | Sample written; needs the real project |
| 02 | Live, in the browser | A luxury object, directed and running in real time | To capture |
| 03 | One frame | An Unreal scene, from moodboard to final light | To capture |
| 04 | Procedural | The intent first, then the graph | To capture |
| 05 | Before the machines | Brand, campaign, type (BA work) | To select |

Ship with **three real cases** (01, one real-time piece, 05); add the rest later. Mods and servers appear as supporting proof (open question).

**Facts to use** (from the Career project's profile doc, the source of truth): modder since 2015; engineer since 2017 (IBM, now Accenture Song); real-time 3D for global luxury fashion and automotive brands; BA in Art Direction & Visual Communication, AANT Rome, 2022 to 2025, 110/110 cum laude, earned alongside the day job; GenAI trainer for Palestre Digitali; leads "AI Way of Work" sessions; ten years of transverse flute; Blender, Linux, FOSS. Email info@lucamolluso.com, LinkedIn linkedin.com/in/luca-molluso, Rome, open to remote.

## 14. Open questions

1. **Production fonts:** keep Archivo Black and DM Sans, or another FOSS pair? Which mono?
2. **Raw link vs toggle:** the spec uses a raw link; the prototype has a rendered/raw toggle.
3. **First real case:** which pipeline to capture first?
4. **Mods:** a supporting strip, or a sixth case for the studio track?
5. **MCP server** that agents can query about the work: v2, or out of scope?
6. **Twitch dates:** "since 2019" vs "5 years"; align with the profile doc before launch.

## 15. Launch checklist

- [ ] `build.mjs`, `site/`, tests and the Pages workflow in place
- [ ] Fonts subset and self-hosted with OFL files; no external requests
- [ ] three.js vendored at a pinned version with its licence; studio HDRI added
- [ ] Three real cases, each with a real hero image, a real `.glb` plus poster, real numbers and verified commits
- [ ] Real portrait shot and art-directed
- [ ] `now.md` lines confirmed and dated
- [ ] `cv.md` written from the profile doc
- [ ] Lighthouse 95+ on mobile; tested on a phone and a wide screen; no-JS check
- [ ] `lucamolluso.com` connected in Pages settings, HTTPS enforced
- [ ] Site added to LinkedIn Featured and the CV header; ArtStation mirror and reel for the studio route
