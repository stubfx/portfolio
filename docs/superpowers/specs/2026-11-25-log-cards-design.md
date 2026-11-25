# Home as a plain git log with project attachments

Status: draft for Luca's approval · 2026-11-25
Extends: `2026-11-25-portfolio-design.md` (the binding base spec). Supersedes: `2026-11-25-fluid-flight-design.md` and its plan (only that plan's Task 1, the browser tooling, was built and is kept).
Chosen from a throwaway spike: variant C, "commit + attachment" (scratchpad `spike/gen.mjs`, served on :8081 during the session).

## Intent

Luca: "instead of having stuff going back and forth in the page, we should present them in a very very simpler format, much like in the work tab. i think is easier to read, easy to access for many devices and we can play a bit more with subtle animations."

So the home page stops being a scroll-driven flight through full-screen covers. It becomes the git log itself, read top to bottom with native scroll. A project is a commit like any other, with its cover attached. This pass is the **blockout**: structure, content, and the first version of the subtle animations. Luca and Claude refine the micro-animations together afterwards.

Measured reason to also expect a smoother site: the current flight drops about 22% of frames during a steady scroll at 1× CPU and 37% at 4×. It forces about 1,320 layouts per sweep from site scripts. A plain page (`/about/`) drops 0–1% with zero site-forced layouts. (Task 1 tooling: `test/e2e/perf.py`, median of 3, host Chromium 156.)

## Goals

- **One continuous log.** Home is the intro, one `ol.log` of every commit in order, and the EOF footer. Native scroll, nothing pinned, no full-screen takeover.
- **A project is a commit plus an attachment.**
  - The entry looks like the other big commits: header (year or span / branch, tags, hash), title with the Fraunces accent word (crema, as elsewhere in the log), the dagger if NDA, the lede (the project's first paragraph), and spec cells (the project's `cells`).
  - Below sits the **attachment**: a link to the project page showing the project's cover art, in its palette, with crop marks. It is 21:9 on wide screens and 16:10 on phones.
  - A chip on the attachment reads `git show <hash>` with an arrow. The link's accessible name is "Open <title>".
- **Every entry fades in once.** Each log entry fades in and rises slightly the first time it scrolls into view. Entries already on screen when the page loads never animate.
- **Attachments add a little more.**
  - On entering, the planet fades and scales up gently and its orbit line draws itself.
  - While scrolling, the cover art and the big accent word drift slowly (CSS scroll-driven animation; static where unsupported).
  - On hover or focus, the attachment's border takes the project accent, it lifts 2 px, and the chip arrow nudges.
- **The cover opens into the page.** Clicking an attachment morphs its cover into the project page's header with a cross-document view transition. The `view-transition-name: cover-<slug>` hook already exists on both ends. Elsewhere it is a normal navigation.
- **The planet is on screen everywhere.** On project page headers and work cards, the generative planet must be visible at every aspect ratio. Today the crop hides it on portrait screens: at 390×844, three of four planets are fully off screen and the fourth shows a sliver. Attachments are landscape and already fine.
- **Header copy backing without a hard edge.** The feathered panel behind the project page header's copy currently cuts the planet with a straight vertical edge. It gets a soft, organic feather.
- **The keys keep working.** `j`/`k` move by commit, `J`/`K` by project, `Enter` on a project opens it, `gg`/`G` go to the top and bottom. Links like `/#configurator-framework` land on that project's entry.

## Non-goals

- Fine-tuned micro-animations (the next pass, with Luca, on top of this blockout).
- Real project copy and media (Luca's content), DNS, the custom domain.
- Any change to the content model beyond removing the obsolete `segmentHeight`.

## Anti-goals (failure even if it works)

- **Content that can be invisible.** That covers:
  - content hidden before the script runs, if the script fails, or under reduced motion;
  - content hidden from assistive tech or find-in-page;
  - content left hidden after a fast scroll, a jump, a hash link or a Tab.
- **Animation that slows reading:** reveal longer than 0.9 s, or any stagger beyond 0.3 s.
- **A JavaScript scroll engine,** per-frame style writes from script, or jank (budgets below).
- **Scroll-jacking** of any kind (same rule as the base spec).

## Constraints

- Static site on GitHub Pages at the root of lucamolluso.com; base-path support stays.
- Zero-dependency build. Home JS under 25 KB gzipped (today 13.1 KB, and this removes the flight).
- Version control through `gitt`; local commits only until Luca says pushing works.
- Browser checks run on the host's Playwright 1.64.1 (`PW_WS=ws://172.29.160.1:3333/`), with Python Playwright and Pillow in a venv outside the repo (README, Task 1).
- WCAG 2.2 AA everywhere, AAA body text. The build's palette check and the e2e contrast checks stay green.

## Approaches considered

1. **CSS-first motion with a tiny observer. (Chosen.)**
   - Entries get their fade-in from a CSS transition triggered by one `IntersectionObserver`, which adds a class once and stops observing.
   - Drift uses `animation-timeline: view()` in CSS, which runs off the main thread where supported.
   - The orbit draw-in and planet rise are CSS transitions on the same class.
   - No per-frame script at all.
2. **A JavaScript scroll engine** (like the old flight). Rejected: it is what produced the measured jank, and subtle motion doesn't need it.
3. **No motion.** Rejected: Luca wants subtle animation and wants to refine it next.

Luca picked the presentation (variant C) from the spike and said "all entries fade in, go ahead". The build approach has one sensible option, stated to Luca before writing.

## Design

### Home markup

- The `.seg`, `.stage` and `.dwell` sections and the per-section `logseg` split go away. There is one `section.logseg.first` holding the intro and one `ol.log`.
- A project row's header, title, lede, tags, year/span and branch come from the project file, as the cover does today (its `tags` already include `planned` for the agentic pipeline). The log row only places it in the timeline.
- A project row is `li.row.k-project` holding `article.entry.pc`. It carries `id="<slug>"`, so old hash links still land, and `aria-labelledby` points at its title.
- The header keeps `data-hash`, `data-branch` and `data-kind="project"`, so the graph draws its ring node.
- The attachment is `a.pc-att` with the project's palette variables. It reuses the work card's cover art markup, including `view-transition-name`, plus the chip.
- `#ground` (the darkening overlay) is removed.
- The intro hint changes from "Scroll to fly through the log" to wording without the flight.

### Motion

- **Fade-in.**
  - Every `.entry` and `.slim` row starts at opacity 0, 18 px lower. This applies only under `.js` and only if it starts below the fold.
  - It eases to rest over about 0.9 s the first time at least 15% of it is in view (observer rootMargin about −10% at the bottom).
  - Rows in the first screen at load are marked revealed before first paint, so nothing above the fold animates or flashes.
- **Attachments.**
  - On reveal, the planet scales from about 0.86 to 1 and fades in.
  - The orbit stroke draws in over about 2.6 s.
  - The plate and accent word drift: translate ±6–8% of their box, linked to `view()`.
- **Hover and focus:** accent border, 2 px lift, chip arrow nudge 5 px.
- **Never hidden.**
  - Focusing anything inside an unrevealed row reveals it at once.
  - A hash link or vim jump reveals its target at once.
  - Under `prefers-reduced-motion: reduce`, nothing is ever hidden or moved, and view transitions are instant fades (the base spec's rule).
  - Without JS, or if `main.js` never runs, the existing 4 s fallback removes `.js` and everything is visible.
- The spike's values are the starting point; Luca and Claude tune them in the micro-animation pass.

### The planet layer (headers, cards, attachments)

The generative planet moves out of the 160×90 plate into its own layer, positioned with container-query units on `.cover`:
- **Landscape:** reproduces today's slice placement exactly. Centre `50cqw + (cx−80)·u`, `50cqh + (cy−45)·u`, radius `rad·u`, with `u = max(100cqw/160, 100cqh/90)`. The x position is clamped so the sphere stays inside on near-square boxes.
- **Portrait** (`aspect-ratio < 1`): a seeded position of x 55–80%, y 18–32% and radius 26–38% of the width, drawn from its own generator seeded with `hash + ':port'`.

The landscape seed draws are unchanged, so no planet moves on landscape screens. The plate keeps its stars.

- **Structure (Claude's call).** The sphere and its orbit ring are one SVG, `.layer.l-planet`, a sibling placed after the plate inside the cover's art.
  - The ring keeps today's proportions (rx = 2.3 r, ry = 0.42 r) and seeded tilt in both orientations.
  - Reveal targets that layer's sphere and ellipse.
  - Drift moves the plate and the planet layer separately, the planet slightly more (it reads as nearer).
- **Real art (Claude's call).** Covers with `image`, `layers` or `video` have no planet layer: in an attachment they get the fade-in and the drift only. The portrait planet rule applies only to generative covers. A unit test renders an image-cover project and checks that no planet layer appears.

### Graph and keys

- Without covers, the graph no longer dims, and nothing ever draws over it.
- Project rows are found by `kind === 'project'` instead of `.seg`:
  - `J`/`K` jump to them;
  - `Enter` follows the row's attachment link;
  - `go()` scrolls a project row like any other row.
- The dwell logic and every `.seg` lookup go.
- If the perf budgets fail, the graph's per-frame work (`detect` reading layout, `innerHTML` per animated frame) is fixed. Otherwise it is left as is.

### Removed

- `src/client/flight.js`, `src/client/phases.mjs` and `test/phases.test.mjs`.
- The `seg` mode in `cover.mjs`, the `.seg`/`.stage`/`.dwell`/`.land` cover-flight CSS, and `#ground`.
- The `segmentHeight` default and its docs.
- The `.seg`-based sweep ranges in `perf.py` and `strip.py`, which are re-pointed (see How we check it).

### Copy

- The home intro hint, the HEAD commit text ("A git log you can fly through, …") and the colophon's Motion paragraph lose the flight. The Motion paragraph describes the fade-ins, drift and morph, and what reduced motion does.
- The README's tagline and "Add a project" section lose the full-screen cover and `segmentHeight`.
- `content/log.mjs`'s comment about `project` commits opening full-screen covers is updated.
- No em dashes.

### Twitch

- The Twitch commit (`c7d41ab`) gets span `2019–24`. Its text says five years of streaming, from 2019 to 2024, keeping the chat-driven Minecraft games. Its cells say `Years: 2019 to 2024`.
- `content/about.md` says the same ("Streaming on Twitch since 2019" becomes five years of streaming, 2019 to 2024).

### Self-hosted fonts

Per the README's existing recipe:
- Atkinson Hyperlegible Next 400, 700 and 400 italic.
- Atkinson Hyperlegible Mono 400 and 700.
- Fraunces italic variable (opsz, wght).

All woff2, subset to Latin, under 120 KB total, in `public/fonts/` with `fonts.css` and the OFL licence texts. The VM has network access; sources come from the fonts' official repositories or Google Fonts.

If the files exceed 120 KB (Claude's call), cut in this order. The budget itself never moves.
1. Subset to the characters the site actually uses (Latin basic and Latin-1 plus the punctuation and symbols in content, such as † → – ’ ·).
2. Pin Fraunces's `opsz` axis to one display value and keep `wght` 300–500.
3. Replace Fraunces with static italic 300 and 400 instances. The layout then switches to the local stylesheet and the colophon says "no third-party requests" (existing logic). The subsetting tool lives in the venv outside the repo.

## Performance budgets

`test/e2e/perf.py --assert`, median of 3, 1280×800, steady scroll from the top of the log to the EOF footer:
- dropped frames under 2% at 1× CPU and under 10% at 4×;
- zero site-forced layouts;
- no site script task over 4 ms at 1×.

`perf.py` and `strip.py` lose their `.seg` ranges:
- **perf:** the full log, top to bottom.
- **strips:** two sheets per viewport (1280×800, 390×844).
  - The first screen-and-a-half after load shows fade-ins.
  - A pass across one attachment shows reveal, orbit draw-in and drift.

## Calls Claude made (check these)

- Fade-in timing: about 0.9 s, 18 px rise, 15% visible to trigger, nothing above the fold animates.
- Old `/#slug` links land on the project entry (`id="<slug>"`).
- `#ground` and `segmentHeight` are removed outright, not kept dormant.
- The planet layer change, carried over from the superseded design, applies to project headers, work cards and attachments alike.
- Graph performance work happens only if the budgets fail.
- Twitch reads 2019–24.
- Font files carry their OFL licences in `public/fonts/`; over budget, cut characters, then Fraunces's opsz axis, then use static Fraunces instances.
- The planet and orbit form one SVG layer beside the plate; real-art covers have no planet effects.
- Project rows show the project file's tags, span and branch (`planned` stays visible).

## What's left to the builder

- Exact CSS structure, the observer's thresholds within the stated ranges, and easing curves (the spike's are the starting point).
- How "above the fold at load" is detected before first paint, for example a synchronous check in `main.js` before the observer starts. It must not flash.
- The exact copy of the updated sentences (no em dashes, Luca's voice as in `about.md`).

## How we check it

- **Unit:** build output for the new home markup (one log; project rows with `id`, header data, attachment link, chip, cells; no `.seg`, `#ground` or `segmentHeight`), planet geometry, Twitch content, fonts switch.
- **Browser (existing checks adapted, new ones added):**
  - `/#slug` lands with that entry in view and visible.
  - Entries below the fold start hidden and are visible after scrolling to them.
  - Nothing above the fold is ever hidden.
  - After a full sweep, every entry has opacity 1.
  - `End` then `Home` leaves no hidden entry in view.
  - Tab into an unrevealed row reveals it.
  - Reduced motion and no-JS show everything.
  - Clicking an attachment reaches the project page.
  - `J` lands on a project row and `Enter` opens it.
  - The planet is on screen for headers, cards and attachments at 1280×800, 390×844, 360×740, 844×390, 1024×1366, 1366×1024 and 1000×900.
  - The contrast checks for header copy and the attachment chip pass.
  - The colophon reports no third-party requests once the fonts are self-hosted.
- **Performance:** the budgets above, before (Task 1 baseline) and after.
- **Eyes:** the strips at both viewports, then Luca on http://172.29.169.57:8080/.
