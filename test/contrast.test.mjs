import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from '../src/build/contrast.mjs';
import { contrastTable, TOKENS } from '../src/build/tokens.mjs';

test('known ratio', () => {
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.equal(contrastRatio('#cdd6f4', '#1e1e2e'), 11.34);
});

test('every check passes on base and on black', () => {
  for (const row of contrastTable()) assert.ok(row.pass, `${row.what}: ${row.onBase}/${row.onBlack}`);
});

test('thresholds', () => {
  const min = { AAA: 7, AA: 4.5, graphics: 3 };
  const rows = contrastTable();
  assert.ok(rows.length >= 10);
  for (const r of rows) assert.ok(Math.min(r.onBase, r.onBlack) >= min[r.rule], r.what);
});

test('tokens carry the spec palette', () => {
  assert.equal(TOKENS.base, '#1e1e2e');
  assert.equal(TOKENS.crema, '#d4a77a');
  assert.equal(TOKENS['b-twitch'], '#f38ba8');
});

test('tokens.css declares every token with the same value', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  for (const [name, hex] of Object.entries(TOKENS)) assert.match(css, new RegExp(`--${name}: ${hex};`), name);
});
