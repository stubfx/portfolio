import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/build/markdown.mjs';

test('headings, paragraphs, emphasis, links, code', () => {
  assert.equal(renderMarkdown('## Look-dev\n\nA *soft* **pass** with `PBR` and [notes](/x).'),
    '<h2>Look-dev</h2>\n<p>A <em>soft</em> <strong>pass</strong> with <code>PBR</code> and <a href="/x">notes</a>.</p>');
});

test('lists', () => {
  assert.equal(renderMarkdown('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(renderMarkdown('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
});

test('image becomes figure with caption from alt', () => {
  assert.equal(renderMarkdown('![Final frame](/media/a.webp)'),
    '<figure><img src="/media/a.webp" alt="Final frame" loading="lazy"><figcaption>Final frame</figcaption></figure>');
});

test('escapes text', () => {
  assert.equal(renderMarkdown('a < b & "c"'), '<p>a &lt; b &amp; &quot;c&quot;</p>');
});

test('raw HTML block lines pass through', () => {
  assert.equal(renderMarkdown('<div class="x">hi</div>'), '<div class="x">hi</div>');
});

test('multi-line paragraph joins with spaces; code inside is not emphasised', () => {
  assert.equal(renderMarkdown('one\ntwo `a*b*c`'), '<p>one two <code>a*b*c</code></p>');
});
