import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSite } from '../lib/site.mjs';
import { validate, formatProblems } from '../lib/validate.mjs';

test('the real content is valid', () => {
  assert.equal(formatProblems(validate(loadSite({ contentDir: 'content', repoDir: '.' }))), '');
});
