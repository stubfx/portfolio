// The built /llms.txt read the way the llms.txt reference parser reads it: sections by "## ", file lists by its item pattern.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpSite } from './_site.mjs';
import { build } from '../build.mjs';

const ITEM = /^-\s*\[(?<title>[^\]]+)\]\((?<url>[^)]+)\)(?::\s*(?<desc>.*))?$/;

function sections(txt) {
  const out = {};
  let cur = null;
  for (const line of txt.split('\n')) {
    if (line.startsWith('## ')) { cur = line.slice(3).trim(); out[cur] = []; continue; }
    const m = cur && ITEM.exec(line.trim());
    if (m) out[cur].push({ ...m.groups });
  }
  return out;
}

test('Work and Contact parse as file lists', async () => {
  const root = tmpSite({
    'index.md': '# Luca Molluso\n\n> Technical artist.\n\n## Work\n\n- [A](work/a.md): An idea. (2026)\n- B: Planned. (2025)\n\n'
      + '## Now\n\nTwo lines. [More](now.md)\n\n## Contact\n\n- [info@lucamolluso.com](mailto:info@lucamolluso.com)\n- [linkedin.com/in/luca-molluso](https://www.linkedin.com/in/luca-molluso)\n- Rome. Open to remote.\n',
    'now.md': '# Now\n\n> d\n', 'work/a.md': '# A.\n\n> d\n',
  }, { git: true });
  const r = await build({ contentDir: path.join(root, 'content'), outDir: path.join(root, 'dist'), repoDir: root });
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  const s = sections(fs.readFileSync(path.join(root, 'dist/llms.txt'), 'utf8'));
  assert.deepEqual(s.Work, [{ title: 'A', url: 'work/a.md', desc: 'An idea. (2026)' }]);
  assert.deepEqual(s.Contact.map((i) => i.url), ['mailto:info@lucamolluso.com', 'https://www.linkedin.com/in/luca-molluso']);
  assert.deepEqual(s.Now, []);
});
