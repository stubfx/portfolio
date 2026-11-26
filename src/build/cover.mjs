import { escapeHtml as esc } from './markdown.mjs';
import { cssVars } from './layout.mjs';

export function accentTitle(title, accent) {
  const t = esc(title);
  if (!accent) return t;
  const a = esc(accent);
  const i = t.lastIndexOf(a);
  return i < 0 ? t : `${t.slice(0, i)}<em>${a}</em>${t.slice(i + a.length)}`;
}

export const lede = (html) => (/<p>([\s\S]*?)<\/p>/.exec(html) || [, ''])[1];

export const paletteVars = (p) => ({ '--p-bg': p.palette.bg, '--p-fg': p.palette.fg, '--p-accent': p.palette.accent });

function seeded(str) {
  let s = [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// A generative "planet" plate, seeded by the commit hash, so every project
// gets its own sky until real art replaces it.
function generative(p, id) {
  const r = seeded(p.hash);
  const cx = 96 + r() * 40, cy = 26 + r() * 30, rad = 14 + r() * 10, tilt = -28 + r() * 56;
  let stars = '';
  for (let i = 0; i < 46; i++) {
    stars += `<circle cx="${(r() * 160).toFixed(1)}" cy="${(r() * 90).toFixed(1)}" r="${(0.12 + r() * 0.28).toFixed(2)}" opacity="${(0.2 + r() * 0.6).toFixed(2)}"/>`;
  }
  return `<svg class="plate" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
    + `<defs><radialGradient id="${id}" cx="34%" cy="30%" r="72%">`
    + `<stop offset="0" style="stop-color:var(--p-accent);stop-opacity:.95"/>`
    + `<stop offset=".5" style="stop-color:var(--p-accent);stop-opacity:.22"/>`
    + `<stop offset="1" style="stop-color:var(--p-bg);stop-opacity:0"/></radialGradient></defs>`
    + `<g style="fill:var(--p-fg)">${stars}</g>`
    + `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="url(#${id})"/>`
    + `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(rad * 2.3).toFixed(1)}" ry="${(rad * 0.42).toFixed(1)}" transform="rotate(${tilt.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" style="fill:none;stroke:var(--p-fg);stroke-opacity:.4;stroke-width:.14"/>`
    + `</svg>`;
}

function backLayers(p, id) {
  const c = p.cover || {};
  if (c.video) return `<div class="layer l-back" style="--depth:.5"><video src="${esc(c.video)}" muted loop playsinline autoplay preload="metadata" aria-hidden="true"></video></div>`;
  const layers = c.layers || (c.image ? [c.image] : []);
  if (!layers.length) return `<div class="layer l-back" style="--depth:.6">${generative(p, id)}</div>`;
  return layers.map((src, i) => `<div class="layer l-img" style="--depth:${(0.7 - i * 0.25).toFixed(2)}"><img src="${esc(src)}" alt="" decoding="async"></div>`).join('');
}

const corners = '<i class="k k1"></i><i class="k k2"></i><i class="k k3"></i><i class="k k4"></i>';

function meta(p, branchLabel) {
  const tags = p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('');
  return `<p class="hud cv-meta"><span class="ref">${esc(p.hash)}</span><span>${esc(branchLabel || p.branch)}</span>`
    + `<time datetime="${p.year}">${esc(p.span || p.year)}</time>${tags}</p>`;
}

export const dagger = (p) => (p.nda ? '<sup class="dg" aria-label="under NDA">†</sup>' : '');

const MODES = new Set(['hero', 'card', 'attachment']);

/**
 * hero: the project page header. card: a work page tile. attachment: the cover attached to its commit in the log.
 * @param {object} p project
 * @param {{ mode?: 'hero'|'card'|'attachment', branchLabel?: string }} o
 */
export function renderCover(p, { mode = 'hero', branchLabel } = {}) {
  if (!MODES.has(mode)) throw new Error(`Unknown cover mode "${mode}"`);
  const id = `g-${p.slug}-${mode}`;
  const vt = `view-transition-name:cover-${p.slug}`;
  const word = p.accent ? `<div class="layer l-word" style="--depth:.3" aria-hidden="true"><span>${esc(p.accent)}</span></div>` : '';
  const href = `/projects/${p.slug}/`;
  const vars = cssVars(paletteVars(p));

  if (mode === 'card') {
    return `<a class="card" href="${href}" style="${vars}">`
      + `<div class="cover mini" style="${vt}">${backLayers(p, id)}${word}${corners}</div>`
      + `<div class="card-meta">${meta(p, branchLabel)}<h2 class="card-title">${accentTitle(p.title, p.accent)}${dagger(p)}</h2></div></a>`;
  }

  if (mode === 'attachment') {
    return `<a class="pc-att" href="${href}" style="${vars}" aria-label="Open ${esc(p.title)}">`
      + `<div class="cover mini att" style="${vt}">${backLayers(p, id)}${word}${corners}</div>`
      + `<span class="pc-chip" aria-hidden="true">git show ${esc(p.hash)}</span></a>`;
  }

  const front = `<div class="layer l-front" style="--depth:0">${corners}`
    + `<div class="cv-copy">${meta(p, branchLabel)}`
    + `<h1 class="cv-title" id="cv-${p.slug}">${accentTitle(p.title, p.accent)}${dagger(p)}</h1>`
    + `<p class="cv-lede">${lede(p.html)}</p></div></div>`;
  return `<header class="hero"><div class="cover" style="${vt}">${backLayers(p, id)}${word}${front}</div></header>`;
}
