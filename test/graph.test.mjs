import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusReducer, laneTarget, branchPath, pickCurrent } from '../src/client/graph-core.mjs';

test('focus moves the old branch to ghost', () => {
  assert.deepEqual(focusReducer({ focus: 'accenture', ghost: null }, 'school'), { focus: 'school', ghost: 'accenture' });
  assert.deepEqual(focusReducer({ focus: 'main', ghost: 'school' }, 'school'), { focus: 'school', ghost: null });
  assert.deepEqual(focusReducer({ focus: 'school', ghost: 'accenture' }, 'main'), { focus: 'main', ghost: 'school' });
  assert.deepEqual(focusReducer({ focus: 'school', ghost: 'accenture' }, 'school'), { focus: 'school', ghost: 'accenture' });
});

test('at most two lanes visible, one on narrow', () => {
  const s = { focus: 'twitch', ghost: 'school' };
  assert.deepEqual(laneTarget('twitch', s, false), { lane: 1, opacity: 1, draw: 1 });
  assert.equal(laneTarget('school', s, false).lane, 2);
  assert.equal(laneTarget('school', s, false).opacity, 0.3);
  assert.equal(laneTarget('school', s, true).opacity, 0);
  assert.equal(laneTarget('ibm', s, false).opacity, 0);
  assert.deepEqual(laneTarget('school', { focus: 'main', ghost: 'school' }, true), { lane: 1, opacity: 0.3, draw: 1 });
});

test('merged branch path starts on the rail at the merge row', () => {
  assert.match(branchPath({ mY: 100, fY: 400, top: 0 }, 54, 76.5), /^M76\.5 100C/);
  assert.match(branchPath({ mY: null, fY: 400, top: 10 }, 54, 76.5), /^M54 10V380/);
  assert.match(branchPath({ mY: null, fY: 400, top: 10 }, 54, 76.5), /76\.5 400$/);
});

test('current row is the last one above the line, a dwelling cover wins', () => {
  const ys = [100, 300, 500, 900];
  assert.equal(pickCurrent(ys, 50, false, -1), 0);
  assert.equal(pickCurrent(ys, 480, false, -1), 1);
  assert.equal(pickCurrent(ys, 500, false, -1), 2);
  assert.equal(pickCurrent(ys, 600, true, -1), 3);
  assert.equal(pickCurrent(ys, 480, false, 3), 3);
});
