import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpSite } from './_site.mjs';
import { loadSite, pageUrl, isSample, realCases, resolveHref, resolveMedia } from '../lib/site.mjs';

const site = (files, opts) => {
  const root = tmpSite(files, opts);
  return loadSite({ contentDir: path.join(root, 'content'), repoDir: root });
};
const PAGE = (title, body = '') => `# ${title}\n\n> d\n\n${body}\n`;
const samplePhoto = {
  kind: 'photo', width: 10, height: 10, master: 'x', sample: true,
  variants: [{ file: 'work/b/p.jpg', width: 10, bytes: 1, type: 'image/jpeg' }],
};

test('pageUrl', () => {
  assert.equal(pageUrl('index.md'), '/');
  assert.equal(pageUrl('404.md'), '/404.html');
  assert.equal(pageUrl('now.md'), '/now/');
  assert.equal(pageUrl('work/a.md'), '/work/a/');
});

test('pages: title, description, urls, history', () => {
  const s = site({ 'index.md': '# Luca **Molluso**\n\n> A [line](now.md).\n', 'now.md': PAGE('Now') }, { git: true });
  const home = s.byPath.get('index.md');
  assert.equal(home.title, 'Luca Molluso');
  assert.equal(home.description, 'A line.');
  assert.equal(home.raw, '/index.md');
  assert.equal(home.file, 'content/index.md');
  assert.equal(home.history.edits, 1);
  assert.deepEqual(s.pages.map((p) => p.path), ['index.md', 'now.md']);
});

test('isSample: a sample comment or sample media', () => {
  const s = site({
    'work/a.md': PAGE('A', '<!-- Sample case. Numbers are placeholders. -->'),
    'work/b.md': PAGE('B', '![p](b/p.jpg)'),
    'work/c.md': PAGE('C', '<!-- Draft: not a sample marker -->'),
    'work/b/p.jpg': Buffer.alloc(1),
    'media.json': JSON.stringify({ 'work/b/p.jpg': samplePhoto }),
  });
  assert.equal(s.byPath.get('work/a.md').sample, true);
  assert.equal(s.byPath.get('work/b.md').sample, true);
  assert.equal(s.byPath.get('work/c.md').sample, false);
  assert.equal(isSample(s.byPath.get('work/c.md'), s.manifest), false);
});

test('realCases: linked, existing, not sample', () => {
  const s = site({
    'index.md': PAGE('Home', '## Work\n\n- [A](work/a.md): Real. (2026)\n- [B](work/b.md): Sample. (2026)\n- C: Planned. (2026)\n'),
    'work/a.md': PAGE('A'),
    'work/b.md': PAGE('B', '<!-- sample -->'),
  });
  assert.equal(realCases(s), 1);
});

test('resolveHref', () => {
  const s = site({
    'index.md': PAGE('Home'), 'now.md': PAGE('Now', '## Top'), 'work/x.md': PAGE('X', '## Here'), 'cv.pdf': Buffer.alloc(1),
  });
  const x = s.byPath.get('work/x.md');
  assert.deepEqual(pick(resolveHref(s, x, '../index.md')), { href: '/', external: false });
  assert.deepEqual(pick(resolveHref(s, x, '../now.md#top')), { href: '/now/#top', external: false });
  assert.deepEqual(pick(resolveHref(s, x, '#here')), { href: '#here', external: false });
  assert.deepEqual(pick(resolveHref(s, x, '../cv.pdf')), { href: '/cv.pdf', external: false });
  assert.deepEqual(pick(resolveHref(s, x, 'mailto:a@b.c')), { href: 'mailto:a@b.c', external: false });
  assert.deepEqual(pick(resolveHref(s, x, 'https://a.b/c')), { href: 'https://a.b/c', external: true });
  assert.match(resolveHref(s, x, 'nope.md').error, /nope\.md/);
  assert.match(resolveHref(s, x, '../now.md#nowhere').error, /#nowhere/);
  assert.match(resolveHref(s, x, '../../etc/passwd').error, /outside/);
});

test('resolveMedia: embeds need a poster; refs come from the manifest', () => {
  const poster = { ...samplePhoto, sample: undefined, variants: [{ file: 'work/youtube-abc.jpg', width: 10, bytes: 1, type: 'image/jpeg' }] };
  const s = site({ 'work/x.md': PAGE('X'), 'work/youtube-abc.jpg': Buffer.alloc(1), 'media.json': JSON.stringify({ 'work/youtube-abc.jpg': poster }) });
  const x = s.byPath.get('work/x.md');
  const { ref } = resolveMedia(s, x, 'https://youtu.be/abc');
  assert.equal(ref.kind, 'embed');
  assert.equal(ref.iframe, 'https://www.youtube-nocookie.com/embed/abc?autoplay=1');
  assert.equal(ref.poster.src, '/work/youtube-abc.jpg');
  assert.match(resolveMedia(s, x, 'https://youtu.be/zzz').error, /youtube-zzz\.jpg/);
});

function pick(r) { return r.error ? r : { href: r.href, external: r.external }; }
