# Content

How to write the site. Everything visible on the site is written here, in Markdown, in `content/`.

## 1. Files

| File | Page | Notes |
| --- | --- | --- |
| `content/index.md` | `/` | Also served as `/index.md` and `/llms.txt` |
| `content/now.md` | `/now/` | What I'm doing this month |
| `content/about.md` | `/about/` | About me, in the homepage's look: the order of the old Readymag About page (portrait and bio, tools, languages, work, contact, Suzanne) |
| `content/cv.md` | `/cv/` | The master CV from the profile doc |
| `content/404.md` | `/404.html` | The not-found page |
| `content/work/<case>.md` | `/work/<case>/` | One file per case |
| `content/work/<case>/` | | That case's photos and loops, with their posters (made by `media.mjs`). Embed posters sit beside the page, in `content/work/` |
| `content/portrait.jpg` | | The About portrait (the one from the Readymag site) |
| `content/suzanne.mp4` | | The About page's closing loop, from the Readymag site's wireframe GIF, on black |
| `content/media.json` | | The media manifest, written by `media.mjs`. Never edit it by hand |

No front matter. The title is the H1, the description is the blockquote right under it, dates come from git.

**File names:** every path segment in `content/` is lowercase letters, digits, dots and dashes (`^[a-z0-9][a-z0-9._-]*$`). Spaces, capitals and accents fail the build.

## 2. The Markdown you can use

Anything not on this list fails the build, so content can't drift. The build reports every problem at once, as `file:line: message`.

### Blocks

| Write | Gets | Rules |
| --- | --- | --- |
| `# Title` | The page title | Exactly one per page, and it is the first block |
| `> line` | The intro line under the title | Required, directly after the H1; it becomes the page description. Later blockquotes are allowed |
| `## Section` | Section heading | |
| `### Sub` | Small heading | Use sparingly. `####` and deeper fail |
| `### YYYY: Title` inside `## Timeline` | A timeline entry | YYYY, YYYY–YYYY or YYYY– (an en dash). Every `###` inside the Timeline must be one; the year sits in its own column |
| A paragraph | Body text | Short. Lines join with a space: no hard line breaks |
| `==One line.==` alone in a paragraph | The punch line, large, in Maroon | **At most one per page.** Not allowed inside a sentence |
| `- item` / `1. item` | Lists | One level, no nesting. `*` and `+` bullets fail. No "**Label:** text" bullets: they read like a chat answer |
| A file list (below) | The index, or a row of cards | Inside `## Timeline`: a row of cards; anywhere else: the index table |
| A table | A table in the index's look | Every row has the header's number of columns |
| `![alt](photo.jpg)` alone on a line | A full-width photo with its line as caption | Alt text required, written as a caption |
| `![alt](image.png)` alone on a line | An image with transparency, kept | Only for masters with transparency (section 4) |
| `![alt](clip.mp4)` alone on a line | A loop or a player (section 4) | Alt text required |
| `![alt](https://youtu.be/ID)` alone on a line | A YouTube or Vimeo video that loads on click | Alt text required; a local poster is required (section 4). Other hosts fail |
| ```` ```logic ```` | A two-lane diagram | Me lane left of column 28, Machine lane right |
| ```` ```yaml ```` | A direction file or config | |
| ```` ```log ```` | Real git commits | Optional. Hashes are verified on pages that aren't sample |
| ```` ``` ```` | Plain mono block | Any other language name fails |
| `---` | A break | |
| `<!-- note -->` | A visible grey note | It is part of the file. May span lines. Any other HTML fails |

Indented code (four spaces or a tab at the start of a block) fails: use a fence.

### Inline

| Write | Gets |
| --- | --- |
| `**bold**` | Bold. For a word, not a sentence |
| `` `code` `` | Mono. Markup inside it stays literal |
| `[text](target)` | A link |
| `\*`, `\_`, `\=`, `\[`, `\]`, `\(`, `\)`, `` \` ``, `\\`, `\<` | The literal character |

`*emphasis*` and `_emphasis_` fail until the italics question is decided ([SPEC](SPEC.md) section 6). Inline HTML fails. `==` inside a sentence fails.

### Links

- Link to other pages by their `.md` file, with relative paths: `[now](now.md)`, `[index](../index.md)`. The build turns them into pretty URLs.
- `#anchor` must exist on the target page. Heading ids come from the heading text (`## Work` is `#work`; repeats get `-2`, `-3`).
- Relative links to other files must name a file that exists in `content/`.
- Allowed schemes: `https:`, `http:`, `mailto:`. Anything else (`javascript:`, `data:`…) fails.

### File lists: the index

A list where every item is a link to a page with a note, optionally ending with the year in brackets:

```markdown
- [Direction as code](work/direction-as-code.md): What if the art direction were the input, not the review? (2026)
- One frame: An Unreal scene, from moodboard to final light. (2026)
```

It renders as the index: the row number comes from the position, then the title, the note as the idea, and the year. At least one item must be a link; otherwise it's an ordinary list. It also parses as an llms.txt file list, so agents get the cases with their ideas.

**Inside `## Timeline`** the same list renders as a **row of cards** that runs edge to edge, wider than the text. A linked card's cover is the linked page's first media (a photo, a clip's poster, an embed's poster); a page with no media gets a card without a cover. Planned items are grey cards with no cover and no link. The year in brackets isn't shown on cards.

## 3. Honest by construction: planned and sample

- **Planned:** an index item without a link (`- Title: note (YYYY)`) is a case that isn't written yet. It renders in grey, as a row that isn't a link, and needs no file.
- **Sample:** a page is sample when it has a comment starting with `sample` (for example `<!-- Sample case. The numbers are placeholders. -->`), or when it uses media made with `--sample`. Its status line says `sample data`, and its `log` hashes aren't checked. Real pages must cite real commits.
- **The WIP banner** shows on every page while fewer than three cases are real (linked from the index and not sample). It goes by itself.

## 4. Media

Photos and clips go through `media.mjs`, on your machine (it needs ffmpeg). Masters (your original exports) stay wherever you keep them: they never enter the repo. The script writes the web files next to the page and records them in `content/media.json`. The build refuses media that skipped it.

```sh
node media.mjs <master> <content path> [--poster <seconds>] [--bg <hex>] [--sample] [--force]
node media.mjs ~/exports/hero.tif work/direction-as-code/hero.jpg
node media.mjs ~/exports/turntable.mov work/direction-as-code/buoy.mp4 --poster 2
node media.mjs --embed https://youtu.be/ID work [--from <still>]   # the folder of the page that embeds it
```

| You write | `media.mjs` makes | On the page |
| --- | --- | --- |
| `hero.jpg` (from any photo master) | `hero.jpg`, the canonical file: 2400 px wide (1200 px for portrait orientation), never upscaled. Plus `hero.800.jpg`, `hero.1600.jpg` and AVIF at every width (`hero.800.avif` … `hero.2400.avif`). Turned upright if the camera says so; no metadata (no GPS) | A `<picture>` with the right size for the screen |
| `clip.mp4` (from any video master) | `clip.mp4` (H.264, plays everywhere), `clip.av1.mp4` (smaller, where supported), poster `clip.jpg` + `clip.avif`; up to 1920 px wide | **Loop** if silent and 30 s or less: plays while on screen, pausable. Otherwise a **player** with controls |
| A YouTube or Vimeo link | `youtube-ID.jpg` or `vimeo-ID.jpg` in the folder of the page that embeds it (`content/work/` for a case): the poster, from the service's thumbnail (fetched once, now) or from `--from` | Your poster with a play mark; YouTube or Vimeo loads only when pressed |
| `cutout.png` (from a master with transparency) | `cutout.png`, the fallback, as wide as fits 600 KB, plus WebP with transparency at every width (`cutout.800.webp` …) | A `<picture>` that shows whatever is under it, in day and night |

A master that hasn't changed is skipped (same file, same `--poster` time, same `--bg`): re-encoding is explicit, with `--force`.

**Transparency is kept.** JPEG can't hold it, so a master with transparency goes in as `.png`. As `.jpg` it is refused, unless `--bg <hex>` asks to flatten it onto that colour on purpose (an image drawn for a black page, which would vanish on the white day paper). An opaque master as `.png` is refused: photos are `.jpg`. Check transparent images in both themes.

**Author.** Every JPEG, PNG and MP4 `media.mjs` writes carries `Luca Molluso` as author (EXIF, PNG text, MP4 tags), in case a file travels without its page. AVIF and WebP don't carry it.

**Budgets** (the build fails above them): a loop file 10 MB (warning above 6 MB), a player file 60 MB, a photo file 600 KB, all media 700 MB. Long videos belong on YouTube or Vimeo.

- **Alt text** is the caption people see and the only thing agents get. Write it like a caption: what it is and why it matters. Empty alt text fails the build.
- **Portrait-orientation** media render narrower (440 px).
- **Portrait:** one, art-directed like the work. No stock photo, no avatar.

## 5. Page formats

**`index.md`** follows the llms.txt structure, so the homepage is also the agent index:

```markdown
# Luca Molluso

> Technical artist. An art director who builds what he directs.

I work in the middle: between the **idea** and the machines that make it real. …

==The outcome is cheap now. The idea isn't.==

![The machine makes outcomes on a beat. I keep one, and it becomes the idea.](outcomes.mp4)

## Timeline

### 2022–2025: AANT, BA in Art Direction.

110/110 cum laude, earned alongside the day job.

- [Frammenti](work/frammenti.md): The true face of Alexander the Great, rebuilt with AI for RAI Cultura.
- Bilbo: An audiobook app for a break from reality.

### 2017: Hired at IBM.

Mods got me in.

## Now

Two lines. [More in now.md](now.md)

## About

![Luca Molluso, Rome.](portrait.jpg)

Short bio. AI is a tool, not a goal. It makes me faster. It doesn't decide what's good.

## Contact

- [info@lucamolluso.com](mailto:info@lucamolluso.com)
- [linkedin.com/in/luca-molluso](https://www.linkedin.com/in/luca-molluso)
- Rome. Open to remote.
```

**`now.md`:** H1 "Now", a blockquote with the updated date, three to five list items, a link back to the index. Update it monthly; git shows when.

**`cv.md`:** the master CV from the Career project's profile doc, in Markdown, same voice.

**Case: Idea · Logic · Proof**

````markdown
# Title of the idea.

> One-line subtitle.

One line of context.

==What if …?==

![Hero image, written as a caption.](case/hero.jpg)

## Logic

```logic
ME                          MACHINE
brief
…
```

One line with a point of view.

```yaml
the direction file, or the key part of it
```

## Proof

![Contact sheet or result, as a caption.](case/sheet.jpg)

![The work, running. A caption.](case/turntable.mp4)

![The full walkthrough, with sound.](https://youtu.be/ID)

**40** kept of 160. **1** direction file. **2** redirects. Machine 46 min, me 5 h.

```log
a3f9c21  redirect: what changed and why          Nov 21
```

## Credits

- Machine: the tools
- Me: the decisions

---

[index](../index.md) · [next: Next case](next.md)
````

The `log` block is optional: past projects have no direction history.

**Academy pages** (the AANT work, 2022 to 2025, recovered from the old Readymag site in `~/porcofolio/readymag-archive/`): each page follows its own content (brief, idea, solution, the pieces), not the Idea · Logic · Proof template. Fixed parts: the H1, the intro blockquote, at most one punch line, and the closing line:

```markdown
---

Academy project, AANT, BA in Art Direction. [index](../index.md)
```

A brief set on a real brand says so ("An academy brief: …"), so it never reads as client work. Group work says "we", without naming anyone. Translated from the Italian into the voice below.

## 6. Logic diagrams

Monospace drawings in a ```` ```logic ```` block. Column 28 is the lane line: everything to its left is the Me lane (rendered in ink), everything from column 28 is the Machine lane (rendered grey). Use box-drawing characters (`│ ▼ ▲ ─ ▶ ◀ └ ┘`). Keep lines under 60 characters so they fit a phone.

## 7. Log blocks

Optional, and they must be real. Commit every direction file, brief and prompt set as it evolves, then copy the commits:

```sh
gitt log --format='%h  %s  %cd' --date=format:'%b %-d' -- content/work/<case>/direction.yaml
```

Format each line as `hash  message  date` (two or more spaces between parts). On pages that aren't sample, the build fails if a hash doesn't exist in the repo.

## 8. Voice

- First person. Short, declarative sentences. One idea per line.
- No narration of the process ("first this, then that"). Let the structure carry the sequence.
- No self-congratulation, no adjectives you can't prove, no em dashes.
- Avoid the shapes of a chat answer: no "**Label:** text" bullets, no lists of three for rhythm.
- Name sectors, never clients (NDA).
- No button fixes. Direction over retouch. Not a configurator portfolio.
- Every number, commit and claim is real and defensible live in an interview.

## 9. Facts to use

From the Career project's profile doc (the source of truth): modder since 2015; engineer since 2017 (IBM, now Accenture Song); real-time 3D for global luxury fashion and automotive brands; BA in Art Direction & Visual Communication, AANT Rome, 2022 to 2025, 110/110 cum laude, earned alongside the day job; GenAI trainer for Palestre Digitali (classes of about 50); leads "AI Way of Work" sessions; ten years of transverse flute; Blender, Linux, FOSS. Email info@lucamolluso.com, LinkedIn linkedin.com/in/luca-molluso, Rome, open to remote.

## 10. Case slots

| # | Case | Idea | Status |
| --- | --- | --- | --- |
| 01 | Direction as code | What if the art direction were the input, not the review? | Sample written; needs the real project |
| 02 | Live, in the browser | A luxury object, directed and running in real time | To capture |
| 03 | One frame | An Unreal scene, from moodboard to final light | To capture |
| 04 | Procedural | The intent first, then the graph | To capture |
| 05 | The academy (2022–2025 in the timeline) | Fifteen projects, one page each | Frammenti, WAYLAY and Bricks of the Future written; the rest one by one |

Three real cases retire the WIP banner: the first three academy pages do it.

## 11. Worlds

A project page can bring its own look ([DESIGN.md](DESIGN.md) section 10). Its files sit in the page's media folder:

| File | What it is |
| --- | --- |
| `content/work/<case>/world.css` | The page's stylesheet. Must set `--paper` to a `#rrggbb` colour (the browser bar takes it). Published inside `@layer world`, below the header |
| `content/work/<case>/fonts/*.woff2` | Its fonts, subset, with their licence beside them (`ofl.txt` or `license.txt`). Preloaded on that page only |
| `content/work/<case>/world.js` | Optional. A small enhancement (under 2 KB gzipped); the page reads fully without it |

The Markdown stays the same grammar. On a world page the HTML gives the stylesheet hooks: the intro (everything before the first `##`) is `<header class="s" data-s="intro">`; each `##` opens `<section class="s" data-s="<heading id>">`; each figure carries its file name, `<figure data-m="countdown">` for `waylay/countdown.jpg`.

The build refuses: `@import`; a `url()` outside the world's folder or to a missing file; any rule for the header (`.bar`, `.wip`, its buttons); a world without `--paper`; a font without its licence; a `world.css` or `world.js` without its page, and a `world.js` without its `world.css`.
