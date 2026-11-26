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

// The planet's landscape draws. They come first and in this order, as when the plate drew the planet,
// so neither the planet nor the stars moved when it got a layer of its own.
const landDraws = (r) => ({ cx: 96 + r() * 40, cy: 26 + r() * 30, rad: 14 + r() * 10, tilt: -28 + r() * 56 });

/**
 * Where a generative cover's planet sits, seeded by the commit hash.
 * land: centre and radius in the 160x90 plate's units, ring tilt in degrees.
 * port: centre in percent of the cover, radius in percent of its width, for portrait covers.
 */
export function planetGeometry(hash) {
  const q = seeded(`${hash}:port`);
  return { land: landDraws(seeded(hash)), port: { x: 55 + q() * 25, y: 18 + q() * 14, r: 26 + q() * 12 } };
}

// A generative starry plate, seeded by the commit hash, so every project gets its own sky until real art replaces it.
function plate(p) {
  const r = seeded(p.hash);
  landDraws(r); // the planet's, see planetGeometry
  let stars = '';
  for (let i = 0; i < 46; i++) {
    stars += `<circle cx="${(r() * 160).toFixed(1)}" cy="${(r() * 90).toFixed(1)}" r="${(0.12 + r() * 0.28).toFixed(2)}" opacity="${(0.2 + r() * 0.6).toFixed(2)}"/>`;
  }
  return `<svg class="plate" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
    + `<g style="fill:var(--p-fg)">${stars}</g></svg>`;
}

// The plate's planet, in a layer of its own so cover.css can keep it on screen at any aspect ratio.
// The sphere has radius 10 at the origin of a 48-unit box: the ring (2.3 r wide) fits, and the reveal can scale it in place.
function planet(p, id) {
  const { land, port } = planetGeometry(p.hash);
  const f = (n) => n.toFixed(1);
  const vars = `--cx:${f(land.cx - 80)};--cy:${f(land.cy - 45)};--rad:${f(land.rad)};--tilt:${f(land.tilt)}deg;`
    + `--px:${f(port.x)};--py:${f(port.y)};--pr:${f(port.r)}`;
  return `<div class="layer l-planet" aria-hidden="true" style="${vars}">`
    + `<svg class="planet" viewBox="-24 -24 48 48" focusable="false">`
    + `<defs><radialGradient id="${id}" cx="34%" cy="30%" r="72%">`
    + `<stop offset="0" style="stop-color:var(--p-accent);stop-opacity:.95"/>`
    + `<stop offset=".5" style="stop-color:var(--p-accent);stop-opacity:.22"/>`
    + `<stop offset="1" style="stop-color:var(--p-bg);stop-opacity:0"/></radialGradient></defs>`
    + `<circle class="sphere" r="10" fill="url(#${id})"/>`
    // The ring is 0.14 plate units thick: rad plate units are the sphere's 10 here, so 1.4 / rad.
    + `<ellipse class="orbit" pathLength="1" rx="23" ry="4.2" stroke-width="${(1.4 / land.rad).toFixed(3)}"/>`
    + `</svg></div>`;
}

function backLayers(p, id) {
  const c = p.cover || {};
  if (c.video) return `<div class="layer l-back" style="--depth:.5"><video src="${esc(c.video)}" muted loop playsinline autoplay preload="metadata" aria-hidden="true"></video></div>`;
  const layers = c.layers || (c.image ? [c.image] : []);
  if (!layers.length) return `<div class="layer l-back" style="--depth:.6">${plate(p)}</div>${planet(p, id)}`;
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
    // The name starts with the chip's visible text, so voice control can say what it sees (WCAG 2.5.3).
    return `<a class="pc-att" href="${href}" style="${vars}" aria-label="git show ${esc(p.hash)}: open ${esc(p.title)}">`
      + `<div class="cover mini att" style="${vt}">${backLayers(p, id)}${word}${corners}</div>`
      + `<span class="pc-chip" aria-hidden="true">git show ${esc(p.hash)}</span></a>`;
  }

  const front = `<div class="layer l-front" style="--depth:0">${corners}`
    + `<div class="cv-copy"><i class="cv-pool" aria-hidden="true"></i>${meta(p, branchLabel)}`
    + `<h1 class="cv-title" id="cv-${p.slug}">${accentTitle(p.title, p.accent)}${dagger(p)}</h1>`
    + `<p class="cv-lede">${lede(p.html)}</p></div></div>`;
  return `<header class="hero"><div class="cover" style="${vt}">${backLayers(p, id)}${word}${front}</div></header>`;
}
