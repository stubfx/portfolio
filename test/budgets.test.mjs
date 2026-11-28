// docs/BUILD.md §12, on the real build.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { build } from '../build.mjs';
import { walk } from '../lib/site.mjs';
import { loadManifest, checkManifest } from '../lib/media.mjs';

const KB = 1024;
let out;
before(async () => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'real-'));
  const r = await build({ outDir: out });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
});
const size = (rel) => fs.statSync(path.join(out, rel)).size;
const html = () => walk(out).filter((f) => f.endsWith('.html'));

test('HTML + CSS under 40 KB per page', () => {
  for (const page of html()) assert.ok(size(page) + size('assets/style.css') < 40 * KB, `${page}: ${size(page) + size('assets/style.css')} bytes`);
});

test('JS under 3 KB gzipped on pages without video or embeds', () => {
  const js = ['main.js', 'theme.js', 'copy.js', 'grain.js', 'grain-core.mjs'];
  const gz = js.reduce((sum, f) => sum + zlib.gzipSync(fs.readFileSync(path.join(out, 'assets', f))).length, 0);
  assert.ok(gz < 3 * KB, `${gz} bytes`);
  const without = html().filter((p) => !fs.readFileSync(path.join(out, p), 'utf8').includes('media.js'));
  assert.ok(without.length > 0, 'at least one page has no video');
  for (const p of without) {
    const scripts = [...fs.readFileSync(path.join(out, p), 'utf8').matchAll(/<script type="module" src="\/assets\/([^"]+)"/g)].map((m) => m[1]);
    const row = fs.readFileSync(path.join(out, p), 'utf8').includes('class="row"');
    assert.deepEqual(scripts, row ? ['main.js', 'rows.js'] : ['main.js'], p);
  }
});

test('fonts under 150 KB', () => {
  const total = walk(path.join(out, 'assets/fonts')).filter((f) => f.endsWith('.woff2')).reduce((s, f) => s + size(`assets/fonts/${f}`), 0);
  assert.ok(total < 150 * KB, `${total} bytes`);
});

test('media within its caps', () => {
  assert.deepEqual(checkManifest(loadManifest('content'), 'content').errors, []);
});

test('rows.js under 1 KB gzipped', () => {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(out, 'assets/rows.js'))).length;
  assert.ok(gz < KB, `${gz} bytes`);
});
