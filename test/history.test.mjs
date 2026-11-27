import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tmpSite, git } from './_site.mjs';
import { fileHistory, commitExists } from '../lib/history.mjs';

test('counts edits across a rename', () => {
  const root = tmpSite({ 'a.md': '# A\n' }, { git: true });
  fs.appendFileSync(path.join(root, 'content/a.md'), '\n> d\n');
  git(root, 'commit', '-qam', 'edit');
  git(root, 'mv', 'content/a.md', 'content/b.md');
  git(root, 'commit', '-qm', 'rename');
  const h = fileHistory(root, 'content/b.md');
  assert.equal(h.edits, 3);
  assert.match(h.last, /^\d{4}-\d{2}-\d{2}$/);
});

test('untracked file and non-repo', () => {
  const root = tmpSite({ 'a.md': '# A\n' }, { git: true });
  fs.writeFileSync(path.join(root, 'content/new.md'), '# New\n');
  assert.deepEqual(fileHistory(root, 'content/new.md'), { edits: 0, last: null });
  assert.deepEqual(fileHistory(fs.mkdtempSync(path.join(os.tmpdir(), 'norepo-')), 'x.md'), { edits: 0, last: null });
});

test('commitExists', () => {
  const root = tmpSite({ 'a.md': '# A\n' }, { git: true });
  const head = git(root, 'rev-parse', '--short=7', 'HEAD');
  assert.equal(commitExists(root, head), true);
  assert.equal(commitExists(root, 'deadbee'), false);
  assert.equal(commitExists(root, 'not-a-hash'), false);
});
