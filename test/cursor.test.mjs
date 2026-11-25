import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepCursor } from '../src/client/cursor-core.mjs';

test('cursor smears down then settles on the node', () => {
  let c = { x: 0, top: 89, bot: 111 };
  c = stepCursor(c, { x: 0, y: 300 });
  assert.ok(c.bot - c.top > 22);
  assert.ok(c.bot > c.top + 22 && c.top < 289);
  for (let i = 0; i < 60; i++) c = stepCursor(c, { x: 0, y: 300 });
  assert.deepEqual(c, { x: 0, top: 289, bot: 311 });
});

test('moving up leads with the top edge', () => {
  const c = stepCursor({ x: 10, top: 289, bot: 311 }, { x: 30, y: 100 });
  assert.ok(311 - c.bot < 289 - c.top, 'top edge moved further than the bottom edge');
  assert.ok(c.x > 10 && c.x < 30);
});

test('instant mode snaps', () => {
  assert.deepEqual(stepCursor({ x: 0, top: 0, bot: 22 }, { x: 5, y: 300 }, null), { x: 5, top: 289, bot: 311 });
});
