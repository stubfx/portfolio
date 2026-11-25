# lucamolluso.com: portfolio design

Status: draft for Luca's approval · 2026-11-25
Prototype it grew from: https://claude.ai/artifact/VmtebUAfFyXH9LLFQXyYa1

## Intent

A portfolio that proves Luca is a technical artist with an art director's eye, not just says it. It should get recruiters to write to him (he is quietly open: game studios, AI technical artist roles, creative technology agencies). The site itself is the first exhibit: a dark, cinematic journey through his career, where every project arrives with its own art direction.

Identity in one line: the terminal is the cockpit, the projects are the universe.

## Goals

- Home is a scroll-driven flight through space. The git log of his career is the spine; each project cover flies in from depth, fills the screen, plays its own art-directed sequence, then drifts away as the log returns.
- Each project also has its own page (case study, breakdowns, process), reached by "landing" on its cover.
- Every project can carry its own palette, type and motion inside a shared frame.
- Adding a project means adding one content file plus its media, no layout work.
- Accessibility is a feature to show off: WCAG 2.2 AA everywhere, AAA for body text, documented in a colophon.

## Non-goals

- No CMS, no backend, no analytics, no cookies.
- No light theme (dark only, see Colour).
- No real client names or NDA material.

## Anti-goals (failure even if it works)

- Scroll-jacking: wheel or touch hijacked, scroll speed altered, or the user trapped in a section.
- A "hacker terminal" cliché: green on black, typing effects, matrix rain.
- Motion that causes nausea or ignores the user's reduced-motion setting.
- A heavy page: a 3D engine download before anything shows, or phones running hot.
- Text that exists only as pixels (canvas or images) and can't be read, selected or found.

## Constraints

- Static hosting on GitHub Pages from `stubfx/portfolio`, custom domain lucamolluso.com (CNAME + DNS, HTTPS by Pages).
- FOSS tools and fonts only.
- Works at 360px phones through wide desktops; touch, trackpad, wheel and keyboard.
- Content arrives later: the build must look finished with placeholder art.

## Approaches considered

1. **Plain HTML, CSS and JS, no build step.** Zero dependencies, simplest deploy. But project pages would duplicate the shell by hand, and per-project content gets messy as projects grow.
2. **Astro static site, DOM and CSS 3D for the flight, canvas 2D starfield. (Chosen.)** Astro is MIT-licensed, outputs plain static HTML, and its content collections give one Markdown file per project with typed frontmatter. The flight engine is a small vanilla script: native scroll, sticky sections, one animation loop writing transforms. Text stays real HTML. Deploys to Pages with the official Astro GitHub Action.
3. **Three.js / WebGL scene.** The most literal space flight, but a large download, text drawn as pixels unless duplicated in the DOM, harder per-project art direction in HTML and CSS, and the most phone battery. The depth effect is achievable with CSS perspective at a fraction of the cost.

Luca handed over the how; Claude chose approach 2, then switched to a variant of approach 1 at planning time: the build workspace cannot install npm packages, so Astro could not be installed or verified. The site is built by a **zero-dependency Node script** (Node built-ins only): project Markdown files with frontmatter, templates as JS template literals, output to `dist/`. Everything else in this design is unchanged. A side benefit is that there's no supply chain: GitHub Pages builds it with `node scripts/build.mjs` and no `npm install`. Migrating to Astro later stays possible because the content files keep the same shape.

## Design

### Colour

Catppuccin Mocha, the darkest flavor, deepened toward black during transits.

- Log ground: Mocha base `#1e1e2e`; deepens through mantle `#181825` and crust `#11111b` to `#000` as a cover arrives.
- Text `#cdd6f4`, labels subtext0 `#a6adc8`, hairlines surface0 `#313244`, crop-mark ticks overlay0 `#6c7086`.
- Git refs (hashes, branch names) in crema brown `#d4a77a`. Cursor, links and focus in mauve `#cba6f7`.
- One colour per branch: main = text, IBM = blue `#89b4fa`, Accenture = mauve `#cba6f7`, art school = peach `#fab387`, Twitch = red `#f38ba8`, mods = teal `#94e2d5`.
- Every pair checked against WCAG 2.2 at build time and listed in the colophon. Inside a cover, the project's own palette takes over; the HUD stays legible on top of it.

### Type

- Atkinson Hyperlegible Next for text, Atkinson Hyperlegible Mono for HUD, labels and code (Braille Institute, made for low vision; part of the accessibility story).
- Fraunces italic for the single accent word in titles. Final choice.
- Self-hosted, subset to the characters used, `font-display: swap`.
- Labels: small mono, uppercase via CSS, wide tracking, always at passing contrast.

### Texture

- **Starfield:** the old dot grid, now stars on a canvas in 3 depth layers that drift at different speeds with scroll. It fades behind the reading column so text never sits on noise. During transits the layers move faster, never streak-warping.
- **Film grain:** a small pre-rendered noise tile laid over the whole screen at about 4 to 6% strength, shifted a few times per second like film. It also dithers the dark gradients so the fade to black doesn't band. It is static under reduced motion, and lighter on phones. The tile is generated once at load, never with a live animated filter.

### The cockpit (fixed HUD)

- **tmux status bar**, pinned at the bottom, square cells. Left: session `luca`, then the page tabs. Right: mode indicator, `HEAD~n · branch`, Rome clock, `:help` and contact. On phones it keeps the tabs and the mode toggle.
- **Git graph** in the left gutter: main is the reading column's left rail. One focused branch is drawn in colour, at most one ghost lane; branches draw in on fork and slide aside on change (as in the prototype). On phones only the focused branch shows.
- **Neovide cursor** sits on the current commit's node. It smears between nodes, leading edge fast, trailing edge slow.

### Home: the flight

The home page alternates **log segments** (commits as in the prototype: rails, crop marks, spec cells, hashes, daggers for NDA notes) and **project segments**.

Each project segment is a tall sticky section (default 300vh, adjustable per project) in four phases, driven by its scroll progress `p` from 0 to 1:

1. **Approach** (`p` 0 to 0.2): the log above drifts up and back, translating up, moving away in depth and fading. The ground darkens toward black. The cover appears small and far, centred, and grows toward the viewer under CSS perspective.
2. **Arrival** (0.2 to 0.3): the cover reaches full screen and the camera "settles", with a slight ease and no bounce.
3. **Dwell** (0.3 to 0.8): the cover is pinned full-screen; scrolling now plays the project's own sequence (layer parallax, title reveal, palette shift, a looping video if supplied). A "land" control opens the project page.
4. **Departure** (0.8 to 1): the cover keeps moving toward and past the viewer, scaling up and fading. The next log segment floats in from below and back, and the ground lifts from black to Mocha.

Rules:

- Native scroll only. Sections use `position: sticky`; one `requestAnimationFrame` loop reads scroll position and writes only `transform` and `opacity`. No wheel or touch handlers that change scroll.
- Reduced motion: no depth moves or drifting stars. Covers still fill the screen, phases become short crossfades, and grain is static.
- Keyboard: `Esc` toggles normal mode (as in the prototype). `j`/`k` go to the next or previous commit, `J`/`K` to the next or previous project, `Enter` on a cover lands on it, `gg`/`G`, `:colo` removed (single theme), `:q` keeps its joke, `:help` opens the colophon.
- The git graph treats each project as a featured commit on its branch, so the graph stays the page's index.

### Project pages

- One Markdown file per project in `content/projects/`. Frontmatter: `title`, `accent` (the Fraunces word), `slug`, `hash`, `branch`, `year`, `tags`, `nda`, `palette` (`bg`, `fg`, `accent`), `cover` (image or video, plus optional layer list for parallax), `segmentHeight`, `order`.
- Optional per-project cover module (`content/covers/<slug>.mjs`, exporting a function that returns HTML) for a fully custom cover; otherwise a default layered cover reads the frontmatter.
- The page shell is the same cockpit (status bar, cursor, graph showing that project's branch). The body is free-form: case study, breakdown, process images, spec cells.
- Landing transition: where the browser supports cross-document view transitions, the cover morphs into the project hero; elsewhere a quick fade.

### Pages (tabs)

Tabs are real pages, not filters. Proposal, to confirm: `1 log` (home flight), `2 work` (all projects as a grid of covers), `3 about` (README, CV highlights, download), `4 :help` (colophon and accessibility receipts). Contact lives in the status bar and footer on every page.

### Accessibility

- Semantic structure: `ol` of commits, `article` per entry, `time` elements. The graph, starfield, grain and cursor are hidden from assistive tech.
- Skip link, visible focus ring, 44px targets in the status bar.
- Letter shortcuts only work in normal mode (WCAG 2.1.4).
- All animations respect `prefers-reduced-motion`. The page never hides content behind a scroll trigger: everything is in the HTML at load.
- Colophon lists every contrast ratio, the fonts, the motion policy, and "no cookies, no tracking".

### Performance budget

- Home JS under 25 KB gzipped (flight engine, graph, cursor, vim keys, starfield).
- Fonts subset, under 120 KB total. Images AVIF/WebP, lazy-loaded; cover videos muted, short, `preload="none"` until near.
- Only `transform` and `opacity` animated; no animated filters or blend modes.

## Calls Claude made (check these)

- **Log data:** all commits live in one file, `content/log.mjs`. Each has hash, year, branch, kind (`big`, `slim`, `merge`, `fork`, `root`, `head`), title, text, spec cells, and an optional project slug. Branches, with their fork and merge commits, are declared in the same file.
- **Graph during a cover:** the graph dims to about 20% while a cover dwells, with the cursor parked on that project's commit. It returns to full strength on departure.
- **Phones:** same four phases with shallower perspective and shorter segments (200vh). The starfield drops to 2 layers and pauses when the tab is hidden.
- **The land control** is a real, focusable link inside each cover ("land on this project"), as well as `Enter` in normal mode.
- **Starting sample projects:** configurator framework (NDA-safe placeholder), agentic texture pipeline (planned), BA art direction, mods and servers. All placeholder art is generative and marked as sample.
- **Checks:** a Playwright script screenshots home and one project page at 390px and 1280px, with motion on and off, and fails on console errors.

## What's left to the builder

- Exact easing curves and phase boundaries per project (defaults above).
- Starfield density and speeds, grain strength (within the stated ranges).
- Placeholder cover art for the sample projects (generative, in each project's palette).
- The GitHub Actions workflow and `public/CNAME`.

## Open items for Luca

- Confirm the tab set (log, work, about, :help).
- Real project content and media, as they come.
- Twitch: "since 2019" on the site vs "5 years" in the LinkedIn/CV doc.
