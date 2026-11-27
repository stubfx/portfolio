// Inline Markdown for the subset: **strong**, `code`, [text](href), backslash escapes.
// Everything else that looks like markup is an error, so content can't drift.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const ESCAPABLE = '*_=[]()`\\<';
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEMES = new Set(['https', 'http', 'mailto']);
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)/;

const unescape = (s) => s.replace(/\\([*_=[\]()`\\<])/g, '$1');

/** Text with code spans and escapes blanked out: what the markup checks look at. */
function masked(text) {
  return text.replace(/\\[*_=[\]()`\\<]/g, '  ').replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
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
      if (j > i) { flush(); nodes.push({ t: 'strong', v: unescape(text.slice(i + 2, j)) }); i = j + 2; continue; }
    }
    if (c === '[') {
      const m = LINK.exec(text.slice(i));
      if (m) {
        const scheme = SCHEME.exec(m[2]);
        if (scheme && !ALLOWED_SCHEMES.has(scheme[1].toLowerCase()))
          errors.push(`link scheme "${scheme[1]}:" isn't allowed: use https:, http:, mailto: or a relative path`);
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
