import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve } from '../build.mjs';

function dist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
  fs.writeFileSync(path.join(dir, 'a.mp4'), Buffer.from([...Array(100).keys()]));
  fs.writeFileSync(path.join(dir, 'x.md'), '# X\n');
  fs.mkdirSync(path.join(dir, 'now'));
  fs.writeFileSync(path.join(dir, 'now/index.html'), '<p>now</p>');
  fs.writeFileSync(path.join(dir, '404.html'), '<p>gone</p>');
  return dir;
}

test('range requests, types, directories, 404', async () => {
  const s = await serve({ outDir: dist(), port: 0 });
  try {
    const r = await fetch(`${s.url}/a.mp4`, { headers: { Range: 'bytes=0-9' } });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get('content-type'), 'video/mp4');
    assert.equal(r.headers.get('content-range'), 'bytes 0-9/100');
    assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const md = await fetch(`${s.url}/x.md`);
    assert.equal(md.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.equal(await (await fetch(`${s.url}/now/`)).text(), '<p>now</p>');
    const missing = await fetch(`${s.url}/nope/`);
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), '<p>gone</p>');
    assert.equal((await fetch(`${s.url}/..%2f..%2fetc%2fpasswd`)).status, 404);
  } finally {
    await s.close();
  }
});
