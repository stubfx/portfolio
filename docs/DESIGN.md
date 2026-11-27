# Design

The visual system. Values here are the source of truth for `site/style.css`.

## 1. Mood

A journal page set in README formatting. Huge, punchy headlines across the screen; large, calm body text; generous space; one soft red line of conviction per page; film grain over everything. Typography carries the page; images and live 3D carry the proof. The look alone is not the differentiator (type minimalism and monospace minimalism are common in 2026): the ideas, the live 3D and the real history are.

## 2. Themes: official Catppuccin

All chrome colours come from the **official Catppuccin palette** (`@catppuccin/palette`, the values in its `css/catppuccin.css`; verified Nov 27, 2026). No hand-tuned variants.

- **Night = Catppuccin Mocha. Default.**
- **Day = Catppuccin Latte.** One switch in the file bar.

| Token | Night: Mocha (default) | Day: Latte | Use |
| --- | --- | --- | --- |
| `--paper` | Base `#1E1E2E` | Base `#EFF1F5` | Background |
| `--ink` | Text `#CDD6F4` | Text `#4C4F69` | Text: me |
| `--grey` | Subtext0 `#A6ADC8` | Subtext1 `#5C5F77` | Machine output, secondary text, captions, code keys, commit hashes |
| `--mk` | Overlay0 `#6C7086` | Overlay0 `#9CA0B0` | Syntax markers only (decorative) |
| `--line` | Surface0 `#313244` | Surface0 `#CCD0DA` | Hairlines, image fallback background |
| `--red` | Maroon `#EBA0AC` | Maroon `#E64553` | The punch line only; link hover |
| `--bar` | Base at 88% opacity | Base at 90% opacity | File bar background |

**Rules**

- Maroon appears only in the punch line (one per page) and on link hover. Never on buttons, borders or decoration.
- Images and the 3D stage keep their own neutral studio grey: they are content, not chrome.
- No other colours in the UI.

## 3. Contrast and accessibility

| Pair | Night (Mocha) | Day (Latte) |
| --- | --- | --- |
| Text on paper | 11.3:1 (AAA) | 7.1:1 (AAA) |
| Secondary on paper | 7.4:1 (AAA) | 5.5:1 (AA) |
| Maroon punch line on paper | 7.9:1 (AAA) | 3.5:1 (AA large) |
| Markers | decorative, hidden from assistive tech | decorative |

Night, the default, is AAA throughout. Latte has no grey that reaches 7:1 below its Text colour, so by day secondary text is AA. The punch line is never smaller than 32 px bold, so it qualifies as large text. **AAA fallback for day** (if it becomes a hard rule): use Text `#4C4F69` for secondary text and Latte Red `#D20F39` (4.8:1) for the punch line.

Other accessibility rules: one H1 per page; real headings, lists, tables and figures; visible focus styles (2 px outline in `--ink`); every image has alt text written as a caption; `prefers-reduced-motion` stops the grain and the 3D auto-turn; nothing requires JavaScript to read.

## 4. Type

| Role | Family | Notes |
| --- | --- | --- |
| Display (H1, H2, punch line) | Archivo Black (OFL) | Weight 400, tracking about -0.045em |
| Text (body, lists, blockquote, table) | DM Sans (OFL), variable | Optical sizing on; bold 700 for `**strong**` |
| Mono (syntax markers, captions, code, file bar, status line) | System mono stack in the prototype; production picks IBM Plex Mono or JetBrains Mono (OFL) | Self-hosted |

All fonts self-hosted as subset woff2 with their OFL files. No Google Fonts or other external requests.

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
- Text keeps its measure; images, the 3D viewer and the index table take the full content width.
- Vertical rhythm comes from the type sizes above; no cards, no boxes, no shadows.

## 6. Visible syntax

The page shows its own Markdown, quietly.

- **Shown** (in `--mk`, mono, `aria-hidden="true"`): `#`, `##`, `###` before headings; `>` before blockquotes; `-` and `1.` before list items; `|` before tables; the code fences with their language; `---`; HTML comments; the full `![alt](file)` line above images; the `==` around the punch line.
- **Hidden:** inline markers (`**`, link brackets and URLs, backticks). At body size they read as noise.
- Block markers **hang** in the left gutter at about `calc(0.11em + 11px)`, right-aligned, so the text edge stays clean.

## 7. Components

**File bar** (sticky top, `--bar` background with a light blur, 1 px `--line` bottom border): breadcrumb path in mono (`lucamolluso.com/work/direction-as-code.md`, last segment in `--ink`, the rest in `--mk`); on the right a **copy .md** button, a **day · night** switch and a **raw** link. Buttons: 1 px `--ink` border, mono 12 px; pressed or hover state inverts (`--ink` background, `--paper` text). Below 720 px the raw link hides.

**Status line** (bottom, mono 12 px, `--mk`): file name in `--ink`, edit count, last edit date, a `history` link in `--ink`.

**Punch line:** a paragraph that is only `==text==`. Display face, Maroon, grey `==` on both sides.

**Index table** (the Work list): header in 11 px mono caps `--mk` over a 1 px `--ink` rule; rows separated by `--line` hairlines. Columns: number (mono, `--mk`), case title (link, large body size), idea (`--grey`, smaller), year (mono, `--mk`, right-aligned). Below 720 px: no header; each row stacks as number, title and year on one line, the idea below.

**Figure:** the `![alt](file)` line in 13 px mono above the image (alt in `--grey`, syntax in `--mk`), then the image at full content width. Portrait images max 440 px wide.

**3D viewer:** 16:9 stage, neutral studio gradient (`#EEF0EE` to `#C3C8C6`) with a soft contact shadow, a small `3D · drag to turn` tag bottom right (mono 11 px, `#555`). Grab cursor while dragging.

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

Only the grain and the 3D viewer move. No page transitions, no scroll effects, no hover animations beyond colour. Both stop with `prefers-reduced-motion` (the 3D model can still be dragged).
