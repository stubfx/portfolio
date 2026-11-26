import { renderInline, escapeHtml as esc } from '../markdown.mjs';
import { renderCover, accentTitle, lede, dagger } from '../cover.mjs';
import { site } from '../../../content/site.mjs';

const SLIM = new Set(['fork', 'merge', 'slim']);

function when(r) {
  return `<time datetime="${r.year}">${esc(r.span || r.year)}</time>`;
}

function data(r) {
  return `data-hash="${esc(r.hash)}" data-branch="${esc(r.branch)}" data-kind="${r.kind}"${r.special ? ' data-special' : ''}`;
}

const ref = (r, label) => `<span class="ref">${esc(label[r.branch] || r.branch)}</span>`;
const hashRef = (r) => `<span class="hud ref h">${esc(r.hash)}</span>`;

// Year or span, branch, tags, hash: the line above every full entry.
function header(r, label) {
  const tags = (r.tags || []).map((t) => `<span class="tag hud">${esc(t)}</span>`).join('');
  return `<header class="eb" ${data(r)}><span class="hud">${when(r)}<span class="sep">/</span>${ref(r, label)}</span>${tags}${hashRef(r)}</header>`;
}

const cellList = (pairs) => (pairs?.length
  ? `<dl class="cells">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
  : '');

export function renderRow(r, label) {
  if (SLIM.has(r.kind)) {
    return `<li class="row k-${r.kind}" style="--c:var(--b-${r.branch})"><p class="slim" id="c-${esc(r.hash)}" ${data(r)}>`
      + `<span class="hud">${when(r)}<span class="sep">/</span>${ref(r, label)}</span><span class="msg">${renderInline(r.text || '')}</span>${hashRef(r)}</p></li>`;
  }
  const help = r.help
    ? '<p class="fn">Receipts in the <a href="/help/">colophon</a>, or press <kbd>Esc</kbd> then type <kbd>:help</kbd>.</p>'
    : '';
  return `<li class="row k-${r.kind}${r.special ? ' special' : ''}" style="--c:var(--b-${r.branch})">`
    + `<article class="entry" id="c-${esc(r.hash)}" aria-labelledby="t-${esc(r.hash)}">`
    + header(r, label)
    + `<h2 class="ttl" id="t-${esc(r.hash)}">${renderInline(r.title || '')}</h2>`
    + (r.text ? `<p class="ds">${renderInline(r.text)}</p>` : '')
    + cellList(r.cells) + help + `</article></li>`;
}

/** A project commit: its file's header, title, lede and cells, with the cover attached. */
export function renderProjectRow(r, label) {
  const p = r.project;
  const h = esc(p.hash);
  return `<li class="row k-project" style="--c:var(--b-${p.branch})">`
    + `<article class="entry pc" id="${esc(p.slug)}" aria-labelledby="t-${h}">`
    + header({ ...p, kind: 'project' }, label)
    + `<h2 class="ttl" id="t-${h}">${accentTitle(p.title, p.accent)}${dagger(p)}</h2>`
    + `<p class="ds">${lede(p.html)}</p>`
    + cellList(Object.entries(p.cells || {}))
    + renderCover(p, { mode: 'attachment' })
    + `</article></li>`;
}

const intro = `<header class="intro">
<p class="hud prompt">~/lucamolluso <span class="ref">(main)</span> $ git log --graph --all</p>
<h1>Luca Molluso, technical <em>artist</em>.</h1>
<p class="lede">AI and real-time 3D. A modder turned engineer who went to art school and never stopped stacking skills.</p>
<p class="hud hint">Scroll down the log, or press <kbd>Esc</kbd> then <kbd>j</kbd>.</p>
</header>`;

export function homePage({ rows, branches }) {
  const label = Object.fromEntries(branches.map((b) => [b.name, b.label]));
  const items = rows.map((r) => (r.kind === 'project' ? renderProjectRow(r, label) : renderRow(r, label))).join('');
  const topology = branches.map(({ name, label: l, fork, merge }) => ({ name, label: l, fork, merge }));
  return [
    `<section class="logseg first" aria-label="Log"><div class="frame">${intro}<ol class="log">${items}</ol></div></section>`,
    `<script type="application/json" id="branches">${JSON.stringify(topology).replace(/</g, '\\u003c')}</script>`,
    `<footer class="end"><div class="frame"><p class="hud">EOF</p>`
      + `<p class="end-line">That's the log so far. <a href="mailto:${site.email}">${site.email}</a></p>`
      + `<p class="hud">${site.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join(' · ')}</p></div></footer>`,
  ].join('\n');
}
