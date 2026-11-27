// Block-level Markdown for the subset in docs/CONTENT.md §2. Produces blocks with 1-based line numbers,
// and an error for anything outside the grammar. Inline syntax is checked separately (lib/inline.mjs).

const LANGS = new Set(['', 'logic', 'yaml', 'log']);
const BLOCK_START = /^(#{1,6}\s|```|>|- |[*+]\s|\d+\. |!\[|---$|<|\||\s+([-*+]|\d+\.)\s)/;
const MEDIA = /^!\[([^\]]*)\]\(([^)\s]+)\)/;
const SEPARATOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;
const LINKED = /^\[([^\]]+)\]\(([^)\s]+\.md)\):\s*(.+?)(?:\s*\((\d{4})\))?$/;
const PLANNED = /^([^[\]:]+):\s*(.+?)(?:\s*\((\d{4})\))?$/;
const NESTED = /^\s+([-*+]|\d+\.)\s/;

const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/** A `-` list becomes a file list (the index) when an item links a page with a note; then every item must be a row. */
function fileItems(items, err) {
  if (!items.some(({ text }) => LINKED.test(text))) return null;
  const out = [];
  for (const { text, line } of items) {
    let m = LINKED.exec(text);
    if (m) { out.push({ title: m[1], href: m[2], note: m[3], year: m[4] ?? null, line }); continue; }
    m = PLANNED.exec(text);
    if (!m) { err(line, 'this list is an index (it links a page with a note): every item needs "[Title](page.md): note" or "Title: note"'); return null; }
    out.push({ title: m[1].trim(), href: null, note: m[2], year: m[3] ?? null, line });
  }
  return out;
}

/** A non-blank line that starts no block of its own continues the line above (lazy continuation). */
const continues = (l) => Boolean(l) && !BLOCK_START.test(l);

/** @returns {{blocks: object[], errors: {line: number, message: string}[]}} */
export function parse(md) {
  const L = md.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, ''));
  const blocks = [];
  const errors = [];
  const err = (line, message) => errors.push({ line, message });
  let i = 0;
  let m;
  while (i < L.length) {
    const l = L[i];
    const line = i + 1;
    if (!l) { i++; continue; }

    if ((m = /^```(.*)$/.exec(l))) {
      const lang = m[1].trim();
      if (!LANGS.has(lang)) err(line, `code language "${lang}" isn't allowed: use logic, yaml, log or none`);
      const lines = [];
      i++;
      while (i < L.length && !/^```$/.test(L[i])) lines.push(L[i++]);
      if (i >= L.length) err(line, 'unclosed code fence');
      i++;
      blocks.push({ type: 'code', lang, lines, line });
      continue;
    }
    if (NESTED.test(l)) { err(line, "nested lists aren't allowed"); i++; continue; }
    if (/^( {4}|\t)/.test(l)) { err(line, "indented code isn't allowed: use a fence"); i++; continue; }
    if (l.startsWith('<!--')) {
      const start = i;
      while (i < L.length && !L[i].includes('-->')) i++;
      if (i >= L.length) { err(line, 'unclosed comment'); break; }
      if (L[i].slice(L[i].indexOf('-->') + 3).trim()) err(i + 1, 'nothing may follow --> on the same line');
      const raw = L.slice(start, i + 1).join('\n');
      i++;
      blocks.push({ type: 'comment', raw, text: raw.replace(/^<!--/, '').replace(/-->$/, '').trim(), line });
      continue;
    }
    if (/^<[a-zA-Z/!]/.test(l)) {
      err(line, "HTML isn't allowed (only <!-- comments -->)");
      while (i < L.length && L[i]) i++;
      continue;
    }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) {
      const level = m[1].length;
      if (level > 3) err(line, `heading level ${level} isn't allowed: use #, ## or ###`);
      else blocks.push({ type: 'heading', level, text: m[2], line });
      i++;
      continue;
    }
    if (l === '---') { blocks.push({ type: 'hr', line }); i++; continue; }
    if (l.startsWith('![')) {
      m = MEDIA.exec(l);
      if (!m) err(line, 'malformed media line: use ![caption](file)');
      else if (m[0].length !== l.length) err(line, 'a media line must stand alone');
      else blocks.push({ type: 'media', alt: m[1], src: m[2], line });
      i++;
      continue;
    }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]);
      if (rows.length < 2 || !SEPARATOR.test(rows[1])) { err(line, 'a table needs a separator line (|---|) under its header'); continue; }
      blocks.push({ type: 'table', head: cells(rows[0]), rows: rows.slice(2).map(cells), line });
      continue;
    }
    if (l.startsWith('>')) {
      const buf = [];
      while (i < L.length && (L[i].startsWith('>') || continues(L[i]))) buf.push(L[i].startsWith('>') ? L[i++].replace(/^>\s?/, '') : L[i++].trim());
      blocks.push({ type: 'quote', text: buf.join(' ').trim(), line });
      continue;
    }
    if (/^[*+]\s/.test(l)) { err(line, 'use - for lists'); i++; continue; }
    if (l.startsWith('- ')) {
      const items = [];
      while (i < L.length && L[i]) {
        if (L[i].startsWith('- ')) items.push({ text: L[i].slice(2).trim(), line: i + 1 });
        else if (NESTED.test(L[i])) err(i + 1, "nested lists aren't allowed");
        else if (continues(L[i])) items.at(-1).text += ` ${L[i].trim()}`;
        else break;
        i++;
      }
      const files = fileItems(items, err);
      blocks.push(files ? { type: 'files', items: files, line } : { type: 'list', ordered: false, items, line });
      continue;
    }
    if (/^\d+\. /.test(l)) {
      const items = [];
      while (i < L.length && L[i]) {
        if ((m = /^(\d+)\. (.*)$/.exec(L[i]))) items.push({ n: Number(m[1]), text: m[2].trim(), line: i + 1 });
        else if (continues(L[i])) items.at(-1).text += ` ${L[i].trim()}`;
        else break;
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items, line });
      continue;
    }
    const buf = [];
    while (i < L.length && L[i] && !(buf.length && BLOCK_START.test(L[i]))) buf.push(L[i++].trim());
    const text = buf.join(' ');
    const punch = /^==([^=]+)==$/.exec(text);
    blocks.push(punch ? { type: 'punch', text: punch[1], line } : { type: 'para', text, line });
  }
  return { blocks, errors };
}
