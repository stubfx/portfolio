import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../src/build/frontmatter.mjs';

test('scalars, lists, nested map, booleans, numbers', () => {
  const { data, body } = parseFrontmatter(`---
title: Configurator framework
accent: framework
nda: true
segmentHeight: 300
tags: [3d, luxury]
palette:
  bg: "#0b0d12"
  fg: "#e8e6e1"
---
Body here.`);
  assert.deepEqual(data, {
    title: 'Configurator framework', accent: 'framework', nda: true,
    segmentHeight: 300, tags: ['3d', 'luxury'], palette: { bg: '#0b0d12', fg: '#e8e6e1' },
  });
  assert.equal(body.trim(), 'Body here.');
});

test('no frontmatter returns empty data', () => {
  assert.deepEqual(parseFrontmatter('Hi').data, {});
  assert.equal(parseFrontmatter('Hi').body, 'Hi');
});

test('unterminated frontmatter throws', () => {
  assert.throws(() => parseFrontmatter('---\na: 1'), /frontmatter/);
});

test('quoted values keep colons and hashes; CRLF is tolerated', () => {
  const { data } = parseFrontmatter('---\r\ntitle: "Look: dev #2"\r\nyear: 2025\r\n---\r\nx');
  assert.deepEqual(data, { title: 'Look: dev #2', year: 2025 });
});
