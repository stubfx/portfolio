import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bayer, noise, fbm, baseLevel, ramp, laneFactors, quantize, lazyRows, twinkle, stepMeteor, starsForRow } from '../src/client/sky-core.mjs';

test('bayer(n) is every threshold (i + 0.5) / n² exactly once, all inside (0, 1)', () => {
  for (const n of [2, 4, 8]) {
    const t = [...bayer(n)].map((v) => Math.round(v * n * n - 0.5)).sort((a, b) => a - b);
    assert.deepEqual(t, Array.from({ length: n * n }, (_, i) => i));
  }
  assert.deepEqual([...bayer(2)].map((v) => v * 4 - 0.5), [0, 2, 3, 1]); // the classic 2x2 order
});

test('noise is deterministic per seed, in [0, 1], and smooth', () => {
  const a = noise(7), b = noise(7), c = noise(8);
  assert.equal(a(3.3, 9.1), b(3.3, 9.1));
  assert.notEqual(a(3.3, 9.1), c(3.3, 9.1));
  for (let i = 0; i < 200; i++) { const v = fbm(a, i * 0.37, i * 0.11); assert.ok(v >= 0 && v <= 1, `fbm ${v}`); }
  assert.ok(Math.abs(a(5.5, 5.5) - a(5.51, 5.5)) < 0.05, 'neighbouring samples differ a lot');
});

test('the ramp passes exactly through the page base at baseLevel', () => {
  const base = [30, 30, 46], accent = [180, 190, 254];
  for (const levels of [3, 4, 6]) {
    const r = ramp(levels, base, accent), k = baseLevel(levels);
    assert.equal(r.length, levels);
    assert.deepEqual(r[k], base, `levels ${levels}`);
    assert.ok(r[0].every((v, i) => v <= base[i]), 'level 0 is darker than the base');
  }
  assert.equal(baseLevel(4), 1);
});

test('quantize: an exact level stays flat under every dither threshold', () => {
  const t = bayer(4);
  for (const levels of [3, 4, 6]) {
    const k = baseLevel(levels), v = k / (levels - 1);
    assert.ok([...t].every((th) => quantize(v, levels, th) === k), `levels ${levels}`);
  }
  assert.equal(quantize(1, 4, 0.99), 3);
  assert.equal(quantize(0, 4, 0.01), 0);
});

test('lane factors: min inside the column, 1 well outside, monotonic in the falloff', () => {
  const f = laneFactors(100, 40, 60, 10, 0.08);
  for (let x = 40; x <= 60; x++) assert.ok(Math.abs(f[x] - 0.08) < 1e-6, `inside at ${x}: ${f[x]}`); // Float32
  assert.equal(f[0], 1); assert.equal(f[99], 1);
  for (let x = 30; x < 40; x++) assert.ok(f[x] >= f[x + 1], `left falloff at ${x}`);
  for (let x = 60; x < 70; x++) assert.ok(f[x] <= f[x + 1], `right falloff at ${x}`);
  assert.deepEqual([...laneFactors(5, null, null, 10, 0.08)], [1, 1, 1, 1, 1]);
});

test('lazy rows: only the rows asked for are ever baked, each once', () => {
  let baked = 0;
  const rows = lazyRows(4, 1000, (y, out) => { baked++; out.fill(y % 4); });
  assert.equal(baked, 0);
  assert.deepEqual([...rows.get(10)], [2, 2, 2, 2]);
  rows.get(10); rows.get(11);
  assert.equal(baked, 2);
  assert.equal(rows.baked, 2);
  assert.equal(rows.has(11), true);
  assert.equal(rows.has(12), false, 'has() never bakes');
  assert.equal(baked, 2);
});

test('twinkle cycles each group in [0, 1] with its own phase', () => {
  const s = [0, 1, 2, 3].map((g) => twinkle(1.3, g));
  assert.ok(s.every((v) => v >= 0 && v <= 1));
  assert.ok(new Set(s.map((v) => v.toFixed(3))).size > 1, 'groups twinkle in step');
});

test('a meteor moves, keeps a short trail and dies', () => {
  let m = { x: 10, y: 5, vx: 1.5, vy: 0.8, life: 3, trail: [] };
  m = stepMeteor(m); m = stepMeteor(m);
  assert.equal(m.trail.length, 2);
  assert.ok(m.x > 10 && m.y > 5);
  m = stepMeteor(m);
  assert.equal(m.life, 0);
  for (let i = 0; i < 20; i++) m = stepMeteor({ ...m, life: 5 });
  assert.ok(m.trail.length <= 8, 'trail is capped');
});

test('stars per row look random: no streaks or diagonal lines across rows', () => {
  const W = 427, rows = Array.from({ length: 400 }, (_, y) => starsForRow(y, W, 0.0015 * 3));
  assert.deepEqual(starsForRow(7, W, 0.01), starsForRow(7, W, 0.01), 'deterministic per row');
  // A seeded LCG with linear seeds lines the first star of each row up: x(y+1) - x(y) repeats.
  const firsts = rows.map((r) => r[0]).filter(Boolean).map((s) => s.x);
  const diffs = new Map();
  for (let i = 1; i < firsts.length; i++) { const d = (firsts[i] - firsts[i - 1] + W) % W; diffs.set(d, (diffs.get(d) || 0) + 1); }
  const worst = Math.max(...diffs.values()) / (firsts.length - 1);
  assert.ok(worst < 0.03, `${(worst * 100).toFixed(1)}% of rows share one step: the stars form lines`);
  // and the columns are evenly used: no column band hoards stars
  const cols = new Array(8).fill(0);
  for (const r of rows) for (const s of r) cols[Math.floor((s.x / W) * 8)]++;
  const mean = cols.reduce((a, b) => a + b) / 8;
  assert.ok(cols.every((n) => Math.abs(n - mean) < mean * 0.35), `uneven columns: ${cols}`);
  for (const r of rows) for (const s of r) assert.ok(s.g >= 0 && s.g < 4 && s.x >= 0 && s.x < W);
});
