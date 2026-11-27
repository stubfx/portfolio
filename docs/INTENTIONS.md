# Portfolio intentions

Nov 27, 2026 · v8

The north star for the portfolio site (lucamolluso.com). Every page, feature and style choice has to serve these intentions. If it doesn't, it doesn't ship.

This file changes how the profile is **presented**, not what it says. Facts stay in the Career project's profile doc (the source of truth). The build contract is the rest of `docs/`: [SPEC](SPEC.md), [DESIGN](DESIGN.md), [CONTENT](CONTENT.md), [BUILD](BUILD.md). Where they go into more detail, they win.

## Decision: the figure in the middle

The title stays **Technical Artist, AI and real-time 3D**, as in the source of truth. The site presents it through art direction, backed by nine years of engineering and modding since 2015.

The role is **the figure in the middle**: between the idea and the machines and people that build it. I have the idea, I design the logic that makes it real, and I make it run. In one line: **an art director who can build what he directs.**

**The idea and the logic are the work. The outcome is proof, not the pitch.** Nobody doubts that AI can produce the output. What's scarce is knowing what to ask for, designing the system that gets there, and holding the direction from the first brief to the final call.

**Not a configurator portfolio.** Configurators are client work I can do and have done at scale. They are not who I am. Real-time 3D for global brands appears as capability and numbers, never as the identity or the hero.

## Human in the loop: direction, not cleanup

Non-negotiable. The human in the loop drives the AI from start to end; he doesn't tidy up after it.

Why: "AI isn't perfect" is a shrinking moat. The classic fixes are already buttons. Meshy, for example, ships one-click remeshing with an automatic PBR rebake and a Remove Lighting option (Meshy docs, Nov 2026). Errors shrink with every release. The gap between what the machine makes and what this idea, this brand and this platform need does not.

**Rule: no button fixes.** If a button could have done it, it doesn't go in the portfolio. No "see, I fixed this."

## Who it's for

The three doors from the source of truth, all open:

1. **AI Technical Artist** roles: generative media, fashion tech, studios building AI pipelines.
2. **Technical Artist (real-time 3D)** roles: game studios, automotive, 3D commerce. Warm targets: Bohemia Interactive (Enfusion) and Rockstar (Cfx.re).
3. **Creative Technologist** roles: agencies, brand studios, in-house creative teams.

Plus **agents** reading on someone's behalf: recruiter tools, AI screeners, a lead's own assistant.

## What it must prove

- **I have the idea.** A clear "what if" that a stranger can repeat in one sentence.
- **I design the logic.** How direction flows through agents, tools and people, and where my calls sit.
- **I make it run.** Footage of real-time work I shipped, and years of shipping software behind it.
- **I've done it for real.** Real-time 3D for global luxury fashion and automotive brands, AI adoption and training at Accenture, mods and servers with real players.

## Intentions

1. **Idea first.** Every case opens with one idea, stated large, in as few words as possible.
2. **Logic is the centerpiece.** A text diagram of the system, Me lane and Machine lane, plus one artifact that shows the thinking.
3. **Proof, briefly.** One strong image or loop, one line of real numbers. No fix lists, no inventories.
4. **Direction over retouch.** When output drifts, the direction changes (the brief, the direction file, the pipeline), never the pixels.
5. **Say less.** A good brief makes the machine say less, and so does a good page.
6. **Show it running.** Footage of the work: silent loops and photos in the page, longer videos on YouTube or Vimeo that load only when pressed. A Markdown image line is all it takes; agents and no-JS readers get the caption and a still.
7. **History, not explanation.** Process is proven by the real git history of each file, not described.
8. **Personal, not prompted.** My ideas, my calls and my voice are the signature. Plus what only I have: eleven years of modding, Twitch, the conservatory. And one human texture on every page: my film grain.
9. **AI credits on every project.** One line: tools, machine time versus my time, what the model did and what I decided.
10. **One file, two readers.** Every page is a Markdown file. People read it typeset; agents read the same file. Nothing to keep in sync.
11. **NDA-safe by design.** Name sectors, never clients.
12. **FOSS, fast, honest.** No framework: one zero-dependency Node script builds a static site. Zero dependencies: no npm packages, nothing running live. Self-hosted OFL fonts, no trackers, readable without JavaScript.

## Copy rules

- One idea per line. Short, declarative, confident.
- No narration of the process ("first this, then that", "I read all of it"). Let the structure carry the sequence.
- No self-congratulation and no explaining the obvious. Imply; don't spell out.
- Alt text is written as a caption: it is what agents "see," and it shows on the page as part of the image syntax.
- The voice rules from the source of truth still apply: first person, no em dashes, no adjectives you can't prove.

## Not this

- Not a one-prompt pretty site: no sensational hero, no dreamy minimalism with nothing in it.
- Not a configurator portfolio.
- Not a cleanup reel or a process explainer.
- Not a GitHub README: the format is Markdown, the typesetting is art direction.
- Not relying on the look to stand out. Type minimalism and radical brevity are 2026 trends, and AI site builders already sell black-and-white monospace templates. The ideas, the footage of real work and the real history are what make it mine.
- Not an effects showcase. The grain is the only effect; skies, dithering and scroll animations were tried and dropped.
- Not a blog, and not a landing page selling a product.
- Not an AI-search traffic play. The agent layer signals craft; it isn't a marketing channel.

## Visual direction: the portfolio is a Markdown file

**Markdown for machines, texture for humans.** Prototype: `prototype/index.html` in the repo, v14 (homepage plus the sample case "Direction as code"). The Career project keeps a copy at `claude/portfolio-md-draft.html`.

History: v1 handwritten marks (dropped: I work digitally). v2 dense review layer (dropped: too explanatory). v3 Redline, a red thread drawn on scroll (dropped: the line wasn't my hand). v4 plain Markdown typeset (kept). v5 live 3D, real history, copy as Markdown. Then the previous site's grain, dithered sky and clouds came over: the sky was dropped as too complicated, the grain stayed. Catppuccin became the colour baseline with a day/night switch, and the strong red softened to Maroon. Night as the default was tried and reverted. v12 made the main text pure black. v13 gave night its own warm neutral palette. v14 added the WIP banner. Then the live 3D viewer was dropped: the projects are photos and videos of shipped work, nothing interactive, so the site shows footage.

**Concept.** Every page is a real `.md` file, typeset like a journal page. Everyone who uses AI reads Markdown every day, people and agents alike, so the format is familiar to both. Less is more: no hero, no effects beyond the grain, just text that says something, and photos and loops that prove it. The page is its own source.

**Mood.** Bold, punchy, editorial. A journal page set in README formatting: huge headlines across the screen, large body text, generous space, one red line of conviction per page, film grain over everything. By day it reads like ink on newsprint; by night like a page under a reading lamp. Typography carries the page; photos and loops carry the proof.

**System**

- **Block syntax only.** Grey mono markers for `#`, `##`, `>`, `-`, `1.`, `|`, code fences, `---`, comments, image lines and the `==highlight==`. Inline markers (`**`, link brackets and URLs) are dropped: at body size they read as noise. On wide screens block markers hang in the left margin. Markers are hidden from screen readers.
- **Four ink tiers.** Light grey = syntax. Mid grey = machine output (the Machine lane, captions, code keys, commit hashes). Ink = me. Red = the one highlighted line per page, nowhere else.
- **Day (default): Catppuccin Latte with pure black text.** Paper Latte Base `#EFF1F5`, me in black `#000`, machine in Subtext1 `#5C5F77`, syntax in Overlay0 `#9CA0B0`, the line in Maroon `#E64553`. Latte's own text colour was too soft as the main voice; black reads like print and turns the blue-greys into a clear second voice.
- **Night: warm, almost neutral dark.** Paper `#1C1917`, me `#EBE5E0`, machine `#B4ACA6`, syntax `#726A64`, the line in a soft coral red `#E66F62`. Every neutral carries the same faint orange tint, never enough to read as brown or sepia. Cozy, not a code editor.
- **Grain.** My film grain from the previous site, ported as-is: the human layer, the only effect, in both themes.
- **Type.** Archivo Black for display and DM Sans for text (both OFL), a mono for syntax. Helvetica was dropped: at poster size it is the most default choice there is.
- **Scale.** H1 up to about 185 px, H2 up to about 90 px, the highlighted line up to about 90 px, body text 19 to 30 px with a measure of about 29 em. Fluid, so the same file works on a phone and a wide screen.
- **Images.** Full content width. The `![alt](file)` line sits above each image as its caption.
- **Video.** `![alt](clip.mp4)` is a silent loop that plays while on screen (pausable, still when reduced motion is on); a longer clip gets controls. `![alt](https://youtu.be/…)` shows my poster and loads YouTube or Vimeo only when pressed.
- **Logic as text.** Monospace diagrams in code blocks: the Me lane in ink, the Machine lane in grey.
- **History.** An editor-style status line under each page: file name, number of edits, last edit, link to its history in the repo (stubfx/portfolio). Redirects appear as a `log` block of real commits to the direction file. All built from git at deploy time; the draft's numbers are samples.
- **File bar.** Path, a **copy .md** button (copies the page as Markdown so a reader can paste it into their AI), the day/night switch, and the raw view.
- **WIP banner** above the file bar, automatically, until three real cases are live.

**Homepage = the llms.txt.** H1 name, a one-line summary in a blockquote, then H2 sections; Work and Contact are link lists, so they parse as llms.txt file lists. The same file is served at `/`, `/index.md` and `/llms.txt`. The "How I work" section was cut: the cases show it.

**Case format: Idea · Logic · Proof**

1. **Idea:** one line of context, then the "what if" as the red highlighted line.
2. **Logic:** the two-lane text diagram, plus one artifact that shows the thinking (a direction file, a node graph, a script).
3. **Proof:** a contact sheet or hero image, a loop of the work, one line of real numbers, the commit log of the redirects, credits, then links to index and the next case.

**Risks to watch.** Looking like a default README or an AI-builder template: the typesetting and the footage have to be visibly deliberate. Images too weak to carry the proof. Copy creeping back into explanation. Effects creeping back in. Honesty: every number, commit and output must be real; the prototype's are samples.

**Next steps**

- **Build** from `docs/` on the new machine: `build.mjs` and the renderer first.
- **Capture now, on real work:** the idea in one sentence, the direction artifacts (files, graphs, prompts), the machine output, real times, and commit every direction change.
- **Pick the first real case** to replace the sample, with real loops and one hero image.

## Content

Homepage (`index.md`), then cases in the Idea · Logic · Proof format:

1. **Direction as code** (or the real equivalent): an agentic pipeline driven by a written art direction. (Sample case in the prototype.)
2. **Live, in the browser:** a luxury object I art-direct, running in real time, shown in footage. The point is the direction, not the product UI.
3. **One frame:** an Unreal scene, moodboard to final light.
4. **Procedural:** the intent first, then the graph.
5. **Before the machines:** my two strongest BA projects, pure direction work.

Launch with three real cases. Mods and servers appear as supporting proof (links, player counts). Open question in SPEC.

## Agent layer

- `/` = `/index.md` = `/llms.txt`: the homepage file itself.
- `/llms-full.txt`: every page in one file.
- `/work/<case>.md`: each case page, the same file people read.
- `/cv.md`: the master CV, from the same source as the profile doc.
- JSON-LD `Person` schema in the rendered page head.
- **copy .md** on every page for readers who bring their own AI.

Context: llms.txt reach is still low (Ahrefs, May 2026: 97% of published files got zero requests), but coding agents do fetch it, and Chrome Lighthouse checks for it in its experimental Agentic Browsing audits. Here it costs nothing: the homepage already is one.

## Done means

- A lead can repeat each case's idea in one sentence after ten seconds.
- Every case shows its logic, with my decisions in the Me lane.
- A loop of real work plays on the homepage.
- The page reads as designed, not as a default README or a template, on a phone and on a wide screen, by day and by night.
- No fix on the site is something a button does, and no case reads as a configurator showcase.
- Every number and every commit is real.
- An agent given only `/llms.txt` writes an accurate summary and finds the right contact.
- Nothing on the site I couldn't defend live in an interview.

**Open questions** are kept in one list, in [SPEC.md](SPEC.md) section 6.
