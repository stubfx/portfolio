// Inline Markdown for the subset: **strong**, `code`, [text](href), backslash escapes.
// Everything else that looks like markup is an error, so content can't drift.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const ESCAPABLE = '*_=[]()`\\<';
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEMES = new Set(['https', 'http', 'mailto']);
// Link targets may hold one level of balanced parentheses (Wikipedia-style URLs).
const LINK = /^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/;
const HAS_LINK = /\[[^\]]+\]\([^)\s]+\)/;

const unescape = (s) => s.replace(/\\([*_=[\]()`\\<])/g, '$1');

/** Text with escapes, code spans and link targets blanked out, scanned the way parseInline reads it:
 *  what the markup checks look at (so a URL's _ or == is never mistaken for markup). */
function masked(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && ESCAPABLE.includes(text[i + 1] ?? '\0')) { out += '  '; i += 2; continue; }
    if (c === '`') {
      const j = text.indexOf('`', i + 1);
      if (j > i) { out += ' '.repeat(j - i + 1); i = j + 1; continue; }
    }
    if (c === '[') {
      const m = LINK.exec(text.slice(i));
      if (m) { out += `[${m[1]}]`.padEnd(m[0].length, ' '); i += m[0].length; continue; }
    }
    out += c;
    i++;
  }
  return out;
}

function markupErrors(text) {
  const errors = [];
  const m = masked(text);
  if ((m.match(/`/g) || []).length % 2) errors.push('unclosed `code` span');
  if ((m.match(/\*\*/g) || []).length % 2) errors.push('unclosed **bold**');
  const noBold = m.replace(/\*\*/g, '  ');
  if (/(?<![*\w])\*(?![\s*])[^*]*?(?<!\s)\*(?!\*)/.test(noBold) || /(?<![\w])_(?![\s_])[^_]*?(?<!\s)_(?!\w)/.test(noBold))
    errors.push("italics (*emphasis*) aren't decided yet: use **bold** or plain text");
  if (m.includes('==')) errors.push('== marks a punch line only: a paragraph that is just ==text==');
  if (/<[a-zA-Z/!]/.test(m)) errors.push("HTML isn't allowed inline");
  return errors;
}

/** @returns {{nodes: Array<{t:'text'|'strong'|'code', v:string}|{t:'link', text:string, href:string}>, errors: string[]}} */
export function parseInline(text) {
  const nodes = [];
  const errors = markupErrors(text);
  let buf = '';
  const flush = () => { if (buf) nodes.push({ t: 'text', v: buf }); buf = ''; };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && ESCAPABLE.includes(text[i + 1] ?? '\0')) { buf += text[i + 1]; i += 2; continue; }
    if (c === '`') {
      const j = text.indexOf('`', i + 1);
      if (j > i) { flush(); nodes.push({ t: 'code', v: text.slice(i + 1, j) }); i = j + 1; continue; }
    }
    if (text.startsWith('**', i)) {
      const j = text.indexOf('**', i + 2);
      if (j > i) {
        const v = text.slice(i + 2, j);
        if (HAS_LINK.test(v)) errors.push("a link can't be inside **bold**: bold the words around it instead");
        flush();
        nodes.push({ t: 'strong', v: unescape(v) });
        i = j + 2;
        continue;
      }
    }
    if (c === '[') {
      const m = LINK.exec(text.slice(i));
      if (m) {
        const scheme = SCHEME.exec(m[2]);
        if (scheme && !ALLOWED_SCHEMES.has(scheme[1].toLowerCase()))
          errors.push(`link scheme "${scheme[1]}:" isn't allowed: use https:, http:, mailto: or a relative path`);
        if (m[1].includes('**')) errors.push('no **bold** inside link text');
        flush();
        nodes.push({ t: 'link', text: unescape(m[1]), href: m[2] });
        i += m[0].length;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return { nodes, errors };
}

/** Plain text of inline Markdown (markers dropped), for titles and descriptions. */
export const inlineText = (text) => parseInline(text).nodes.map((n) => (n.t === 'link' ? n.text : n.v)).join('');

/** @param {(href: string) => {href: string, external: boolean}} link */
export function renderInline(nodes, link) {
  return nodes.map((n) => {
    if (n.t === 'strong') return `<strong>${escapeHtml(n.v)}</strong>`;
    if (n.t === 'code') return `<code>${escapeHtml(n.v)}</code>`;
    if (n.t === 'link') {
      const { href, external } = link(n.href);
      return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(n.text)}</a>`;
    }
    return escapeHtml(n.v);
  }).join('');
}
