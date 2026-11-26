import { contrastTable } from '../tokens.mjs';
import { site } from '../../../content/site.mjs';

const RULE = { AAA: 'AAA text, 7:1', AA: 'AA text, 4.5:1', graphics: 'graphics, 3:1' };

const KEYS = [
  ['Esc', 'toggle normal mode (letters do nothing until you do)'],
  ['j / k', 'next or previous commit'],
  ['J / K', 'next or previous project'],
  ['g g / G', 'top or bottom of the log'],
  ['Enter', 'open the project in view'],
  [':help', 'this page'],
  [':q', 'try it'],
  ['i', 'back to insert mode, keys behave normally'],
];

export function helpPage({ selfHostedFonts }) {
  const rows = contrastTable().map((r) => `<tr><th scope="row"><span class="sw" style="background:${r.fg}"></span>${r.what}</th>`
    + `<td><code>${r.fg}</code></td><td>${RULE[r.rule]}</td><td>${r.onBase.toFixed(2)}</td><td>${r.onBlack.toFixed(2)}</td>`
    + `<td>${r.pass ? 'pass' : 'FAIL'}</td></tr>`).join('');
  const keys = KEYS.map(([k, v]) => `<tr><th scope="row"><kbd>${k}</kbd></th><td>${v}</td></tr>`).join('');
  const fonts = selfHostedFonts
    ? 'Fonts are self-hosted, so the site makes no third-party requests.'
    : 'Fonts load from Google Fonts for now. Self-hosting them is on the list.';
  return `<div class="frame prose">
<header class="page-head">
<p class="hud prompt">:help colophon</p>
<h1>Receipts, not <em>claims</em>.</h1>
<p class="lede">Accessibility is part of the art direction here. This page lists the evidence, computed when the site is built.</p>
</header>

<h2 id="contrast">Contrast</h2>
<p>WCAG 2.2 AA everywhere, AAA for body text. Every colour is checked against the Mocha base and against pure black. Each project's own palette is checked too, or the site refuses to build.</p>
<div class="table-wrap"><table class="spec">
<caption class="sr-only">Contrast ratios of every colour on the site</caption>
<thead><tr><th scope="col">Colour</th><th scope="col">Hex</th><th scope="col">Rule</th><th scope="col">On base</th><th scope="col">On black</th><th scope="col">Result</th></tr></thead>
<tbody>${rows}</tbody></table></div>

<h2 id="motion">Motion</h2>
<p>Scrolling is native: nothing hijacks the wheel or the touch. Entries fade in once as they arrive and stay put after that. Covers drift slowly as you scroll, each project and job tints the background with its own colours while you read it, and opening a project morphs its cover into the page. If your system asks for reduced motion, the fade-ins, the drift and the hover lift are off, the stars stop drifting, the film grain freezes, the cursor jumps instead of smearing, the colour changes are quicker, and page transitions fade.</p>

<h2 id="keys">Keys</h2>
<p>Vim keys work only in normal mode, so a single letter never fires by accident (WCAG 2.1.4).</p>
<div class="table-wrap"><table class="spec keys"><caption class="sr-only">Keyboard shortcuts</caption><tbody>${keys}</tbody></table></div>

<h2 id="type">Type</h2>
<p>Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono, by the Braille Institute, designed for readers with low vision. Fraunces, by Undercase Type, for one italic word per heading. All under the SIL Open Font License. ${fonts}</p>

<h2 id="privacy">Privacy</h2>
<p>Privacy: no cookies, no tracking, no analytics. Your scroll is your business.</p>

<h2 id="built">Built with</h2>
<p>Hand-written HTML, CSS and JavaScript, built by a Node script with zero dependencies and served by GitHub Pages. <a href="${site.source}">Source on GitHub</a>.</p>
</div>`;
}
