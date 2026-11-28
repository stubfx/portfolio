// site/style.css rules the design depends on, beyond the contrast table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('site/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.trim(), body }));
const rule = (sel) => rules.filter((r) => r.sel.split(',').map((s) => s.trim()).includes(sel)).map((r) => r.body).join(';');

test('column styles belong to the index; a generic table reads as text', () => {
  for (const r of rules) if (/\.tbl/.test(r.sel) && /\.c[0-3]\b/.test(r.sel)) assert.match(r.sel, /\.index/, r.sel);
  assert.match(rule('.tbl:not(.index) th'), /color:var\(--grey\)/);
  assert.doesNotMatch(rule('.tbl:not(.index) th') + rule('.tbl td'), /--mk/);
});

test('long words wrap instead of widening the page', () => {
  for (const sel of ['h1', 'h2', 'h3', 'p,li', 'blockquote']) assert.match(rules.find((r) => r.sel === sel)?.body ?? '', /overflow-wrap/, sel);
  assert.match(rule('.tbl td'), /overflow-wrap:anywhere/);
  assert.doesNotMatch(css, /\.tbl\.index td\.c1\{white-space:nowrap\}/);
});

test('rows bleed edge to edge, snap, and never scroll the page', () => {
  assert.match(rule('.row'), /margin:[^;]*calc\(-1 \* var\(--bleed-r\)\)[^;]*calc\(-1 \* var\(--bleed-l\)\)/);
  assert.match(rule('.cards'), /scroll-snap-type:x mandatory/);
  assert.match(rule('body'), /overflow-x:clip/);
  assert.match(rule('html:not(.js) .row-btn'), /display:none/);
});

test('transparent images get no placeholder background, so the page shows through', () => {
  assert.match(rule('.cutout img'), /background:none/);
});
