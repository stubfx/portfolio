import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../lib/parse.mjs';

const fixture = `# Title

> The description.

A paragraph that
runs over two lines.

==The punch line.==

- one
- two

1. first
2. second

- [A case](work/a.md): An idea. (2026)
- Planned case: Later. (2025)

| # | Name |
|---|---|
| 1 | x |

![A caption.](work/a/hero.jpg)

\`\`\`logic
ME                          MACHINE
\`\`\`

---

<!-- a note
over two lines -->
`;

test('each block type', () => {
  const { blocks, errors } = parse(fixture);
  assert.deepEqual(errors, []);
  assert.deepEqual(blocks.map((b) => b.type),
    ['heading', 'quote', 'para', 'punch', 'list', 'list', 'files', 'table', 'media', 'code', 'hr', 'comment']);
});

test('blocks carry 1-based lines and their content', () => {
  const { blocks } = parse(fixture);
  const by = (t) => blocks.find((b) => b.type === t);
  assert.deepEqual(by('heading'), { type: 'heading', level: 1, text: 'Title', line: 1 });
  assert.deepEqual(by('quote'), { type: 'quote', text: 'The description.', line: 3 });
  assert.deepEqual(by('para'), { type: 'para', text: 'A paragraph that runs over two lines.', line: 5 });
  assert.deepEqual(by('punch'), { type: 'punch', text: 'The punch line.', line: 8 });
  assert.equal(blocks[5].ordered, true);
  assert.deepEqual(blocks[5].items.map((i) => [i.n, i.text]), [[1, 'first'], [2, 'second']]);
  assert.deepEqual(by('table'), { type: 'table', head: ['#', 'Name'], rows: [['1', 'x']], line: 19 });
  assert.deepEqual(by('media'), { type: 'media', alt: 'A caption.', src: 'work/a/hero.jpg', line: 23 });
  assert.deepEqual(by('code'), { type: 'code', lang: 'logic', lines: ['ME                          MACHINE'], line: 25 });
  assert.deepEqual(by('comment'), { type: 'comment', raw: '<!-- a note\nover two lines -->', text: 'a note\nover two lines', line: 31 });
});

test('file list: linked, planned, year', () => {
  const { blocks } = parse('- [A](a.md): Idea one. (2026)\n- B, still: Idea two. (2025)\n- [C](c.md): No year\n');
  assert.equal(blocks[0].type, 'files');
  assert.deepEqual(blocks[0].items.map(({ title, href, note, year }) => [title, href, note, year]),
    [['A', 'a.md', 'Idea one.', '2026'], ['B, still', null, 'Idea two.', '2025'], ['C', 'c.md', 'No year', null]]);
});

test('a list with no linked .md item stays a list', () => {
  assert.equal(parse('- Machine: tools\n- Me: decisions\n').blocks[0].type, 'list');
  assert.equal(parse('- [mail](mailto:a@b.c)\n- Rome.\n').blocks[0].type, 'list');
});

test('punch only when the paragraph is exactly ==text==', () => {
  assert.equal(parse('==Yes.==\n').blocks[0].type, 'punch');
  assert.equal(parse('Not ==this== one.\n').blocks[0].type, 'para');
});

test('outside the grammar fails with a line', () => {
  for (const [md, line, msg] of [
    ['# T\n\n#### Deep\n', 3, 'heading level'],
    ['- a\n  - nested\n', 2, 'nested'],
    ['<div>x</div>\n', 1, 'HTML'],
    ['```js\nx\n```\n', 1, 'language'],
    ['```\nx\n', 1, 'unclosed'],
    ['<!-- open\n', 1, 'unclosed'],
    ['* star\n', 1, 'use -'],
    ['![a](b.jpg) trailing\n', 1, 'alone'],
    ['    indented\n', 1, 'indented'],
    ['| a |\n| b |\n', 1, 'separator'],
  ]) {
    const { errors } = parse(md);
    assert.equal(errors[0]?.line, line, md);
    assert.match(errors[0].message, new RegExp(msg, 'i'), md);
  }
});

test('CRLF, BOM and trailing spaces parse like the clean file', () => {
  const clean = '# T\n\n> d\n\n- a\n';
  assert.deepEqual(parse('﻿# T  \r\n\r\n> d\r\n\r\n- a \r\n'), parse(clean));
});

test('wrapped list and quote lines continue the item', () => {
  assert.deepEqual(parse('- a\n  continued\n- b\n').blocks[0].items.map((i) => i.text), ['a continued', 'b']);
  assert.deepEqual(parse('1. a\nmore\n').blocks[0].items.map((i) => i.text), ['a more']);
  assert.equal(parse('> a\ncontinued\n').blocks[0].text, 'a continued');
  assert.equal(parse('- [A](a.md): Idea\n  goes on. (2026)\n').blocks[0].items[0].note, 'Idea goes on.');
});

test('an index list with an item that is not an index row fails', () => {
  const { errors } = parse('- [A](a.md): Idea. (2026)\n- just text\n');
  assert.equal(errors[0]?.line, 2);
  assert.match(errors[0].message, /index/i);
});

test('nothing may follow --> on its line', () => {
  assert.match(parse('<!-- a --> b\n').errors[0]?.message ?? '', /-->/);
});
