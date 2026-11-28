# Academy pages and the homepage timeline

Approved direction from Luca on 2026-11-28. Builds on the foundation (`2026-11-27-foundation-design.md`) and the docs in `docs/`, which stay the contract; this design says what changes.

## Intent

The old Readymag site (https://readymag.website/u2223839342/5522918/, "Luca | Art Director Jr") held Luca's academy work, and only that: AANT, BA in Art Direction, 2022 to 2025. It is recovered into `~/porcofolio/readymag-archive/`, outside the repo. Building the new portfolio from it means:

1. Every academy project becomes **its own page**, translated into English and written in the site's voice.
2. The **career timeline** from the previous site returns to the homepage, typeset in the white Markdown style.
3. Inside the timeline's academy entry, the projects show as a **Netflix-style row of covers** that runs edge to edge, wider than the timeline column.
4. Published files carry **Luca's name as author** in their metadata, so a file that gets passed around still says whose it is. This is a courtesy tag, not a formal rights statement.

**Why:** the site has one sample case and no real work yet. The academy work is real, finished and visual. Putting it on the site, inside a timeline, turns the homepage from a placeholder into a portfolio, and three real cases retire the WIP banner.

## Goals

- All 15 academy projects reachable from the homepage: written pages as linked cards, unwritten ones as grey cards.
- The first three pages written in full: **Frammenti** (RAI, aired), **WAYLAY** (Black Mirror) and **Bricks of the Future** (LEGO × OpenAI). The other twelve follow one by one, each as its own small change.
- The timeline reads as plain Markdown in `index.md`. Agents get the same words through `/index.md` and `/llms.txt`.
- Every published photo and video carries `Luca Molluso` as author. Every page has `<meta name="author" content="Luca Molluso">`.

## Non-goals

- No dates on individual academy projects (Luca: "there's no reason to give a date to each project"). They sit inside the 2022–2025 entry.
- No CV or About page from the Readymag "about me" page; that's later work.
- No image sequences (the Readymag "shots" widgets that scrub on mouse move). Stills of the same work are used instead.
- No Figma embed. The Bilbo prototype is a plain link, because only YouTube and Vimeo embed, by design.
- No file renaming with Luca's name. Metadata only.

## Anti-goals

- Academy briefs passed off as client work. Netflix, LEGO, OpenAI, Yahoo and Philadelphia were briefs set by the academy. Each of those pages says so in one line. Frammenti is the exception: it was made with RAI Cultura and aired on RaiPlay.
- Group work written as solo work. Where the Italian says "abbiamo" (we), the English says "we". Teammates aren't named.
- A carousel that needs JavaScript to be usable, or that pulls the page over its budgets (HTML+CSS 40 KB, JS 3 KB gzipped).

## Constraints

- Zero dependencies: Node built-ins, local ffmpeg; nothing from npm, nothing running live.
- Every HTTP request on this machine goes through `carlo` (the machine's CLAUDE.md). The archive was fetched that way. Embed posters come from the downloaded Vimeo thumbnails via `media.mjs --embed … --from`, so `media.mjs` makes no request.
- The Markdown grammar stays closed (CONTENT.md section 2). The timeline and the carousel reuse existing syntax: headings, paragraphs and file lists. No new markup for Luca to learn.
- File names: lowercase, digits, dots and dashes.
- Budgets as in CONTENT.md section 4.

## Approaches considered

**Pages.** Own page per project (picked by Luca) against one BA page with a section per project. Own pages give each project room and a URL of its own. Writing them in stages keeps the first launch small.

**Timeline syntax.**
1. *A `## Timeline` section whose `### YEAR: Title` headings are the entries* (chosen). Plain Markdown, reads well raw and to agents, and a file list can sit inside an entry.
2. A table. Too cramped for a paragraph and no place for a row of cards.
3. A `log` block, like the old site's career log. Its made-up hashes break the rule that `log` hashes are real commits.

**Carousel.**
1. *A horizontal row with CSS scroll snapping, plus a small script for the arrow buttons* (chosen). It scrolls by swipe, trackpad, keyboard and shift-wheel with no JavaScript. The script only adds the arrows.
2. A JavaScript slider that moves a track with transforms. Unusable without JavaScript and heavier.
3. A static grid. Not what Luca asked for.

## The design

### The timeline (index.md)

`## Work` is replaced by `## Timeline`. Each entry is a `###` heading `YEAR: Title`, where YEAR is `YYYY`, `YYYY–YYYY` or `YYYY–` (an en dash), followed by a paragraph or two. Newest first. Inside the Timeline section only, a file list renders as a row of cards, not as the index table.

The proposed text, from the previous site's career log (its facts, not its sample copy) and the facts in CONTENT.md section 9:

```markdown
## Timeline

### 2026: Beyond the brief.

Accenture Song. GenAI trainer for classes of about 50. Weekly "AI Way of Work" sessions. I founded the gaming and streaming corner.

- [Direction as code](work/direction-as-code.md): What if the art direction were the input, not the review?
- Live, in the browser: A luxury object, directed and running in real time.
- One frame: An Unreal scene, from moodboard to final light.
- Procedural: The intent first, then the graph.

### 2022–2025: AANT, BA in Art Direction.

110/110 cum laude, earned alongside the day job. Days at work, nights at school.

- [Frammenti](work/frammenti.md): The true face of Alexander the Great, rebuilt with AI for RAI Cultura.
- [WAYLAY](work/waylay.md): A live Black Mirror episode you can die in.
- [Bricks of the Future](work/bricks-of-the-future.md): LEGO and OpenAI build a museum where ideas become bricks.
- Bilbo: An audiobook app for a break from reality.
- Interstellar credits: What if Kubrick had shot Interstellar in 1968?
- Philadelphia: From invisible to indispensable, on street-food menus.
- Yahoo, all you can eat: A brand everyone uses and nobody sees.
- Sguardi: A magazine about Rome's smallest gestures.
- Pieux Établissements: An identity for five churches and thirteen palaces in Rome.
- Vessel: Twenty One Pilots' obsession, through repetition.
- TAPE: Run the loop, break the loop.
- Roma Game Jam: The identity of a game jam.
- 3D: Renders and loops.
- AI gallery: One look, held across a whole project.
- Photoshop: Before and after.

### 2021: Accenture.

From IBM to Accenture. Same lane, new colour. Real-time 3D for global luxury fashion and automotive brands.

### 2019–2024: Going live.

Five years streaming on Twitch, including Minecraft games my chat played live.

### 2017–2021: Two Android apps.

Native apps for a major Italian transport company, from first commit to production.

### 2017: Hired at IBM.

Mods got me in. No joke.

### 2015: First Arma 3 mod.

High school, side projects, pocket money. It compiled.
```

The "Now", "About" and "Contact" sections stay as they are. The "Before the machines" slot in CONTENT.md section 10 becomes the academy entry.

**Rendering.** Each entry is a two-column grid inside the main column on desktop: the year on the left in its own column (JetBrains Mono, marker grey, wide enough for `2017–2021`, about 10ch), and title and text on the right. The hanging column is too narrow for a span of years, so the `###` marker keeps hanging there as everywhere, and the year doesn't. On phones the year sits above the title. Heading ids come from the full heading text, as today (`#2017-hired-at-ibm`).

### The row of cards (Netflix style)

A file list inside `## Timeline` renders as:

```
2022–25  AANT, BA in Art Direction.
         110/110 cum laude, earned alongside the day job.
◀ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──── ▶
  │   cover    │ │   cover    │ │   cover    │ │  (grey)    │ │
  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────
  frammenti.md   waylay.md      bricks-of…md   Bilbo
  Frammenti      WAYLAY         Bricks of…     An audiobook app…
```

- **Bleed.** The row spans the full viewport width, wider than the text column. Its first card lines up with the text column's left edge, and the row runs off the right edge of the screen. Scrolling lets cards pass under the left edge too (`scroll-padding` keeps the snap aligned with the text).
- **Cards.** A linked card shows the linked page's first media as its cover (a photo, or a loop's poster; the cover is never a playing video), cropped to 4:3. Under it come the page's file name in mono marker grey (the "this is a Markdown file" signature), the title, and the note in grey. Width: about 22 rem on desktop, 72 vw on phones, so the next card always peeks in.
- **Planned cards** (an item without a link) are grey text cards with the same size, title and note, with no cover and no link. That keeps them honest by construction, as the index table's grey rows are today.
- **Covers** use the same `<picture>` markup as media (AVIF first, then JPEG, `srcset`), at `loading="lazy"`, with width and height set so nothing shifts.
- **Interaction.** Native horizontal scrolling with `scroll-snap-type: x mandatory`. With JavaScript, two arrow buttons (`◀` `▶`, mono, in the ink outline style of the bar buttons) scroll by one screen of cards, smoothly unless the visitor prefers reduced motion. An arrow is disabled at its end. Arrows show on hover-capable screens only; on touch screens you swipe. Cards are links, so Tab moves through them and scrolls each into view.
- **Hover.** The cover lifts slightly (`scale(1.03)`, 150 ms) and the title takes the link hover colour. Nothing moves with reduced motion.
- **Without JavaScript.** The row still scrolls; there are just no arrows (same `html:not(.js)` pattern as the bar).
- **Agents and the raw view** see the plain file list.

### Academy pages

One file per project in `content/work/<slug>.md`, with media in `content/work/<slug>/`. Slugs: `frammenti`, `waylay`, `bricks-of-the-future`, `bilbo`, `interstellar-credits`, `philadelphia`, `yahoo-all-you-can-eat`, `sguardi`, `pieux-etablissements`, `vessel`, `tape`, `roma-game-jam`, `3d`, `ai-gallery`, `photoshop`.

Each page has its own life. Its shape follows its content (brief, idea, solution, the pieces), not the professional Idea · Logic · Proof template. Every page keeps the fixed parts: the H1, the intro blockquote, at most one punch line, and a closing line:

```markdown
---

Academy project, AANT, BA in Art Direction. [index](../index.md)
```

The academy-brief line goes in the intro or context for brand briefs, for example "An academy brief: launch the seventh season of Black Mirror." Frammenti instead says it was made with RAI Cultura, and links the RaiPlay broadcast.

**Translation.** From the Italian (and some English) in `readymag-archive/pages/*.md`, into the voice in CONTENT.md section 8: first person (or "we" for group work), short declarative lines, no em dashes, no adjectives that can't be proved. The numbers kept are the ones the original states (for example Philadelphia's survey percentages, labelled as the project's research).

**Media.** From `readymag-archive/images/` and `videos/`, through `media.mjs`, choosing the images that carry each page rather than all of them. Silent clips of 30 s or less become loops. Clips with sound become players, unless the sound is incidental, in which case the audio is dropped and the clip becomes a loop. Vimeo films stay Vimeo embeds, with posters made from the downloaded thumbnails (`--embed <url> work/<slug> --from <thumbnail>`). Animated GIFs go in as `.mp4` loops.

**Not published as real until written.** A page goes into the repo only when it's written. Until then, its card stays grey.

### Author metadata

- `media.mjs` still strips every master's metadata (no GPS, no camera data), then writes the author:
  - **JPEG:** an EXIF segment with `Artist: Luca Molluso` and `Copyright: © Luca Molluso, lucamolluso.com`, written by `media.mjs` itself (a few bytes of TIFF structure, no tool needed).
  - **MP4:** ffmpeg `-metadata artist=… -metadata copyright=…`.
  - **AVIF:** the same, if ffmpeg's AVIF muxer can write it. If it can't, AVIF stays bare and the JPEG and MP4 carry the name. Builder's call, tested either way.
- Every existing media file (hero, sheet, portrait, buoy, outcomes) is re-encoded with `--force` so they carry it too. Their masters are in Claude's scratch folder today, matched by checksum to `media.json`. They move to `~/porcofolio/masters/` first, so a cleared scratch folder can't lose them.
- `site/template.html` gets `<meta name="author" content="Luca Molluso">`.
- **Transparency.** PNG masters with transparency are flattened onto a background, not onto black: `#eff1f5` (the paper) by default, or `--bg <hex>`, since many Readymag images were designed on black.

### Docs to update

- **CONTENT.md:** the Timeline (section 5, `index.md` format, and section 2, file lists: inside the Timeline they render as a row of cards), academy pages (a new subsection: closing line, brief line, "we"), author metadata and `--bg` (section 4), and case slots (section 10: the academy entry replaces "Before the machines").
- **DESIGN.md:** the Timeline layout and the card row.
- **BUILD.md:** `media.mjs` writes author metadata; the readymag archive lives outside the repo.

## What's left to the builder

- The exact card proportions, type sizes and spacing, within DESIGN.md's tokens, checked at 360, 390, 1440 and 1920 px wide in day and night.
- How the renderer knows it's inside the Timeline section (tracking the current `##` while rendering is the obvious way).
- Which images and clips each page uses, and the order of cards after the first three (the order above is a proposal by strength).
- The arrow script's size: it must fit inside the 3 KB gzipped JavaScript budget with everything else.
- Tests: the grammar (YEAR parsing, malformed years reported as `file:line`), the card markup (linked, planned, the cover from the linked page's first media, a page with no media gets a text card), metadata present in the encoded outputs, budgets on the real build, and browser checks (row bleed, no horizontal page scroll, arrows, focus outlines, no layout shift, no request to another site).

## Calls made by Claude (for Luca to check)

1. Every file list inside the Timeline becomes a card row, including the 2026 entry with the professional cases, so the timeline is consistent. Only the academy row was asked for.
2. The timeline text above, condensed from the old career log (dropping its "This site" and the planned "agentic texture pipeline" entries).
3. The order of the academy cards, and the first three pages.
4. The closing line and the academy-brief line on each page.
5. Transparent PNGs are flattened onto the paper colour by default.
6. The cover is the linked page's first media. There's no separate cover syntax.
