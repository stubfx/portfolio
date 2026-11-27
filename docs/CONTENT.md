# Content

How to write the site. Everything visible on the site is written here, in Markdown, in `content/`.

## 1. Files

| File | Page | Notes |
| --- | --- | --- |
| `content/index.md` | `/` | Also served as `/index.md` and `/llms.txt` |
| `content/now.md` | `/now/` | What I'm doing this month |
| `content/cv.md` | `/cv/` | The master CV from the profile doc |
| `content/work/<case>.md` | `/work/<case>/` | One file per case |
| `content/work/<case>/` | | That case's images, `.glb` models and poster stills |
| `content/portrait.jpg` | | The About portrait |

No front matter. The title is the H1, the description is the first blockquote, dates come from git.

## 2. The Markdown you can use

Anything not on this list fails the build, so content can't drift.

| Write | Gets | Rules |
| --- | --- | --- |
| `# Title` | The page title | Exactly one per page |
| `## Section` | Section heading | |
| `### Sub` | Small heading | Use sparingly |
| `> line` | The intro line under the title | The first one becomes the page description |
| A paragraph | Body text | Short |
| `==One line.==` alone in a paragraph | The punch line, large, in Maroon | **At most one per page.** Not allowed inside a sentence |
| `**bold**` | Bold | For a word, not a sentence |
| `[text](other.md)` | A link | Link to `.md` files with relative paths; the build makes them pretty URLs |
| `` `code` `` | Mono | |
| `- item` / `1. item` | Lists | No "**Label:** text" bullets: they read like a chat answer |
| A table | The index table | Columns: `#`, `Case`, `Idea`, `Year` |
| `![alt](image.jpg)` | A full-width image with its line as caption | Alt text is required and written as a caption |
| `![alt](model.glb)` | A live 3D viewer | Needs `model.jpg` next to it as the poster |
| ```` ```logic ```` | A two-lane diagram | Me lane left of column 28, Machine lane right |
| ```` ```yaml ```` | A direction file or config | |
| ```` ```log ```` | Real git commits | Hashes are verified by the build |
| ```` ``` ```` | Plain mono block | |
| `---` | A break | |
| `<!-- note -->` | A visible grey note | It is part of the file |

## 3. Page formats

**`index.md`** follows the llms.txt structure, so the homepage is also the agent index:

```markdown
# Luca Molluso

> Technical artist. An art director who builds what he directs.

I work in the middle: between the **idea** and the machines that make it real. …

==The outcome is cheap now. The idea isn't.==

![The buoy from "Direction as code". Real-time, in the page. Drag to turn it.](work/direction-as-code/buoy.glb)

## Work

| # | Case | Idea | Year |
|---|---|---|---|
| 01 | [Direction as code](work/direction-as-code.md) | What if the art direction were the input, not the review? | 2026 |

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

![The model, live. Drag to turn it.](case/model.glb)

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

## 4. Assets

- **Images:** JPEG or WebP, up to 2400 px wide, in the case's folder. The build reads their dimensions; portrait-orientation images render narrower.
- **Alt text** is the caption people see and the only thing agents get. Write it like a caption: what it is and why it matters. Empty alt text fails the build.
- **3D:** `.glb`, 4 MB or less, compressed textures. A poster `same-name.jpg` next to it is required. Art-direct it like a render: matte materials, neutral studio light, no grid or gizmos.
- **Portrait:** one, art-directed like the work. No stock photo, no avatar.

## 5. Logic diagrams

Monospace drawings in a ```` ```logic ```` block. Column 28 is the lane line: everything to its left is the Me lane (rendered in ink), everything from column 28 is the Machine lane (rendered grey). Use box-drawing characters (`│ ▼ ▲ ─ ▶ ◀ └ ┘`). Keep lines under 60 characters so they fit a phone.

## 6. Log blocks

They must be real. Commit every direction file, brief and prompt set as it evolves, then copy the commits:

```sh
git log --format='%h  %s' -- content/work/<case>/direction.yaml
```

Format each line as `hash  message  date` (two or more spaces between parts). The build fails if a hash doesn't exist in the repo.

## 7. Voice

- First person. Short, declarative sentences. One idea per line.
- No narration of the process ("first this, then that"). Let the structure carry the sequence.
- No self-congratulation, no adjectives you can't prove, no em dashes.
- Avoid the shapes of a chat answer: no "**Label:** text" bullets, no lists of three for rhythm.
- Name sectors, never clients (NDA).
- No button fixes. Direction over retouch. Not a configurator portfolio.
- Every number, commit and claim is real and defensible live in an interview.

## 8. Facts to use

From the Career project's profile doc (the source of truth): modder since 2015; engineer since 2017 (IBM, now Accenture Song); real-time 3D for global luxury fashion and automotive brands; BA in Art Direction & Visual Communication, AANT Rome, 2022 to 2025, 110/110 cum laude, earned alongside the day job; GenAI trainer for Palestre Digitali (classes of about 50); leads "AI Way of Work" sessions; ten years of transverse flute; Blender, Linux, FOSS. Email info@lucamolluso.com, LinkedIn linkedin.com/in/luca-molluso, Rome, open to remote.

## 9. Case slots

| # | Case | Idea | Status |
| --- | --- | --- | --- |
| 01 | Direction as code | What if the art direction were the input, not the review? | Sample written; needs the real project |
| 02 | Live, in the browser | A luxury object, directed and running in real time | To capture |
| 03 | One frame | An Unreal scene, from moodboard to final light | To capture |
| 04 | Procedural | The intent first, then the graph | To capture |
| 05 | Before the machines | Brand, campaign, type (BA work) | To select |

Launch with three real cases (01, one real-time piece, 05).
