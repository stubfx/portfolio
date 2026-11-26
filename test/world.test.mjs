import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldPalettes, renderWorldData } from '../src/build/world.mjs';

test('world palettes: the approved faint base per world, shared by identical colours', () => {
  const rows = [
    { hash: 'aaa1111', kind: 'project', branch: 'main', project: { palette: { bg: '#120c08', accent: '#fab387' } } },
    { hash: 'bbb2222', kind: 'big', branch: 'ibm' },
    { hash: 'ccc3333', kind: 'merge', branch: 'main' },
    { hash: 'ddd4444', kind: 'big', branch: 'ibm' },
  ];
  const w = worldPalettes(rows);
  assert.equal(w.length, 2);
  assert.deepEqual(w[0], { hashes: ['aaa1111'], base: '#171419', accent: '#fab387' });
  assert.deepEqual(w[1].hashes, ['bbb2222', 'ddd4444']);
  assert.equal(w[1].accent, '#89b4fa');
  assert.match(w[1].base, /^#[0-9a-f]{6}$/);
  const json = renderWorldData(rows);
  assert.match(json, /^<script type="application\/json" id="worlds">\[.*\]<\/script>$/);
  assert.deepEqual(JSON.parse(json.replace(/^<script[^>]*>|<\/script>$/g, '')), w);
  assert.equal(renderWorldData([rows[2]]), '');
});
