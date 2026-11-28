// A ```logic diagram read as a graph: its labels, strokes and arrowheads, placed on the character grid, each with
// the moment it appears (t) and how long it takes to draw (l), in ms. The page draws it in that order (site/graph.js
// and the "logic graphs" rules in site/style.css); the Markdown text stays the source. docs/DESIGN.md section 7.
export const LANE = 28;           // Me lane left of this column, Machine lane from it
export const CW = 0.6;            // a mono cell: advance width, in em
export const LH = 1.55;           // and line height, in em
const DOWN = 85;                  // ms to draw one row down
const ACROSS = 16;                // ms to draw one cell across
const AFTER = 60;                 // ms between an arrival and what it reaches
const ACCENTS = 6;                // accent colours a0…a5, cycled
const HEAD = 0.5;                 // arrowhead length and width, in em

const STEP = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const BACK = { u: 'd', d: 'u', l: 'r', r: 'l' };
const LINKS = { '│': 'ud', '─': 'lr', '┘': 'ul', '└': 'ur', '┐': 'dl', '┌': 'dr', '├': 'udr', '┤': 'udl', '┬': 'lrd', '┴': 'lru', '┼': 'udlr', '▼': 'ud', '▲': 'ud', '▶': 'lr', '◀': 'lr' };
const POINT = { '▼': 'd', '▲': 'u', '▶': 'r', '◀': 'l' };
const ORDER = 'uldr'; // which free side a stroke starts from, when it has several

const round = (v) => Math.round(v * 1000) / 1000;
const half = (d) => (d === 'u' || d === 'd' ? LH / 2 : CW / 2);
const ms = (d, len) => (d === 'u' || d === 'd' ? DOWN * (len / LH) : ACROSS * (len / CW));

/** @param {string[]} lines the block's lines @returns {{cols: number, rows: number, labels: object[], segments: object[], heads: object[]}} */
export function graph(lines) {
  const grid = lines.map((l) => [...l]);
  const rows = grid.length;
  const cols = Math.max(0, ...grid.map((r) => r.length));
  const at = (c, r) => grid[r]?.[c] ?? ' ';
  const box = (c, r) => at(c, r) in LINKS;
  const id = (c, r) => r * 4096 + c;
  const linked = (c, r, d) => {
    const [dc, dr] = STEP[d];
    return box(c + dc, r + dr) && LINKS[at(c + dc, r + dr)].includes(BACK[d]);
  };
  const lane = (c) => (c < LANE ? 'me' : 'm');

  // Labels: runs of text, ended by a box character, two spaces, or a space before a box character.
  const labels = [];
  grid.forEach((row, r) => {
    for (let c = 0; c < row.length;) {
      if (row[c] === ' ' || row[c] in LINKS) { c++; continue; }
      let e = c;
      while (e < row.length && !(row[e] in LINKS) && !(row[e] === ' ' && (e + 1 >= row.length || row[e + 1] === ' ' || row[e + 1] in LINKS))) e++;
      labels.push({ text: row.slice(c, e).join(''), r, c, n: e - c, lane: lane(c), title: r === 0 });
      c = e;
    }
  });
  const labelAt = (c, r) => labels.find((l) => l.r === r && c >= l.c && c < l.c + l.n);
  /** The label a side of a cell faces: across up to two spaces on the row, or the row above or below. */
  const facing = (c, r, d) => {
    if (d === 'u' || d === 'd') return labelAt(c, r + STEP[d][1]);
    for (let k = 1; k <= 3; k++) {
      const x = c + STEP[d][0] * k;
      if (box(x, r)) return null;
      const l = labelAt(x, r);
      if (l) return l;
    }
    return null;
  };

  // Strokes: each connected group of box characters is walked once from its start, in relative time.
  const seen = new Set();
  const groups = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!box(c, r) || seen.has(id(c, r))) continue;
    const cells = [];
    const queue = [[c, r]];
    seen.add(id(c, r));
    while (queue.length) {
      const [x, y] = queue.shift();
      cells.push([x, y]);
      for (const d of LINKS[at(x, y)]) {
        const [nx, ny] = [x + STEP[d][0], y + STEP[d][1]];
        if (linked(x, y, d) && !seen.has(id(nx, ny))) { seen.add(id(nx, ny)); queue.push([nx, ny]); }
      }
    }
    cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const free = (x, y) => [...ORDER].filter((d) => LINKS[at(x, y)].includes(d) && !linked(x, y, d) && POINT[at(x, y)] !== d);
    const start = cells.find(([x, y]) => free(x, y).length) ?? cells[0];
    groups.push({ ...walk(start, free(...start)[0]), start, stub: free(...start)[0] });
  }

  function walk([c0, r0], stub) {
    const segments = [];
    const heads = [];
    const times = new Map();
    const done = new Set();
    const centre = (c, r) => [(c + 0.5) * CW, (r + 0.5) * LH];
    // the first stroke comes in from the start's free side
    let first = null;
    let t0 = 0;
    if (stub) {
      const [x, y] = centre(c0, r0);
      const [dx, dy] = STEP[stub];
      first = { x1: x + dx * half(stub), y1: y + dy * half(stub), x2: x, y2: y, t: 0, l: ms(stub, half(stub)), dir: BACK[stub], lane: lane(c0) };
      segments.push(first);
      t0 = first.l;
    }
    const go = (c, r, from, t, carry) => {
      done.add(id(c, r));
      times.set(id(c, r), t);
      const [x, y] = centre(c, r);
      const ch = at(c, r);
      const sides = [...LINKS[ch]].filter((d) => d !== from);
      let open = carry;
      const take = (d) => {
        // a stroke that goes straight on continues the open one; a turn or a branch starts a new one here
        if (open && open.dir === d) { const s = open; open = null; return s; }
        const s = { x1: x, y1: y, x2: x, y2: y, t, l: 0, dir: d, lane: lane(c) };
        segments.push(s);
        return s;
      };
      for (const d of sides) {
        const [dx, dy] = STEP[d];
        if (linked(c, r, d)) {
          const [nx, ny] = [c + dx, r + dy];
          if (done.has(id(nx, ny))) continue;
          const s = take(d);
          const len = d === 'u' || d === 'd' ? LH : CW;
          if (POINT[ch] === d) { // an arrowhead the line runs on through (▼ over a corner): drawn where the line passes it
            const base = half(d) + (d === 'u' || d === 'd' ? 0.18 : 0) - HEAD;
            heads.push({ c, r, dir: d, x: x + dx * base, y: y + dy * base, t: t + ms(d, Math.max(base, 0.01)), lane: lane(c) });
          }
          s.x2 = x + dx * len; s.y2 = y + dy * len; s.l += ms(d, len);
          s.lane = lane(nx);
          go(nx, ny, BACK[d], t + ms(d, len), s);
        } else if (POINT[ch] === d) {
          const s = take(d);
          const len = half(d) + (d === 'u' || d === 'd' ? 0.18 : 0) - HEAD;
          s.x2 = x + dx * len; s.y2 = y + dy * len; s.l += ms(d, Math.max(len, 0.01));
          heads.push({ c, r, dir: d, x: s.x2, y: s.y2, t: t + ms(d, Math.max(len, 0.01)), lane: lane(c) });
        } else if (!(c === c0 && r === r0 && d === stub)) {
          const s = take(d);
          s.x2 = x + dx * half(d); s.y2 = y + dy * half(d); s.l += ms(d, half(d));
        }
      }
    };
    go(c0, r0, stub, t0, first);
    return { segments: segments.filter((s) => s.l > 0), heads, times };
  }

  // Time: a group starts at its row, after the label it leaves; a label shows at its row, after what reaches it.
  // Each depends on the other, so settle them together.
  const rowT = (r) => r * DOWN;
  for (const l of labels) l.t = l.title ? 0 : rowT(l.r);
  for (const gr of groups) gr.t0 = rowT(gr.start[1]);
  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (const gr of groups) {
      const from = gr.stub ? facing(gr.start[0], gr.start[1], gr.stub) : null;
      gr.from = from;
      const t0 = Math.max(rowT(gr.start[1]), from ? from.t + AFTER : 0);
      if (t0 !== gr.t0) { gr.t0 = t0; moved = true; }
    }
    for (const l of labels) {
      if (l.title) continue;
      let t = rowT(l.r);
      const above = labels.find((o) => o.r === l.r - 1 && o.c < l.c + l.n && l.c < o.c + o.n);
      if (above) t = Math.max(t, above.t + AFTER);
      for (const gr of groups) {
        // only a forward arrow holds a label back; one that loops back up (a redirect) reaches it again later
        if (gr.start[1] <= l.r) for (const h of gr.heads) if (facing(h.c, h.r, h.dir) === l) t = Math.max(t, gr.t0 + h.t + AFTER);
        // a note beside a line shows as the line passes it, unless the line leaves from this very label
        if (gr.from !== l) for (const k of [1, 2]) if (box(l.c - k, l.r) && gr.times.has(id(l.c - k, l.r))) t = Math.max(t, gr.t0 + gr.times.get(id(l.c - k, l.r)));
      }
      t = Math.round(t);
      if (t !== l.t) { l.t = t; moved = true; }
    }
    if (!moved) break;
  }

  // Accents: labels in the order they appear, strokes by group.
  [...labels].sort((a, b) => a.t - b.t || a.r - b.r || a.c - b.c).forEach((l, k) => { l.a = k % ACCENTS; });
  const segments = [];
  const heads = [];
  groups.forEach((gr, k) => {
    for (const s of gr.segments) segments.push({ x1: round(s.x1), y1: round(s.y1), x2: round(s.x2), y2: round(s.y2), t: Math.round(gr.t0 + s.t), l: Math.max(1, Math.round(s.l)), lane: s.lane, a: k % ACCENTS });
    for (const h of gr.heads) heads.push({ dir: h.dir, x: h.x, y: h.y, t: Math.round(gr.t0 + h.t), lane: h.lane, a: k % ACCENTS });
  });
  return { cols, rows, labels, segments, heads };
}

const U = 16; // user units per em in the SVG: text at 16 px, never a tiny size a browser's minimum font size would bump

/** The graph as inline SVG, on the text diagram's own grid (an em is 16 units). */
export function graphSVG(g, esc) {
  const u = (v) => round(v * U);
  const W = round(g.cols * CW);
  const H = round(g.rows * LH);
  const lanes = g.labels.filter((l) => l.title);
  const body = g.labels.filter((l) => !l.title).sort((a, b) => a.t - b.t || a.r - b.r);
  const alt = lanes.length === 2
    ? `Diagram. ${lanes.filter((ln) => body.some((l) => l.lane === ln.lane)).map((ln) => `${ln.text}: ${body.filter((l) => l.lane === ln.lane).map((l) => l.text).join(', ')}.`).join(' ')}`
    : `Diagram: ${body.map((l) => l.text).join(', ')}.`;
  const out = [];
  for (const s of g.segments) out.push(`<path class="s ${s.lane} a${s.a}" d="M${u(s.x1)} ${u(s.y1)}L${u(s.x2)} ${u(s.y2)}" pathLength="1" data-t="${s.t}" data-l="${s.l}"/>`);
  for (const h of g.heads) {
    const [dx, dy] = STEP[h.dir];
    const [px, py] = [-dy, dx];
    const p = [[h.x + dx * HEAD, h.y + dy * HEAD], [h.x + px * HEAD / 2, h.y + py * HEAD / 2], [h.x - px * HEAD / 2, h.y - py * HEAD / 2]];
    out.push(`<path class="h ${h.lane} a${h.a}" d="M${p.map(([x, y]) => `${u(x)} ${u(y)}`).join(' L')}Z" data-t="${h.t}"/>`);
  }
  for (const l of g.labels) {
    out.push(`<text class="t ${l.lane}${l.title ? ' lane' : ''} a${l.a}" x="${u(l.c * CW)}" y="${u(l.r * LH + 1.13)}" textLength="${u(l.n * CW)}" lengthAdjust="spacingAndGlyphs" data-t="${l.t}">${esc(l.text)}</text>`);
  }
  return `<svg class="graph" role="img" aria-label="${esc(alt)}" viewBox="0 0 ${u(W)} ${u(H)}" width="${Math.round(W * U)}" height="${Math.round(H * U)}">${out.join('')}</svg>`;
}
