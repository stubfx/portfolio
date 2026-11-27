// Blocks to HTML: block syntax stays visible (grey, hanging, hidden from screen readers), inline markers don't.
import { parseInline, renderInline, inlineText, escapeHtml as esc } from './inline.mjs';

const MK = (s) => `<span class="mk" aria-hidden="true">${esc(s)}</span>`;
const HANG = (s) => `<span class="mk hang" aria-hidden="true">${esc(s)}</span>`;
const LANE = 28; // logic diagrams: Me lane left of this column, Machine lane from it
const SIZES = '(min-width: 1560px) 1280px, 92vw';
const SERVICE = { youtube: 'YouTube', vimeo: 'Vimeo' };

export function slug(text) {
  const s = inlineText(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return s || 'section';
}

/** Heading ids in document order; repeats get -2, -3. */
export function anchors(blocks) {
  const seen = new Map();
  return blocks.filter((b) => b.type === 'heading').map((b) => {
    const base = slug(b.text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

function codeHTML(lines, lang) {
  if (lang === 'logic') return lines.map((l) => {
    const a = [...l];
    return esc(a.slice(0, LANE).join('')) + (a.length > LANE ? `<span class="m">${esc(a.slice(LANE).join(''))}</span>` : '');
  }).join('\n');
  if (lang === 'yaml') return lines.map((l) => {
    const m = /^([\w-]+:)(.*)$/.exec(l);
    return m ? `<span class="k">${esc(m[1])}</span>${esc(m[2])}` : esc(l);
  }).join('\n');
  if (lang === 'log') return lines.map((l) => {
    const m = /^([0-9a-f]{7,40})(\s+)(.*?)(\s{2,})(\S.*)$/.exec(l);
    return m ? `<span class="k">${m[1]}</span>${m[2]}${esc(m[3])}${m[4]}<span class="k">${esc(m[5])}</span>` : esc(l);
  }).join('\n');
  return lines.map(esc).join('\n');
}

function picture(ref, alt, eager) {
  const set = (list) => list.map((v) => `${esc(v.src)} ${v.w}w`).join(', ');
  const sizes = ref.narrow ? '440px' : SIZES;
  const load = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `<picture><source type="image/avif" srcset="${set(ref.avif)}" sizes="${sizes}">`
    + `<img src="${esc(ref.src)}" srcset="${set(ref.jpg)}" sizes="${sizes}" alt="${esc(alt)}" width="${ref.width}" height="${ref.height}" ${load} decoding="async"></picture>`;
}

function mediaHTML(b, ref, eager) {
  const cap = `<figcaption aria-hidden="true"><span class="mk">![</span><span class="alt">${esc(b.alt)}</span><span class="mk">](</span>${esc(b.src)}<span class="mk">)</span></figcaption>`;
  const narrow = ref.kind !== 'embed' && ref.height > ref.width ? ' class="narrow"' : '';
  if (ref.kind === 'photo') return `<figure${narrow}>${cap}${picture(ref, b.alt, eager)}</figure>`;
  if (ref.kind === 'loop' || ref.kind === 'player') {
    const attrs = ref.kind === 'loop' ? 'class="loop" muted loop playsinline preload="metadata"' : 'class="player" preload="none"';
    const sources = ref.sources.map((s) => `<source src="${esc(s.src)}" type="${esc(s.type)}">`).join('');
    return `<figure${narrow}>${cap}<video ${attrs} controls poster="${esc(ref.poster.jpg)}" width="${ref.width}" height="${ref.height}" aria-label="${esc(b.alt)}">${sources}</video></figure>`;
  }
  const name = SERVICE[ref.service];
  return `<figure>${cap}<a class="embed" href="${esc(ref.url)}" data-embed="${esc(ref.iframe)}" data-title="${esc(b.alt)}" aria-label="Play: ${esc(b.alt)} (${name})">`
    + `${picture(ref.poster, '', eager)}<span class="play" aria-hidden="true">▶</span><span class="tag" aria-hidden="true">${name} · loads on play</span></a></figure>`;
}

/**
 * @param {object[]} blocks from parse()
 * @param {{link: (href: string) => {href: string, external: boolean}, media: (block: object) => object|null}} ctx
 */
export function renderBlocks(blocks, ctx) {
  const inl = (text) => renderInline(parseInline(text).nodes, ctx.link);
  const ids = anchors(blocks);
  let h = 0;
  let firstMedia = true;
  return blocks.map((b) => {
    switch (b.type) {
      case 'heading': return `<h${b.level} id="${ids[h++]}">${HANG('#'.repeat(b.level))}${inl(b.text)}</h${b.level}>`;
      case 'quote': return `<blockquote>${HANG('>')}${inl(b.text)}</blockquote>`;
      case 'para': return `<p>${inl(b.text)}</p>`;
      case 'punch': return `<p class="punch">${MK('==')}<mark>${inl(b.text)}</mark>${MK('==')}</p>`;
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        return `<${tag}>${b.items.map((it) => `<li>${HANG(b.ordered ? `${it.n}.` : '-')}${inl(it.text)}</li>`).join('')}</${tag}>`;
      }
      case 'files': {
        const rows = b.items.map((it, k) => {
          const title = it.href ? `<a href="${esc(ctx.link(it.href).href)}">${inl(it.title)}</a>` : `<span class="planned">${inl(it.title)}</span>`;
          return `<tr><td class="c0">${HANG('-')}${String(k + 1).padStart(2, '0')}</td><td class="c1">${title}</td><td class="c2">${inl(it.note)}</td><td class="c3">${it.year ?? ''}</td></tr>`;
        }).join('');
        return '<div class="tbl index"><table><thead><tr><th class="c0">#</th><th class="c1">case</th><th class="c2">idea</th><th class="c3">year</th></tr></thead>'
          + `<tbody>${rows}</tbody></table></div>`;
      }
      case 'table': {
        const head = b.head.map((c, k) => `<th class="c${k}">${inl(c)}</th>`).join('');
        const rows = b.rows.map((r) => `<tr>${r.map((c, k) => `<td class="c${k}">${inl(c)}</td>`).join('')}</tr>`).join('');
        return `<div class="tbl">${HANG('|')}<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      case 'media': {
        const ref = ctx.media(b);
        if (!ref) return '';
        const html = mediaHTML(b, ref, firstMedia);
        firstMedia = false;
        return html;
      }
      case 'code':
        return `<div class="code"><div class="fence" aria-hidden="true">\`\`\`${esc(b.lang)}</div><pre>${codeHTML(b.lines, b.lang)}</pre><div class="fence" aria-hidden="true">\`\`\`</div></div>`;
      case 'hr': return '<div class="hr" aria-hidden="true">---</div>';
      case 'comment': return `<p class="comment">${esc(b.raw)}</p>`;
      default: throw new Error(`unknown block type: ${b.type}`);
    }
  }).join('');
}
