// The home page's worlds: while a project or work entry is the current row, the sky takes on that
// entry's colours (docs/superpowers/specs/2026-11-26-sky-design.md). Rows with the same colours share a world.
import { mixSrgb, mixOklab } from './colour.mjs';
import { TOKENS } from './tokens.mjs';

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
