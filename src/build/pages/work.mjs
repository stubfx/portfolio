import { renderCover } from '../cover.mjs';

export function workPage(projects, label) {
  const cards = projects.map((p) => `<li>${renderCover(p, { mode: 'card', branchLabel: label[p.branch] })}</li>`).join('');
  return `<div class="frame wide">
<header class="page-head">
<p class="hud prompt">~/lucamolluso/work $ ls</p>
<h1>Selected <em>work</em>.</h1>
<p class="lede">Every cover is a project with its own art direction. Some clients are under NDA, marked with a dagger.</p>
</header>
<ul class="grid">${cards}</ul>
</div>`;
}
