// One page: its blocks rendered into site/template.html, with the head, banner, file bar and status line.
import fs from 'node:fs';
import { escapeHtml as esc } from './inline.mjs';
import { renderBlocks } from './render.mjs';
import { timelineMask } from './timeline.mjs';
import { resolveHref, resolveMedia, realCases } from './site.mjs';
import { csp } from './csp.mjs';
import { ORIGIN } from './outputs.mjs';

/** Applies the stored theme before the first paint and marks that JavaScript runs. Its hash is in the CSP. */
export const HEAD_SCRIPT = 'try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"day"}catch(e){document.documentElement.dataset.theme="day"}document.documentElement.classList.add("js")';
export const REPO = 'https://github.com/stubfx/portfolio';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const banner = (sample) => '<div class="wip" role="note"><b>WIP</b> · This site is being rebuilt in the open, '
  + `<a href="${REPO}" target="_blank" rel="noopener">on GitHub</a>.${sample ? ' Sample content and numbers for now.' : ''}</div>`;
const PERSON = {
  '@context': 'https://schema.org', '@type': 'Person', name: 'Luca Molluso', jobTitle: 'Technical Artist', url: `${ORIGIN}/`,
  email: 'mailto:info@lucamolluso.com', sameAs: ['https://www.linkedin.com/in/luca-molluso'],
  address: { '@type': 'PostalAddress', addressLocality: 'Rome', addressCountry: 'IT' },
};

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function refs(site, page) {
  return page.blocks.filter((b) => b.type === 'media').map((b) => resolveMedia(site, page, b.src).ref).filter(Boolean);
}

/** A card's cover: a photo as is, an embed's poster, a clip's poster as a one-width photo. */
function coverRef(ref) {
  if (ref.kind === 'photo') return ref;
  if (ref.kind === 'embed') return ref.poster;
  return {
    kind: 'photo', src: ref.poster.jpg, width: ref.width, height: ref.height, narrow: false,
    modern: [{ type: 'image/avif', set: [{ src: ref.poster.avif, w: ref.width }] }], fallback: [{ src: ref.poster.jpg, w: ref.width }],
  };
}

const hasRow = (page) => { const mask = timelineMask(page.blocks); return page.blocks.some((b, k) => mask[k] && b.type === 'files'); };

function ogImage(site, page) {
  const first = refs(site, page)[0];
  if (!first) return '/og.jpg';
  return first.kind === 'photo' ? first.src : first.kind === 'embed' ? first.poster.src : first.poster.jpg;
}

function status(page) {
  const name = page.path.split('/').pop();
  const { edits, last } = page.history;
  const parts = [`<span><b>${esc(name)}</b></span>`];
  if (edits) {
    parts.push(`<span>${edits} edit${edits === 1 ? '' : 's'}</span>`, `<span>last edit ${formatDate(last)}</span>`,
      `<span><a href="${REPO}/commits/main/${esc(page.file)}" target="_blank" rel="noopener">history</a></span>`);
  } else parts.push('<span>not committed yet</span>');
  if (page.sample) parts.push('<span>sample data</span>');
  return parts.join('');
}

function breadcrumb(page) {
  const segs = page.path.split('/');
  return `<a href="/">lucamolluso.com</a>/${segs.slice(0, -1).map((s) => `${esc(s)}/`).join('')}<b>${esc(segs.at(-1))}</b>`;
}

/** @param {{dev?: boolean, template?: string}} opts template defaults to site/template.html */
export function renderPage(page, site, { dev = false, template = fs.readFileSync('site/template.html', 'utf8') } = {}) {
  const ctx = {
    link: (href) => { const r = resolveHref(site, page, href); return r.error ? { href, external: false } : r; },
    media: (b) => resolveMedia(site, page, b.src).ref ?? null,
    card: (href) => {
      const r = resolveHref(site, page, href);
      const first = r.page ? refs(site, r.page)[0] : null;
      return { href: r.error ? href : r.href, file: (r.page?.path ?? href).split('/').pop(), cover: first ? coverRef(first) : null };
    },
  };
  const home = page.path === 'index.md';
  const title = home ? page.title : `${page.title.replace(/\.$/, '')} · Luca Molluso`;
  const url = `${ORIGIN}${page.url}`;
  const head = [
    `<meta http-equiv="Content-Security-Policy" content="${csp([HEAD_SCRIPT])}">`,
    `<script>${HEAD_SCRIPT}</script>`,
    `<meta name="description" content="${esc(page.description)}">`,
    '<meta name="author" content="Luca Molluso">',
    `<link rel="canonical" href="${esc(url)}">`,
    `<link rel="alternate" type="text/markdown" href="${esc(page.raw)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:image" content="${esc(ORIGIN + ogImage(site, page))}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="theme-color" content="#eff1f5">',
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="preload" href="/assets/fonts/archivo-black.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="/assets/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>',
  ];
  if (home) head.push(`<script type="application/ld+json">${JSON.stringify(PERSON).replace(/</g, '\\u003c')}</script>`);
  const scripts = ['<script type="module" src="/assets/main.js"></script>'];
  if (refs(site, page).some((r) => r.kind !== 'photo')) scripts.push('<script type="module" src="/assets/media.js"></script>');
  if (hasRow(page)) scripts.push('<script type="module" src="/assets/rows.js"></script>');
  if (dev) scripts.push('<script type="module" src="/__reload.js"></script>');
  const fill = {
    title: esc(title), head: head.join('\n'), banner: realCases(site) < 3 ? banner(site.pages.some((p) => p.sample)) : '', path: breadcrumb(page),
    raw: esc(page.raw), main: renderBlocks(page.blocks, ctx), status: status(page), scripts: scripts.join('\n'),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in fill ? fill[k] : m));
}
