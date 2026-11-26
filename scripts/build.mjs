// Zero-dependency static build: content/ + src/ -> dist/.
import { mkdir, writeFile, readFile, readdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as log from '../content/log.mjs';
import { site } from '../content/site.mjs';
import { loadProjects, buildTimeline } from '../src/build/timeline.mjs';
import { renderMarkdown } from '../src/build/markdown.mjs';
import { layout } from '../src/build/layout.mjs';
import { paletteVars } from '../src/build/cover.mjs';
import { homePage } from '../src/build/pages/home.mjs';
import { renderWorld, renderWorldData } from '../src/build/world.mjs';
import { projectPage } from '../src/build/pages/project.mjs';
import { workPage } from '../src/build/pages/work.mjs';
import { aboutPage } from '../src/build/pages/about.mjs';
import { helpPage } from '../src/build/pages/help.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_ORDER = ['tokens', 'base', 'log', 'cover', 'hud', 'pages', 'motion', 'world', 'sky'];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

// GitHub project pages live under /<repo>/; a custom domain lives at the root.
// Templates write site-relative URLs ("/assets/...") and this prefixes them.
export function withBase(html, base) {
  const b = (base || '').replace(/\/+$/, '');
  if (!b) return html;
  return html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${b}/`);
}

export async function build({ outDir = join(ROOT, 'dist'), base = '' } = {}) {
  const out = resolve(outDir);
  if (out === ROOT || out === '/' || ROOT.startsWith(out + '/')) throw new Error(`Refusing to clean ${out}`);
  await rm(out, { recursive: true, force: true });

  const projects = loadProjects(join(ROOT, 'content/projects'));
  const timeline = buildTimeline(log, projects);
  const label = Object.fromEntries(timeline.branches.map((b) => [b.name, b.label]));
  const selfHostedFonts = existsSync(join(ROOT, 'public/fonts/fonts.css'));
  const written = [];

  const write = async (rel, content) => {
    const file = join(out, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, rel.endsWith('.html') ? withBase(content, base) : content);
    written.push(file);
  };
  const page = (rel, o) => write(rel, layout({ selfHostedFonts, ...o }));

  await page('index.html', { title: `${site.name}, ${site.role.toLowerCase()}`, page: 'log', body: homePage(timeline), backdrop: renderWorldData(timeline.rows) + renderWorld(timeline.rows), path: '/' });
  await page('work/index.html', { title: `Work · ${site.name}`, page: 'work', body: workPage(projects, label), path: '/work/' });
  await page('about/index.html', {
    title: `About · ${site.name}`, page: 'about', path: '/about/',
    body: aboutPage(renderMarkdown(await readFile(join(ROOT, 'content/about.md'), 'utf8'))),
  });
  await page('help/index.html', { title: `:help · ${site.name}`, page: 'help', body: helpPage({ selfHostedFonts }), path: '/help/' });
  await page('404.html', {
    title: `E484 · ${site.name}`, page: 'none', path: '/404.html',
    body: `<div class="frame prose"><header class="page-head"><p class="hud prompt">:e</p><h1>E484: Can't open <em>file</em>.</h1>`
      + `<p class="lede">That page doesn't exist. <a href="/">:e /</a> takes you back to the log.</p></header></div>`,
  });

  for (const [i, p] of projects.entries()) {
    await page(`projects/${p.slug}/index.html`, {
      title: `${p.title} · ${site.name}`, page: 'project', section: 'work', path: `/projects/${p.slug}/`,
      description: `${p.title}. ${site.name}, ${site.role.toLowerCase()}.`,
      vars: { ...paletteVars(p), '--bg': p.palette.bg },
      pos: `${p.hash} · ${label[p.branch] || p.branch}`,
      body: projectPage(p, { prev: projects[i - 1], next: projects[i + 1], branchLabel: label[p.branch] }),
    });
  }

  const css = await Promise.all(CSS_ORDER.map((n) => readFile(join(ROOT, `src/styles/${n}.css`), 'utf8')));
  await write('assets/site.css', css.join('\n'));

  for (const f of await readdir(join(ROOT, 'src/client'))) {
    if (/\.m?js$/.test(f)) await write(`assets/${f}`, await readFile(join(ROOT, 'src/client', f)));
  }

  if (existsSync(join(ROOT, 'public'))) {
    await cp(join(ROOT, 'public'), out, { recursive: true });
    for (const f of await walk(join(ROOT, 'public'))) written.push(join(out, relative(join(ROOT, 'public'), f)));
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const base = process.env.BASE_PATH || '';
  build({ base }).then((files) => console.log(`built ${files.length} files into dist/${base ? ` (base ${base})` : ''}`)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
