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
