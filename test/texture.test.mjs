import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeStars, starCount, starOffset } from '../src/client/stars-core.mjs';
import { grainTile, grainOffset } from '../src/client/grain-core.mjs';

test('stars are deterministic and split by layer', () => {
  const a = makeStars({ count: 90, layers: 3, seed: 7, w: 1280, h: 800 });
  assert.deepEqual(a, makeStars({ count: 90, layers: 3, seed: 7, w: 1280, h: 800 }));
  assert.equal(a.length, 90);
  assert.equal(a.filter((s) => s.layer === 2).length, 30);
  assert.ok(a.every((s) => s.x >= 0 && s.x < 1280 && s.y >= 0 && s.y < 800 && s.r > 0));
  assert.notDeepEqual(a, makeStars({ count: 90, layers: 3, seed: 8, w: 1280, h: 800 }));
});

test('star count scales with area, within bounds', () => {
  assert.equal(starCount(1280, 800), 180);
  assert.equal(starCount(640, 400), 45);
  assert.ok(starCount(10, 10) >= 40);
  assert.ok(starCount(8000, 8000) <= 420);
});

test('nearer layers drift more, and stay on the canvas', () => {
  assert.ok(starOffset(1000, 2, 800) !== starOffset(1000, 0, 800));
  for (const layer of [0, 1, 2]) {
    const o = starOffset(123456, layer, 800);
    assert.ok(o >= 0 && o < 800);
  }
  assert.equal(starOffset(1000, 1, 800, true), 0);
});

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
