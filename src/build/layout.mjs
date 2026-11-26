import { site } from '../../content/site.mjs';
import { escapeHtml as esc } from './markdown.mjs';

export const TABS = [
  { key: 'log', href: '/', label: 'log' },
  { key: 'work', href: '/work/', label: 'work' },
  { key: 'about', href: '/about/', label: 'about' },
  { key: 'help', href: '/help/', label: ':help' },
];

const GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;700'
  + '&family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400'
  + '&family=Fraunces:ital,opsz,wght@1,9..144,300..500&display=swap';

export function fontLinks(selfHosted) {
  return selfHosted
    ? '<link rel="stylesheet" href="/fonts/fonts.css">'
    : '<link rel="preconnect" href="https://fonts.googleapis.com">'
      + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
      // Non-blocking: text renders in the fallback first, and main.js never waits on Google.
      + `<link rel="stylesheet" href="${GOOGLE_FONTS.replace(/&/g, '&amp;')}" media="print" onload="this.media='all'">`
      + `<noscript><link rel="stylesheet" href="${GOOGLE_FONTS.replace(/&/g, '&amp;')}"></noscript>`;
}

function footer() {
  const links = site.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join(' · ');
  return `<footer class="site-foot"><div class="frame"><p class="rail"><a href="mailto:${site.email}">${site.email}</a></p>`
    + `<p class="hud">${links} · ${site.location}</p></div></footer>`;
}

const style = (vars) => Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');

/**
 * The page shell shared by every page.
 * @param {{ title: string, page: string, body: string, description?: string,
 *   section?: string, vars?: Record<string,string>, selfHostedFonts?: boolean, path?: string }} o
 */
export function layout({ title, page, body, description = site.description, section = page, vars, selfHostedFonts = false, path = '/', pos = 'HEAD · main' }) {
  const tabs = TABS.map((t, i) => {
    const current = t.key === page ? ' aria-current="page"' : '';
    const on = t.key === section ? ' class="on"' : '';
    return `<li${on}><a href="${t.href}"${current}><span class="num">${i + 1}</span>${t.label}</a></li>`;
  }).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#11111b">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="https://${site.domain}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="https://${site.domain}${path}">
<meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.__site)document.documentElement.classList.remove('js')},4000)</script>
${fontLinks(selfHostedFonts)}
<link rel="stylesheet" href="/assets/site.css">
<script type="module" src="/assets/main.js"></script>
</head>
<body data-page="${page}"${vars ? ` style="${style(vars)}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
<canvas id="stars" aria-hidden="true"></canvas>
<div id="grain" aria-hidden="true"></div>
<div class="page">
<svg id="graph" aria-hidden="true" focusable="false"></svg>
<main id="main" tabindex="-1">
${body}
</main>
${page === 'log' ? '' : footer()}
</div>
<nav id="bar" aria-label="Pages and status">
<a class="ses" href="/">lucamolluso</a>
<ul class="tabs">${tabs}</ul>
<span class="fill"></span>
<span id="mode" class="hud">esc · normal</span>
<span id="pos" class="hud">${esc(pos)}</span>
<a class="mail hud" href="mailto:${site.email}">mail</a>
<span id="clk" class="hud" title="Time in Rome">--:--</span>
</nav>
<div id="cmd">
<form id="cmdf" hidden><label for="cmdi" class="sr-only">Command</label><span id="cmdp" aria-hidden="true">:</span><input id="cmdi" autocomplete="off" spellcheck="false"></form>
<p id="msg" role="status"></p>
</div>
</body>
</html>
`;
}

export { style as cssVars };
