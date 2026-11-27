# Spec

What we are building, for whom, and the decisions that shape it. Design, content and build details live in [DESIGN.md](DESIGN.md), [CONTENT.md](CONTENT.md) and [BUILD.md](BUILD.md).

## 1. In one line

A portfolio where every page is a Markdown file: typeset like a bold journal page for people, read as-is by agents.

## 2. Who, for whom, what it says

- **Who:** Luca Molluso, Technical Artist, AI and real-time 3D. Presented as **the figure in the middle**: an art director who can build what he directs.
- **For:** people hiring AI Technical Artists, real-time 3D Technical Artists and Creative Technologists, and the agents that read on their behalf.
- **Message:** the idea and the logic are the work; the outcome is proof. AI is a tool, not a goal. The human drives the machine from the first brief to the final call.

## 3. Principles

1. **Markdown for machines, texture for humans.** The words are a plain `.md` file. On top, for people only: Luca's film grain. Nothing else.
2. **One file, two readers.** People and agents read the same file. Nothing to keep in sync.
3. **Less is more.** No hero animation, no effects beyond the grain. Every addition has to earn its place.
4. **Idea, then logic, then proof.** Every case opens with an idea a stranger can repeat in one sentence.
5. **Direction, not cleanup.** Drift is fixed by changing the direction, never by retouching the output. No "button fixes": nothing a tool does in one click is shown as skill.
6. **Show it running.** The proof is footage of shipped work: silent loops and photos in the page, longer videos on YouTube or Vimeo behind click-to-load. Each is one Markdown image line.
7. **Show history, don't explain it.** Process is proven with the real git history of each file.
8. **Honest by construction.** Every number, commit and claim is real and defensible live in an interview.
9. **Not a configurator portfolio.** Client real-time 3D appears as capability, never as identity.
10. **Accessible and private.** Body text WCAG AAA, no trackers, no request to another site until you press play on a video, readable without JavaScript.
11. **Zero dependencies (a must).** No npm packages, nothing running live. Tools on Luca's own machine (ffmpeg, Python through `uv`) are fine: they prepare files that get committed.

## 4. Decisions

| Area | Decision | Why |
| --- | --- | --- |
| Format | Every page is a Markdown file; the HTML is generated from it | The AI-era idea made literal: agents and people read the same words |
| Syntax | Block-level Markdown markers stay visible in the margin; inline markers are hidden | The page shows its own source without cluttering the reading |
| Stack | **No framework, no bundler, no `npm install`**: one zero-dependency Node script (local tools only prepare media and fonts) | A small fixed Markdown subset needs a few hundred lines of our own code, not hundreds of dependencies. See [BUILD.md](BUILD.md) section 1 |
| Colour | **Day (default): official Catppuccin Latte with pure black text. Night: a warm, almost neutral dark with a faint orange tint** | Catppuccin was the previous site's baseline. Latte's own text colour is too soft as the main voice; black makes the page read like print. Mocha's blue-violet felt like a code editor; night should feel like a page under a reading lamp |
| Accent | One red, for the one punch line per page: Catppuccin Maroon by day, a soft coral red by night | Conviction without shouting |
| Type | Archivo Black (display), DM Sans (text), JetBrains Mono (syntax); all OFL, self-hosted | Punchy, editorial, open source. JetBrains Mono has every glyph the logic diagrams draw with (IBM Plex Mono lacks `▲ ▶ ▼ ◀`) |
| Texture | The previous site's film grain, ported as-is | Luca's touch, for humans only |
| Media | Photos and silent loops live in the repo, encoded by `media.mjs` (ffmpeg, run locally); longer videos come from YouTube or Vimeo, shown as my poster and loaded only on click | The projects are photos and videos of shipped work. Loops are small; streaming services suit long videos; click-to-load keeps the privacy rule |
| History | Status line built from git on every page; `log` blocks optional (past projects have no direction history), hashes verified on real pages | Process proven, not described |
| Agents | Homepage follows the llms.txt structure (Work and Contact are link lists) and is served as `/llms.txt`; every page also served as raw `.md`; copy .md button | Agent-readable by construction |
| Raw view | The prototype's rendered/raw switch; a plain `raw` link without JavaScript | The page showing its own source is the concept |

**Tried and dropped** (in prototypes, so nobody rebuilds them): handwritten red marks, a dense review layer with kill walls and issue tables, a red "thread" drawn on scroll, a dithered sky with stars or clouds, a custom vermilion red, white paper, Latte's soft text colour, Mocha as the night theme, night as the default, the live 3D viewer (a `.glb` image line rendered with three.js). Each was defensible alone; together they buried the idea.

## 5. Scope for launch

- `index.md` (homepage = llms.txt), `now.md`, `cv.md`, a 404 page.
- **Three real cases** in the Idea · Logic · Proof format: one agentic pipeline, one real-time 3D piece, one pure art direction piece. More cases later.
- Day and night themes, grain, loops and photos on the homepage and in cases, YouTube/Vimeo embeds behind click-to-load, history line on every page.
- Agent files: `/llms.txt`, `/llms-full.txt`, raw `.md` for every page, sitemap, robots.
- Deploy to GitHub Pages at lucamolluso.com.

**Out of scope:** blog, CMS, analytics, comments, contact form, newsletter, translations, search, an MCP server (possible v2).

## 6. Open questions

The only list; INTENTIONS links here.

1. **Italics:** render Markdown `*emphasis*` in Fraunces italic, at most once per page, for the "human" word (for example "Technical *artist*")? Until decided, `*emphasis*` fails the build.
2. **First real case:** which pipeline to capture first?
3. **Mods and servers:** a supporting strip, or a case for the studio track?
4. **Twitch dates:** "since 2019" vs "5 years"; align with the profile before launch.
5. **AAA by day:** accept AA for secondary text and the punch line in Latte, or apply the AAA fallback in [DESIGN.md](DESIGN.md) section 3?
6. **MCP server** that agents can query about my work: out of scope for launch, possible v2.

Decided Nov 27, 2026: production fonts (Archivo Black, DM Sans, JetBrains Mono), rendered/raw (the switch), 3D stage at night (no 3D viewer).

## 7. Launch checklist

- [ ] `build.mjs`, `site/`, tests and the Pages workflow, per [BUILD.md](BUILD.md)
- [ ] Fonts subset and self-hosted with their OFL licences; no external requests
- [ ] Grain and its tests ported from commit `5ed1192`
- [ ] Three real cases: real hero image, real loops encoded with `media.mjs`, real numbers, verified commits where there is history
- [ ] Real portrait, art-directed like the rest
- [ ] `now.md` confirmed and dated; `cv.md` written from the profile
- [ ] Both themes checked for contrast; no-JS check; Lighthouse 95+ on mobile; tested on a phone and a wide screen
- [ ] lucamolluso.com connected in Pages settings, HTTPS enforced
- [ ] WIP banner gone (it goes by itself at three real cases)
- [ ] Site on LinkedIn Featured and in the CV header; ArtStation mirror and reel for the studio route
