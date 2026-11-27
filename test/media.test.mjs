import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpSite } from './_site.mjs';
import { LIMITS, MB, NAME_RE, parseEmbed, embedSrc, embedPosterKey, videoKind, mediaRef, loadManifest, checkManifest } from '../lib/media.mjs';

const photo = (key, bytes, extra = []) => ({
  kind: 'photo', width: 2400, height: 1200, master: 'x',
  variants: [{ file: key, width: 2400, bytes, type: 'image/jpeg' }, ...extra],
});
const loop = (key, bytes) => ({
  kind: 'video', width: 1920, height: 1080, duration: 10, audio: false, master: 'x',
  variants: [{ file: key, bytes, type: 'video/mp4; codecs="avc1.640028"' }],
  poster: { jpg: { file: key.replace('.mp4', '.jpg'), bytes: 1 }, avif: { file: key.replace('.mp4', '.avif'), bytes: 1 } },
});

test('embed URL forms', () => {
  assert.deepEqual(parseEmbed('https://youtu.be/abc_1-2'), { service: 'youtube', id: 'abc_1-2' });
  assert.deepEqual(parseEmbed('https://www.youtube.com/watch?v=abc&t=42'), { service: 'youtube', id: 'abc', start: 42 });
  assert.deepEqual(parseEmbed('https://www.youtube.com/watch?v=abc&t=1m2s'), { service: 'youtube', id: 'abc', start: 62 });
  assert.deepEqual(parseEmbed('https://vimeo.com/123'), { service: 'vimeo', id: '123' });
  assert.deepEqual(parseEmbed('https://vimeo.com/123/ff00aa'), { service: 'vimeo', id: '123', hash: 'ff00aa' });
  assert.equal(parseEmbed('https://dailymotion.com/x'), null);
  assert.equal(parseEmbed('http://youtu.be/abc'), null);
  assert.equal(parseEmbed('not a url'), null);
});

test('player URLs and poster keys', () => {
  assert.equal(embedSrc({ service: 'youtube', id: 'abc' }), 'https://www.youtube-nocookie.com/embed/abc?autoplay=1');
  assert.equal(embedSrc({ service: 'youtube', id: 'abc', start: 42 }), 'https://www.youtube-nocookie.com/embed/abc?autoplay=1&start=42');
  assert.equal(embedSrc({ service: 'vimeo', id: '123' }), 'https://player.vimeo.com/video/123?autoplay=1&dnt=1');
  assert.equal(embedSrc({ service: 'vimeo', id: '123', hash: 'ff' }), 'https://player.vimeo.com/video/123?autoplay=1&dnt=1&h=ff');
  assert.equal(embedPosterKey('work/x', { service: 'youtube', id: 'abc' }), 'work/x/youtube-abc.jpg');
  assert.equal(embedPosterKey('', { service: 'vimeo', id: '1' }), 'vimeo-1.jpg');
});

test('loop or player', () => {
  assert.equal(videoKind({ audio: false, duration: 30 }), 'loop');
  assert.equal(videoKind({ audio: false, duration: 31 }), 'player');
  assert.equal(videoKind({ audio: true, duration: 5 }), 'player');
});

test('file name rule', () => {
  for (const ok of ['hero.jpg', 'a-b_c.1600.avif', '01']) assert.ok(NAME_RE.test(ok), ok);
  for (const bad of ['My Hero.jpg', 'Hero.jpg', 'café.jpg', '-x', '.hidden']) assert.ok(!NAME_RE.test(bad), bad);
});

test('limits', () => {
  assert.deepEqual(LIMITS, { loop: 10 * MB, loopWarn: 6 * MB, player: 60 * MB, photo: 600 * 1024, total: 700 * MB });
});

test('loadManifest: empty without media.json', () => {
  assert.deepEqual(loadManifest(path.join(tmpSite({ 'a.md': '# A\n' }), 'content')), {});
});

test('manifest check: missing file, wrong size, unlisted media, over budget', () => {
  const manifest = {
    'work/x/a.jpg': photo('work/x/a.jpg', 10, [{ file: 'work/x/a.800.avif', width: 800, bytes: 3, type: 'image/avif' }]),
    'work/x/b.jpg': photo('work/x/b.jpg', 99),
    'work/x/big.mp4': loop('work/x/big.mp4', 11 * MB),
    'work/x/mid.mp4': loop('work/x/mid.mp4', 7 * MB),
  };
  const files = {
    'media.json': JSON.stringify(manifest),
    'work/x/a.jpg': Buffer.alloc(10), 'work/x/b.jpg': Buffer.alloc(10), 'work/x/stray.jpg': Buffer.alloc(5),
    'work/x/big.mp4': { size: 11 * MB }, 'work/x/mid.mp4': { size: 7 * MB },
  };
  for (const k of ['big', 'mid']) { files[`work/x/${k}.jpg`] = Buffer.alloc(1); files[`work/x/${k}.avif`] = Buffer.alloc(1); }
  const dir = path.join(tmpSite(files), 'content');
  const { errors, warnings } = checkManifest(loadManifest(dir), dir);
  const has = (list, file, m) => list.some((e) => e.file === file && e.message.includes(m));
  assert.ok(has(errors, 'work/x/a.800.avif', 'missing'), 'missing');
  assert.ok(has(errors, 'work/x/b.jpg', 'size changed'), 'size changed');
  assert.ok(has(errors, 'work/x/stray.jpg', 'not in media.json'), 'unlisted');
  assert.ok(has(errors, 'work/x/big.mp4', 'over 10 MB'), 'loop cap');
  assert.ok(has(warnings, 'work/x/mid.mp4', 'over 6 MB'), 'loop warning');
  assert.ok(!errors.some((e) => e.file === 'work/x/mid.mp4'), 'a 7 MB loop is only a warning');
  assert.ok(!errors.some((e) => e.file === 'media.json'), 'not over the total');
});

test('photo and player caps', () => {
  const player = { ...loop('p.mp4', 61 * MB), duration: 90 };
  const manifest = { 'big.jpg': photo('big.jpg', 601 * 1024), 'p.mp4': player };
  const dir = path.join(tmpSite({
    'media.json': JSON.stringify(manifest), 'big.jpg': { size: 601 * 1024 }, 'p.mp4': { size: 61 * MB },
    'p.jpg': Buffer.alloc(1), 'p.avif': Buffer.alloc(1),
  }), 'content');
  const { errors } = checkManifest(loadManifest(dir), dir);
  assert.ok(errors.some((e) => e.file === 'big.jpg' && e.message.includes('over 600 KB')));
  assert.ok(errors.some((e) => e.file === 'p.mp4' && e.message.includes('over 60 MB')));
});

test('total media budget', () => {
  const manifest = {};
  const files = {};
  for (let k = 0; k < 13; k++) {
    const key = `v${k}.mp4`;
    manifest[key] = { ...loop(key, 55 * MB), duration: 120 };
    files[key] = { size: 55 * MB };
    files[`v${k}.jpg`] = Buffer.alloc(1);
    files[`v${k}.avif`] = Buffer.alloc(1);
  }
  files['media.json'] = JSON.stringify(manifest);
  const dir = path.join(tmpSite(files), 'content');
  const { errors } = checkManifest(loadManifest(dir), dir);
  assert.ok(errors.some((e) => e.file === 'media.json' && e.message.includes('700 MB')));
});

test('mediaRef encodes and orders', () => {
  const manifest = {
    'work/x/clip.mp4': {
      kind: 'video', width: 1920, height: 1080, duration: 12, audio: false, master: 'x',
      variants: [{ file: 'work/x/clip.mp4', bytes: 1, type: 'video/mp4; codecs="avc1.640028"' }, { file: 'work/x/clip.av1.mp4', bytes: 1, type: 'video/mp4; codecs="av01.0.08M.08"' }],
      poster: { jpg: { file: 'work/x/clip.jpg', bytes: 1 }, avif: { file: 'work/x/clip.avif', bytes: 1 } },
    },
    'tall.jpg': {
      kind: 'photo', width: 800, height: 1200, master: 'x',
      variants: [{ file: 'tall.jpg', width: 800, bytes: 1, type: 'image/jpeg' }, { file: 'tall.800.avif', width: 800, bytes: 1, type: 'image/avif' }],
    },
  };
  const v = mediaRef(manifest, 'work/x/clip.mp4');
  assert.equal(v.kind, 'loop');
  assert.equal(v.src, '/work/x/clip.mp4');
  assert.match(v.sources[0].type, /av01/);
  assert.deepEqual(v.poster, { jpg: '/work/x/clip.jpg', avif: '/work/x/clip.avif' });
  const p = mediaRef(manifest, 'tall.jpg');
  assert.deepEqual(p, { kind: 'photo', src: '/tall.jpg', width: 800, height: 1200, narrow: true, avif: [{ src: '/tall.800.avif', w: 800 }], jpg: [{ src: '/tall.jpg', w: 800 }] });
  assert.equal(mediaRef(manifest, 'nope.jpg'), null);
});
