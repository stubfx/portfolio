import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpSite } from './_site.mjs';
import { loadSite } from '../lib/site.mjs';
import { validate, formatProblems } from '../lib/validate.mjs';

const problems = (files) => {
  const root = tmpSite(files, { git: true });
  return validate(loadSite({ contentDir: path.join(root, 'content'), repoDir: root }));
};
const has = (ps, file, line, re) => ps.some((p) => p.file === file && p.line === line && re.test(p.message));

const RULES = [
  ['no H1', 'Just text.\n', 1, 'one H1'],
  ['two H1s', '# A\n\n> d\n\n# B\n', 5, 'one H1'],
  ['H1 not first', 'Text.\n\n# A\n\n> d\n', 1, 'first block'],
  ['no description', '# A\n\nText.\n', 3, 'blockquote'],
  ['two punch lines', '# A\n\n> d\n\n==x==\n\n==y==\n', 7, 'one punch'],
  ['empty alt', '# A\n\n> d\n\n![](p.jpg)\n', 5, 'alt'],
  ['.glb', '# A\n\n> d\n\n![m](m.glb)\n', 5, 'not a supported'],
  ['media not in manifest', '# A\n\n> d\n\n![p](p.jpg)\n', 5, 'media\\.mjs'],
  ['embed host', '# A\n\n> d\n\n![v](https://dailymotion.com/x)\n', 5, 'YouTube or Vimeo'],
  ['embed without poster', '# A\n\n> d\n\n![v](https://youtu.be/abc)\n', 5, 'youtube-abc\\.jpg'],
  ['broken link', '# A\n\n> d\n\n[x](nope.md)\n', 5, 'nope\\.md'],
  ['broken anchor', '# A\n\n> d\n\n[x](#nowhere)\n', 5, '#nowhere'],
  ['broken link in a file list', '# A\n\n> d\n\n- [X](work/x.md): Idea. (2026)\n', 5, 'work/x\\.md'],
  ['table columns', '# A\n\n> d\n\n| a | b |\n|---|---|\n| 1 |\n', 7, 'columns'],
  ['log format', '# A\n\n> d\n\n```log\nnot a commit line\n```\n', 6, 'log line'],
  ['log hash on a real page', '# A\n\n> d\n\n```log\ndeadbee  msg  Nov 1\n```\n', 6, 'deadbee'],
  ['inline italics', '# A\n\n> d\n\nAn *idea*.\n', 5, 'italics'],
  ['parse error', '# A\n\n> d\n\n#### Deep\n', 5, 'heading level'],
  ['timeline year with a hyphen', '# A\n\n> d\n\n## Timeline\n\n### 2022-2025: AANT.\n', 7, 'en dash'],
  ['timeline entry without a year', '# A\n\n> d\n\n## Timeline\n\n### Hired at IBM.\n', 7, '### YYYY: Title'],
];
for (const [name, md, line, msg] of RULES) {
  test(name, () => {
    const ps = problems({ 'x.md': md });
    assert.ok(has(ps, 'content/x.md', line, new RegExp(msg, 'i')), `${name}: ${formatProblems(ps)}`);
  });
}

test('a clean page has no problems', () => {
  assert.deepEqual(problems({ 'x.md': '# A\n\n> d\n\nText [self](#a).\n\n==One.==\n' }), []);
});

test('log hashes are not checked on sample pages', () => {
  assert.deepEqual(problems({ 'x.md': '# A\n\n> d\n\n```log\ndeadbee  msg  Nov 1\n```\n\n<!-- sample -->\n' }), []);
});

test('file names: lowercase letters, digits, dots, dashes', () => {
  const ps = problems({ 'work/My Case.md': '# A\n\n> d\n', 'work/café.md': '# B\n\n> d\n' });
  assert.ok(ps.some((p) => p.file === 'content/work/My Case.md' && /lowercase/.test(p.message)), formatProblems(ps));
  assert.ok(ps.some((p) => p.file === 'content/work/café.md' && /lowercase/.test(p.message)), formatProblems(ps));
});

test('parse errors and rule errors all come back in one run, sorted', () => {
  const ps = problems({ 'b.md': '# B\n\n> d\n\n[x](nope.md)\n', 'a.md': '# A\n\nText.\n\n#### Deep\n' });
  assert.ok(ps.length >= 3, formatProblems(ps));
  assert.deepEqual(ps.map((p) => `${p.file}:${p.line}`), ['content/a.md:3', 'content/a.md:5', 'content/b.md:5']);
});

test('manifest problems surface with the media file', () => {
  const ps = problems({ 'x.md': '# A\n\n> d\n', 'work/x/stray.jpg': Buffer.alloc(5) });
  assert.ok(has(ps, 'content/work/x/stray.jpg', 0, /not in media\.json/), formatProblems(ps));
});

test('formatProblems', () => {
  assert.equal(formatProblems([{ file: 'content/a.md', line: 3, message: 'm' }, { file: 'content/p.jpg', line: 0, message: 'n' }]),
    'content/a.md:3: m\ncontent/p.jpg: n');
});

test('dotfiles in content/ are ignored', () => {
  assert.deepEqual(problems({ 'x.md': '# A\n\n> d\n', '.DS_Store': Buffer.alloc(3), 'work/.x.md.swp': Buffer.alloc(3), '.hidden.md': 'junk' }), []);
});

test('a broken media.json is one clear problem, not a crash', () => {
  const ps = problems({ 'x.md': '# A\n\n> d\n\n![p](p.jpg)\n', 'p.jpg': Buffer.alloc(3), 'media.json': '{\n<<<<<<< HEAD\n' });
  assert.equal(ps.length, 1, formatProblems(ps));
  assert.equal(ps[0].file, 'content/media.json');
  assert.match(ps[0].message, /not valid JSON/);
});

test('the timeline rule only reads the Timeline section, on any page', () => {
  const outside = problems({ 'x.md': '# A\n\n> d\n\n## Work\n\n### Hired at IBM.\n' });
  assert.ok(!outside.some((p) => /YYYY/.test(p.message)), formatProblems(outside));
  const work = problems({ 'work/x.md': '# A\n\n> d\n\n## Timeline\n\n### Hired at IBM.\n\n## Then\n\n### Fine here.\n' });
  assert.ok(has(work, 'content/work/x.md', 7, /YYYY/), formatProblems(work));
  assert.ok(!has(work, 'content/work/x.md', 11, /YYYY/), 'after the section ends');
});

// A page's world: work/a/world.css beside work/a.md (docs/CONTENT.md section 9).
const OK = ':root{--paper:#000000}\n';
const world = (css, extra = {}) => problems({ 'work/a.md': '# A\n\n> d\n', 'work/a/world.css': css, ...extra });

test('a clean world has no problems', () => {
  assert.deepEqual(world(`${OK}@font-face{font-family:W;src:url("fonts/w.woff2") format("woff2")}\n/* .bar in a comment is fine */\n`,
    { 'work/a/fonts/w.woff2': 'x', 'work/a/fonts/ofl.txt': 'licence', 'work/a/world.js': 'export {};\n' }), []);
});

const WORLD_RULES = [
  ['world: @import', `${OK}@import url(x.css);\n`, 2, /@import/],
  ['world: a url to another site', `${OK}h1{background:url(https://x.com/a.png)}\n`, 2, /inside its own folder/],
  ['world: a url outside its folder', `${OK}h1{background:url('../b/a.png')}\n`, 2, /inside its own folder/],
  ['world: a url to a missing file', `${OK}\nh1{background:url(fonts/none.woff2)}\n`, 3, /no such file/],
  ['world: styling the header', `${OK}main h1, .bar .path{display:none}\n`, 2, /header/],
  ['world: no --paper colour', 'h1{color:red}\n', 1, /--paper/],
];
for (const [name, css, line, msg] of WORLD_RULES) {
  test(name, () => {
    const ps = world(css);
    assert.ok(has(ps, 'content/work/a/world.css', line, msg), `${name}: ${formatProblems(ps)}`);
  });
}

test('world: fonts need their licence beside them', () => {
  const ps = world(`${OK}@font-face{font-family:W;src:url(fonts/w.woff2)}\n`, { 'work/a/fonts/w.woff2': 'x' });
  assert.ok(has(ps, 'content/work/a/fonts/w.woff2', 0, /licen[cs]e/), formatProblems(ps));
});

test('world: a stylesheet or script without its page, a script without a stylesheet', () => {
  const ps = problems({ 'work/b/world.css': OK, 'work/a.md': '# A\n\n> d\n', 'work/a/world.js': 'export {};\n' });
  assert.ok(has(ps, 'content/work/b/world.css', 0, /work\/b\.md/), formatProblems(ps));
  assert.ok(has(ps, 'content/work/a/world.js', 0, /world\.css/), formatProblems(ps));
});
