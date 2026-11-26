// The home page's worlds: while a project or work entry is the current row, the page behind the log
// takes on that entry's colours (docs/superpowers/specs/2026-11-26-worlds-design.md).
// One fixed layer per distinct world; rows with the same colours share it, so both IBM rows are one world.
import { escapeHtml as esc } from './markdown.mjs';

function colours(r) {
  if (r.kind === 'project') return { wb: r.project.palette.bg, wa: r.project.palette.accent };
  if (r.kind === 'big') {
    const lane = `var(--b-${r.branch})`;
    return { wb: `color-mix(in oklab, var(--base) 86%, ${lane})`, wa: lane };
  }
  return null;
}

/**
 * @param {{ hash: string, kind: string, branch: string, project?: { palette: { bg: string, accent: string } } }[]} rows
 * @returns {string} the #world layer stack, or '' when no row has a world
 */
export function renderWorld(rows) {
  const worlds = new Map();
  for (const r of rows) {
    const c = colours(r);
    if (!c) continue;
    const style = `--wb:${esc(c.wb)};--wa:${esc(c.wa)}`;
    if (!worlds.has(style)) worlds.set(style, []);
    worlds.get(style).push(esc(r.hash));
  }
  if (!worlds.size) return '';
  const layers = [...worlds].map(([style, hashes]) => `<i data-hash="${hashes.join(' ')}" style="${style}"></i>`).join('');
  return `<div id="world" aria-hidden="true">${layers}</div>`;
}
