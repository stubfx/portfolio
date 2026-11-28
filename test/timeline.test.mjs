import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../lib/parse.mjs';
import { timelineMask, entry } from '../lib/timeline.mjs';

test('the mask covers the blocks inside ## Timeline, not the heading, up to the next ## or #', () => {
  const { blocks } = parse('# T\n\n> d\n\n## Timeline\n\n### 2017: A.\n\nPara.\n\n- [X](x.md): n\n\n## Now\n\nNow.\n');
  assert.deepEqual(blocks.map((b) => b.type), ['heading', 'quote', 'heading', 'heading', 'para', 'files', 'heading', 'para']);
  assert.deepEqual(timelineMask(blocks), [false, false, false, true, true, true, false, false]);
  assert.deepEqual(timelineMask(parse('# T\n\n> d\n\n### 2017: A.\n').blocks), [false, false, false], 'no Timeline, no mask');
});

test('entry splits the year from the title: a year, a span, an open span', () => {
  assert.deepEqual(entry('2017: Hired at IBM.'), { year: '2017', title: 'Hired at IBM.' });
  assert.deepEqual(entry('2022–2025: AANT, BA in Art Direction.'), { year: '2022–2025', title: 'AANT, BA in Art Direction.' });
  assert.deepEqual(entry('2015–: Mods.'), { year: '2015–', title: 'Mods.' });
  assert.equal(entry('2022-2025: AANT.'), null, 'a hyphen is not an en dash');
  assert.equal(entry('Hired at IBM.'), null);
  assert.equal(entry('17: Short.'), null);
});
