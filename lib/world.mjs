// A page's world: its own stylesheet, fonts and optional script, in the folder beside the page
// (work/waylay.md → work/waylay/world.css). docs/DESIGN.md section 10, docs/CONTENT.md section 9.
import fs from 'node:fs';
import path from 'node:path';

const posix = path.posix;
/** The header and its controls: shared by every page, so a world never styles them. */
const HEADER = /(^|[^\w-])(\.bar|\.wip|#(?:path|copy|themeseg|t-day|t-night|viewseg|v-rendered|v-raw))(?![\w-])/;
const LICENCE = /^(ofl|licen[cs]e)[a-z0-9._-]*\.txt$/;
/** Images a world's stylesheet uses (a mask, a texture) skip media.json, so they stay small. */
const ASSET_MAX = 200 * 1024;

export const worldDir = (pagePath) => pagePath.replace(/\.md$/, '');

/** Comments blanked, newlines kept, so positions still give line numbers. */
const uncomment = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const lineAt = (text, i) => text.slice(0, i).split('\n').length;

/**
 * @returns {null | {dir: string, css: string, js: boolean, paper: string|null,
 *   urls: {url: string, line: number, file: string|null}[], fonts: string[]}}
 *   file: the url's target, content-relative, or null when it leaves the world's folder
 */
export function loadWorld(contentDir, pagePath) {
  const dir = worldDir(pagePath);
  const cssFile = path.join(contentDir, dir, 'world.css');
  if (!fs.existsSync(cssFile)) return null;
  const css = fs.readFileSync(cssFile, 'utf8');
  const bare = uncomment(css);
  const urls = [...bare.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/g)].map((m) => {
    const url = m[2].trim();
    const inside = !/^[a-z][a-z0-9+.-]*:|^\/|\\/i.test(url) && !posix.normalize(url).startsWith('..');
    return { url, line: lineAt(bare, m.index), file: inside ? posix.join(dir, posix.normalize(url)) : null };
  });
  return {
    dir, css, js: fs.existsSync(path.join(contentDir, dir, 'world.js')),
    paper: /--paper\s*:\s*(#[0-9a-f]{6})\b/i.exec(bare)?.[1].toLowerCase() ?? null,
    urls, fonts: [...new Set(urls.filter((u) => u.file?.endsWith('.woff2')).map((u) => u.file))],
  };
}

/** @returns {{file: string, line: number, message: string}[]} file content-relative */
export function worldProblems(contentDir, world) {
  const out = [];
  const css = `${world.dir}/world.css`;
  const bare = uncomment(world.css);
  const add = (line, message, file = css) => out.push({ file, line, message });
  for (const m of bare.matchAll(/@import\b/g)) add(lineAt(bare, m.index), 'a world has no @import: put everything in world.css');
  for (const u of world.urls) {
    if (!u.file) add(u.line, `a world's url() points inside its own folder (${world.dir}/): ${u.url}`);
    else if (!fs.existsSync(path.join(contentDir, u.file))) add(u.line, `${u.url}: no such file in ${world.dir}/`);
    else if (!u.file.endsWith('.woff2') && fs.statSync(path.join(contentDir, u.file)).size > ASSET_MAX) add(0, 'an image a world uses is over 200 KB: a picture belongs in the Markdown, through media.mjs', u.file);
  }
  const header = HEADER.exec(bare.replace(/\{[^{}]*\}/g, (m) => m.replace(/[^\n]/g, ' ')));
  if (header) add(lineAt(bare, header.index), `a world doesn't style the header (${header[2]}): set --paper, --ink, --mk, --line and --bar instead`);
  if (!world.paper) add(1, 'a world sets --paper to a #rrggbb colour: the page and the browser bar use it');
  for (const font of world.fonts) {
    const folder = posix.dirname(font);
    const files = fs.existsSync(path.join(contentDir, folder)) ? fs.readdirSync(path.join(contentDir, folder)) : [];
    if (fs.existsSync(path.join(contentDir, font)) && !files.some((f) => LICENCE.test(f))) add(0, `a font needs its licence beside it (${folder}/ofl.txt)`, font);
  }
  return out;
}

/** Files a world's stylesheet uses, content-relative: they are the world's, not media.json's. */
export const worldAssets = (worlds) => new Set(worlds.flatMap((w) => w.urls.map((u) => u.file).filter(Boolean)));

/** world.css and world.js files that have no page, or no stylesheet: content-relative paths in, problems out. */
export function strayWorldFiles(files) {
  const all = new Set(files);
  return files.filter((f) => /(^|\/)world\.(css|js)$/.test(f)).flatMap((f) => {
    const dir = posix.dirname(f);
    if (!all.has(`${dir}.md`)) return [{ file: f, line: 0, message: `a world belongs to a page: ${dir}.md doesn't exist` }];
    if (f.endsWith('.js') && !all.has(`${dir}/world.css`)) return [{ file: f, line: 0, message: `a world's script needs its world.css beside it` }];
    return [];
  });
}

/** The published stylesheet: the world's rules in the world layer, below the header's frame layer (site/style.css). */
export const worldStylesheet = (world) => `@layer world{\n${world.css.trimEnd()}\n}\n`;

/** Every file the world publishes, content-relative: the script, each url() target, each font folder's licence. */
export function worldFiles(contentDir, world) {
  const files = new Set(world.js ? [`${world.dir}/world.js`] : []);
  for (const u of world.urls) if (u.file) files.add(u.file);
  for (const font of world.fonts) {
    const folder = posix.dirname(font);
    for (const f of fs.readdirSync(path.join(contentDir, folder))) if (LICENCE.test(f)) files.add(`${folder}/${f}`);
  }
  return [...files];
}
