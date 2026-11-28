# Design

The visual system. Values here are the source of truth for `site/style.css`.

## 1. Mood

A journal page set in README formatting. Huge, punchy headlines across the screen; large, calm body text; generous space; one soft red line of conviction per page; film grain over everything. Typography carries the page; photos and loops carry the proof. The look alone is not the differentiator (type minimalism and monospace minimalism are common in 2026): the ideas, the footage of real work and the real history are.

## 2. Themes

Day is built on the **official Catppuccin Latte** values (`@catppuccin/palette`, its `css/catppuccin.css`; verified Nov 27, 2026), with one deliberate exception: the main text is pure black. Night is our own: a **warm, almost neutral dark** with a very faint orange tint.

- **Day = Catppuccin Latte, text pure black `#000`. Default.** Latte's own Text (`#4C4F69`) reads soft and washed out as the main voice; black on Latte paper reads like printer's ink, and the Catppuccin blue-greys around it become a clear second voice (the machine) instead of faded text.
- **Night = warm neutral dark.** Cozy: a page under a reading lamp, not a code editor. Every neutral carries the same faint orange tint (OKLCH hue 60, chroma under 0.015), so it reads as warm charcoal and warm paper-white, never brown or beige. The punch line becomes a soft coral red that sits in the same warm family. One switch in the file bar.

| Token | Day: Latte (default) | Night: warm neutral | Use |
| --- | --- | --- | --- |
| `--paper` | Base `#EFF1F5` | `#1C1917` | Background |
| `--ink` | **Pure black `#000000`** | `#EBE5E0` | Text: me. Headings, body, links, table titles, code, buttons |
| `--grey` | Subtext1 `#5C5F77` | `#B4ACA6` | Machine output, secondary text, captions, code keys, commit hashes |
| `--mk` | Overlay0 `#9CA0B0` | `#726A64` | Syntax markers only (decorative) |
| `--line` | Surface0 `#CCD0DA` | `#312D2A` | Hairlines, image fallback background |
| `--red` | Maroon `#E64553` | Coral red `#E66F62` | The punch line only; link hover |
| `--bar` | Base at 90% opacity | Paper at 88% opacity | File bar background |

Night values were set in OKLCH at hue 60 (tune there, not in hex): paper L 0.215 C 0.006, ink L 0.925 C 0.010, grey L 0.75 C 0.013, markers L 0.53 C 0.013, line L 0.30 C 0.008, punch line L 0.68 C 0.15 at hue 28.

**Rules**

- Black is for the main text in most cases. Not black: machine output and secondary text (`--grey`), syntax markers (`--mk`), the punch line (`--red`).
- The punch line colour (Maroon by day, coral red by night) appears only in the punch line (one per page) and on link hover. Never on buttons, borders or decoration.
- Images and video keep their own colours: they are content, not chrome.
- No other colours in the UI.

## 3. Contrast and accessibility

| Pair | Day (Latte, default) | Night (warm neutral) |
| --- | --- | --- |
| Text on paper | 18.6:1 (AAA), black | 14.0:1 (AAA) |
| Secondary on paper | 5.5:1 (AA) | 7.8:1 (AAA) |
| Punch line on paper | 3.5:1 (AA large) | 5.7:1 (AAA large) |
| Markers | decorative, hidden from assistive tech | decorative |

Main text is AAA in both themes. By day, secondary text is AA (Latte Subtext1) and the punch line is AA large: it is never smaller than 32 px bold, so it qualifies as large text. Night is AAA throughout (the punch line counts as large text). **AAA fallback for day** (if it becomes a hard rule): with black as the main text, Latte Text `#4C4F69` (7.1:1) becomes the secondary grey, and Latte Red `#D20F39` (4.8:1) the punch line. The me/machine contrast survives the swap.

Other accessibility rules: one H1 per page; real headings, lists, tables and figures; visible focus styles (2 px outline in `--ink`); every image has alt text written as a caption; `prefers-reduced-motion` stops the grain and keeps loops on their poster; every loop can be paused (WCAG 2.2.2); nothing requires JavaScript to read.

## 4. Type

| Role | Family | Notes |
| --- | --- | --- |
| Display (H1, H2, punch line) | Archivo Black (OFL) | Weight 400, tracking about -0.045em |
| Text (body, lists, blockquote, table) | DM Sans (OFL), variable | Optical sizing on; bold 700 for `**strong**` |
| Mono (syntax markers, captions, code, file bar, status line) | JetBrains Mono (OFL), weight 400 | Self-hosted. Covers the box-drawing lines and the `▲ ▶ ▼ ◀` triangles of the logic diagrams; IBM Plex Mono lacks the triangles |

All fonts self-hosted as subset woff2 with their OFL files, preloaded, with metric-matched fallback faces so the swap doesn't move the page. No Google Fonts or other external requests.

**Scale** (fluid)

| Element | Size | Line height | Max width |
| --- | --- | --- | --- |
| H1 | `clamp(46px, 11.2vw, 184px)` | 0.9 | none |
| H2 | `clamp(32px, 5.4vw, 88px)` | 0.95; 1.45em space above | none |
| Punch line | `clamp(32px, 5.6vw, 92px)` | 0.98 | 13em |
| Blockquote | `clamp(24px, 2.9vw, 46px)` | 1.12 | 20em |
| Body, list items | `clamp(19px, 2vw, 30px)` | 1.3 | 29em (paragraphs), 31em (list items) |
| Index table: case title | `clamp(20px, 2.3vw, 34px)` | | |
| Index table: idea | `clamp(15px, 1.3vw, 20px)` | 1.35 | |
| Captions, file bar, status line, code | 11 to 16 px mono | | |

## 5. Layout

- Page max width 1560 px, centred. Side padding `clamp(18px, 7vw, 120px)`.
- **Hanging gutter:** 3.6 rem on the left, holding the block syntax markers, on screens wider than 720 px. Below 720 px the gutter is 0 and markers sit inline, smaller.
- Text keeps its measure; photos, video, embeds and the index take the full content width.
- Vertical rhythm comes from the type sizes above; no cards, no boxes, no shadows.

## 6. Visible syntax

The page shows its own Markdown, quietly.

- **Shown** (in `--mk`, mono, `aria-hidden="true"`): `#`, `##`, `###` before headings; `>` before blockquotes; `-` and `1.` before list items; `|` before tables; the code fences with their language; `---`; HTML comments; the full `![alt](file)` line above images; the `==` around the punch line.
- **File lists** (the Work index) show a hanging `-` on each row, as in the source. The column labels and row numbers are typesetting, not syntax.
- **Hidden:** inline markers (`**`, link brackets and URLs, backticks). At body size they read as noise.
- Block markers **hang** in the left gutter at about `calc(0.11em + 11px)`, right-aligned, so the text edge stays clean.

## 7. Components

**WIP banner** (shown automatically while fewer than three cases are real): a full-width strip above the file bar, not sticky, so it scrolls away. `--ink` background, `--paper` text, mono 12 px, `role="note"`. Text: "**WIP** · This site is being rebuilt in the open, on GitHub. Sample content and numbers for now." with "on GitHub" linking to the repo. Inverted ink like a pressed button: no red, no icon.

**File bar** (sticky top, `--bar` background with a light blur, 1 px `--line` bottom border): breadcrumb path in mono (`lucamolluso.com/work/direction-as-code.md`, last segment in `--ink`, the rest in `--mk`); on the right a **copy .md** button, a **day · night** switch and a **rendered · raw** switch. Without JavaScript, copy and the theme switch are hidden and a plain **raw** link to the `.md` replaces the view switch. Buttons: 1 px `--ink` border, mono 12 px; pressed or hover state inverts (`--ink` background, `--paper` text). Below 720 px the view switch hides.

**Status line** (bottom, mono 12 px, `--mk`): file name in `--ink`, edit count, last edit date, a `history` link in `--ink`.

**Punch line:** a paragraph that is only `==text==`. Display face, Maroon, grey `==` on both sides.

**Index** (the Work file list, rendered as a table): column labels `# · case · idea · year` in 11 px mono caps `--mk` over a 1 px `--ink` rule; rows separated by `--line` hairlines; a hanging `-` in `--mk` on each row. Columns: number from the row's position (mono, `--mk`), case title (link, large body size), idea (`--grey`, smaller), year (mono, `--mk`, right-aligned). **Planned** rows (no link yet): title in `--grey`, no underline, not a link. Below 720 px: no header; each row stacks as number, title and year on one line, the idea below.

**Timeline** (`## Timeline` on the homepage): each `### YYYY: Title` entry is a two-column grid inside the text column, the year (mono 13 px, `--mk`) in a 6.5 rem column on the left, title and text on the right, the `###` hanging as everywhere. Newest first. Below 720 px the year sits above the title.

**Row of cards** (a file list inside the Timeline): runs edge to edge across the screen, wider than the text; its first card lines up with the entry's text and the row runs off the right edge. Cards are 22 rem wide (72 vw on phones, so the next one peeks in), with a 4:3 cover cropped to fill, then the page's file name (mono 12 px, `--mk`), the title (body size) and the note (`--grey`). Planned cards: a dashed `--line` frame where the cover would be, title in `--grey`, no link. Native horizontal scroll with snapping; no JavaScript needed. With JavaScript, on screens with a mouse, two 44 px arrow buttons in the bar-button style (ink outline, paper fill, inverted on hover) scroll by most of a screen, and hide at each end. Hover lifts the cover to 103% (150 ms) and turns the title Maroon; nothing moves with reduced motion.

**Table** (any other Markdown table): content, so it reads as text. Header from the table itself in 11 px mono caps `--grey` over a 1 px `--ink` rule; cells in body text, `--ink`, separated by `--line` hairlines; one hanging `|`. Long words and URLs wrap anywhere, in every table, so nothing widens the page.

**Figure:** the `![alt](file)` line in 13 px mono above the media (alt in `--grey`, syntax in `--mk`), then the photo or video at full content width. Portrait-orientation media max 440 px wide.

**Loop** (a silent clip of 30 s or less): no chrome. It plays while at least half of it is on screen and pauses otherwise. It is focusable; click, Enter or Space toggles it. A small tag bottom right (`pause` or `play`, mono 11 px) shows on hover and keyboard focus and stays while paused. With reduced motion, or without JavaScript, it shows its poster with native controls.

**Player** (a clip with sound, or longer than 30 s): native controls, poster, never autoplays.

**Embed** (YouTube or Vimeo): my poster at 16:9, a `▶` in the centre (mono), and a tag bottom right, `YouTube · loads on play` or `Vimeo · loads on play` (mono 11 px). Pressing it swaps in the privacy-enhanced player. Without JavaScript it is a link to the video.

**Code blocks:** fences visible in `--mk`; content in mono, `--ink`.
- `logic`: two-lane diagrams. Characters left of column 28 (the Me lane) in `--ink`, the rest (the Machine lane) in `--grey`.
- `yaml`: keys in `--grey`, values in `--ink`.
- `log`: hash and date in `--grey`, message in `--ink`.

**Links:** underline 0.07em thick, offset 0.14em; hover turns Maroon.

**Horizontal rule:** a grey `---` in mono with generous space above.

**Comments:** `<!-- ... -->` shown as small grey mono text: they are part of the file.

## 8. The human layer: grain

The only effect. Ported unchanged from the previous site (see [BUILD.md](BUILD.md) section 11).

- A 128 px grey noise tile on a fixed layer at 200% of the viewport, above the content, `pointer-events: none`.
- Jumped to a random offset with transforms 8 times a second.
- Night: opacity 0.05, normal blending. Day: opacity 0.07, multiply blending.
- Still with reduced motion, paused when the tab is hidden, hidden when printing.

## 9. Motion

Only the grain and loops move. No page transitions, no scroll effects, no hover animations beyond colour. Both stop with `prefers-reduced-motion` (a loop can still be played by hand).
