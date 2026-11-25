// A Markdown subset for project pages: headings, paragraphs, lists, images as
// figures, emphasis, inline code, links. Blocks starting with `<` are raw HTML.

export const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text) {
  const codes = [];
  let s = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

function block(b) {
  const lines = b.split('\n');
  if (b.startsWith('<')) return b;
  const h = /^(#{1,6})\s+(.*)$/.exec(b);
  if (h && lines.length === 1) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
  const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(b);
  if (img) {
    const alt = escapeHtml(img[1]);
    return `<figure><img src="${escapeHtml(img[2])}" alt="${alt}" loading="lazy">${alt ? `<figcaption>${alt}</figcaption>` : ''}</figure>`;
  }
  if (lines.every((l) => /^[-*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
  if (lines.every((l) => /^\d+\.\s+/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
  return `<p>${inline(lines.map((l) => l.trim()).join(' '))}</p>`;
}

export function renderMarkdown(md) {
  return md.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map(block).join('\n');
}
