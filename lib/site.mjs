// The site model: pages loaded from content/, with their blocks, URLs, states and history,
// plus link and media resolution shared by validation and rendering.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from './parse.mjs';
import { inlineText, parseInline } from './inline.mjs';
import { anchors } from './render.mjs';
import { loadManifest, parseEmbed, embedPosterKey, embedSrc, mediaRef } from './media.mjs';
import { fileHistory } from './history.mjs';

const posix = path.posix;

export function pageUrl(p) {
  if (p === 'index.md') return '/';
  if (p === '404.md') return '/404.html';
  return `/${p.replace(/\.md$/, '')}/`;
}

/** Files under dir, content-relative, sorted. Dotfiles (.DS_Store, editor swap files) are not part of the site. */
export function walk(dir, base = '') {
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (d.name.startsWith('.')) continue;
    const rel = base ? `${base}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...walk(path.join(dir, d.name), rel));
    else out.push(rel);
  }
  return out;
}

const pageDir = (page) => posix.dirname(page.path);

/** The manifest key a media line points at (the poster's, for an embed), or null for other URLs. */
export function mediaKey(page, src) {
  const e = parseEmbed(src);
  if (e) return embedPosterKey(pageDir(page), e);
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return null;
  return posix.normalize(posix.join(pageDir(page), src));
}

export function isSample(page, manifest) {
  return page.blocks.some((b) => (b.type === 'comment' && /^sample/i.test(b.text))
    || (b.type === 'media' && manifest[mediaKey(page, b.src)]?.sample === true));
}

/** Inline text of a block, with the line each piece sits on. */
export function blockTexts(b) {
  switch (b.type) {
    case 'heading': case 'quote': case 'para': case 'punch': return [[b.text, b.line]];
    case 'list': return b.items.map((it) => [it.text, it.line]);
    case 'files': return b.items.flatMap((it) => [[it.title, it.line], [it.note, it.line]]);
    case 'table': return [...b.head.map((c) => [c, b.line]), ...b.rows.flatMap((r, k) => r.map((c) => [c, b.line + 2 + k]))];
    default: return [];
  }
}

/** Every link on a page (inline links and index rows), with its line. */
export function pageLinks(page) {
  const out = [];
  for (const b of page.blocks) {
    for (const [text, line] of blockTexts(b)) for (const n of parseInline(text).nodes) if (n.t === 'link') out.push({ href: n.href, line });
    if (b.type === 'files') for (const it of b.items) if (it.href) out.push({ href: it.href, line: it.line });
  }
  return out;
}

export function loadSite({ contentDir, repoDir }) {
  const contentRel = path.relative(repoDir, contentDir).split(path.sep).join('/');
  const loadProblems = [];
  let manifest = {};
  try { manifest = loadManifest(contentDir); } catch (e) { loadProblems.push({ file: `${contentRel}/media.json`, line: 0, message: e.message }); }
  const pages = walk(contentDir).filter((p) => p.endsWith('.md')).sort((a, b) => (a === 'index.md' ? -1 : b === 'index.md' ? 1 : a.localeCompare(b))).map((p) => {
    const md = fs.readFileSync(path.join(contentDir, p), 'utf8');
    const { blocks, errors } = parse(md);
    const h1 = blocks.find((b) => b.type === 'heading' && b.level === 1);
    const quote = blocks.find((b) => b.type === 'quote');
    const file = `${contentRel}/${p}`;
    const page = {
      path: p, file, url: pageUrl(p), raw: `/${p}`, md, blocks, errors,
      title: h1 ? inlineText(h1.text) : '', description: quote ? inlineText(quote.text) : '',
      anchors: anchors(blocks), history: fileHistory(repoDir, file),
    };
    page.sample = isSample(page, manifest);
    return page;
  });
  return { contentDir, repoDir, contentRel, manifest, loadProblems, pages, byPath: new Map(pages.map((p) => [p.path, p])) };
}

/** @returns {{href: string, external: boolean, page?: object, anchor?: string} | {error: string}} */
export function resolveHref(site, page, href) {
  if (/^https?:/i.test(href)) return { href, external: true };
  if (/^mailto:/i.test(href)) return { href, external: false };
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { error: `link scheme isn't allowed: ${href}` };
  const [p, anchor] = href.split('#');
  if (!p) {
    if (!page.anchors.includes(anchor)) return { error: `#${anchor} isn't a heading on this page` };
    return { href: `#${anchor}`, external: false, page, anchor };
  }
  const target = posix.normalize(posix.join(pageDir(page), p));
  if (target.startsWith('../') || target === '..') return { error: `${href} points outside content/` };
  if (target.endsWith('.md')) {
    const t = site.byPath.get(target);
    if (!t) return { error: `${href}: no such page (${site.contentRel}/${target})` };
    if (anchor && !t.anchors.includes(anchor)) return { error: `${href}: #${anchor} isn't a heading on ${target}` };
    return { href: t.url + (anchor ? `#${anchor}` : ''), external: false, page: t, anchor };
  }
  if (fs.existsSync(path.join(site.contentDir, target))) return { href: `/${target}`, external: false, file: target };
  return { error: `${href}: no such file in ${site.contentRel}/` };
}

/** @returns {{ref: object} | {error: string}} */
export function resolveMedia(site, page, src) {
  const e = parseEmbed(src);
  if (e) {
    const key = mediaKey(page, src);
    const poster = mediaRef(site.manifest, key);
    if (!poster || poster.kind !== 'photo') return { error: `an embed needs its poster ${site.contentRel}/${key}: run node media.mjs --embed ${src} ${pageDir(page)}` };
    return { ref: { kind: 'embed', service: e.service, url: src, iframe: embedSrc(e), poster } };
  }
  if (/^https?:/i.test(src)) return { error: `${src}: embeds must be YouTube or Vimeo links` };
  if (!/\.(jpg|png|mp4)$/i.test(src)) return { error: `${src} is not a supported media type: use a .jpg photo, a .png with transparency, an .mp4 clip, or a YouTube or Vimeo link` };
  const key = mediaKey(page, src);
  const ref = mediaRef(site.manifest, key);
  if (!ref) return { error: `${src} isn't in media.json: run node media.mjs <master> ${key}` };
  return { ref };
}

/** Linked index items whose page exists and isn't sample. */
export function realCases(site) {
  const index = site.byPath.get('index.md');
  if (!index) return 0;
  const targets = new Set();
  for (const b of index.blocks) {
    if (b.type !== 'files') continue;
    for (const it of b.items) {
      if (!it.href) continue;
      const r = resolveHref(site, index, it.href);
      if (r.page && !r.page.sample) targets.add(r.page.path);
    }
  }
  return targets.size;
}
