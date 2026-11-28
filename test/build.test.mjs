import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { tmpSite } from './_site.mjs';
import { build } from '../build.mjs';
import { HEAD_SCRIPT } from '../lib/page.mjs';

const PAGE = (title, body = '') => `# ${title}\n\n> d\n\n${body}\n`;
const bytes = (n) => Buffer.alloc(n, 1);
const MEDIA = {
  'work/a/clip.mp4': {
    kind: 'video', width: 1920, height: 1080, duration: 12, audio: false, master: 'x',
    variants: [{ file: 'work/a/clip.av1.mp4', bytes: 8, type: 'video/mp4; codecs="av01.0.08M.08"' }, { file: 'work/a/clip.mp4', bytes: 10, type: 'video/mp4; codecs="avc1.640028"' }],
    poster: { jpg: { file: 'work/a/clip.jpg', bytes: 3 }, avif: { file: 'work/a/clip.avif', bytes: 2 } },
  },
  'work/a/p.jpg': {
    kind: 'photo', width: 2400, height: 1200, master: 'x', sample: true,
    variants: [{ file: 'work/a/p.jpg', width: 2400, bytes: 5, type: 'image/jpeg' }, { file: 'work/a/p.800.avif', width: 800, bytes: 4, type: 'image/avif' }],
  },
};
const MEDIA_FILES = { 'work/a/clip.mp4': bytes(10), 'work/a/clip.av1.mp4': bytes(8), 'work/a/clip.jpg': bytes(3), 'work/a/clip.avif': bytes(2), 'work/a/p.jpg': bytes(5), 'work/a/p.800.avif': bytes(4) };
const INDEX = '# Luca Molluso\n\n> Technical artist.\n\nIntro.\n\n![A loop.](work/a/clip.mp4)\n\n## Work\n\n'
  + '- [A](work/a.md): Idea. (2026)\n- B: Later. (2025)\n\n## Contact\n\n'
  + '- [info@lucamolluso.com](mailto:info@lucamolluso.com)\n- [linkedin.com/in/luca-molluso](https://www.linkedin.com/in/luca-molluso)\n';

function fixture(extra = {}, { uncommitted = {} } = {}) {
  const root = tmpSite({
    'index.md': INDEX, 'now.md': PAGE('Now'), 'work/a.md': PAGE('A.', '![A photo.](a/p.jpg)'), '404.md': PAGE('Not here.', '[index](index.md)'),
    'media.json': JSON.stringify(MEDIA), ...MEDIA_FILES, ...extra,
  }, { git: true });
  for (const [rel, data] of Object.entries(uncommitted)) fs.writeFileSync(path.join(root, 'content', rel), data);
  return root;
}
const run = (root) => build({ contentDir: path.join(root, 'content'), outDir: path.join(root, 'dist'), repoDir: root });
const read = (root, rel) => fs.readFileSync(path.join(root, 'dist', rel), 'utf8');
const pages = ['index.html', 'now/index.html', 'work/a/index.html', '404.html', 'extra/index.html'];

test('every page names its author', () => {
  for (const p of pages) assert.match(read(root, p), /<meta name="author" content="Luca Molluso">/, p);
});

test('a transparent .png photo builds, with a webp source and a png img', async () => {
  const media = { ...MEDIA, 'work/t/s.png': { kind: 'photo', width: 800, height: 400, master: 'x', variants: [{ file: 'work/t/s.800.webp', width: 800, bytes: 3, type: 'image/webp' }, { file: 'work/t/s.png', width: 800, bytes: 6, type: 'image/png' }] } };
  const r2 = fixture({ 'media.json': JSON.stringify(media), 'work/t.md': PAGE('T.', '![A cutout.](t/s.png)'), 'work/t/s.800.webp': bytes(3), 'work/t/s.png': bytes(6) });
  const res = await run(r2);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  const html = read(r2, 'work/t/index.html');
  assert.match(html, /<source type="image\/webp" srcset="\/work\/t\/s\.800\.webp 800w"/);
  assert.match(html, /<img src="\/work\/t\/s\.png"/);
  assert.ok(fs.existsSync(path.join(r2, 'dist/work/t/s.png')));
});

test('the home timeline: cards with covers from the linked pages, rows.js only where there is a row', async () => {
  const index = INDEX.replace('## Work\n\n- [A](work/a.md): Idea. (2026)\n- B: Later. (2025)\n',
    '## Timeline\n\n### 2022–2025: School.\n\n- [A](work/a.md): Idea.\n- [C](work/c.md): A loop.\n- [Now](now.md): Text only.\n- B: Later.\n');
  const r3 = fixture({ 'index.md': index, 'work/c.md': PAGE('C.', '![A loop.](a/clip.mp4)') });
  const res = await run(r3);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  const home = read(r3, 'index.html');
  assert.match(home, /<li class="card"><a href="\/work\/a\/"><span class="cover"><picture><source type="image\/avif" srcset="\/work\/a\/p\.800\.avif 800w"/);
  assert.match(home, /<span class="file">a\.md · sample<\/span>/, 'a sample page says so on its card');
  assert.match(home, /<li class="card"><a href="\/work\/c\/"><span class="cover"><picture><source type="image\/avif" srcset="\/work\/a\/clip\.avif 1920w"[^>]*><img src="\/work\/a\/clip\.jpg"/);
  assert.match(home, /<li class="card"><a href="\/now\/"><span class="cover"><\/span><span class="file">now\.md<\/span>/);
  assert.match(home, /<li class="card planned">/);
  assert.match(home, /<script type="module" src="\/assets\/rows\.js"><\/script>/);
  assert.doesNotMatch(read(r3, 'work/a/index.html'), /rows\.js/);
  assert.ok(fs.existsSync(path.join(r3, 'dist/assets/rows.js')));
});

let root;
let result;
before(async () => {
  root = fixture({}, { uncommitted: { 'extra.md': PAGE('Extra') } });
  result = await run(root);
});

test('outputs', () => {
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.equal(result.pages, 5);
  for (const f of [...pages, 'index.md', 'now.md', 'work/a.md', 'llms.txt', 'llms-full.txt', 'sitemap.xml', 'robots.txt', '.nojekyll',
    'assets/style.css', 'assets/main.js', 'assets/theme.js', 'assets/copy.js', 'assets/grain.js', 'assets/grain-core.mjs', 'assets/media.js',
    'assets/fonts/dm-sans.woff2', 'assets/fonts/OFL-DMSans.txt', 'favicon.svg', 'CNAME', ...Object.keys(MEDIA_FILES)])
    assert.ok(fs.existsSync(path.join(root, 'dist', f)), f);
  assert.match(read(root, 'assets/style.css'), /^\/\* Generated by scripts\/fonts\.py[\s\S]*--paper:#eff1f5/);
});

test('llms.txt is index.md byte for byte', () => {
  assert.ok(fs.readFileSync(path.join(root, 'dist/llms.txt')).equals(fs.readFileSync(path.join(root, 'content/index.md'))));
});

test('llms-full.txt: index first, then the cases in order, each with its source', () => {
  const full = read(root, 'llms-full.txt');
  const sources = [...full.matchAll(/^Source: (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(sources, ['https://lucamolluso.com/index.md', 'https://lucamolluso.com/work/a.md', 'https://lucamolluso.com/extra.md', 'https://lucamolluso.com/now.md']);
});

test('sitemap and robots', () => {
  const map = read(root, 'sitemap.xml');
  assert.match(map, /<loc>https:\/\/lucamolluso\.com\/<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  assert.ok(!map.includes('404'));
  assert.match(read(root, 'robots.txt'), /Sitemap: https:\/\/lucamolluso\.com\/sitemap\.xml/);
});

test('every page has the CSP and the hash matches HEAD_SCRIPT', () => {
  const hash = crypto.createHash('sha256').update(HEAD_SCRIPT).digest('base64');
  for (const p of pages) {
    const html = read(root, p);
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1];
    assert.ok(csp, p);
    assert.ok(csp.includes(`'sha256-${hash}'`), p);
    assert.match(csp, /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/);
    assert.ok(html.includes(`<script>${HEAD_SCRIPT}</script>`), p);
    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'), `${p}: CSP before any script`);
  }
});

test('assets and media are referenced from this site only', () => {
  for (const p of pages) {
    const html = read(root, p);
    for (const m of html.matchAll(/<(?:link|script|img|source|video)\b[^>]*>/g)) {
      if (/rel="canonical"/.test(m[0])) continue;
      for (const [, attr, value] of m[0].matchAll(/\b(src|href|poster)="([^"]*)"/g)) assert.match(value, /^\//, `${p}: ${attr}="${value}"`);
    }
  }
});

test('banner while fewer than three real cases', async () => {
  for (const p of pages) assert.match(read(root, p), /<div class="wip" role="note">/, p);
  const three = fixture({
    'index.md': INDEX.replace('- B: Later. (2025)', '- [B](work/b.md): Two. (2026)\n- [C](work/c.md): Three. (2026)'),
    'work/a.md': PAGE('A.'), 'work/b.md': PAGE('B.'), 'work/c.md': PAGE('C.'),
  });
  assert.equal((await run(three)).ok, true);
  assert.ok(!read(three, 'index.html').includes('class="wip"'));
});

test('status line: edits, sample, uncommitted', () => {
  assert.match(read(root, 'index.html'), /<footer class="status" id="status"><span><b>index\.md<\/b><\/span><span>1 edit<\/span><span>last edit [A-Z][a-z]{2} \d{1,2}, \d{4}<\/span><span><a href="https:\/\/github\.com\/stubfx\/portfolio\/commits\/main\/content\/index\.md"/);
  assert.match(read(root, 'work/a/index.html'), /<span>sample data<\/span><\/footer>/);
  assert.match(read(root, 'extra/index.html'), /<span>not committed yet<\/span>/);
});

test('head: title, description, canonical, alternate, Open Graph', () => {
  const a = read(root, 'work/a/index.html');
  assert.match(a, /<title>A · Luca Molluso<\/title>/);
  assert.match(a, /<meta name="description" content="d">/);
  assert.match(a, /<link rel="canonical" href="https:\/\/lucamolluso\.com\/work\/a\/">/);
  assert.match(a, /<link rel="alternate" type="text\/markdown" href="\/work\/a\.md">/);
  assert.match(a, /<meta property="og:image" content="https:\/\/lucamolluso\.com\/work\/a\/p\.jpg">/);
  assert.match(read(root, 'index.html'), /<title>Luca Molluso<\/title>[\s\S]*og:image" content="https:\/\/lucamolluso\.com\/work\/a\/clip\.jpg"/);
  assert.match(read(root, 'now/index.html'), /og:image" content="https:\/\/lucamolluso\.com\/og\.jpg"/);
  assert.match(a, /<a class="btn rawlink" href="\/work\/a\.md">raw<\/a>/);
  assert.match(a, /<div class="path" id="path"><a href="\/">lucamolluso\.com<\/a>\/work\/<b>a\.md<\/b><\/div>/);
});

test('media.js only where needed; JSON-LD only on home', () => {
  assert.match(read(root, 'index.html'), /<script type="module" src="\/assets\/media\.js"><\/script>/);
  assert.ok(!read(root, 'now/index.html').includes('media.js'));
  assert.ok(!read(root, 'work/a/index.html').includes('media.js'));
  const ld = /<script type="application\/ld\+json">([^<]+)<\/script>/.exec(read(root, 'index.html'));
  assert.equal(JSON.parse(ld[1]).jobTitle, 'Technical Artist');
  assert.ok(!read(root, 'now/index.html').includes('ld+json'));
  for (const p of pages) assert.match(read(root, p), /<script type="module" src="\/assets\/main\.js"><\/script>/);
});

test('a problem stops the build and leaves dist alone', async () => {
  const bad = fixture({ 'now.md': PAGE('Now', '[x](nope.md)') });
  fs.mkdirSync(path.join(bad, 'dist'));
  fs.writeFileSync(path.join(bad, 'dist/keep.txt'), 'x');
  const r = await run(bad);
  assert.equal(r.ok, false);
  assert.deepEqual({ file: r.problems[0].file, line: r.problems[0].line }, { file: 'content/now.md', line: 5 });
  assert.ok(fs.existsSync(path.join(bad, 'dist/keep.txt')));
});

test('linked files are published', async () => {
  const site = fixture({ 'cv.pdf': Buffer.from('%PDF-1.4'), 'work/a/direction.yaml': 'world: x\n', 'now.md': PAGE('Now', '[CV](cv.pdf) and [the direction file](work/a/direction.yaml)') });
  const r = await run(site);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.equal(read(site, 'cv.pdf'), '%PDF-1.4');
  assert.equal(read(site, 'work/a/direction.yaml'), 'world: x\n');
  assert.match(read(site, 'now/index.html'), /href="\/cv\.pdf"/);
});

test('a missing homepage stops the build with a problem', async () => {
  const site = fixture();
  fs.rmSync(path.join(site, 'content/index.md'));
  const r = await run(site);
  assert.equal(r.ok, false);
  assert.equal(r.problems[0].file, 'content/index.md');
});

test('the banner calls the content sample only while a page is sample', async () => {
  assert.match(read(root, 'index.html'), /Sample content and numbers for now\./);
  const real = fixture({ 'work/a.md': PAGE('A.') });
  assert.equal((await run(real)).ok, true);
  const html = read(real, 'index.html');
  assert.match(html, /<div class="wip" role="note">/);
  assert.ok(!html.includes('Sample content'), 'no page is sample');
});

test('a page with a world: its stylesheet in the world layer, its fonts preloaded, its colours, its script; other pages untouched', async () => {
  const css = ':root{--paper:#0a0a0a;--ink:#ffffff}\n@font-face{font-family:W;src:url("fonts/w.woff2") format("woff2")}\nh1{font-family:W}\n';
  const w = fixture({ 'work/a/world.css': css, 'work/a/world.js': 'export {};\n', 'work/a/fonts/w.woff2': bytes(7), 'work/a/fonts/ofl.txt': 'licence' });
  const res = await run(w);
  assert.equal(res.ok, true, JSON.stringify(res.problems));
  const html = read(w, 'work/a/index.html');
  assert.match(html, /<html lang="en" data-theme="day" class="world" data-world="a">/);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/style\.css">\n<link rel="stylesheet" href="\/work\/a\/world\.css">/);
  assert.match(html, /<link rel="preload" href="\/work\/a\/fonts\/w\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.doesNotMatch(html, /archivo-black\.woff2|dm-sans\.woff2/);
  assert.match(html, /<meta name="theme-color" content="#0a0a0a">/);
  assert.match(html, /<script type="module" src="\/work\/a\/world\.js"><\/script>/);
  assert.match(html, /<main class="page" id="page"><header class="s" data-s="intro"><h1 id="a">/);
  assert.match(html, /<figure data-m="p">/);
  assert.equal(read(w, 'work/a/world.css'), `@layer world{\n${css.trimEnd()}\n}\n`);
  for (const f of ['fonts/w.woff2', 'fonts/ofl.txt', 'world.js']) assert.ok(fs.existsSync(path.join(w, 'dist/work/a', f)), f);
  const now = read(w, 'now/index.html');
  assert.doesNotMatch(now, /class="world"|world\.css|world\.js|<header class="s"/);
  assert.match(now, /<html lang="en" data-theme="day">/);
  assert.match(now, /archivo-black\.woff2/);
  assert.match(now, /<meta name="theme-color" content="#eff1f5">/);
});
