# lucamolluso.com

A portfolio where every page is a Markdown file: typeset like a bold journal page for people, read as-is by agents. One source, two readers.

**Status:** rebuilding from scratch. The previous site was removed on Nov 27, 2026 (it is still in git history before that commit).

- **Docs:** [`docs/`](docs/README.md). Start there: spec, design, content and build. It is the build contract.
- **Prototype:** [`prototype/index.html`](prototype/index.html). Open it in a browser. Sample content and numbers.
- **Draft content:** [`content/`](content/). The Markdown files the site will be built from (samples marked in each file).

No framework, no bundler, no `npm install`: a single zero-dependency Node script builds the site (see `docs/BUILD.md`, section 1).
