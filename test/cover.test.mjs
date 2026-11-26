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
