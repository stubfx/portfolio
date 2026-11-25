# Status

Read this first when resuming work. Last updated 2026-11-25.

## Where things are

- **Live:** https://stubfx.github.io/portfolio/ (deployed by `.github/workflows/pages.yml` on every push to `main`).
- **Target domain:** lucamolluso.com (not connected yet).
- **Design:** `docs/superpowers/specs/2026-11-25-portfolio-design.md` (the binding spec).
- **Plan:** `docs/superpowers/plans/2026-11-25-portfolio-site.md` (9 tasks, all done).
- **How to run, add a project, deploy:** `README.md`.
- **History:** PR #1 (the site), PR #2 (base path fix for github.io).

## Before launch

- [ ] Self-host fonts in `public/fonts/` (README has the steps). Google Fonts sends visitor IPs to Google, a GDPR exposure in the EU (LG München, 2022).
- [ ] Settings → Pages → custom domain `lucamolluso.com`, then Enforce HTTPS. DNS per README. Verify the domain in account settings.
- [ ] Replace the sample copy in all four `content/projects/*.md` and add real covers under `public/media/<slug>/`.
- [ ] Optional: CV PDF in `public/` and a link in `content/about.md`.

## Open questions for Luca

- Tab set: `1 log`, `2 work`, `3 about`, `4 :help`. Confirm or change.
- Twitch: the site says "since 2019"; the LinkedIn/CV doc says "5 years". Pick one.
- The art school branch is labelled `art-school`; projects are sample content.

## Decisions taken during the build (and the cost if wrong)

- Astro could not be installed (no network), so the build is a zero-dependency Node script. Cost: none; content files keep a shape Astro could read later.
- Test command is `node --test "test/**/*.test.mjs"` (Node 22 rejects a folder path). Cost: none.
- `tokens.css` is checked against the colour tokens in code. With reduced motion, page transitions crossfade. Cost: none.
- Optional fields: project `span`, `cells`; branch `label`; commit `special`, `help`. Cost: none.
- The build fails on a project palette below 7:1 (fg) or 4.5:1 (accent), or a project hash that does not match its commit. Cost: a build error instead of a broken page.
- `content/site.mjs` holds contact facts (email `info@lucamolluso.com` from the CV); `content/about.md` is adapted from the LinkedIn About; a 404 page uses a vim error joke. Cost: none.
- With JavaScript, each cover overlaps the last screen of the log before it and the first screen after it, so both are visible during the flight; `#slug` links land mid-cover. Cost: short log sections stay readable only briefly.
- Covers start hidden until the script runs; after 4 s without it the page falls back to plain stacked sections. Cost: if the script fails after starting, covers stay hidden.
- A cover clears in the first 60% of its exit, so the next log does not show through it. Cost: none.
- Faded logs stay in the Tab order; focusing one scrolls it into view (keyboard focus only). Cost: none.
- The graph exposes an interface for the vim keys; branch topology ships as JSON in the page; school's fork point was removed. Cost: none.
- A project node sits at the centre of its cover section; the cover on screen is always the current commit. Cost: none.
- After a jump (j/k/J/K) the cursor stays on that commit until the user scrolls by hand (replaces a 700 ms lock). Cost: none.
- The flight measures layout positions (offsetTop), not on-screen boxes, so its own transforms do not feed back. No dedicated test. Cost: low.
- Grain moves with a transform; the screen darkens with a fixed black overlay, not body custom properties. Cost: none.
- Esc announces normal mode for screen readers. Off the home page j/k scroll and J/K/Enter do nothing. Enter on a focused link always follows it. Cost: none.
- Cover copy sits on a feathered panel of the cover's own background, so any art keeps text readable. Art cost: the giant accent word is mostly hidden behind the copy; revisit when real covers exist.
- Status bar is 44 px on phones and touch screens, 34 px on desktop. Cost: a fine-pointer touchscreen gets 34 px targets.
- Workflow uses checkout@v5, setup-node@v5, configure-pages@v5, upload-pages-artifact@v4, deploy-pages@v4. Cost: if setup-node@v5 misbehaves, pin @v4.
- Browser checks do not run in CI (CI stays install-free). Cost: run `npm run e2e` locally before merging.
- Base path comes from `actions/configure-pages`: `/portfolio` on github.io, empty with the custom domain. Cost: none.
- Untested without devices: iOS toolbar vs the 100vh stage, real screen readers, view-transition visuals.

## Known minor issues (deferred)

- The 4 s fallback can still misfire on a very slow connection.
- Off the home page, j/k scroll smoothly even with reduced motion.
- Video covers would preload and have no pause button; image layers are not lazy-loaded (no media yet).
- The NDA dagger reads "frameworkunder NDA" to screen readers.
- Slugs, segment height and all-digit hashes are not validated.
- Rotating a phone mid-cover shifts the reading position.
- Spec extras not built: faster stars between sections, lighter grain and shallower perspective on phones, graph on project pages, project palettes in the colophon, session cell "luca", stars jump when the mobile address bar hides.
- The idle "esc · normal" label is uppercase and looks like the active state.
- Markdown: a paragraph starting with `<` passes through raw; emphasis can fire inside link URLs.
- CI runs only on pushes to `main`; scripts load in three rounds with no preloading.
- The "/" separator is about 3.4:1; a few elements ignore the iPhone safe area; four home sections are all labelled "Log".
