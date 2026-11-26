# lucamolluso.com

A career as a git log. Dark Catppuccin Mocha, a starfield, a little film grain, and every project as a commit with its cover attached.

Hand-written HTML, CSS and JavaScript. The build is a Node script with **zero dependencies**: no `npm install`, ever.

## Run it

```sh
npm test            # unit tests (node:test)
npm run build       # writes dist/
python3 -m http.server -d dist   # or any static server
npm run e2e         # headless Chrome checks; needs Python Playwright + Chrome
node scripts/budget.mjs dist   # weight budgets: home JS ≤ 25 KB gz, fonts ≤ 120 KB
```

Browser tooling (Python Playwright, Pillow):

```sh
python3 -m venv .venv && .venv/bin/pip install playwright==1.64.1 pillow
export PW_WS=ws://HOST:3333/     # optional: drive a remote Playwright server instead of local Chrome
                                 # (connects with expose_network='<loopback>' so it reaches the test servers)
.venv/bin/python test/e2e/check.py                      # all checks; append names to run some
.venv/bin/python test/e2e/perf.py --cpu 1 4 --runs 3    # scroll-sweep trace: dropped frames, forced layouts, script time
                                                        # --route control (floor), --assert (budgets), --json PATH
.venv/bin/python test/e2e/strip.py --video              # frame strips + home-1280.webm in test/e2e/shots/strips/
```

Run perf.py and strip.py without `-I`: they import from check.py beside them.

Node 22 or newer.

## Where things live

| Path | What |
| --- | --- |
| `content/log.mjs` | The git log: every commit, and the branches with their fork and merge commits. Newest first. |
| `content/projects/*.md` | One file per project: frontmatter plus a Markdown story. |
| `content/about.md` | The About page. |
| `content/site.mjs` | Name, email, links. |
| `src/build/` | Templates and the content pipeline. |
| `src/client/` | Browser code: the dithered sky (`sky.js`, `sky-core.mjs`), worlds as palette fades (`world.js`), git graph, once-only fade-ins (`reveal.js`), grain, vim keys. `*-core.mjs` files are pure and unit-tested. |
| `src/styles/` | CSS, concatenated in order: tokens, base, log, cover, hud, pages, motion (fade-ins, drift, hover: `motion.css`), sky. |
| `public/` | Copied as-is into `dist/` (favicon, CNAME, fonts, media). |

## Add a project

1. Create `content/projects/<slug>.md`:

   ```md
   ---
   title: Configurator framework
   accent: framework          # the word set in Fraunces italic
   slug: configurator-framework
   hash: 7be2104              # must match its commit in content/log.mjs
   branch: accenture
   year: 2024
   span: 2021–24              # optional display year
   tags: [3d, real-time]
   nda: true                  # optional: adds the dagger and the NDA line
   order: 2                   # position on the work page
   palette:
     bg: "#0b0d12"
     fg: "#e8e6e1"
     accent: "#d4a77a"
   cover:
     image: /media/configurator-framework/cover.webp   # or video:, or layers: [back, mid, front]
   cells:
     Role: lead developer
     Tools: Babylon.js, Vue 3, Blender
   ---
   The first paragraph becomes the lede, in the log and on the project page.

   ## Sections as you like
   ```

2. Add a commit to `content/log.mjs` with `kind: 'project'`, `project: '<slug>'` and the same `hash`. The project appears in the log as that commit, with its cover attached; the cover opens its page.
3. Put media under `public/media/<slug>/`.

Without `cover`, the project gets a generative planet seeded by its hash. The build fails if a palette's `fg` or `accent` is below 4.5:1 on its `bg`, if a hash doesn't match, or if a branch or project name is unknown.

## Fonts

The fonts are self-hosted in `public/fonts/`, so the site makes no third-party requests (no Google Fonts, which would send visitor IPs to Google). `scripts/fonts.py` made them and can remake them: it downloads Atkinson Hyperlegible Next (400, 700, 400 italic), Atkinson Hyperlegible Mono (400, 700) and Fraunces italic (variable, weight 300 to 500, every optical size) from google/fonts, subsets them to `woff2`, and writes `fonts.css` and the SIL Open Font License texts.

```sh
npm run build                                   # the script reads dist/ for the characters in use
.venv/bin/pip install fonttools brotli
.venv/bin/python scripts/fonts.py               # prints each file, the total, and which cut it needed
```

The fonts budget is 120 KB and never moves. The script keeps Latin basic and Latin-1 plus the symbols the pages use (such as † → –); if it ever comes out over, it pins Fraunces's optical size, then falls back to static Fraunces, and says where it stopped. Rerun it after adding copy with a new symbol, or that symbol renders in the fallback font.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`: tests, build, budgets, then GitHub Pages.

On `stubfx.github.io` the site lives under `/portfolio/`; the workflow passes that prefix to the build (`BASE_PATH`, from `actions/configure-pages`), and it drops to the root by itself once the custom domain is set. To try a prefixed build locally: `BASE_PATH=/portfolio npm run build`.

One-time setup:

1. Repository **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Pages → Custom domain:** `lucamolluso.com`, then tick **Enforce HTTPS** once the certificate is issued. With Actions deployments GitHub ignores the `CNAME` file, so this setting is what counts.
3. DNS at your registrar:
   - Apex `lucamolluso.com`: `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (and optionally `AAAA` to `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`).
   - `www`: `CNAME` to `stubfx.github.io`.
4. Verify the domain in your GitHub account settings (Pages → Verified domains) to stop takeovers.

## Keys

`Esc` toggles normal mode and shows the block cursor on the graph. Then `j`/`k` commit, `J`/`K` project, `gg`/`G` top and bottom, `Enter` opens a project, `:help`, and `:q` (try it).
