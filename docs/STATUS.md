# Status

Read this first when resuming work. Last updated 2026-11-26.

## Where things are

- **Live:** https://lucamolluso.com (GitHub Pages with a custom domain and HTTPS, deployed by `.github/workflows/pages.yml` on every push to `main`). https://stubfx.github.io/portfolio/ redirects there.
- **Branch `feat/fluid-flight`:** the home page rebuilt as one git log with each project's cover attached, plus motion, worlds and self-hosted fonts. Merged into `main` and live since 2026-11-26 (`main` was force-pushed once, with Luca's OK, to rewrite its commit identity to `luca` with no email).
- **Design:** `docs/superpowers/specs/2026-11-25-portfolio-design.md` (the base spec), extended by `docs/superpowers/specs/2026-11-25-log-cards-design.md` (the log with attachments) and `docs/superpowers/specs/2026-11-26-worlds-design.md` (entering a world). `2026-11-25-fluid-flight-design.md` is superseded.
- **Plans:** `docs/superpowers/plans/2026-11-25-portfolio-site.md` (the first build, done) and `docs/superpowers/plans/2026-11-25-log-cards.md` (8 tasks, done on the branch).
- **How to run, add a project, deploy:** `README.md`.
- **History:** PR #1 (the site), PR #2 (base path fix for github.io), PR #3 (status), then the branch above.

## Before launch

- [x] Self-hosted fonts in `public/fonts/` (2026-11-26, 117.9 KB of the 120 KB budget, made by `scripts/fonts.py` from a pinned google/fonts commit, curly quotes and the ellipsis included). No third-party requests, so no Google Fonts GDPR exposure.
- [x] `feat/fluid-flight` merged into `main` and deployed (2026-11-26).
- [x] Custom domain `lucamolluso.com` with HTTPS (2026-11-26). The build drops the `/portfolio` base path by itself: `actions/configure-pages` reports an empty one now.
- [ ] DNS redundancy: the apex has one of GitHub's four A records (185.199.108.153). Add 185.199.109.153, 185.199.110.153 and 185.199.111.153, and optionally the AAAA records 2606:50c0:8000::153 to 8003::153. `www` is already a CNAME to `stubfx.github.io`.
- [ ] Verify the domain in GitHub account settings (Pages → Verified domains), if not done yet, to stop takeovers.
- [ ] Replace the sample copy in all four `content/projects/*.md` and add real covers under `public/media/<slug>/`.
- [ ] Optional: CV PDF in `public/` and a link in `content/about.md`.

## Open questions for Luca

- Tab set: `1 log`, `2 work`, `3 about`, `4 :help`. Confirm or change.
- Answered: Twitch is 2019–24, "five years streaming" (2026-11-25). The headline stays "Luca Molluso, technical artist." (2026-11-26).
- The art school branch is labelled `art-school`; projects are sample content.

## Performance

Measured with `test/e2e/perf.py` (median of 3, 1280×800, a steady scroll from the top of the log to the EOF footer) on the host's headless Chromium 156.0.8078.4. That browser renders with SwiftShader, a software GPU, so dropped frames overstate the cost of full-screen layers and fades compared with a real desktop GPU. The budgets were resized with Luca on 2026-11-26: the audience is companies on good desktops; gates are only the numbers that don't depend on the GPU.

| | Flight (before) | Log with attachments (now) |
| --- | --- | --- |
| Layouts forced by site scripts, in total (information) | about 1,320 | about 830 |
| … of those, inside animation frames, after writes (gate: 0) | not measured | 0 |
| Longest site script task at 1× (gate: 4 ms) | | 0.8 ms |
| Site script time over the sweep, 1× | | 289 ms |
| Dropped frames 1× / 4× (information) | 22.1% / 36.9% | 17.8% / 24.7% |

Floors on the same browser: `/about/` drops 0.0% / 1.0%; home with the worlds switched off drops 0.2% at 1×, and with worlds that never fade 0.8%. What remains is the worlds' crossfades on a software compositor; a world at rest is opaque and costs nothing. `npm run perf -- --assert` (or `perf.py --assert`) checks the gates; `check.py no-forced-layout graph-no-churn` guards them on every run.

## Decisions taken during the build (and the cost if wrong)

- Astro could not be installed (no network), so the build is a zero-dependency Node script. Cost: none; content files keep a shape Astro could read later.
- Test command is `node --test "test/**/*.test.mjs"` (Node 22 rejects a folder path). Cost: none.
- `tokens.css` is checked against the colour tokens in code. With reduced motion, page transitions crossfade. Cost: none.
- Optional fields: project `span`, `cells`; branch `label`; commit `special`, `help`. Cost: none.
- The build fails on a project palette below 7:1 (fg) or 4.5:1 (accent), or a project hash that does not match its commit. Cost: a build error instead of a broken page.
- `content/site.mjs` holds contact facts (email `info@lucamolluso.com` from the CV); `content/about.md` is adapted from the LinkedIn About; a 404 page uses a vim error joke. Cost: none.
- The graph exposes an interface for the vim keys; branch topology ships as JSON in the page; school's fork point was removed. Cost: none.
- After a jump (j/k/J/K) the cursor stays on that commit until the user scrolls by hand (replaces a 700 ms lock). Cost: none.
- Grain moves with a transform. Cost: none.
- Esc announces normal mode for screen readers. Off the home page j/k scroll and J/K/Enter do nothing. Enter on a focused link always follows it. Cost: none.
- Hero copy sits on a soft, blurred pool of the cover's own background (no straight edge anywhere), so any art keeps text readable. Art cost: on phones the pool mostly hides the giant accent word, and the blur has a paint cost on project pages; revisit when real covers exist.
- Status bar is 44 px on phones and touch screens, 34 px on desktop. Cost: a fine-pointer touchscreen gets 34 px targets.
- Workflow uses checkout@v5, setup-node@v5, configure-pages@v5, upload-pages-artifact@v4, deploy-pages@v4. Cost: if setup-node@v5 misbehaves, pin @v4.
- Browser checks do not run in CI (CI stays install-free). Cost: run `npm run e2e` locally before merging.
- Base path comes from `actions/configure-pages`: `/portfolio` on github.io, empty with the custom domain. Cost: none.
- Untested without devices: real screen readers, iOS Safari and Firefox (the host has only Chromium; view transitions are verified there).
- The flight was replaced by one plain git log (2026-11-25, Luca: "very very simpler… easier to read, easy to access for many devices"). Each project is a commit row with its cover attached as a link with a `git show <hash>` chip (spike variant C); the project page keeps the full hero, and the cover morphs into it. Cost: no full-screen covers on home.
- The attachment link's accessible name is "git show <hash>: open <title>", starting with the chip's visible text (WCAG 2.5.3). Cost: a longer spoken name.
- Motion is CSS-first. Only rows below the fold at startup fade in, once (`reveal.js`), and only under `html.js`; focus, jumps, hash links, reload, Back, print and reduced motion show rows at once. Covers drift on a `view()` timeline; the planet rises and its orbit draws in. Hash links land 24 px below the top. Cost: none.
- The planet is its own layer, placed with container-query units so it stays on screen at any aspect ratio; portrait covers use a second seed. Cost: none.
- Entering a world (2026-11-26, Luca picked "faint" in a spike): while a project or work entry is the current row, the page takes on its colours; both IBM rows share one world. A world at rest is opaque (the strength is mixed into its colours) and a switch fades the new one in over the old, because translucent full-screen layers cost frames on a software GPU. Spec cells are see-through everywhere. Cost: rapid switches briefly blend two layers.
- The view-transition opt-in is inline in every page's head: in `site.css` it lost a race with the module graph, and no page transition ever ran. Cost: none.
- Performance budgets were resized with Luca for an audience on good desktops (see Performance). Cost: phones are not a performance target; they must still work and stay accessible.

## Known minor issues (deferred)

- On home, the NDA dagger takes the title's colour (the palette sits on the attachment, not the row). Micro-animation pass.
- The fonts have 2.1 KB of headroom; copy with a new symbol needs `scripts/fonts.py` rerun (a build test fails until then).
- The host's remote browser sometimes stops answering mid-run; `check.py` and `perf.py` now fail the stalled check or run by name instead of hanging.
- If `main.js` takes longer than 4 s to arrive, the head script drops `html.js` and rows show without fade-ins (by design: nothing stays hidden).
- Off the home page, j/k scroll smoothly even with reduced motion.
- Video covers would preload and have no pause button; image layers are not lazy-loaded (no media yet).
- The NDA dagger reads "frameworkunder NDA" to screen readers.
- Slugs and all-digit hashes are not validated.
- Spec extras not built: faster stars between sections, lighter grain and shallower perspective on phones, graph on project pages, project palettes in the colophon, session cell "luca", stars jump when the mobile address bar hides.
- The idle "esc · normal" label is uppercase and looks like the active state.
- Markdown: a paragraph starting with `<` passes through raw; emphasis can fire inside link URLs.
- CI runs only on pushes to `main`; scripts load in three rounds with no preloading.
- The "/" separator is about 3.4:1; a few elements ignore the iPhone safe area.
- `.venv/` is not in `.gitignore`, though the README creates it in the repo root.
- `world-contrast` runs only at 1280×800 and samples only the lede and cells; the no-planet unit test covers `image` covers, not `layers` or `video`.
- The `check.py` docstring still says web fonts are blocked (self-hosted fonts load now).

## Next

- The background: a dithered, low-bit galaxy as quiet texture in the retro-futuristic terminal style, with each project page in its own palette, built with deliberate old-school tricks (small indexed framebuffer, dither tables, palette cycling, a low update rate). Design first.
- The micro-animation pass with Luca: tune the fade-ins, drift, hover, the worlds' strength and timing, and the planet draw-in by eye.
- Real project copy and covers; then the merge to `main`.
