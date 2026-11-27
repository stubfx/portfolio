// Test helper (not a test): throwaway sites in the temp dir, optionally as git repos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function git(root, ...args) {
  const r = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

/** Writes root/content/<path> for each entry (string, Buffer, or {size} for a sparse file). With git, commits it all. */
export function tmpSite(files, { git: commit = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  for (const [rel, data] of Object.entries(files)) {
    const p = path.join(root, 'content', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (data && typeof data === 'object' && !Buffer.isBuffer(data) && 'size' in data) {
      fs.writeFileSync(p, '');
      fs.truncateSync(p, data.size);
    } else fs.writeFileSync(p, data);
  }
  if (commit) {
    git(root, 'init', '-q');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'init');
  }
  return root;
}
