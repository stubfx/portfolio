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
6. **Make it run.** Real-time 3D lives inside the page, as a Markdown image that points at a `.glb`.
7. **Show history, don't explain it.** Process is proven with the real git history of each file.
8. **Honest by construction.** Every number, commit and claim is real and defensible live in an interview.
9. **Not a configurator portfolio.** Client real-time 3D appears as capability, never as identity.
10. **Accessible and private.** Body text WCAG AAA, no trackers, no third-party requests, readable without JavaScript.

## 4. Decisions

| Area | Decision | Why |
| --- | --- | --- |
| Format | Every page is a Markdown file; the HTML is generated from it | The AI-era idea made literal: agents and people read the same words |
| Syntax | Block-level Markdown markers stay visible in the margin; inline markers are hidden | The page shows its own source without cluttering the reading |
| Stack | **No framework, no bundler, no `npm install`**: one zero-dependency Node script | A small fixed Markdown subset needs a few hundred lines of our own code, not hundreds of dependencies. See [BUILD.md](BUILD.md) section 1 |
| Colour | **Day (default): official Catppuccin Latte with pure black text. Night: a warm, almost neutral dark with a faint orange tint** | Catppuccin was the previous site's baseline. Latte's own text colour is too soft as the main voice; black makes the page read like print. Mocha's blue-violet felt like a code editor; night should feel like a page under a reading lamp |
| Accent | One red, for the one punch line per page: Catppuccin Maroon by day, a soft coral red by night | Conviction without shouting |
| Type | Archivo Black (display), DM Sans (text), a mono for syntax; all OFL, self-hosted | Punchy, editorial, open source |
| Texture | The previous site's film grain, ported as-is | Luca's touch, for humans only |
| 3D | `![alt](model.glb)` becomes a live viewer; a still with alt text for agents and no-JS | Real proof of technical art, inside plain Markdown |
| History | Status line and `log` blocks built from git, hashes verified at build | Process proven, not described |
| Agents | Homepage is a valid llms.txt; every page also served as raw `.md`; copy .md button | Agent-readable by construction |

**Tried and dropped** (in prototypes, so nobody rebuilds them): handwritten red marks, a dense review layer with kill walls and issue tables, a red "thread" drawn on scroll, a dithered sky with stars or clouds, a custom vermilion red, white paper, Latte's soft text colour, Mocha as the night theme, night as the default. Each was defensible alone; together they buried the idea.

## 5. Scope for launch

- `index.md` (homepage = llms.txt), `now.md`, `cv.md`, a 404 page.
- **Three real cases** in the Idea · Logic · Proof format: one agentic pipeline, one real-time 3D piece, one pure art direction piece. More cases later.
- Day and night themes, grain, live 3D on the homepage and in cases, history line on every page.
- Agent files: `/llms.txt`, `/llms-full.txt`, raw `.md` for every page, sitemap, robots.
- Deploy to GitHub Pages at lucamolluso.com.

**Out of scope:** blog, CMS, analytics, comments, contact form, newsletter, translations, search, an MCP server (possible v2).

## 6. Open questions

1. **Production fonts:** keep Archivo Black and DM Sans? Which FOSS mono (IBM Plex Mono or JetBrains Mono)?
2. **Rendered/raw:** a raw link (current plan) or a rendered/raw toggle (prototype)?
3. **Italics:** render Markdown `*emphasis*` in Fraunces italic, at most once per page, for the "human" word (for example "Technical *artist*")? Not decided.
4. **First real case:** which pipeline to capture first?
5. **Mods and servers:** a supporting strip, or a case for the studio track?
6. **Twitch dates:** "since 2019" vs "5 years"; align with the profile before launch.
7. **3D stage at night:** keep the bright studio grey, or a dim warm stage by night?
8. **AAA by day:** accept AA for secondary text and the punch line in Latte, or apply the AAA fallback in [DESIGN.md](DESIGN.md) section 3?

## 7. Launch checklist

- [ ] `build.mjs`, `site/`, tests and the Pages workflow, per [BUILD.md](BUILD.md)
- [ ] Fonts subset and self-hosted with their OFL licences; no external requests
- [ ] Grain and its tests ported from commit `5ed1192`
- [ ] three.js vendored at a pinned version with its licence
- [ ] Three real cases: real hero image, real `.glb` plus poster, real numbers, verified commits
- [ ] Real portrait, art-directed like the rest
- [ ] `now.md` confirmed and dated; `cv.md` written from the profile
- [ ] Both themes checked for contrast; no-JS check; Lighthouse 95+ on mobile; tested on a phone and a wide screen
- [ ] lucamolluso.com connected in Pages settings, HTTPS enforced
- [ ] WIP banner removed once the three real cases are live
- [ ] Site on LinkedIn Featured and in the CV header; ArtStation mirror and reel for the studio route
