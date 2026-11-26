import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWorld } from '../src/build/world.mjs';

test('worlds: projects take their palette, work takes its lane, others none', () => {
  const rows = [
    { hash: 'aaa1111', kind: 'project', branch: 'main', project: { palette: { bg: '#120c08', accent: '#fab387' } } },
    { hash: 'bbb2222', kind: 'big', branch: 'twitch', special: true },
    { hash: 'ccc3333', kind: 'merge', branch: 'main' },
    { hash: 'ddd4444', kind: 'big', branch: 'twitch' },
  ];
  const html = renderWorld(rows);
  assert.match(html, /^<div id="world" aria-hidden="true"><i data-hash="aaa1111" style="--wb:#120c08;--wa:#fab387"><\/i>/);
  assert.match(html, /<i data-hash="bbb2222 ddd4444" style="--wb:color-mix\(in oklab, var\(--base\) 86%, var\(--b-twitch\)\);--wa:var\(--b-twitch\)"><\/i><\/div>$/);
  assert.equal((html.match(/<i /g) || []).length, 2, 'same-lane rows share one world');
  assert.doesNotMatch(html, /ccc3333/);
  assert.equal(renderWorld([rows[2]]), '');
});

test('world colours are escaped', () => {
  const html = renderWorld([{ hash: 'eee5555', kind: 'project', branch: 'main', project: { palette: { bg: '"><script>', accent: '#fff' } } }]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /--wb:&quot;&gt;&lt;script&gt;/);
});
