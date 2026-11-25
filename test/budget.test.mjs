import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { measure } from '../scripts/budget.mjs';

test('budgets', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'budget-'));
  await build({ outDir: tmp });
  const m = measure(tmp);
  assert.ok(m.homeJsGzip > 1000, `home js measured ${m.homeJsGzip}`);
  assert.ok(m.homeJsGzip <= 25 * 1024, `home js ${m.homeJsGzip}`);
  assert.ok(m.fontsBytes <= 120 * 1024, `fonts ${m.fontsBytes}`);
});

test('measure counts font files', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'fonts-'));
  mkdirSync(join(tmp, 'fonts'));
  mkdirSync(join(tmp, 'assets'));
  writeFileSync(join(tmp, 'fonts', 'a.woff2'), Buffer.alloc(1000));
  writeFileSync(join(tmp, 'fonts', 'fonts.css'), 'x');
  assert.equal(measure(tmp).fontsBytes, 1000);
});

test('no dependencies', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});
