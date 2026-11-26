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
  assert.match(html, /aria-current="page"[^>]*>.*log/s);
  assert.match(html, /data-hash="7be2104" data-branch="accenture" data-kind="project"/);
  assert.match(html, /id="configurator-framework"/);
  assert.doesNotMatch(html, /—/);
});

test('home is one log with project attachments', async () => {
  const html = await page('index.html');
  assert.equal(html.match(/<ol class="log"/g).length, 1);
  assert.doesNotMatch(html, /class="seg"|id="ground"|class="stage"|class="land"|--seg-desk/);
  const at = html.indexOf('id="configurator-framework"');
  const row = html.slice(html.lastIndexOf('<li', at), html.indexOf('</li>', at));
  assert.match(row, /^<li class="row k-project" style="--c:var\(--b-accenture\)">/);
  assert.match(row, /<article class="entry pc" id="configurator-framework" aria-labelledby="t-7be2104">/);
  assert.match(row, /data-hash="7be2104" data-branch="accenture" data-kind="project"/);
  assert.match(row, /<time datetime="2024">2021–24<\/time>/);
  assert.match(row, /<h2 class="ttl" id="t-7be2104">Configurator <em>framework<\/em><sup class="dg" aria-label="under NDA">†<\/sup><\/h2>/);
  assert.match(row, /<dl class="cells">.*Babylon\.js/s);
  assert.match(row, /<a class="pc-att" href="\/projects\/configurator-framework\/" style="[^"]*--p-accent:#d4a77a[^"]*" aria-label="git show 7be2104: open Configurator framework">/);
  assert.match(row, /view-transition-name:cover-configurator-framework/);
  assert.match(row, /<span class="pc-chip" aria-hidden="true">git show 7be2104<\/span>/);
  assert.match(html, /<span class="tag hud">planned<\/span>/);
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

test('fonts are self-hosted and preloaded', async () => {
  const html = await page('index.html');
  assert.match(html, /<link rel="preload" href="\/fonts\/atkinson-next-400\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.match(html, /<link rel="preload" href="\/fonts\/fraunces-italic\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.match(html, /<link rel="stylesheet" href="\/fonts\/fonts\.css">/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  assert.match(await page('help/index.html'), /no third-party requests/);
  const css = await readFile(join(tmp, 'fonts/fonts.css'), 'utf8');
  for (const fam of ['Atkinson Hyperlegible Next', 'Atkinson Hyperlegible Mono', 'Fraunces']) assert.match(css, new RegExp(`font-family:\\s*"${fam}"`));
  assert.match(css, /font-display:\s*swap/);
  for (const m of css.matchAll(/url\(([^)]+)\)/g)) assert.match(m[1], /^\.\/[a-z0-9-]+\.woff2$/, `relative woff2 url: ${m[1]}`);
});

test('every page but home ends with a contact footer', async () => {
  for (const f of ['work/index.html', 'about/index.html', 'help/index.html', 'projects/ba-art-direction/index.html', '404.html']) {
    assert.match(await page(f), /<footer class="site-foot">[\s\S]*mailto:info@lucamolluso\.com/, f);
  }
  assert.doesNotMatch(await page('index.html'), /class="site-foot"/);
});

test('a base path prefixes every site-relative URL (GitHub project pages)', async () => {
  const out = mkdtempSync(join(tmpdir(), 'site-base-'));
  await build({ outDir: out, base: '/portfolio' });
  for (const f of ['index.html', 'work/index.html', 'projects/ba-art-direction/index.html', '404.html']) {
    const html = await readFile(join(out, f), 'utf8');
    assert.match(html, /src="\/portfolio\/assets\/main\.js"/, f);
    assert.match(html, /href="\/portfolio\/assets\/site\.css"/, f);
    const stray = html.match(/(?:href|src)="\/(?!portfolio\/|\/)[^"]*"/g);
    assert.equal(stray, null, `${f}: ${stray}`);
  }
  assert.match(await readFile(join(out, 'index.html'), 'utf8'), /href="\/portfolio\/projects\/configurator-framework\/"/);
});

test('every page opts in to view transitions inline, before any stylesheet or script', async () => {
  // In site.css alone the opt-in lost a race with the module graph: Chromium revealed the new page without it.
  for (const f of ['index.html', 'work/index.html', 'about/index.html', 'help/index.html', '404.html', 'projects/configurator-framework/index.html']) {
    const head = (await page(f)).split('</head>')[0];
    const optIn = head.indexOf('<style>@view-transition{navigation:auto}</style>');
    assert.ok(optIn > 0, `${f}: no inline view-transition opt-in`);
    for (const later of ['<link rel="stylesheet"', '<script type="module"', '<script>'])
      assert.ok(head.indexOf(later) === -1 || optIn < head.indexOf(later), `${f}: opt-in comes after ${later}`);
  }
  assert.doesNotMatch(await page('assets/site.css'), /@view-transition/, 'one opt-in, in the head');
});

test('motion ships as its own stylesheet section and script', async () => {
  const css = await page('assets/site.css');
  assert.ok(css.indexOf('.rv.in') > css.indexOf('.pc-chip'), 'motion.css comes after cover/log styles');
  assert.match(css, /animation-timeline:\s*view\(\)/);
  assert.match(css, /@media print/);
  assert.match(await page('assets/main.js'), /startReveal/);
});

test('home carries its world data before the sky, and no world layers anywhere', async () => {
  const home = await page('index.html');
  assert.match(home, /<script type="application\/json" id="worlds">[^<]+<\/script><canvas id="sky"/);
  for (const rel of ['index.html', 'work/index.html', 'about/index.html', 'projects/configurator-framework/index.html'])
    assert.doesNotMatch(await page(rel), /id="world"/, rel);
  assert.doesNotMatch(await page('assets/site.css'), /#world/);
});

test('copy: Twitch years, no flight anywhere', async () => {
  const home = await page('index.html');
  const tw = home.slice(home.indexOf('id="c-c7d41ab"'));
  assert.match(tw, /<time datetime="2019">2019–24<\/time>/);
  assert.match(tw, /Five years streaming on Twitch, from 2019 to 2024/);
  assert.match(await page('about/index.html'), /Five years streaming on Twitch, from 2019 to 2024\./);
  for (const f of ['index.html', 'help/index.html', 'about/index.html', 'work/index.html'])
    assert.doesNotMatch((await page(f)).replace(/<[^>]+>/g, ' '), /\bfl(y|ies|ight)\b/i, f);
  const readme = await readFile('README.md', 'utf8');
  assert.doesNotMatch(readme, /segmentHeight|full-screen|fly through|flight/i);
  assert.doesNotMatch(JSON.parse(await readFile('package.json', 'utf8')).description || '', /\bfl(y|ies|ight)\b/i, 'package.json description');
  for (const f of ['index.html', 'help/index.html', 'about/index.html']) assert.doesNotMatch(await page(f), /—/, f);
});

test('the fonts cover every character on the pages, and the typography real copy will bring', async () => {
  const css = await readFile(join(tmp, 'fonts/fonts.css'), 'utf8');
  const covered = new Set();
  for (const range of css.match(/unicode-range:\s*([^;]+);/)[1].split(',')) {
    const [lo, hi] = range.trim().slice(2).split('-').map((h) => parseInt(h, 16));
    for (let c = lo; c <= (hi ?? lo); c++) covered.add(c);
  }
  // Curly quotes, apostrophe and ellipsis: the spec names ’, and real copy will use them all.
  for (const ch of ['‘', '’', '“', '”', '…']) assert.ok(covered.has(ch.codePointAt(0)), `fonts miss ${ch}`);
  const missing = new Set();
  for (const f of files.filter((p) => p.endsWith('.html'))) {
    const text = (await readFile(f, 'utf8')).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ')
      .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, ' ');
    for (const ch of text) if (ch.codePointAt(0) > 0x20 && !covered.has(ch.codePointAt(0))) missing.add(ch);
  }
  assert.deepEqual([...missing], [], 'characters on the pages that render in the fallback face');
});

test('the status bar carries a grain toggle, and the head applies a saved choice before paint', async () => {
  const html = await page('index.html');
  assert.match(html, /<button id="grainbtn" class="hud" type="button" aria-pressed="true" title="Film grain">grain<\/button>\s*<a class="mail hud"/);
  const head = html.split('</head>')[0];
  assert.match(head, /localStorage\.getItem\('grain'\)==='off'/);
  assert.match(head, /classList\.add\('nograin'\)/);
});

test('home ships its world palettes as JSON for the sky', async () => {
  const m = /<script type="application\/json" id="worlds">(.*?)<\/script>/.exec(await page('index.html'));
  assert.ok(m, 'no #worlds data on home');
  const worlds = JSON.parse(m[1]);
  assert.equal(worlds.length, 7);
  assert.ok(worlds.some((w) => w.hashes.join(' ') === 'e8d77f0 1a7c3e9'), 'the two IBM rows share a world');
  for (const w of worlds) assert.match(w.base + w.accent, /^#[0-9a-f]{6}#[0-9a-f]{6}$/);
});
