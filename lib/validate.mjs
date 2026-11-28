// Every problem in the site, with file and line, in one run. Nothing outside docs/CONTENT.md passes.
import { parseInline } from './inline.mjs';
import { NAME_RE, checkManifest } from './media.mjs';
import { commitExists } from './history.mjs';
import { timelineMask, entry } from './timeline.mjs';
import { resolveHref, resolveMedia, walk, blockTexts, pageLinks } from './site.mjs';

const LOG_LINE = /^([0-9a-f]{7,40})\s{2,}(.+?)\s{2,}(\S.*)$/;

function checkPage(site, page, add) {
  for (const e of page.errors) add(e.line, e.message);
  const { blocks } = page;
  const h1s = blocks.filter((b) => b.type === 'heading' && b.level === 1);
  if (!h1s.length) add(1, 'a page needs exactly one H1 (# Title)');
  else {
    for (const extra of h1s.slice(1)) add(extra.line, 'only one H1 per page');
    if (blocks[0] !== h1s[0]) add(blocks[0].line, 'the H1 must be the first block');
    const next = blocks[blocks.indexOf(h1s[0]) + 1];
    if (!next || next.type !== 'quote') add(next ? next.line : h1s[0].line, 'the H1 must be followed by a > blockquote: the page description');
  }
  for (const extra of blocks.filter((b) => b.type === 'punch').slice(1)) add(extra.line, 'only one punch line (==…==) per page');
  const mask = timelineMask(blocks);
  blocks.forEach((b, k) => {
    if (!mask[k] || b.type !== 'heading' || b.level !== 3 || entry(b.text)) return;
    add(b.line, /^\d{4}-\d{4}/.test(b.text) ? 'a timeline year range uses an en dash: 2022–2025'
      : 'a timeline entry is "### YYYY: Title" (or YYYY–YYYY, or YYYY–)');
  });

  for (const { href, line } of pageLinks(page)) { const r = resolveHref(site, page, href); if (r.error) add(line, r.error); }
  for (const b of blocks) {
    for (const [text, line] of blockTexts(b)) for (const m of parseInline(text).errors) add(line, m);
    if (b.type === 'table') b.rows.forEach((r, k) => { if (r.length !== b.head.length) add(b.line + 2 + k, `this row has ${r.length} columns; the header has ${b.head.length}`); });
    if (b.type === 'media') {
      if (!b.alt.trim()) add(b.line, 'media needs alt text, written as a caption');
      const r = resolveMedia(site, page, b.src);
      if (r.error) add(b.line, r.error);
    }
    if (b.type === 'code' && b.lang === 'log') b.lines.forEach((l, k) => {
      const line = b.line + 1 + k;
      const m = LOG_LINE.exec(l);
      if (!m) add(line, 'a log line is "hash  message  date", parts separated by two or more spaces');
      else if (!page.sample && !commitExists(site.repoDir, m[1])) add(line, `commit ${m[1]} isn't in this repo`);
    });
  }
}

/** @returns {{file: string, line: number, message: string}[]} sorted by file, then line */
export function validate(site) {
  if (site.loadProblems.length) return site.loadProblems; // fix these first: everything else would be noise
  const problems = [];
  for (const page of site.pages) checkPage(site, page, (line, message) => problems.push({ file: page.file, line, message }));
  for (const rel of walk(site.contentDir)) {
    const bad = rel.split('/').find((seg) => !NAME_RE.test(seg));
    if (bad) problems.push({ file: `${site.contentRel}/${rel}`, line: 0, message: `"${bad}": file names use lowercase letters, digits, dots and dashes only` });
  }
  const { errors } = checkManifest(site.manifest, site.contentDir);
  for (const e of errors) problems.push({ file: `${site.contentRel}/${e.file}`, line: 0, message: e.message });
  return problems.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}

export const mediaWarnings = (site) => checkManifest(site.manifest, site.contentDir).warnings
  .map((w) => ({ file: `${site.contentRel}/${w.file}`, line: 0, message: w.message }));

export const formatProblems = (problems) => problems.map((p) => (p.line ? `${p.file}:${p.line}: ${p.message}` : `${p.file}: ${p.message}`)).join('\n');
