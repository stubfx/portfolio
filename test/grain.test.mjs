import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grainTile, grainOffset } from '../site/grain-core.mjs';

test('grain tile shape', () => {
  const t = grainTile(128, 3);
  assert.equal(t.length, 128 * 128 * 4);
  assert.equal(t[3], 255);
  assert.equal(t[0], t[1]);
  assert.equal(t[1], t[2]);
  const distinct = new Set(); for (let i = 0; i < 400; i += 4) distinct.add(t[i]);
  assert.ok(distinct.size > 20, 'noise, not flat');
});

test('grain offsets stay within one tile', () => {
  for (let i = 0; i < 50; i++) {
    const [x, y] = grainOffset(128, Math.random);
    assert.ok(x <= 0 && x > -128 && y <= 0 && y > -128);
  }
});
