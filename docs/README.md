# Docs

The build contract for lucamolluso.com. Read in this order:

0. **[INTENTIONS.md](INTENTIONS.md)**: the north star. Who it's for, what it must prove, the visual direction and every choice so far, in plain words.
1. **[SPEC.md](SPEC.md)**: what we are building and why. Principles, decisions, scope, open questions, launch checklist.
2. **[DESIGN.md](DESIGN.md)**: the visual system. Themes (day by default: Catppuccin Latte with pure black text; night: warm neutral dark), type, layout, visible syntax, components, grain, motion, accessibility.
3. **[CONTENT.md](CONTENT.md)**: how to write the site. The Markdown you can use, planned and sample states, media (`media.mjs`), page formats, the case format, voice.
4. **[BUILD.md](BUILD.md)**: how it is built. No framework, repo layout, renderer, outputs, git history, agent layer, theme switch, media on the page, grain, budgets, tests, deploy, the CSP.

**Reference:** `prototype/index.html` (open it in a browser, no server needed) implements the design and the renderer with sample content. Where the prototype and these docs differ, the docs win.

**Versions:** docs v2, Nov 27, 2026 (v2: no 3D viewer; photos, loops and click-to-load embeds; the full Markdown grammar; zero dependencies defined). They replace the single-file SPEC v1 to v5; the history of those decisions is in git.
