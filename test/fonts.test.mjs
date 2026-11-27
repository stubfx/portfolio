import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from '../lib/parse.mjs';
import { parseInline } from '../lib/inline.mjs';
import { walk } from '../lib/site.mjs';

const DIR = 'site/fonts';
const FILES = { display: 'archivo-black.woff2', text: 'dm-sans.woff2', mono: 'jetbrains-mono.woff2' };
// Text the site itself prints in the mono (file bar, status line, banner, media tags).
const UI_MONO = 'WIP · This site is being rebuilt in the open, on GitHub. Sample content and numbers for now. lucamolluso.com/ '
  + 'copy .md copied selected day night rendered raw edits last edit history sample data not committed yet '
  + '# case idea year pause play ▶ YouTube · loads on play Vimeo · loads on play ## > - 1. | ``` --- == ![ ]( )';

const coverage = () => JSON.parse(fs.readFileSync(path.join(DIR, 'coverage.json'), 'utf8'));

/** Characters each font must render, from the content and the site's own labels. */
function needed() {
  const want = { display: new Map(), text: new Map(), mono: new Map() };
  const add = (font, s, where) => { for (const c of s) if (c.codePointAt(0) > 0x20 && !want[font].has(c)) want[font].set(c, where); };
  const inline = (font, s, where) => {
    for (const n of parseInline(s).nodes) add(n.t === 'code' ? 'mono' : font, n.t === 'link' ? n.text : n.v, where);
  };
  for (const rel of walk('content').filter((f) => f.endsWith('.md'))) {
    const where = `content/${rel}`;
    for (const b of parse(fs.readFileSync(where, 'utf8')).blocks) {
      if (b.type === 'heading' || b.type === 'punch') inline('display', b.text, where);
      if (b.type === 'para' || b.type === 'quote') inline('text', b.text, where);
      if (b.type === 'list') b.items.forEach((it) => inline('text', it.text, where));
      if (b.type === 'files') b.items.forEach((it) => { inline('text', it.title, where); inline('text', it.note, where); });
      if (b.type === 'table') [b.head, ...b.rows].flat().forEach((c) => inline('text', c, where));
      if (b.type === 'code') b.lines.forEach((l) => add('mono', l, where));
      if (b.type === 'media') add('mono', b.alt + b.src, where);
      if (b.type === 'comment') add('mono', b.raw, where);
    }
  }
  add('mono', UI_MONO, 'site UI');
  return want;
}

test('coverage.json matches the font files', () => {
  const cov = coverage();
  for (const file of Object.values(FILES)) {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, file))).digest('hex');
    assert.equal(cov[file]?.sha256, sha, `${file}: rerun scripts/fonts.py`);
  }
});

test('every character in the content has a glyph in the font that renders it', () => {
  const cov = coverage();
  const missing = [];
  for (const [font, chars] of Object.entries(needed())) {
    const have = new Set(cov[FILES[font]].codepoints);
    for (const [c, where] of chars) if (!have.has(c.codePointAt(0))) missing.push(`${FILES[font]} lacks "${c}" (U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}) used in ${where}`);
  }
  assert.deepEqual(missing, []);
});

test('the mono has no ligatures that would mangle visible syntax', () => {
  assert.equal(coverage()[FILES.mono].ligatures, false);
});

test('fonts under 150 KB', () => {
  const total = Object.values(FILES).reduce((sum, f) => sum + fs.statSync(path.join(DIR, f)).size, 0);
  assert.ok(total < 150 * 1024, `${Math.round(total / 1024)} KB`);
});

test('fonts.css declares the three faces and their fallbacks', () => {
  const css = fs.readFileSync(path.join(DIR, 'fonts.css'), 'utf8');
  for (const family of ['Archivo Black', 'DM Sans', 'JetBrains Mono'])
    assert.match(css, new RegExp(`font-family:\\s*"${family}";[^}]*src:\\s*url\\(fonts/`), family);
  for (const family of ['Archivo Black fallback', 'DM Sans fallback', 'JetBrains Mono fallback'])
    assert.match(css, new RegExp(`font-family:\\s*"${family}";[^}]*size-adjust:\\s*[\\d.]+%;[^}]*ascent-override`), family);
  for (const lic of ['OFL-ArchivoBlack.txt', 'OFL-DMSans.txt', 'OFL-JetBrainsMono.txt']) assert.ok(fs.existsSync(path.join(DIR, lic)), lic);
});
