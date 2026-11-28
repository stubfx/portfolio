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
  assert.match(rule('.cards'), /scrollbar-width:none/); // Luca, 2026-11-28: no visible scrollbars in the rows
  assert.match(rule('.cards::-webkit-scrollbar'), /display:none/);
  assert.match(rule('body'), /overflow-x:clip/);
  assert.match(rule('html:not(.js) .row-btn'), /display:none/);
});

test('transparent images get no placeholder background, so the page shows through', () => {
  assert.match(rule('.cutout img'), /background:none/);
});

test('.vh hides text visually and keeps it for screen readers', () => {
  assert.match(rule('.vh'), /position:absolute/);
  assert.match(rule('.vh'), /clip-path:inset\(50%\)/);
});

test('the header sits in the frame layer, above any world; a world page hides the theme switch', () => {
  const src = fs.readFileSync('site/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.match(src, /^@layer base,world,frame;/);
  const at = src.indexOf('@layer frame{');
  assert.ok(at > 0, 'a frame layer');
  const [base, frame] = [src.slice(0, at), src.slice(at)];
  for (const sel of ['.bar{', '.btn{', '.seg button{', '.wip{']) {
    assert.ok(frame.includes(sel), `${sel} in the frame layer`);
    assert.ok(!base.includes(sel), `${sel} only in the frame layer`);
  }
  assert.match(frame, /html\.world #themeseg\{display:none\}/);
  assert.match(base, /^@layer base,world,frame;\s*@layer base\{/);
});

test('a video box has no placeholder colour: at fractional widths a GPU-drawn video leaves a sliver of it (Luca: "a tiny little line on the right")', () => {
  assert.doesNotMatch(rule('figure video'), /background:var\(--line\)/);
  assert.match(rule('figure video'), /background:none/);
});

test('logic graphs: hidden before they play only with JavaScript and motion; reduced motion and no-JS show them drawn', () => {
  const src = fs.readFileSync('site/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const motion = /@media \(prefers-reduced-motion:no-preference\)\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  const inside = [...src.matchAll(motion)].map((m) => m[1]).join('');
  assert.match(inside, /\.graph\.armed:not\(\.play\) \.t/); // armed by graph.js: if it never runs, nothing stays hidden
  assert.match(inside, /\.graph\.play \.s\{animation:/);
  const outside = src.replace(motion, '');
  assert.doesNotMatch(outside, /\.graph\.armed|\.graph\.play/);
  assert.match(rule('.graph'), /max-width:100%/);
});
