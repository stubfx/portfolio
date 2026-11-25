import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phaseAt, flightFrame, groundColor, segmentProgress } from '../src/client/phases.mjs';

test('stage boundaries', () => {
  assert.deepEqual(phaseAt(0), { stage: 'approach', t: 0 });
  assert.equal(phaseAt(0.25).stage, 'arrival');
  assert.equal(phaseAt(0.5).stage, 'dwell');
  assert.equal(phaseAt(0.9).stage, 'departure');
  assert.equal(phaseAt(2).stage, 'departure');
  assert.deepEqual(phaseAt(-1), { stage: 'approach', t: 0 });
});

test('dwell fills the screen and dims the graph', () => {
  const f = flightFrame(0.55, { reduced: false });
  assert.equal(f.cover.scale, 1);
  assert.equal(f.cover.opacity, 1);
  assert.equal(f.ground, 1);
  assert.equal(f.graphDim, 0.2);
});

test('approach start is the plain log', () => {
  const f = flightFrame(0, { reduced: false });
  assert.deepEqual(f.prev, { y: 0, z: 0, opacity: 1 });
  assert.equal(f.cover.opacity, 0);
  assert.equal(f.ground, 0);
  assert.equal(f.graphDim, 1);
});

test('approach comes from depth, departure overshoots and fades', () => {
  const a = flightFrame(0.1, { reduced: false });
  assert.ok(a.cover.scale > 0.18 && a.cover.scale < 0.9);
  assert.ok(a.cover.z < -150 && a.cover.z > -1200);
  const end = flightFrame(1, { reduced: false });
  assert.equal(end.cover.scale, 1.6);
  assert.equal(end.cover.opacity, 0);
  assert.deepEqual(end.next, { y: 0, z: 0, opacity: 1 });
  assert.equal(end.ground, 0);
});

test('reduced motion never moves in depth', () => {
  for (const p of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
    const f = flightFrame(p, { reduced: true });
    assert.equal(f.prev.z, 0); assert.equal(f.prev.y, 0);
    assert.equal(f.cover.scale, 1); assert.equal(f.cover.z, 0);
    assert.equal(f.next.y, 0); assert.equal(f.next.z, 0);
  }
  assert.equal(flightFrame(0.1, { reduced: true }).cover.opacity, flightFrame(0.1, { reduced: false }).cover.opacity);
});

test('ground colour endpoints', () => {
  assert.equal(groundColor(0), '#1e1e2e');
  assert.equal(groundColor(1), '#000000');
  assert.equal(groundColor(5), '#000000');
});

test('segment progress runs from pin start to pin end', () => {
  assert.equal(segmentProgress(0, 3000, 1000), 0);
  assert.equal(segmentProgress(-1000, 3000, 1000), 0.5);
  assert.equal(segmentProgress(-2000, 3000, 1000), 1);
  assert.equal(segmentProgress(-500, 1000, 1000), 1);
});
