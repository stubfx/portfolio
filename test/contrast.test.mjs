// DESIGN.md §3, enforced: the contrast table is a test, not a promise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { contrastRatio, readTokens } from '../lib/contrast.mjs';

const { day, night } = readTokens(fs.readFileSync('site/style.css', 'utf8'));

test('tokens are DESIGN.md §2 values', () => {
  assert.deepEqual({ paper: day.paper, ink: day.ink, grey: day.grey, mk: day.mk, line: day.line, red: day.red },
    { paper: '#eff1f5', ink: '#000000', grey: '#5c5f77', mk: '#9ca0b0', line: '#ccd0da', red: '#e64553' });
  assert.deepEqual({ paper: night.paper, ink: night.ink, grey: night.grey, mk: night.mk, line: night.line, red: night.red },
    { paper: '#1c1917', ink: '#ebe5e0', grey: '#b4aca6', mk: '#726a64', line: '#312d2a', red: '#e66f62' });
});

test('main text AAA in both themes', () => {
  assert.equal(contrastRatio(day.ink, day.paper), 18.57);
  assert.equal(contrastRatio(night.ink, night.paper), 14);
});

test('secondary: AA by day, AAA by night', () => {
  assert.ok(contrastRatio(day.grey, day.paper) >= 4.5);
  assert.ok(contrastRatio(night.grey, night.paper) >= 7);
});

test('punch line: AA large by day, AAA large by night', () => {
  assert.ok(contrastRatio(day.red, day.paper) >= 3);
  assert.ok(contrastRatio(night.red, night.paper) >= 4.5);
});

test('contrastRatio and readTokens edge cases', () => {
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.throws(() => contrastRatio('red', '#000000'), /#rrggbb/);
  assert.deepEqual(readTokens(':root{--paper:#FFF;--ink:#000}html[data-theme="night"]{--paper:#111111}'),
    { day: { paper: '#ffffff', ink: '#000000' }, night: { paper: '#111111', ink: '#000000' } });
});
