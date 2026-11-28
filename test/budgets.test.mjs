// docs/BUILD.md §12, on the real build.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { build } from '../build.mjs';
import { walk, loadSite } from '../lib/site.mjs';
import { worldAssets } from '../lib/world.mjs';
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

/** The world stylesheet a page links, or null. */
const worldOf = (page) => /<link rel="stylesheet" href="\/([^"]+\/world\.css)">/.exec(fs.readFileSync(path.join(out, page), 'utf8'))?.[1] ?? null;

test('HTML + CSS under 40 KB per page, plus up to 20 KB for a world', () => {
  for (const page of html()) {
    const world = worldOf(page);
    const total = size(page) + size('assets/style.css') + (world ? size(world) : 0);
    assert.ok(total < (world ? 60 : 40) * KB, `${page}: ${total} bytes`);
    if (world) assert.ok(size(world) < 20 * KB, `${world}: ${size(world)} bytes`);
  }
});

test('a world: fonts under 120 KB, script under 2 KB gzipped', () => {
  for (const page of html()) {
    const world = worldOf(page);
    if (!world) continue;
    const dir = path.dirname(world);
    const fonts = fs.existsSync(path.join(out, dir, 'fonts')) ? walk(path.join(out, dir, 'fonts')).filter((f) => f.endsWith('.woff2')) : [];
    const total = fonts.reduce((s, f) => s + size(`${dir}/fonts/${f}`), 0);
    assert.ok(total < 120 * KB, `${dir}: fonts ${total} bytes`);
    if (fs.existsSync(path.join(out, dir, 'world.js'))) {
      const gz = zlib.gzipSync(fs.readFileSync(path.join(out, dir, 'world.js'))).length;
      assert.ok(gz < 2 * KB, `${dir}/world.js: ${gz} bytes gzipped`);
    }
  }
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
    assert.deepEqual(scripts, row ? ['main.js', 'rows.js'] : ['main.js'], p); // a world's own script is counted in its own budget
  }
});

test('fonts under 150 KB', () => {
  const total = walk(path.join(out, 'assets/fonts')).filter((f) => f.endsWith('.woff2')).reduce((s, f) => s + size(`assets/fonts/${f}`), 0);
  assert.ok(total < 150 * KB, `${total} bytes`);
});

test('media within its caps', () => {
  const own = worldAssets(loadSite({ contentDir: 'content', repoDir: '.' }).pages.filter((p) => p.world).map((p) => p.world));
  assert.deepEqual(checkManifest(loadManifest('content'), 'content').errors.filter((e) => !own.has(e.file)), []);
});

test('rows.js under 1 KB gzipped', () => {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(out, 'assets/rows.js'))).length;
  assert.ok(gz < KB, `${gz} bytes`);
});
