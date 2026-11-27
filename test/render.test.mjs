import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../lib/parse.mjs';
import { renderBlocks, slug, anchors } from '../lib/render.mjs';

const photo = (name, width = 2400, height = 1200) => ({
  kind: 'photo', src: `/${name}.jpg`, width, height, narrow: height > width,
  avif: [800, 1600, 2400].map((w) => ({ src: `/${name}.${w}.avif`, w })),
  jpg: [800, 1600].map((w) => ({ src: `/${name}.${w}.jpg`, w })).concat({ src: `/${name}.jpg`, w: 2400 }),
});
const video = (kind, name) => ({
  kind, src: `/${name}.mp4`, width: 1920, height: 1080, poster: { jpg: `/${name}.jpg`, avif: `/${name}.avif` },
  sources: [{ src: `/${name}.av1.mp4`, type: 'video/mp4; codecs="av01.0.08M.08"' }, { src: `/${name}.mp4`, type: 'video/mp4; codecs="avc1.640028"' }],
});
const refs = {
  'p.jpg': photo('p'), 'q.jpg': photo('q'), 'tall.jpg': photo('tall', 800, 1200),
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
