// lib/graph.mjs: a ```logic diagram read as a graph, timed for the page to draw it (docs/DESIGN.md section 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graph, graphSVG, CW, LH } from '../lib/graph.mjs';
import { escapeHtml } from '../lib/inline.mjs';

const DAC = `ME                          MACHINE

brief
│
▼
direction file ───────────▶ claude code
▲                           │ writes the prompts
│                           ▼
│                           comfyui · meshy
│                           │ 160 candidates
│                           ▼
│                           blender
│                           │ renders the sheet
│                           ▼
└── the eye ◀───────────────┘
    keeps 40 · 2 redirects`.split('\n');

const BRANCH = `VISITOR                     MACHINE

                            the box
                            │ prints the sentence
hands, at home ◀────────────┤
│ brick by brick            │
▼                           ▼
the sentence, built         the portal
                            │ anyone can buy the work`.split('\n');

const g = graph(DAC);
const label = (gr, text) => gr.labels.find((l) => l.text === text);
const t = (gr, text) => label(gr, text).t;

test('labels: text runs split at box characters and double spaces, in their lane; the first row names the lanes', () => {
  assert.deepEqual(g.labels.filter((l) => l.title).map((l) => [l.text, l.lane]), [['ME', 'me'], ['MACHINE', 'm']]);
  assert.deepEqual([label(g, 'brief').lane, label(g, 'claude code').lane, label(g, 'keeps 40 · 2 redirects').lane], ['me', 'm', 'me']);
  assert.ok(label(g, 'direction file') && label(g, 'the eye') && label(g, 'writes the prompts'));
  assert.ok(!g.labels.some((l) => /[│─▶◀▼▲┘└]|^ | $/.test(l.text)), 'no box characters or edge spaces in a label');
  assert.equal(g.cols, 48);
  assert.equal(g.rows, 16);
});

test('arrowheads: one per arrow character, pointing its way', () => {
  assert.deepEqual(g.heads.map((h) => h.dir).sort(), ['d', 'd', 'd', 'd', 'l', 'r', 'u']);
});

test('the flow decides the order: each label after the arrow that reaches it, the loop back last', () => {
  assert.ok(t(g, 'ME') === 0 && t(g, 'MACHINE') === 0);
  const order = ['brief', 'direction file', 'claude code', 'writes the prompts', 'comfyui · meshy', '160 candidates', 'blender', 'renders the sheet', 'the eye', 'keeps 40 · 2 redirects'];
  for (let k = 1; k < order.length; k++) assert.ok(t(g, order[k]) > t(g, order[k - 1]), `${order[k]} after ${order[k - 1]}`);
  const up = g.heads.find((h) => h.dir === 'u');
  assert.ok(up.t > t(g, 'the eye'), 'the redirect reaches back to the direction file after the eye');
  const end = Math.max(...g.segments.map((s) => s.t + s.l), ...g.labels.map((l) => l.t));
  assert.ok(end < 4000, `the whole graph draws in under 4 s (${end} ms)`);
  for (const s of g.segments) assert.ok(s.t >= 0 && s.l > 0, JSON.stringify(s));
});

test('strokes draw toward their arrowhead: the arrow from direction file runs left to right, the redirect bottom to top', () => {
  const across = g.segments.filter((s) => s.y1 === s.y2 && s.y1 === (5 + 0.5) * LH && s.x1 < 28 * CW);
  assert.ok(across.length && across.every((s) => s.x2 > s.x1), JSON.stringify(across));
  assert.ok(across[0].x1 <= 15 * CW + 1e-9, 'it starts at the gap after the label');
  const back = g.segments.filter((s) => s.x1 === s.x2 && s.x1 === 0.5 * CW);
  assert.ok(back.some((s) => s.y2 < s.y1), 'the redirect line runs upward');
});

test('a branch splits the flow: both arms start after the box', () => {
  const b = graph(BRANCH);
  assert.ok(t(b, 'hands, at home') > t(b, 'the box'));
  assert.ok(t(b, 'the portal') > t(b, 'the box'));
  assert.ok(t(b, 'the sentence, built') > t(b, 'hands, at home'));
  assert.deepEqual(b.heads.map((h) => h.dir).sort(), ['d', 'd', 'l']);
});

test('the SVG: on the character grid, labels fitted to their cells, every drawn piece timed, a text alternative', () => {
  const svg = graphSVG(g, escapeHtml);
  assert.match(svg, /^<svg class="graph" role="img" aria-label="Diagram\. ME: brief, direction file, the eye, keeps 40 · 2 redirects\. MACHINE: claude code, writes the prompts, comfyui · meshy, 160 candidates, blender, renders the sheet\." viewBox="0 0 460\.8 396\.8" width="461" height="397">/);
  assert.match(svg, /<text class="t me a\d" x="0" y="[\d.]+" textLength="48" lengthAdjust="spacingAndGlyphs" data-t="\d+">brief<\/text>/);
  assert.match(svg, /<path class="s m a\d" d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+" pathLength="1" data-t="\d+" data-l="\d+"\/>/);
  assert.match(svg, /<path class="h me a\d" d="M[\d. L]+Z" data-t="\d+"\/>/);
  assert.doesNotMatch(svg, /style=/);
});
