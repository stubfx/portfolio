import { site } from '../../../content/site.mjs';

export function aboutPage(html) {
  const links = site.links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('');
  return `<div class="frame prose">
<header class="page-head">
<p class="hud prompt">~/lucamolluso $ cat README.md</p>
<h1>Hi, I'm <em>Luca</em>.</h1>
<p class="lede">${site.role}. AI and real-time 3D, with an engineer's backbone and an art director's eye. ${site.location}.</p>
</header>
${html}
<dl class="cells contact">
<div><dt>Mail</dt><dd><a href="mailto:${site.email}">${site.email}</a></dd></div>
<div><dt>Based</dt><dd>${site.location}</dd></div>
</dl>
<ul class="links hud">${links}</ul>
</div>`;
}
