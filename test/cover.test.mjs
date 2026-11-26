import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCover } from '../src/build/cover.mjs';

const fixture = {
  title: 'Test project', accent: 'project', slug: 'test-project', hash: 'abc1234', branch: 'main', year: 2020,
  tags: ['3d'], palette: { bg: '#000000', fg: '#cdd6f4', accent: '#cba6f7' }, cover: {},
  cells: { Role: 'developer' }, html: '<p>Lede.</p>',
};

test('cover modes', () => {
  assert.match(renderCover(fixture, { mode: 'attachment' }), /^<a class="pc-att"/);
  assert.throws(() => renderCover(fixture, { mode: 'seg' }), /Unknown cover mode "seg"/);
});

test('attachment name starts with the chip text, escaped (WCAG 2.5.3)', () => {
  const html = renderCover({ ...fixture, title: 'Rock & "roll"' }, { mode: 'attachment' });
  assert.ok(html.includes(' aria-label="git show abc1234: open Rock &amp; &quot;roll&quot;">'), html.slice(0, 220));
  assert.match(html, /<span class="pc-chip" aria-hidden="true">git show abc1234<\/span><\/a>$/);
});
