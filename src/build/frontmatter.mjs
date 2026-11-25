// A small YAML subset for project frontmatter: `key: value`, `[a, b]` lists,
// one level of 2-space-indented maps, booleans, numbers, quoted strings.

function scalar(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map(scalar);
  }
  return v;
}

function splitPair(line, n) {
  const i = line.indexOf(':');
  if (i < 1) throw new Error(`Bad frontmatter line ${n}: "${line}"`);
  return [line.slice(0, i).trim(), line.slice(i + 1)];
}

export function parseFrontmatter(text) {
  const src = text.replace(/\r\n?/g, '\n');
  if (!src.startsWith('---\n')) return { data: {}, body: text };
  const end = src.indexOf('\n---', 3);
  if (end === -1) throw new Error('Unterminated frontmatter: missing closing ---');
  const lines = src.slice(4, end).split('\n');
  const body = src.slice(end + 4).replace(/^\n/, '');
  const data = {};
  let map = null;
  lines.forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    if (/^\s{2,}\S/.test(line)) {
      if (!map) throw new Error(`Indented frontmatter line ${i + 1} has no parent key`);
      const [k, v] = splitPair(line, i + 1);
      map[k] = scalar(v);
      return;
    }
    const [k, v] = splitPair(line, i + 1);
    if (v.trim() === '') { map = data[k] = {}; return; }
    map = null;
    data[k] = scalar(v);
  });
  return { data, body };
}
