// The agent and crawler files: llms-full.txt, sitemap.xml, robots.txt. (/llms.txt is index.md, copied byte for byte.)
import { resolveHref } from './site.mjs';

export const ORIGIN = 'https://lucamolluso.com';

/** Index first, then the cases in index order, then the other pages by path. The 404 page is left out. */
export function pageOrder(site) {
  const index = site.byPath.get('index.md');
  const order = index ? [index] : [];
  if (index) {
    for (const b of index.blocks) {
      if (b.type !== 'files') continue;
      for (const it of b.items) {
        const r = it.href ? resolveHref(site, index, it.href) : null;
        if (r?.page && !order.includes(r.page)) order.push(r.page);
      }
    }
  }
  for (const p of site.pages) if (!order.includes(p) && p.path !== '404.md') order.push(p);
  return order;
}

export const llmsFull = (site) => pageOrder(site).map((p) => `Source: ${ORIGIN}${p.raw}\n\n${p.md.replace(/\s+$/, '')}\n`).join('\n---\n\n');

export function sitemap(site) {
  const urls = pageOrder(site).map((p) => `<url><loc>${ORIGIN}${p.url}</loc>${p.history.last ? `<lastmod>${p.history.last}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
