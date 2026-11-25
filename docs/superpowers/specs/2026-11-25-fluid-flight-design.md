# Fluid flight: covers that open, overlap and keep moving

Status: draft for Luca's approval · 2026-11-25
Extends: `2026-11-25-portfolio-design.md` (the binding spec). Everything there still holds unless this document says otherwise.

## Intent

Luca loves the simplicity of the home flight, but the in/out of every cover "feels too much like PowerPoint". He wants the log and the covers to intertwine fluidly. Separately, the git graph is visible on top of the project covers while you scroll over them, and that must not happen.

A frame-by-frame capture of one log → cover → log pass (21 frames, 120 px apart, 1280×800) shows why it reads as slides:

1. **Hand-offs, not overlaps.** The log fades out completely before the cover arrives, and the cover clears to near black before the next log appears. One 120 px scroll step goes from text to a near-full cover.
2. **The cover is one flat card.** A framed rectangle grows from the centre, then scales up and fades: PowerPoint's zoom transition.
3. **Motion stops and restarts.** About 40% of each segment shows the same frame (only a 14vh layer parallax moves).
4. **Graph on top.** `#graph` is `z-index: 6`, the cover stage `z-index: 4`. The graph is at full strength during the approach and 20% during the dwell, so its rails cut across every cover.

## Goals

- **No empty frames.** At every scroll position something meaningful is on screen: the outgoing log, the cover, or the incoming log. Neighbours overlap in time.
- **The cover opens from its planet.** A circular aperture grows from the cover's focal point (the generative planet, or a set focal point for real art) until it fills the screen. No rectangle ever scales in.
- **Pieces arrive separately.** Sky, planet, accent word and copy each have their own timing and depth, so the arrival is choreographed, not a single block.
- **Motion never stops.** Background layers drift at constant speed through the whole segment; only the text holds still while it is readable.
- **One space.** The site's stars continue inside the cover: same stars, same drift, a different sky colour behind them.
- **The graph sits behind covers** and fades out as a cover takes the screen, returning as it leaves.

## Non-goals

- No change to project pages, the work grid, the content model (beyond one optional field), or the vim keys, with one exception: the generative planet becomes its own layer in every cover rendering (home, project hero, work card), so it is on screen at every aspect ratio and the cover-to-hero view transition doesn't jump (see The planet on every screen).
- No new dependencies, no WebGL, no 3D engine.
- Not option 2 (one continuous camera) and not option 3 (cover opens from the commit dot); see Approaches.

## Anti-goals (failure even if it works)

- Any scroll-jacking (same rule as the base spec): native scroll only, progress-driven.
- Text that moves while it is meant to be read, or more motion than the base spec allowed under `prefers-reduced-motion`.
- Animating anything other than `transform` and `opacity` per frame (no per-frame `clip-path`, filters, colours or layout writes). Phones must not run hot.
- Losing what already works: covers in the accessibility tree and Tab order, find-in-page, hash links landing mid-cover, focus revealing faded content, the 4 s no-JS fallback, cover text contrast.

## Constraints

- Static site on GitHub Pages, served from the root of lucamolluso.com (base path support stays).
- Zero-dependency build; home JS stays under 25 KB gzipped (currently 13.1 KB).
- Works from 360 px phones to wide desktops, touch, wheel, trackpad and keys.
- Browser checks run against the Playwright 1.64.1 server on the VM host (`ws://172.29.160.1:3333/`), not a local Chrome. Verified: all 17 existing e2e checks pass that way today (Python Playwright 1.64.1 and Pillow in a venv outside the repo, so the project itself stays zero-dependency; `connect(..., expose_network='<loopback>')` so the host browser reaches the check's local server). `check.py` gains an opt-in `PW_WS` environment variable for this; without it, it launches local Chrome as before.

## Approaches considered

1. **Overlap and stagger inside the current engine. (Chosen.)** Keep per-segment scroll progress and the sticky stages, but replace the four back-to-back stages with overlapping tracks per element, open the cover through an aperture from its planet, keep background layers drifting, and share the starfield. Medium-sized change to `phases.mjs`, `flight.js`, `stars.js`, the cover markup and CSS.
2. **One continuous camera.** Every log entry and cover element at a depth on one track; scrolling moves the camera past and through them. The most literal flight, but a large rewrite, text moving in depth is hard to read, and the base spec lists motion sickness as an anti-goal.
3. **The commit opens into the cover.** The project's node on the git graph opens like an iris into the cover and closes back into the next commit. Strong tie to the git spine, but every reveal starts at the left gutter, which is narrow on phones. Could be layered onto 1 later.

Luca handed over the choice ("your picks"). Claude chose 1, with the aperture opening from the planet rather than from the commit dot.

## Design

### Timeline

Progress `p` runs 0 → 1 over a segment's pinned run, as today. Each element gets its own window on `p` and its own easing; windows overlap. Defaults below are starting values to tune by eye, not contracts.

| Track | Window (p) | What happens |
| --- | --- | --- |
| Previous log | 0 → 0.22 | Rows drift up and back and fade, top rows first (staggered a few % of p apart), so the last rows are still leaving while the aperture opens. |
| Ground | 0.04 → 0.30 | The page ground deepens toward black around the opening aperture. |
| Aperture | 0.04 → 0.30 | A circle centred on the focal point grows from nothing to past the farthest screen corner. Slow start, fast middle, soft landing. Its edge is a 1 px hairline in the project accent that fades as it leaves the screen. |
| Graph | with the aperture | Graph opacity follows how much of the screen the aperture covers: 1 → 0 as it opens, 0 through the dwell. |
| Sky and stars | whole segment | Visible inside the aperture from its first pixel; drift at constant speed with scroll, never stopping. |
| Planet | 0.06 → 0.40, then on | Comes from depth inside the aperture (smaller and farther → full size), then keeps drifting at constant speed until departure. |
| Accent word | whole segment | Slow constant sideways drift. |
| Copy | 0.18 → 0.36 | Meta line, title, lede, land link rise in one after another (about 0.03 apart). Then they hold perfectly still. |
| Copy leaves | 0.74 → 0.86 | Same pieces lift off, meta first. |
| Sky dissolves | 0.78 → 0.96 | The cover's background fades to the ground; the stars stay continuous because they are the same stars. |
| Planet leaves | 0.78 → 1 | Slides past the camera: grows and moves out toward its own side, fading at the very end. |
| Ground lifts | 0.82 → 1 | Black back to Mocha base. |
| Next log | 0.84 → 1 | Rows rise in one by one (bottom-up stagger) while the planet is still leaving. |

The copy is still and fully legible from about 0.36 to 0.74. The hash anchor (`#slug`, 0.55) stays inside that window.

**Chained covers** (two projects with no log between, today BA → configurator): the next cover's aperture starts opening while the previous cover's planet is still leaving. The rule is the same as everywhere: no scroll position shows only the ground.

**Invariant (testable):** for every `p`, at least one of outgoing log, cover copy or incoming log is at opacity ≥ 0.5, or the aperture is at least half open. No black or empty frame between neighbours.

### The aperture

- Opens from the cover's **focal point**. Generative covers: the planet layer's centre, measured at runtime (see The planet on every screen). Image or video covers: a new optional frontmatter field `cover.origin: [x, y]` in percent of the cover (Claude's call; default `[50, 50]`). The build validates it (two numbers, 0–100).
- Must be transform-only. Suggested technique: a round wrapper (`border-radius: 50%; overflow: hidden`) sized to the largest needed circle and scaled up from near zero, with the cover content inside counter-scaled so it stays put on screen. The builder may choose another technique if it stays transform/opacity-only and crisp.

### The planet on every screen

Today the planet is drawn inside the 160×90 plate, which is cropped to fill the screen (`preserveAspectRatio slice`, plus a 6% overhang). On portrait phones the crop keeps only the middle strip and the planet (always placed at x 96–136 of 160) falls outside it. Computed with `seeded(hash)` at 390×844, planet centres land at x 585–767 px on a 390 px screen: three covers show no planet at all, configurator a sliver. Same at 360×740. Desktop and landscape are fine.

Since the aperture opens from the planet, the planet must be on screen everywhere:

- The planet (sphere plus orbit) moves out of the plate into its own layer, positioned in viewport terms rather than by the plate's crop. Landscape keeps today's placement; portrait places it in the upper part of the screen, clear of the copy block at the bottom (roughly x 55–80%, y 18–32%, a radius that reads as a planet, not a dot). The seed still varies position, size and tilt within those ranges.
- The same rule applies to the project hero and the work card, so the planet is visible there on phones too and the view transition from cover to hero has no jump.
- The aperture's focal point is the planet layer's measured centre, re-measured on resize and orientation change.

### Real art (image, layers, video)

No real art exists yet; the generative covers are what ship now. When art arrives, its layers take the same roles without new content fields:

- `image` or `video`: a single sky layer. It opens through the aperture from `cover.origin` and drifts slowly; there is no planet track.
- `layers: [back, mid, front]`: the first is the sky (opens with the aperture, slowest drift), the last plays the planet's part (arrives from depth, drifts, leaves past the camera), the middle ones sit between in depth and timing.
- Shared stars render beneath the art, never on top: they show only where Luca's art is transparent. Art that wants the "one space" effect uses transparent layers; opaque art simply covers them.
- A test fixture with three transparent placeholder layers exercises this path in the browser checks, so it is proven before real art lands.

### Shared stars

- The generative cover keeps its planet and orbit but drops its own static star dots in home segments.
- Each cover gets a star layer showing the same stars as the site (same seed, positions, depth layers and drift) beneath the planet, unmasked (full width). Inside and outside the aperture the stars line up, so it reads as one space with a different sky; once the aperture is fully open, stars span the whole screen without touching the site layer's reading-column mask.
- Star colour inside a cover may follow the project's `fg` (builder's call; static, never animated).
- Project pages and work cards keep their current stars.

### The graph

- `#graph` moves below the cover stage in the stacking order, so a cover always sits on top of it.
- Its opacity follows the aperture (see Timeline) instead of the old 1 → 0.2 dim. The cursor and nodes go with it.
- The current-commit logic is unchanged: the status bar still shows the project as current while its cover holds the screen.

### Cover copy backing

The feathered pool of `--p-bg` behind the copy (it keeps text contrast on any art) currently shows a hard vertical edge across the planet (visible on the configurator project page). With the planet now drifting behind it, that edge would be more visible. The pool gets a wider, softer, more organic feather (e.g., radial). The build's palette check and the e2e contrast check must still pass at all three test viewports.

### Performance: fluid means no dropped frames

Luca's bar for this project is "top notch", so fluid has to be measured, not assumed. A baseline trace of today's site (host Playwright, Chrome 156, 1280×800, a steady 10 px-per-frame scroll for 240 frames through the first cover) shows the motion is also janky, not only badly choreographed:

| | 1× CPU | 4× CPU (phone-ish) |
| --- | --- | --- |
| Frames dropped | 92 of 331 (28%) | 343 of 584 (59%) |
| Style recalcs / layouts | 384 / 105 | 418 / 105 |
| Top script cost | graph `detect` 144 ms, stars `draw` 103 ms, flight `frame` 68 ms, graph `frame` 59 ms | ×7 |

Causes visible in the code: the flight, the graph and the stars each run their own scroll handler and `requestAnimationFrame`; the graph reads `getBoundingClientRect` after the flight has written styles (forced style and layout every frame); the graph rebuilds branch-node markup with `innerHTML` on every animated frame; the starfield clears and redraws every star with `arc()` on every scroll.

Required:

- **One frame loop.** A single scroll-driven `requestAnimationFrame` per frame for flight, graph detection and stars, with every read (scroll position, cached layout) before any write. Layout positions are measured on load, resize and font load, never per frame.
- **No DOM building per frame.** Graph markup is created once per layout; frames only update attributes or transforms.
- **Stars move, not redraw.** Each depth layer is rendered once (per size) and moved with transforms; the cover star layers reuse the same renders.
- **Promote only what moves** (layers for the aperture, planet, copy and logs while they animate), and drop promotion when idle so phones don't hold dozens of layers.

Budgets, measured with the same trace on the same server, through log → cover → cover → log:

- 1× CPU: under 2% frames dropped. 4× CPU: under 10%.
- Zero forced layouts during scroll (no Layout or style recalc triggered from script between a write and a read).
- Script under 4 ms per frame at 1×.
- Home JS still under 25 KB gzipped.

### Reduced motion

Unchanged in spirit: no depth, no drift, no aperture growth, no staggered movement. Covers and logs crossfade over short windows; copy is present when the cover is; stars static. The aperture is simply fully open whenever the cover is visible.

### Phones

Same choreography and windows; segments stay at two thirds height. Depth moves shallower (smaller z offsets) where they would crowd a 360 px screen. The aperture's focal point is measured per viewport, so the planet's different crop on a tall screen is handled.

## Calls Claude made (check these)

- Aperture opens from the planet, not the commit dot (option 3 stays available as a later layer).
- The aperture edge is a 1 px accent hairline, echoing the orbit lines and crop marks.
- New optional frontmatter `cover.origin` for real art; default centre.
- Copy holds still from roughly 0.36 to 0.74 of the segment; everything else keeps moving.
- Segment height default stays 300vh.
- The copy backing gets a softer feather as part of this work, since the drifting planet would expose its edge.
- The planet becomes its own layer and is placed on screen in portrait (upper part, clear of the copy) on home, hero and cards alike. This is the one change outside the home page.
- Real art maps onto the tracks by layer order (first = sky, last = planet's role); stars sit beneath art, never on it; a three-layer test fixture proves the path.
- Performance budgets as numbers (2% / 10% dropped frames at 1× / 4× CPU, no forced layouts, 4 ms script per frame), measured on the host's Playwright server.

## What's left to the builder

- Exact windows, easing curves and stagger offsets (defaults above), tuned by eye against frame strips and on Luca's screen.
- How chained covers share their overlap in the progress maths.
- The aperture technique, within the transform/opacity rule.
- Whether per-row log staggering writes to rows or to small groups, as long as it stays cheap.
- Updating unit and e2e tests to the new timeline (`test/phases.test.mjs`, `test/e2e/check.py`), including the no-empty-frame invariant and "graph is behind the cover / transparent mid-dwell". Making the e2e harness able to use the remote Playwright server.

## How we check it

- Unit: the timeline maths (windows, overlaps, the no-empty-frame invariant across `p` in small steps, reduced motion having no depth or drift).
- Browser: the existing e2e checks pass (adapted where they assumed the old stages, e.g., clicking "land" at p = 0.15 before the copy has arrived), plus: graph transparent mid-dwell; no frame in a scroll sweep where log, copy and aperture are all absent.
- Performance: the trace above, scripted and repeatable, reporting dropped frames, forced layouts and script time per frame at 1× and 4× CPU, before and after.
- Eyes: frame strips of log → cover → log, cover → cover and cover → log at 1280×800 and 390×844, a recorded scroll video of the whole home page, and Luca scrolling it live on the VM's server.
