import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, renderInline } from '../lib/inline.mjs';

const plain = (h) => ({ href: h, external: /^https?:/.test(h) });

test('strong, code, link; markers dropped', () => {
  const { nodes, errors } = parseInline('a **b** `c` [d](e.md)');
  assert.deepEqual(errors, []);
  assert.deepEqual(nodes.map((n) => n.t), ['text', 'strong', 'text', 'code', 'text', 'link']);
  assert.deepEqual(nodes[5], { t: 'link', text: 'd', href: 'e.md' });
});

test('code spans keep markup literally', () => {
  const { nodes, errors } = parseInline('`a==b *c* <d>`');
  assert.deepEqual(errors, []);
  assert.equal(nodes[0].v, 'a==b *c* <d>');
});

test('escapes', () => {
  assert.equal(parseInline('\\*x\\* \\[y\\]').nodes[0].v, '*x* [y]');
});

test('rejected inline', () => {
  for (const [s, msg] of [
    ['*em*', 'italics'], ['_em_', 'italics'], ['a ==b== c', 'punch'], ['<b>x</b>', 'HTML'],
    ['**open', 'unclosed'], ['[x](javascript:alert(1))', 'scheme'], ['[x](data:text/html,1)', 'scheme'],
  ]) assert.match(parseInline(s).errors.join(' '), new RegExp(msg, 'i'), s);
});

test('snake_case is not italics', () => {
  assert.deepEqual(parseInline('file_name_here').errors, []);
});

test('allowed schemes', () => {
  for (const href of ['https://a.b', 'http://a.b', 'mailto:a@b.c', 'now.md', '../index.md', '#work'])
    assert.deepEqual(parseInline(`[x](${href})`).errors, [], href);
});

test('renderInline escapes and marks external links', () => {
  const html = renderInline(parseInline('<&> [x](https://a.b) [y](now.md) **b** `<c>`').nodes, plain);
  assert.match(html, /^&lt;&amp;&gt; /);
  assert.match(html, /<a href="https:\/\/a\.b" target="_blank" rel="noopener">x<\/a>/);
  assert.match(html, /<a href="now\.md">y<\/a>/);
  assert.match(html, /<strong>b<\/strong> <code>&lt;c&gt;<\/code>$/);
});

test('renderInline escapes quotes inside hrefs', () => {
  const html = renderInline([{ t: 'link', text: 'q', href: 'a"b.md' }], plain);
  assert.match(html, /href="a&quot;b\.md"/);
});
