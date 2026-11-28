import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../lib/parse.mjs';
import { renderBlocks, slug, anchors } from '../lib/render.mjs';

const photo = (name, width = 2400, height = 1200) => ({
  kind: 'photo', src: `/${name}.jpg`, width, height, narrow: height > width,
  modern: [{ type: 'image/avif', set: [800, 1600, 2400].map((w) => ({ src: `/${name}.${w}.avif`, w })) }],
  fallback: [800, 1600].map((w) => ({ src: `/${name}.${w}.jpg`, w })).concat({ src: `/${name}.jpg`, w: 2400 }),
});
const cutout = (name) => ({
  kind: 'photo', src: `/${name}.png`, width: 1600, height: 800, narrow: false, transparent: true,
  modern: [{ type: 'image/webp', set: [{ src: `/${name}.800.webp`, w: 800 }, { src: `/${name}.1600.webp`, w: 1600 }] }],
  fallback: [{ src: `/${name}.png`, w: 1600 }],
});
const video = (kind, name) => ({
  kind, src: `/${name}.mp4`, width: 1920, height: 1080, poster: { jpg: `/${name}.jpg`, avif: `/${name}.avif` },
  sources: [{ src: `/${name}.av1.mp4`, type: 'video/mp4; codecs="av01.0.08M.08"' }, { src: `/${name}.mp4`, type: 'video/mp4; codecs="avc1.640028"' }],
});
const refs = {
  'p.jpg': photo('p'), 'q.jpg': photo('q'), 'tall.jpg': photo('tall', 800, 1200), 'cut.png': cutout('cut'),
  'l.mp4': video('loop', 'l'), 'long.mp4': video('player', 'long'),
  'https://youtu.be/abc': { kind: 'embed', service: 'youtube', url: 'https://youtu.be/abc', iframe: 'https://www.youtube-nocookie.com/embed/abc?autoplay=1', poster: photo('youtube-abc', 1280, 720) },
  'https://vimeo.com/1': { kind: 'embed', service: 'vimeo', url: 'https://vimeo.com/1', iframe: 'https://player.vimeo.com/video/1?autoplay=1&dnt=1', poster: photo('vimeo-1', 1280, 720) },
};
const ctx = { link: (h) => ({ href: h.replace(/\.md$/, '/'), external: /^https?:/.test(h) }), media: (b) => refs[b.src] ?? null };
const r = (md) => renderBlocks(parse(md).blocks, ctx);
const media = (src, alt = 'Cap') => renderBlocks([{ type: 'media', alt, src, line: 1 }], ctx);

test('heading with hanging marker and id', () => {
  assert.equal(r('## Work\n'), '<h2 id="work"><span class="mk hang" aria-hidden="true">##</span>Work</h2>');
});

test('duplicate headings get unique ids', () => {
  assert.deepEqual(anchors(parse('## A\n\n## A\n\n### A b!\n').blocks), ['a', 'a-2', 'a-b']);
  assert.match(r('## A\n\n## A\n'), /id="a-2"/);
});

test('slug', () => {
  assert.equal(slug('Before the machines'), 'before-the-machines');
  assert.equal(slug('Café, déjà vu!'), 'cafe-deja-vu');
  assert.equal(slug('**Bold** [link](x.md)'), 'bold-link');
});

test('quote, paragraph, punch', () => {
  assert.equal(r('> A **b**.\n'), '<blockquote><span class="mk hang" aria-hidden="true">&gt;</span>A <strong>b</strong>.</blockquote>');
  assert.equal(r('Text [now](now.md).\n'), '<p>Text <a href="now/">now</a>.</p>');
  assert.equal(r('==Big.==\n'), '<p class="punch"><span class="mk" aria-hidden="true">==</span><mark>Big.</mark><span class="mk" aria-hidden="true">==</span></p>');
});

test('lists with hanging markers', () => {
  assert.equal(r('- a\n- b\n'), '<ul><li><span class="mk hang" aria-hidden="true">-</span>a</li><li><span class="mk hang" aria-hidden="true">-</span>b</li></ul>');
  assert.equal(r('1. a\n2. b\n'), '<ol><li><span class="mk hang" aria-hidden="true">1.</span>a</li><li><span class="mk hang" aria-hidden="true">2.</span>b</li></ol>');
});

test('file list renders the index table', () => {
  const html = r('- [A](a.md): Idea. (2026)\n- B: Later. (2025)\n');
  assert.match(html, /^<div class="tbl index"><table>/);
  assert.match(html, /<th class="c0">#<\/th><th class="c1">case<\/th><th class="c2">idea<\/th><th class="c3">year<\/th>/);
  assert.match(html, /<td class="c0"><span class="mk hang" aria-hidden="true">-<\/span>01<\/td><td class="c1"><a href="a\/">A<\/a><\/td><td class="c2">Idea\.<\/td><td class="c3">2026<\/td>/);
  assert.match(html, /<td class="c0"><span class="mk hang" aria-hidden="true">-<\/span>02<\/td><td class="c1"><span class="planned">B<\/span><\/td><td class="c2">Later\.<\/td><td class="c3">2025<\/td>/);
});

test('table with hanging bar', () => {
  assert.equal(r('| a | b |\n|---|---|\n| 1 | **2** |\n'),
    '<div class="tbl"><span class="mk hang" aria-hidden="true">|</span><table><thead><tr><th class="c0">a</th><th class="c1">b</th></tr></thead>'
    + '<tbody><tr><td class="c0">1</td><td class="c1"><strong>2</strong></td></tr></tbody></table></div>');
});

test('code blocks: fences visible, lanes and keys coloured', () => {
  const logic = r('```logic\nME                          MACHINE\n```\n');
  assert.equal(logic, '<div class="code"><div class="fence" aria-hidden="true">```logic</div><pre>ME                          <span class="m">MACHINE</span></pre><div class="fence" aria-hidden="true">```</div></div>');
  assert.match(r('```yaml\nkey: <v>\n```\n'), /<pre><span class="k">key:<\/span> &lt;v&gt;<\/pre>/);
  assert.match(r('```log\na3f9c21  msg here  Nov 21\n```\n'), /<pre><span class="k">a3f9c21<\/span>  msg here  <span class="k">Nov 21<\/span><\/pre>/);
});

test('rule and comment', () => {
  assert.equal(r('---\n'), '<div class="hr" aria-hidden="true">---</div>');
  assert.equal(r('<!-- a <b> -->\n'), '<p class="comment">&lt;!-- a &lt;b&gt; --&gt;</p>');
});

test('photo: picture with avif and jpg srcsets, caption shows the line', () => {
  const html = media('p.jpg');
  assert.match(html, /^<figure><figcaption aria-hidden="true"><span class="mk">!\[<\/span><span class="alt">Cap<\/span><span class="mk">\]\(<\/span>p\.jpg<span class="mk">\)<\/span><\/figcaption><picture>/);
  assert.match(html, /<source type="image\/avif" srcset="\/p\.800\.avif 800w, \/p\.1600\.avif 1600w, \/p\.2400\.avif 2400w" sizes="[^"]+">/);
  assert.match(html, /<img src="\/p\.jpg" srcset="\/p\.800\.jpg 800w, \/p\.1600\.jpg 1600w, \/p\.jpg 2400w" sizes="[^"]+" alt="Cap" width="2400" height="1200" loading="eager" fetchpriority="high" decoding="async"><\/picture><\/figure>$/);
});

test('transparent photo: a webp source and a png img, nothing flattened', () => {
  const html = media('cut.png');
  assert.match(html, /<source type="image\/webp" srcset="\/cut\.800\.webp 800w, \/cut\.1600\.webp 1600w" sizes="[^"]+">/);
  assert.doesNotMatch(html, /image\/avif/);
  assert.match(html, /<img src="\/cut\.png" srcset="\/cut\.png 1600w"/);
  assert.match(html, /^<figure class="cutout">/, 'no placeholder box behind what should show through');
});

test('portrait-orientation photo is narrow', () => {
  assert.match(media('tall.jpg'), /^<figure class="narrow">/);
});

test('the first media block is eager, the rest lazy', () => {
  const html = r('![a](p.jpg)\n\n![b](q.jpg)\n');
  assert.equal((html.match(/loading="eager" fetchpriority="high"/g) || []).length, 1);
  assert.ok(html.indexOf('loading="eager"') < html.indexOf('loading="lazy"'));
});

test('loop: muted loop playsinline controls, av1 source first, poster', () => {
  const html = media('l.mp4', 'Turn');
  assert.match(html, /<video class="loop" muted loop playsinline preload="metadata" controls poster="\/l\.jpg" width="1920" height="1080" aria-label="Turn">/);
  assert.match(html, /<source src="\/l\.av1\.mp4" type="video\/mp4; codecs=&quot;av01\.0\.08M\.08&quot;"><source src="\/l\.mp4" type="video\/mp4; codecs=&quot;avc1\.640028&quot;"><\/video>/);
  assert.ok(html.indexOf('av01') < html.indexOf('avc1'));
});

test('player: preload none, controls, never autoplay', () => {
  const html = media('long.mp4', 'Walk');
  assert.match(html, /<video class="player" preload="none" controls poster="\/long\.jpg" width="1920" height="1080" aria-label="Walk">/);
  assert.ok(!/autoplay|muted|loop/.test(html));
});

test('embed: a link to the video with poster, play mark and tag', () => {
  const html = media('https://youtu.be/abc', 'Film');
  assert.match(html, /<a class="embed" href="https:\/\/youtu\.be\/abc" data-embed="https:\/\/www\.youtube-nocookie\.com\/embed\/abc\?autoplay=1" data-title="Film" aria-label="Play: Film \(YouTube\)">/);
  assert.match(html, /<img src="\/youtube-abc\.jpg"[^>]* alt=""/);
  assert.match(html, /<span class="play" aria-hidden="true">▶<\/span><span class="tag" aria-hidden="true">YouTube · loads on play<\/span><\/a>/);
  assert.match(media('https://vimeo.com/1', 'V'), /data-embed="https:\/\/player\.vimeo\.com\/video\/1\?autoplay=1&amp;dnt=1"[^>]*aria-label="Play: V \(Vimeo\)"[\s\S]*Vimeo · loads on play/);
});

test('special characters are escaped in text and attributes', () => {
  const alt = `"<&>' 🙂`;
  const html = media('p.jpg', alt);
  assert.match(html, /alt="&quot;&lt;&amp;&gt;&#39; 🙂"/);
  assert.match(html, /<span class="alt">&quot;&lt;&amp;&gt;&#39; 🙂<\/span>/);
  const embed = media('https://youtu.be/abc', alt);
  assert.match(embed, /data-title="&quot;&lt;&amp;&gt;&#39; 🙂"/);
  assert.match(embed, /aria-label="Play: &quot;&lt;&amp;&gt;&#39; 🙂 \(YouTube\)"/);
  assert.match(r('- [<A&>](a.md): "Q" & <R>. (2026)\n'), /<a href="a\/">&lt;A&amp;&gt;<\/a><\/td><td class="c2">&quot;Q&quot; &amp; &lt;R&gt;\.<\/td>/);
});

test('heading ids never collide with the page shell', () => {
  assert.deepEqual(anchors(parse('## Raw\n\n## Status\n\n## Page\n\n## Work\n').blocks), ['raw-2', 'status-2', 'page-2', 'work']);
});

const cardCtx = { ...ctx, card: (h) => ({ href: h.replace(/\.md$/, '/'), file: h.split('/').pop(), sample: h.endsWith('s.md'), cover: h.endsWith('x.md') ? photo('cov', 1600, 1200) : h.endsWith('w.md') ? photo('wide', 2400, 900) : null }) };
const rt = (md) => renderBlocks(parse(md).blocks, cardCtx);

test('timeline: each ### YEAR: Title is an entry, the year beside it, closed before the next entry or section', () => {
  const html = rt('## Timeline\n\n### 2017: Hired at IBM.\n\nMods got me in.\n\n### 2015–: Mods.\n\nPocket money.\n\n## Now\n\nNow.\n');
  assert.match(html, /<section class="entry"><p class="when" aria-hidden="true">2017<\/p><h3 id="2017-hired-at-ibm"><span class="mk hang" aria-hidden="true">###<\/span><span class="vh">2017: <\/span>Hired at IBM\.<\/h3><p>Mods got me in\.<\/p><\/section>/);
  assert.match(html, /<section class="entry"><p class="when" aria-hidden="true">2015–<\/p><h3 id="2015-mods">.*?Mods\.<\/h3><p>Pocket money\.<\/p><\/section><h2 id="now">/);
});

test('timeline: a file list is a row of cards; the cover comes from the linked page; planned and cover-less cards are text', () => {
  const html = rt('## Timeline\n\n### 2022–2025: AANT.\n\n- [X](work/x.md): The idea.\n- [Y](work/y.md): No media.\n- Z: Not written yet.\n');
  assert.match(html, /<div class="row"><ul class="cards">/);
  assert.match(html, /<li class="card"><a href="work\/x\/"><span class="cover"><picture><source type="image\/avif" srcset="[^"]+" sizes="\(min-width: 720px\) 22rem, 72vw"><img src="\/cov\.jpg"[^>]* alt=""[^>]* loading="lazy"[^>]*><\/picture><\/span><span class="file">x\.md<\/span><span class="title">X<\/span><span class="note">The idea\.<\/span><\/a><\/li>/);
  assert.match(html, /<li class="card"><a href="work\/y\/"><span class="cover"><\/span><span class="file">y\.md<\/span><span class="title">Y<\/span>/);
  assert.match(html, /<li class="card planned"><span class="cover"><\/span><span class="title">Z<\/span><span class="note">Not written yet\.<\/span><\/li>/);
  assert.match(html, /<\/ul><button class="row-btn prev" type="button" aria-label="Scroll left">◀<\/button><button class="row-btn next" type="button" aria-label="Scroll right">▶<\/button><\/div><\/section>$/);
  assert.doesNotMatch(html, /tbl index/);
});

test('cards: a sample page says so; a wide cover, cropped to 4:3, asks for a larger file', () => {
  const html = rt('## Timeline\n\n### 2026: Now.\n\n- [S](work/s.md): A sample.\n- [W](work/w.md): Wide.\n- [X](work/x.md): Four by three.\n');
  assert.match(html, /<span class="file">s\.md · sample<\/span>/);
  assert.match(html, /<span class="file">x\.md<\/span>/);
  assert.match(html, /srcset="\/wide\.800\.avif[^"]*" sizes="\(min-width: 720px\) calc\(22rem \* 2\.00\), calc\(72vw \* 2\.00\)"/);
  assert.match(html, /srcset="\/cov\.800\.avif[^"]*" sizes="\(min-width: 720px\) 22rem, 72vw"/);
});

// A page with a world (docs/DESIGN.md section 10): hooks for its stylesheet.
const rw = (md) => renderBlocks(parse(md).blocks, ctx, { world: true });

test('world pages: the intro is a header, each ## opens a section named by its id', () => {
  const html = rw('# T\n\n> d\n\n![Cap](p.jpg)\n\n## The app\n\nText.\n\n### Small\n\n## Lives\n\n==One.==\n');
  assert.match(html, /^<header class="s" data-s="intro"><h1 id="t">.*?<\/figure><\/header><section class="s" data-s="the-app"><h2 id="the-app">.*?<p>Text\.<\/p><h3 id="small">.*?<\/h3><\/section><section class="s" data-s="lives"><h2 id="lives">.*?<\/p><\/section>$/);
});

test('world pages: figures carry their file name', () => {
  const html = rw('# T\n\n> d\n\n![C](p.jpg)\n\n![C](tall.jpg)\n\n![C](cut.png)\n\n![C](l.mp4)\n\n![C](https://vimeo.com/1)\n');
  for (const [n, cls] of [['p', ''], ['tall', ' class="narrow"'], ['cut', ' class="cutout"'], ['l', ''], ['vimeo-1', '']]) assert.match(html, new RegExp(`<figure data-m="${n}"${cls}><figcaption`), n);
});

test('world pages: a timeline entry closes before its section', () => {
  assert.match(rw('# T\n\n> d\n\n## Timeline\n\n### 2017: IBM.\n\nText.\n\n## Next\n'), /<p>Text\.<\/p><\/section><\/section><section class="s" data-s="next">/);
});

test('other pages keep the flat markup', () => {
  assert.doesNotMatch(r('# T\n\n> d\n\n![C](p.jpg)\n\n## A\n\nText.\n'), /<section|<header|data-m=/);
});
