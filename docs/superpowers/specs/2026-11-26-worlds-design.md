# Entering a world (home log)

Status: approved by Luca on 2026-11-26 after the spike ("go with faint, and make the boxes see-through"). This extends `docs/superpowers/specs/2026-11-25-log-cards-design.md`. Everything there still binds, including its performance budgets and contrast rules.

## Intent

Luca: "when i reach each project or work, i want to have a faint change of background. like 'entering that world'." Reading the log should feel like passing through the places of a career, while the log stays calm and easy to read.

## Goals

- When a project or work entry becomes the current row (the one the graph cursor sits on), the page background slowly crossfades into that entry's world. Moving on to a row with no world fades it back to the plain background.
- Strength is "faint": the world layer at opacity 0.55, as picked in the spike.
- The spec cells (the "School / Years / Focus" boxes) are see-through, so the world shows behind them.

## Non-goals

- No worlds on `/work/`, `/about/`, `/help/` or project pages. Project pages already sit in their own palette.
- Text, stars and graph colours don't change.
- The status bar and the command line stay solid.

## Anti-goals (failure even if it works)

- Any text dropping below the site's contrast rules (AAA body text) inside a world.
- Repaint or layout work while scrolling, or a forced layout from the world code.
- A hard cut or flash between worlds.
- The world showing a different row than the cursor.

## Approaches considered

1. **Chosen: a fixed stack of pre-built layers, one per world, crossfading opacity on the graph's `graph:current` event.** It is compositor-only, adds no per-frame work, follows the cursor exactly (scroll, keys and jumps alike), and is built at build time.
2. Animating the body's background colour through a registered custom property. Rejected: every frame of the 1.5 s fade repaints the whole viewport.
3. Scroll-driven `animation-timeline: view()` per row. Rejected: it follows scroll position rather than the cursor, so worlds overlap mid-scroll, and it can't follow keyboard jumps.

Luca saw approach 1 in a spike with four strengths and picked "faint" and see-through boxes.

## Design

- **Which rows have a world:**
  - project rows use their project's `palette.bg` (base) and `palette.accent` (glow);
  - `big` rows, `special` included, use their lane colour `var(--b-<branch>)` as the glow, over `color-mix(in oklab, var(--base) 86%, var(--b-<branch>))`;
  - `head`, `merge`, `fork`, `root` and `slim` rows have none.
  - Rows with an identical world share one layer: both IBM rows are "the IBM world". Moving between them changes nothing on screen.
- **Layer:**
  - `#world` is `position: fixed; inset: 0; z-index: 0; pointer-events: none`, `aria-hidden`. It sits in the root stacking context, immediately before `#stars`, never inside `.page`, so the stars stay on top of it.
  - It holds one `<i>` per distinct world, rendered at build time.
  - Each `<i>` paints, from the spike: `radial-gradient(70% 90% at 0% 45%, <accent 26%>, transparent 72%)`, `radial-gradient(60% 55% at 100% 0%, <accent 12%>, transparent 75%)`, then the world's base colour.
  - Off is opacity 0, on is opacity 0.55. The transition is `opacity 1.5s cubic-bezier(.4, 0, .2, 1)`.
  - Under reduced motion the fade is 0.45 s. It is a colour change, not movement, so it stays.
- **Driver:** a small client module listens to `graph:current` and flips one class when the current hash changes. It does no layout reads and no other style writes. Without JS there is no world and the background stays plain.
- **See-through cells:**
  - every `.cells > div` (site-wide, for consistency) gets a translucent fill, `color-mix(in oklab, var(--mantle) 55%, transparent)`;
  - the 1 px hairlines between and around cells stay `var(--line)`, drawn without any opaque backing under the cells.
- **Print:** `#world` is hidden.

## Calls Claude made (check these)

- The status bar and command line stay solid. Luca said "boxes", meaning the cells.
- Cells are see-through on every page, not just home, so the site has one cell style.
- Worlds are on home only.
- The cell fill is mantle at 55%. It's tunable in the micro-animation pass.

## How we check it

Unit tests for the world markup. Browser checks:
- each world turns on, and only it, at the current row;
- neutral rows clear it;
- contrast stays at the site's thresholds inside every world;
- reduced motion, no-JS and print behave as above;
- the cells have no opaque backing.

The performance budgets in the log-cards spec cover the fade.
