// Builds lucamolluso.com: content/ + site/ + static/ → dist/. Zero dependencies: Node built-ins only.
//   node build.mjs            build (validates first; any problem stops it)
//   node build.mjs --serve    build, serve dist/ on :8080, rebuild and reload on change
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { loadSite, pageLinks, resolveHref } from './lib/site.mjs';
import { validate, formatProblems, mediaWarnings } from './lib/validate.mjs';
import { renderPage } from './lib/page.mjs';
import { llmsFull, sitemap, robots } from './lib/outputs.mjs';
import { worldStylesheet, worldFiles } from './lib/world.mjs';

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  for (const d of fs.readdirSync(from, { withFileTypes: true })) {
    const [a, b] = [path.join(from, d.name), path.join(to, d.name)];
    if (d.isDirectory()) copyDir(a, b);
    else write(b, fs.readFileSync(a));
  }
}

/** @returns {Promise<{ok: boolean, problems: object[], warnings: object[], pages: number}>} */
export async function build({ contentDir = 'content', siteDir = 'site', staticDir = 'static', outDir = 'dist', repoDir = '.', dev = false } = {}) {
  const site = loadSite({ contentDir, repoDir });
  const problems = validate(site);
  if (!site.loadProblems.length && !site.byPath.has('index.md')) problems.unshift({ file: `${site.contentRel}/index.md`, line: 0, message: 'the homepage is missing' });
  const warnings = site.loadProblems.length ? [] : mediaWarnings(site);
  if (problems.length) return { ok: false, problems, warnings, pages: 0 };

  fs.rmSync(outDir, { recursive: true, force: true });
  const template = fs.readFileSync(path.join(siteDir, 'template.html'), 'utf8');
  for (const page of site.pages) {
    const html = renderPage(page, site, { dev, template });
    write(page.path === '404.md' ? path.join(outDir, '404.html') : path.join(outDir, page.url, 'index.html'), html);
    write(path.join(outDir, page.path), page.md);
  }
  write(path.join(outDir, 'llms.txt'), fs.readFileSync(path.join(contentDir, 'index.md')));
  write(path.join(outDir, 'llms-full.txt'), llmsFull(site));
  write(path.join(outDir, 'sitemap.xml'), sitemap(site));
  write(path.join(outDir, 'robots.txt'), robots());
  write(path.join(outDir, '.nojekyll'), '');

  const assets = path.join(outDir, 'assets');
  write(path.join(assets, 'style.css'), `${fs.readFileSync(path.join(siteDir, 'fonts/fonts.css'), 'utf8')}\n${fs.readFileSync(path.join(siteDir, 'style.css'), 'utf8')}`);
  for (const f of fs.readdirSync(siteDir)) if (/\.m?js$/.test(f)) write(path.join(assets, f), fs.readFileSync(path.join(siteDir, f)));
  for (const f of fs.readdirSync(path.join(siteDir, 'fonts'))) if (/\.(woff2|txt)$/.test(f)) write(path.join(assets, 'fonts', f), fs.readFileSync(path.join(siteDir, 'fonts', f)));
  for (const e of Object.values(site.manifest)) {
    const files = [...e.variants.map((v) => v.file), ...(e.poster ? [e.poster.jpg.file, e.poster.avif.file] : [])];
    for (const f of files) write(path.join(outDir, f), fs.readFileSync(path.join(contentDir, f)));
  }
  for (const page of site.pages) {
    for (const { href } of pageLinks(page)) {
      const r = resolveHref(site, page, href);
      if (r.file) write(path.join(outDir, r.file), fs.readFileSync(path.join(contentDir, r.file)));
    }
  }
  for (const { world } of site.pages) {
    if (!world) continue;
    write(path.join(outDir, world.dir, 'world.css'), worldStylesheet(world));
    for (const f of worldFiles(contentDir, world)) write(path.join(outDir, f), fs.readFileSync(path.join(contentDir, f)));
  }
  copyDir(staticDir, outDir);
  return { ok: true, problems: [], warnings, pages: site.pages.length };
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.avif': 'image/avif', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};
const RELOAD_JS = "new EventSource('/__reload').onmessage = () => location.reload();\n";

/** This machine's IPv4 addresses other than loopback: what another machine (the VM's host) opens. */
const lanAddresses = () => Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);

/** A static server for dist/ with Range support (video), the 404 page, and live reload for --serve.
 *  host 0.0.0.0 makes it reachable from other machines; `urls` lists the addresses to open. */
export function serve({ outDir = 'dist', port = 8080, host = '127.0.0.1' } = {}) {
  const clients = new Set();
  const root = path.resolve(outDir);
  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname === '/__reload') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
      res.write(': hi\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (pathname === '/__reload.js') { res.writeHead(200, { 'content-type': TYPES['.js'] }); res.end(RELOAD_JS); return; }
    let file;
    try { file = path.resolve(root, `.${decodeURIComponent(pathname)}`); } catch { file = null; }
    if (file && file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file || !file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      const notFound = path.join(root, '404.html');
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'not found');
      return;
    }
    const size = fs.statSync(file).size;
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : size - Number(range[2]);
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return; }
      res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve({
    url: `http://127.0.0.1:${server.address().port}`,
    urls: (host === '0.0.0.0' ? ['127.0.0.1', ...lanAddresses()] : [host]).map((h) => `http://${h}:${server.address().port}`),
    reload: () => { for (const c of clients) c.write('data: reload\n\n'); },
    close: () => new Promise((done) => { for (const c of clients) c.end(); server.close(done); }),
  })));
}

/** Builds and reports; never throws, so a failing rebuild can't take the dev server down. */
export async function rebuild(opts = {}, io = console) {
  const t = Date.now();
  try {
    const r = await build(opts);
    for (const w of r.warnings) io.warn(`warning: ${formatProblems([w])}`);
    if (r.ok) io.log(`built ${r.pages} pages in ${Date.now() - t} ms`);
    else io.error(`${formatProblems(r.problems)}\n\n${r.problems.length} problem${r.problems.length === 1 ? '' : 's'}: nothing was built`);
    return r.ok;
  } catch (e) {
    io.error(`build failed: ${e.stack ?? e}`);
    return false;
  }
}

async function main(args) {
  const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  if (!args.includes('--serve')) { process.exitCode = (await rebuild()) ? 0 : 1; return; }
  await rebuild({ dev: true });
  const s = await serve({ port: Number(opt('--port')) || 8080, host: opt('--host') ?? '127.0.0.1' });
  console.log(`serving ${s.urls.join('  ')}`);
  let timer = null;
  for (const dir of ['content', 'site', 'static']) {
    if (!fs.existsSync(dir)) continue;
    fs.watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(async () => { if (await rebuild({ dev: true })) s.reload(); }, 100);
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
