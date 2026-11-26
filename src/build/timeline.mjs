import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { renderMarkdown } from './markdown.mjs';
import { contrastRatio } from './contrast.mjs';

const REQUIRED = ['title', 'slug', 'hash', 'branch', 'year'];
const DEFAULT_PALETTE = { bg: '#000000', fg: '#cdd6f4', accent: '#cba6f7' };

export function loadProjects(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data, body } = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
      for (const key of REQUIRED) {
        if (data[key] === undefined || data[key] === '') throw new Error(`Project file "${file}" is missing "${key}"`);
      }
      const palette = { ...DEFAULT_PALETTE, ...(data.palette || {}) };
      // fg is body text (AAA); accent is used for links, refs and the accent word (AA).
      for (const [k, min] of [['fg', 7], ['accent', 4.5]]) {
        const ratio = contrastRatio(palette[k], palette.bg);
        if (ratio < min) throw new Error(`Project "${data.slug}": ${k} on bg contrast ${ratio} is below ${min}`);
      }
      return {
        accent: '',
        tags: [],
        nda: false,
        cover: {},
        cells: {},
        order: 0,
        ...data,
        hash: String(data.hash),
        palette,
        html: renderMarkdown(body),
      };
    })
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export function buildTimeline({ commits, branches }, projects) {
  const branchNames = new Set(branches.map((b) => b.name));
  const bySlug = new Map(projects.map((p) => [p.slug, p]));
  const hashes = new Set();

  const rows = commits.map((c) => {
    if (hashes.has(c.hash)) throw new Error(`Log: duplicate hash "${c.hash}"`);
    hashes.add(c.hash);
    if (!branchNames.has(c.branch)) throw new Error(`Log: commit "${c.hash}" is on unknown branch "${c.branch}"`);
    if (c.kind !== 'project') return { ...c };
    const project = bySlug.get(c.project);
    if (!project) throw new Error(`Log: commit "${c.hash}" points at unknown project "${c.project}"`);
    if (project.hash !== c.hash) throw new Error(`Log: project "${c.project}" has hash "${project.hash}" but its commit is "${c.hash}"`);
    return { ...c, project };
  });

  const out = branches.map((b) => {
    for (const key of ['fork', 'merge']) {
      if (b[key] !== undefined && !hashes.has(b[key])) throw new Error(`Log: branch "${b.name}" has ${key} "${b[key]}", which is not a commit`);
    }
    return { label: b.name, ...b, color: `var(--b-${b.name})` };
  });

  return { rows, branches: out };
}
