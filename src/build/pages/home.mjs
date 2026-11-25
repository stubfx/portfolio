import { renderInline, escapeHtml as esc } from '../markdown.mjs';
import { renderCover } from '../cover.mjs';
import { site } from '../../../content/site.mjs';

const SLIM = new Set(['fork', 'merge', 'slim']);

function when(r) {
  return `<time datetime="${r.year}">${esc(r.span || r.year)}</time>`;
}

function data(r) {
  return `data-hash="${esc(r.hash)}" data-branch="${esc(r.branch)}" data-kind="${r.kind}"${r.special ? ' data-special' : ''}`;
}

export function renderRow(r, label) {
  const ref = `<span class="ref">${esc(label[r.branch] || r.branch)}</span>`;
  const hash = `<span class="hud ref h">${esc(r.hash)}</span>`;
  if (SLIM.has(r.kind)) {
    return `<li class="row k-${r.kind}" style="--c:var(--b-${r.branch})"><p class="slim" id="c-${esc(r.hash)}" ${data(r)}>`
      + `<span class="hud">${when(r)}<span class="sep">/</span>${ref}</span><span class="msg">${renderInline(r.text || '')}</span>${hash}</p></li>`;
  }
  const tags = (r.tags || []).map((t) => `<span class="tag hud">${esc(t)}</span>`).join('');
  const cells = r.cells?.length
    ? `<dl class="cells">${r.cells.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
    : '';
  const help = r.help
    ? '<p class="fn">Receipts in the <a href="/help/">colophon</a>, or press <kbd>Esc</kbd> then type <kbd>:help</kbd>.</p>'
    : '';
  return `<li class="row k-${r.kind}${r.special ? ' special' : ''}" style="--c:var(--b-${r.branch})">`
    + `<article class="entry" id="c-${esc(r.hash)}" aria-labelledby="t-${esc(r.hash)}">`
    + `<header class="eb" ${data(r)}><span class="hud">${when(r)}<span class="sep">/</span>${ref}</span>${tags}${hash}</header>`
    + `<h2 class="ttl" id="t-${esc(r.hash)}">${renderInline(r.title || '')}</h2>`
    + (r.text ? `<p class="ds">${renderInline(r.text)}</p>` : '')
    + cells + help + `</article></li>`;
}

const intro = `<header class="intro">
<p class="hud prompt">~/lucamolluso <span class="ref">(main)</span> $ git log --graph --all</p>
<h1>Luca Molluso, technical <em>artist</em>.</h1>
<p class="lede">AI and real-time 3D. A modder turned engineer who went to art school and never stopped stacking skills.</p>
<p class="hud hint">Scroll to fly through the log, or press <kbd>Esc</kbd> then <kbd>j</kbd>.</p>
</header>`;

export function homePage({ rows, branches }) {
  const label = Object.fromEntries(branches.map((b) => [b.name, b.label]));
  const parts = [];
  let buf = [];
  const flush = () => {
    const first = parts.length === 0;
    if (!buf.length && !first) return;
    parts.push(`<section class="logseg${first ? ' first' : ''}" aria-label="Log"><div class="frame">${first ? intro : ''}`
      + `<ol class="log">${buf.join('')}</ol></div></section>`);
    buf = [];
  };
  for (const r of rows) {
    if (r.kind === 'project') {
      flush();
      parts.push(renderCover(r.project, { mode: 'seg', branchLabel: label[r.branch] }));
    } else {
      buf.push(renderRow(r, label));
    }
  }
  flush();
  const topology = branches.map(({ name, label: l, fork, merge }) => ({ name, label: l, fork, merge }));
  parts.push(`<script type="application/json" id="branches">${JSON.stringify(topology).replace(/</g, '\\u003c')}</script>`);
  parts.push(`<footer class="end"><div class="frame"><p class="hud">EOF</p>`
    + `<p class="end-line">That's the log so far. <a href="mailto:${site.email}">${site.email}</a></p>`
    + `<p class="hud">${site.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join(' · ')}</p></div></footer>`);
  return parts.join('\n');
}
