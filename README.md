# lucamolluso.com

> [!WARNING]
> **WIP.** This site is being rebuilt from scratch, in the open. Everything here is a draft: sample content and numbers.

A portfolio where every page is a Markdown file: typeset like a bold journal page for people, read as-is by agents. One source, two readers.

**Status:** every push to `main` builds the site with `node build.mjs` (which validates the content first) and deploys it through `.github/workflows/pages.yml`. Sample content until the real cases land; the WIP banner goes by itself at three real cases. The previous site was removed on Nov 27, 2026 (it is still in git history before that commit).

- **Docs:** [`docs/`](docs/README.md). Start there: spec, design, content and build. It is the build contract.
- **Content:** [`content/`](content/). The Markdown files the site is built from (samples marked in each file).
- **Run it:** `node build.mjs --serve`, then open http://127.0.0.1:8080. Tests: `node --test`.

Zero dependencies: no npm packages, nothing running live. No framework, no bundler, no `npm install`: a single Node script builds the site (see `docs/BUILD.md`, section 1). Media goes through `media.mjs`, run locally with ffmpeg; its outputs are committed.
