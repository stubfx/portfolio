// History from git: edit counts and dates for the status line, commit checks for log blocks.
// The site's build calls `git` directly (Luca's exemption from the machine's gitt rule).
import { spawnSync } from 'node:child_process';

const run = (repoDir, args) => spawnSync('git', args, { cwd: repoDir, encoding: 'utf8' });

/** @returns {{edits: number, last: string|null}} last is YYYY-MM-DD; a file with no commits (or no repo) has none. */
export function fileHistory(repoDir, relPath) {
  const r = run(repoDir, ['log', '--follow', '--format=%h|%cs', '--', relPath]);
  if (r.status !== 0 || r.error) return { edits: 0, last: null };
  const lines = r.stdout.split('\n').filter(Boolean);
  return { edits: lines.length, last: lines.length ? lines[0].split('|')[1] : null };
}

export function commitExists(repoDir, hash) {
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) return false;
  const r = run(repoDir, ['cat-file', '-e', `${hash}^{commit}`]);
  return r.status === 0 && !r.error;
}
