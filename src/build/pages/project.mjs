import { escapeHtml as esc } from '../markdown.mjs';
import { renderCover, accentTitle } from '../cover.mjs';

export function projectPage(p, { prev, next, branchLabel }) {
  const cells = [
    ...Object.entries(p.cells || {}),
    ['Year', p.span || String(p.year)],
    ['Branch', branchLabel || p.branch],
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const nda = p.nda
    ? `<p class="nda"><span class="ref">†</span> Client under NDA. The story's better over a call.</p>`
    : '';
  const link = (q, rel) => q
    ? `<a href="/projects/${q.slug}/" rel="${rel}"><span class="hud">${rel === 'prev' ? 'previous' : 'next'}</span>${accentTitle(q.title, q.accent)}</a>`
    : '<span></span>';
  return `<article class="project">
${renderCover(p, { mode: 'hero', branchLabel })}
<div class="frame prose">
<dl class="cells">${cells}</dl>
${nda}
${p.html}
<nav class="pager rail" aria-label="More projects">${link(prev, 'prev')}<a class="back" href="/"><span class="hud">back to</span>the log</a>${link(next, 'next')}</nav>
</div>
</article>`;
}
