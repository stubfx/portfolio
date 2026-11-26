# The sky: a lowbit dithered galaxy behind every page

Status: approved by Luca on 2026-11-26 after a spike ("go with soft, but make it waay softer, write the design and build it"). This extends `2026-11-25-log-cards-design.md` and replaces the starfield and the world layers of `2026-11-26-worlds-design.md`. Everything else in those specs still binds.

## Intent

Luca, in his words: a "retro futuristic look in the terminal style, polished for the modern times."

- The main pages get a low-bit colour galaxy, techy and terminal-like in the Neovim spirit. Each project page gets its own branding.
- The background is texture, not a show. He likes the current star layer because it "feels like a normal texture and nothing else".
- Performance must be good, and achieved on purpose with old-style tricks, so the engineering matches the vibe.
- Shooting stars "every once in a while". In the spike he asked for twice the run ("it looks amazing") and picked the "lowbit" look.

## Goals

- **One renderer behind every page:** a dithered, lowbit galaxy drawn into a small indexed-colour framebuffer and scaled up with hard pixels.
- **A calm reading lane:** behind the reading column the sky fades to almost nothing. It keeps under a tenth of its variation, as a whisper of dither, with no stars and no meteors. It dissolves into the full sky in the margins over about 120 px, with the ordered dither doing the fade.
- **Shooting stars:** every 7 to 16 s, each running about 1.5 s with a short fading tail, never inside the lane.
- **Worlds become palette fades:** on the home log the sky's palette follows the current world (the same colours and "faint" strength as the worlds spec), fading over about 1.2 s. Project pages use their own palette, and the other pages use the site's.
- **Old-school tricks, documented in the colophon:** indexed colour, a precomputed ordered-dither table, a baked noise field, palette cycling, hardware-style scroll, dirty pixels, low update rates and a dirty schedule.

## Non-goals

- The film grain is untouched (Luca: "leave the grain untouched for the moment").
- Covers, the planet, text and the graph don't change.
- No WebGL and no dependencies.

## Anti-goals (failure even if it works)

- Text losing readability or contrast (AAA body text, AA labels) anywhere, in any world.
- Flashing: shooting stars are rare, small and slow, far from the 3-per-second threshold.
- Layout reads inside animation frames, or a site script task over 4 ms during scrolling (the performance gates).
- A sky that moves under reduced motion.

## Approaches considered

1. **Chosen: a 2D canvas with an indexed framebuffer**, and the tricks above. Proven in the spike: about 0.5 to 1 ms per redraw on the software-GPU test browser, at 10 redraws a second.
2. A WebGL fragment shader. Rejected: it is not old-school, it is heavier to start, and it is overkill for a texture.
3. CSS only (gradients and SVG filters). Rejected: no ordered dither, no palette cycling, no meteors.

## Design

- **Framebuffer:**
  - The canvas is `ceil(viewport / 3)` pixels plus one row, scaled ×3 with `image-rendering: pixelated`, fixed behind the page where `#stars` was (same stacking slot).
  - It is opaque, so it replaces the page background behind it.
- **Lowbit look (fixed):**
  - 4 palette levels, a 4×4 Bayer matrix, and strength 1.0.
  - Star density 0.0015 per low-res pixel.
  - Temporal dither: the threshold matrix shifts by one pixel every other tick, so mid-tones breathe slightly.
- **Palette:**
  - Index 0 to 3 is the sky ramp: darker than the page; then the page's own base, exactly, at level 1; then a faint lift toward the accent (20%).
  - 8 to 11 are four star twinkle groups whose colours cycle (palette cycling, no star is redrawn).
  - 12 to 15 are the meteor trail, head to tail.
- **The sky field:**
  - Value noise (fbm) and a diagonal band, minus dust lanes.
  - Ordered-dithered into palette levels in world space, so the dither scrolls with the sky and never crawls.
  - Built row by row on demand: only rows on screen are ever baked, a handful per scroll step.
- **Scroll (changed while building, see below):**
  - The sky moves at 5% of the scroll.
  - The canvas holds the whole page's sky: the screen's rows plus the rows the scroll reveals.
  - A CSS scroll-driven animation (`animation-timeline: scroll(root)`, `steps()` of one screen pixel) slides it on the compositor. No script runs on scroll. Without support, or under reduced motion, the sky holds still.
- **Lane:**
  - It is the reading column (`main .frame`), measured at start, on resize and when fonts load, never per frame.
  - Inside the lane, the sky's variation around the base level is scaled to 0.08 and stars are omitted.
  - Meteor pixels are drawn only where the lane factor is above 0.5.
- **Update schedule:**
  - 10 ticks a second at rest: twinkle and temporal dither. 30 while a meteor flies or a palette fades.
  - Dirty pixels: a frame rewrites only new rows, the stars, and the pixels the lens and meteors covered. A palette step or a breath recomposes the buffer from per-row palette indices kept for both dither phases.
  - Paused while the tab is hidden.
- **Reduced motion:** one still frame. No parallax, twinkle, temporal dither or meteors. A palette change is still a quick 0.45 s fade (colour, not movement).
- **Worlds:**
  - The build computes each world's colours: `base` is the approved faint base (the world colour mixed 55% into `--base` in sRGB, with lane worlds first mixed in OKLab as before), and `accent` is the project accent or the lane colour.
  - They ship as JSON in the home page. On `graph:current` the sky fades to that world, or back to the page's own colours.
  - Rows with the same colours share a world, so moving between them changes nothing.
  - The world DOM layers and their stylesheet are removed.
- **Project pages:** base `--bg`, accent `--p-accent`, both on `<body>`. Other pages: base `--base`, accent `--lavender` (a new token, `#b4befe`).
- **No JavaScript, print:** without JavaScript the canvas stays transparent and the page shows its plain background. In print, the canvas is hidden.

## Calls Claude made (check these)

- The lane keeps 8% of the sky's variation and drops stars entirely ("waay softer" than the spike's 25%).
- The lane covers `main .frame` on every page, the graph gutter included.
- The world colours are computed in the build, not read back from CSS, so the sky needs no hidden layers.
- `--lavender` joins the tokens as the default accent.
- The colophon (help) gets a short "How the sky is drawn" list of the tricks.

## Added while building (Luca)

- The dither reacts to the mouse "just a tiny little bit": a lens lifts the sky's values by up to 0.12 within 90 px of the pointer and re-dithers them, scaled by the lane factor, eased toward the pointer at the tick rate; fine pointers only, off under reduced motion.
- "Make the shooting stars fade out, fast, but not abruptly": over their last 8 ticks (about a quarter of a second) they burn out with an ordered-dither dissolve while their colours step down.
- "The stars are forming a pattern": stars are placed per row from a hashed seed (a linear seed lined them up into diagonals); a unit test fails if one step between rows repeats in more than 3% of rows.

## Changed while building (Claude, for performance)

- **Scroll moved to CSS.** The scroll handler's `scrollY` read forced a style recalc on every scroll event (3 to 8 ms tasks in traces), so the canvas now holds the whole page's sky and a scroll-driven animation moves it. `sky-scrolls-in-css` checks the offset (whole pixels, about 5% of the scroll) and that no sky script runs during a traced scroll.
- **Dirty pixels.** Full redraws of the taller buffer at 30 frames a second during fades and meteors reached 4 to 5.5 ms on the test host. A frame now rewrites only what changed; the worst sky task in a sweep fell to about 1.9 ms.

## How we check it

- **Unit tests:** dither tables, noise determinism, the exact base level, the lane falloff, quantization, colour mixing, and the world data.
- **Browser checks:**
  - the sky renders at low resolution with hard pixels;
  - the lane behind the text is near-flat with no star pixels;
  - a forced meteor appears in the margin and never inside the lane;
  - reduced motion gives a still frame;
  - print and no-JS;
  - worlds fade the palette to the right colours (both IBM rows: no change; a merge: back to the page's own);
  - text contrast in every world;
  - the performance gates.
- **Screenshots** at 1280×800 and 390×844 on home, a world, and a project page.
