// The home page's worlds: while a project or work entry is the current row, the page behind the log
// takes on that entry's colours (docs/superpowers/specs/2026-11-26-worlds-design.md).
// One fixed layer per distinct world; rows with the same colours share it, so both IBM rows are one world.
import { escapeHtml as esc } from './markdown.mjs';
import { mixSrgb, mixOklab } from './colour.mjs';
import { TOKENS } from './tokens.mjs';

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

/**
 * The sky's worlds: per distinct world, the approved "faint" base (the world colour mixed 55% into the
 * page base in sRGB, as the world layers did) and the accent. Rows with identical colours share one.
 * @returns {{ hashes: string[], base: string, accent: string }[]}
 */
export function worldPalettes(rows) {
  const out = new Map();
  for (const r of rows) {
    let wb, accent;
    if (r.kind === 'project') { wb = r.project.palette.bg; accent = r.project.palette.accent; }
    else if (r.kind === 'big') { accent = TOKENS[`b-${r.branch}`]; wb = mixOklab(TOKENS.base, accent, 0.14); }
    else continue;
    const base = mixSrgb(TOKENS.base, wb, 0.55);
    const key = base + accent;
    if (!out.has(key)) out.set(key, { hashes: [], base, accent });
    out.get(key).hashes.push(r.hash);
  }
  return [...out.values()];
}

/** The world palettes as JSON for the sky, or '' when no row has a world. */
export function renderWorldData(rows) {
  const w = worldPalettes(rows);
  return w.length ? `<script type="application/json" id="worlds">${JSON.stringify(w).replace(/</g, '\\u003c')}</script>` : '';
}
