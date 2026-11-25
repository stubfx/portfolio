import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { contrastTable } from '../src/build/tokens.mjs';

const tmp = mkdtempSync(join(tmpdir(), 'site-'));
let files;
const page = (f) => readFile(join(tmp, f), 'utf8');
before(async () => { files = await build({ outDir: tmp }); });

test('build writes every page', () => {
  for (const f of ['index.html', 'work/index.html', 'about/index.html', 'help/index.html', '404.html',
    'projects/configurator-framework/index.html', 'CNAME', 'assets/main.js', 'assets/site.css'])
    assert.ok(files.some((p) => p.endsWith(f)), f);
});

test('home structure is semantic', async () => {
  const html = await page('index.html');
  assert.match(html, /<ol class="log"/);
  assert.match(html, /<time datetime="2015">/);
  assert.match(html, /class="land" href="\/projects\/configurator-framework\/"/);
  assert.match(html, /aria-current="page"[^>]*>.*log/s);
  assert.match(html, /data-hash="7be2104" data-branch="accenture" data-kind="project"/);
  assert.match(html, /id="configurator-framework"/);
  assert.doesNotMatch(html, /—/);
});

test('every page has one h1, a skip link and a lang', async () => {
  for (const f of ['index.html', 'work/index.html', 'about/index.html', 'help/index.html', 'projects/ba-art-direction/index.html']) {
    const html = await page(f);
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1, f);
    assert.match(html, /<html lang="en">/, f);
    assert.match(html, /class="skip" href="#main"/, f);
  }
});

test('help lists live contrast values', async () => {
  const html = await page('help/index.html');
  for (const r of contrastTable()) assert.ok(html.includes(r.onBase.toFixed(2)), r.what);
  assert.match(html, /no cookies, no tracking/);
});

test('nda project never prints a client name field', async () => {
  const html = await page('projects/configurator-framework/index.html');
  assert.match(html, /Client under NDA/);
  assert.doesNotMatch(html, /Prada|Ferrari|Moncler/i);
});

test('project page uses its palette and the cover morph name', async () => {
  const html = await page('projects/ba-art-direction/index.html');
  assert.match(html, /--p-bg:#120c08/);
  assert.match(html, /view-transition-name:cover-ba-art-direction/);
});

test('home ships branch topology for the graph', async () => {
  const html = await page('index.html');
  const json = /<script type="application\/json" id="branches">([^<]+)<\/script>/.exec(html);
  assert.ok(json, 'branches JSON missing');
  const branches = JSON.parse(json[1]);
  assert.equal(branches.find((b) => b.name === 'school').merge, '4d01c9a');
  assert.match(html, /data-kind="big" data-special/);
});

test('project pages show their commit in the status bar', async () => {
  const html = await page('projects/configurator-framework/index.html');
  assert.match(html, /<span id="pos" class="hud">7be2104 · accenture<\/span>/);
});
