import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vimKey, runCommand } from '../src/client/vim-core.mjs';

test('letters do nothing outside normal mode', () => {
  for (const k of ['j', 'k', 'J', 'G', 'g', ':', 'Enter', 'i']) {
    const r = vimKey({ normal: false, lastG: 0 }, k, 0);
    assert.equal(r.action, null, k);
    assert.equal(r.state.normal, false, k);
  }
});

test('esc toggles, gg needs two presses', () => {
  const on = vimKey({ normal: false, lastG: 0 }, 'Escape', 0);
  assert.equal(on.state.normal, true);
  const g1 = vimKey(on.state, 'g', 1000);
  assert.equal(g1.action, null);
  assert.deepEqual(vimKey(g1.state, 'g', 1300).action, { type: 'top' });
  assert.equal(vimKey(g1.state, 'g', 2000).action, null);
  const off = vimKey(on.state, 'Escape', 0);
  assert.equal(off.state.normal, false);
  assert.deepEqual(off.action, { type: 'exitNormal' });
});

test('gg resets so a third g does not fire again', () => {
  const s = { normal: true, lastG: 0 };
  const a = vimKey(s, 'g', 100);
  const b = vimKey(a.state, 'g', 200);
  assert.deepEqual(b.action, { type: 'top' });
  assert.equal(vimKey(b.state, 'g', 300).action, null);
});

test('motions, project jumps and land', () => {
  const s = { normal: true, lastG: 0 };
  assert.deepEqual(vimKey(s, 'j', 0).action, { type: 'next' });
  assert.deepEqual(vimKey(s, 'k', 0).action, { type: 'prev' });
  assert.deepEqual(vimKey(s, 'J', 0).action, { type: 'nextProject' });
  assert.deepEqual(vimKey(s, 'K', 0).action, { type: 'prevProject' });
  assert.deepEqual(vimKey(s, 'G', 0).action, { type: 'bottom' });
  assert.deepEqual(vimKey(s, 'Enter', 0).action, { type: 'land' });
  assert.deepEqual(vimKey(s, ':', 0).action, { type: 'openCmd' });
  const i = vimKey(s, 'i', 0);
  assert.deepEqual(i.action, { type: 'exitNormal' });
  assert.equal(i.state.normal, false);
  assert.equal(vimKey(s, 'x', 0).action, null);
});

test('commands', () => {
  assert.equal(runCommand('q').message, "You can't quit. You just can't stop.");
  assert.equal(runCommand('wq').message, "You can't quit. You just can't stop.");
  assert.equal(runCommand('q!').message, "You can't quit. You just can't stop.");
  assert.equal(runCommand('help').action, 'help');
  assert.equal(runCommand(' help ').action, 'help');
  assert.equal(runCommand('colo latte').message, 'E492: Not an editor command: colo latte');
  assert.equal(runCommand('foo bar').message, 'E492: Not an editor command: foo bar');
  assert.equal(runCommand('').message, '');
});
