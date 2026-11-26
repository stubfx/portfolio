import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as log from '../content/log.mjs';
import { loadProjects, buildTimeline } from '../src/build/timeline.mjs';
import { renderInline } from '../src/build/markdown.mjs';

const projectFile = (fm) => {
  const dir = mkdtempSync(join(tmpdir(), 'proj-'));
  writeFileSync(join(dir, 'p.md'), `---\n${fm}\n---\nBody.`);
  return dir;
};

test('rows keep log order and attach projects', () => {
  const t = buildTimeline(log, loadProjects('content/projects'));
  assert.equal(t.rows[0].hash, 'HEAD');
  assert.equal(t.rows.at(-1).kind, 'root');
  assert.equal(t.rows.find((r) => r.kind === 'project' && r.project.slug === 'configurator-framework').project.nda, true);
  assert.equal(t.branches.find((b) => b.name === 'school').merge, '4d01c9a');
});

test('validation errors name the problem', () => {
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }], commits: [{ hash: 'a', branch: 'nope', kind: 'big' }] }, []), /unknown branch "nope"/);
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }], commits: [{ hash: 'a', branch: 'main', kind: 'project', project: 'x' }] }, []), /unknown project "x"/);
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }, { name: 'b', merge: 'zz' }], commits: [{ hash: 'a', branch: 'main', kind: 'big' }] }, []), /merge "zz"/);
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }], commits: [{ hash: 'a', branch: 'main', kind: 'big' }, { hash: 'a', branch: 'main', kind: 'big' }] }, []), /duplicate hash "a"/);
});

test('project hash must match the commit that points at it', () => {
  const projects = loadProjects(projectFile('title: P\nslug: p\nhash: 111\nbranch: main\nyear: 2020'));
  assert.throws(() => buildTimeline({ branches: [{ name: 'main' }], commits: [{ hash: '222', branch: 'main', kind: 'project', project: 'p' }] }, projects), /project "p" has hash "111"/);
});

test('project defaults', () => {
  const p = loadProjects('test/fixtures/minimal-project')[0];
  assert.deepEqual(p.palette, { bg: '#000000', fg: '#cdd6f4', accent: '#cba6f7' });
  assert.equal('segmentHeight' in p, false);
  assert.deepEqual(p.cover, {});
  assert.deepEqual(p.tags, []);
  assert.equal(p.nda, false);
  assert.match(p.html, /<p>/);
});

test('project files must have required fields and a readable palette', () => {
  assert.throws(() => loadProjects(projectFile('title: P\nhash: 1\nbranch: main\nyear: 2020')), /p\.md.*missing "slug"/);
  assert.throws(() => loadProjects(projectFile('title: P\nslug: p\nhash: 1\nbranch: main\nyear: 2020\npalette:\n  bg: "#000000"\n  fg: "#333333"')), /contrast/);
});

test('inline markdown renders the accent word', () => {
  assert.equal(renderInline('This *site* & more'), 'This <em>site</em> &amp; more');
});

test('project body text must reach AAA (7:1) on its own background', () => {
  // #8a8a8a on #000000 is about 6.2:1: fine for AA, not for body text.
  assert.throws(() => loadProjects(projectFile('title: P\nslug: p\nhash: 1\nbranch: main\nyear: 2020\npalette:\n  bg: "#000000"\n  fg: "#8a8a8a"\n  accent: "#cba6f7"')), /fg on bg contrast .* below 7/);
});
