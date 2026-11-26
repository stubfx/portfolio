// The git graph in the gutter: main is the rail, the focused branch draws in
// on lane 1, the previous one lingers as a ghost, and a Neovide cursor rides the nodes.
import { focusReducer, laneTarget, branchPath, pickCurrent } from './graph-core.mjs';
import { stepCursor, settled } from './cursor-core.mjs';

const NS = 'http://www.w3.org/2000/svg';

function mk(doc, tag, attrs = {}) {
  const e = doc.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

const ease = (a, b, k) => (k === null || Math.abs(b - a) < 0.002 ? b : a + (b - a) * k);

/** @returns {null | { rows: object[], index: number, go(i: number): void, step(d: number): void, project(d: number): void, land(): boolean }} */
export function startGraph(doc = document) {
  const win = doc.defaultView;
  const svg = doc.getElementById('graph');
  const page = doc.querySelector('.page');
  const anchors = [...doc.querySelectorAll('.eb[data-hash], .slim[data-hash]')];
  if (!svg || !page || !anchors.length) return null;

  const topo = JSON.parse(doc.getElementById('branches')?.textContent || '[]');
  const label = Object.fromEntries(topo.map((b) => [b.name, b.label || b.name]));
  const merges = new Set(topo.map((b) => b.merge).filter(Boolean));
  const rows = anchors.map((el) => ({
    el,
    hash: el.dataset.hash,
    branch: el.dataset.branch,
    kind: el.dataset.kind,
    special: el.hasAttribute('data-special'),
  }));
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');

  const gBr = mk(doc, 'g');
  const gMain = mk(doc, 'g');
  const cursor = mk(doc, 'rect', { width: 14, rx: 1.5, style: 'fill:var(--mauve)' });
  const dot = mk(doc, 'circle', { r: 3.2, style: 'fill:var(--bg, var(--base))' });
  svg.append(gBr, gMain, cursor, dot);

  const S = {};
  for (const b of topo) {
    if (b.name === 'main') continue;
    const g = mk(doc, 'g', { opacity: 0 });
    const p = mk(doc, 'path', {
      pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1,
      style: `fill:none;stroke:var(--b-${b.name});stroke-width:2;stroke-linecap:round`,
    });
    const nodes = mk(doc, 'g');
    g.append(p, nodes);
    gBr.append(g);
    S[b.name] = { ...b, g, p, nodes, x: 0, op: 0, draw: 0, tx: 0, top: 0, tdraw: 0, geo: null };
  }

  let state = { focus: 'main', ghost: null };
  let idx = 0;
  let Y = [];
  let X0 = 0, L1 = 0, L2 = 0, narrow = false;
  let c = null;
  let raf = 0;
  // After go(), the chosen row stays current until the user scrolls by hand.
  let pinned = -1;

  const docY = (el) => { let y = 0; while (el && el !== page) { y += el.offsetTop; el = el.offsetParent; } return y; };
  const k = () => (motion.matches ? null : 0.16);

  function retarget() {
    for (const name in S) {
      const s = S[name];
      if (!s.geo) { s.top = 0; s.tdraw = 0; continue; }
      const t = laneTarget(name, state, narrow);
      s.top = t.opacity;
      s.tdraw = t.draw;
      if (t.lane) s.tx = t.lane === 1 ? L1 : L2;
      if (s.op < 0.01 && s.top > 0) s.x = s.tx;
    }
  }

  function layout() {
    const gw = parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue('--gw')) || 76;
    narrow = gw < 60;
    X0 = gw + 0.5;
    L1 = gw - (narrow ? 18 : 22);
    L2 = gw - 46;
    const H = page.offsetHeight;
    svg.setAttribute('width', gw + 8);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${gw + 8} ${H}`);
    Y = rows.map((r) => docY(r.el) + r.el.offsetHeight / 2);
    const at = Object.fromEntries(rows.map((r, i) => [r.hash, i]));
    const topY = Y[0] - 26;

    const mainRows = rows.map((r, i) => [r, Y[i]]).filter(([r]) => r.branch === 'main');
    let html = `<path d="M${X0} ${Y[0]}V${mainRows.at(-1)[1]}" style="stroke:var(--b-main);stroke-width:2;fill:none"/>`;
    for (const [r, y] of mainRows) {
      const ring = r.kind === 'head' || r.kind === 'root' || r.kind === 'merge' || merges.has(r.hash) || r.kind === 'project';
      if (ring) html += `<circle cx="${X0}" cy="${y}" r="6.5" style="fill:var(--bg, var(--base));stroke:var(--b-main);stroke-width:2"/>`;
      if (!ring) html += `<circle cx="${X0}" cy="${y}" r="5" style="fill:var(--b-main)"/>`;
      else if (r.kind !== 'root') html += `<circle cx="${X0}" cy="${y}" r="2.6" style="fill:var(--b-main)"/>`;
    }
    gMain.innerHTML = html;

    for (const name in S) {
      const s = S[name];
      const mine = rows.map((r, i) => i).filter((i) => rows[i].branch === name);
      if (!mine.length) { s.geo = null; continue; }
      const ys = mine.map((i) => Y[i]);
      s.geo = {
        ys,
        kinds: mine.map((i) => (rows[i].special ? 'special' : rows[i].kind)),
        mY: s.merge !== undefined && at[s.merge] !== undefined ? Y[at[s.merge]] : null,
        fY: s.fork !== undefined && at[s.fork] !== undefined ? Y[at[s.fork]] : Math.max(...ys) + 34,
        top: topY,
      };
    }
    retarget();
    kick();
  }

  function nodeX(i) {
    const b = rows[i]?.branch;
    return !b || b === 'main' || !S[b] ? X0 : S[b].x;
  }

  function frame() {
    raf = 0;
    const kk = k();
    let busy = false;
    for (const name in S) {
      const s = S[name];
      s.op = ease(s.op, s.top, kk);
      s.x = ease(s.x, s.tx, kk);
      s.draw = s.top === 0 && s.op < 0.03 ? 0 : ease(s.draw, s.tdraw, kk === null ? null : 0.12);
      if (s.op !== s.top || s.x !== s.tx || s.draw !== s.tdraw) busy = true;
      s.g.setAttribute('opacity', s.op.toFixed(3));
      if (!s.geo) { s.nodes.innerHTML = ''; continue; }
      s.p.setAttribute('d', branchPath(s.geo, s.x, X0));
      s.p.setAttribute('stroke-dashoffset', (1 - s.draw).toFixed(4));
      const vis = s.draw > 0.85 ? 1 : 0;
      const col = `var(--b-${name})`;
      s.nodes.innerHTML = s.geo.ys.map((y, i) => {
        const kind = s.geo.kinds[i];
        const tick = `<path d="M${s.x + 7} ${y}H${X0}" style="stroke:${col};stroke-width:1" opacity="${0.5 * vis}"/>`;
        if (kind === 'special') return tick + `<rect x="${s.x - 5.5}" y="${y - 5.5}" width="11" height="11" transform="rotate(45 ${s.x} ${y})" style="fill:${col}" opacity="${vis}"/>`;
        if (kind === 'project') return tick + `<circle cx="${s.x}" cy="${y}" r="6.5" style="fill:var(--bg, var(--base));stroke:${col};stroke-width:2" opacity="${vis}"/><circle cx="${s.x}" cy="${y}" r="2.6" style="fill:${col}" opacity="${vis}"/>`;
        return tick + `<circle cx="${s.x}" cy="${y}" r="5" style="fill:${col}" opacity="${vis}"/>`;
      }).join('');
    }

    const target = { x: nodeX(idx), y: Y[idx] };
    c = c ? stepCursor(c, target, kk === null ? null : undefined) : stepCursor(null, target, null);
    if (!settled(c, target)) busy = true;
    cursor.setAttribute('x', (c.x - 7).toFixed(2));
    cursor.setAttribute('y', c.top.toFixed(2));
    cursor.setAttribute('height', Math.max(22, c.bot - c.top).toFixed(2));
    dot.setAttribute('cx', target.x.toFixed(2));
    dot.setAttribute('cy', target.y.toFixed(2));
    if (busy) raf = win.requestAnimationFrame(frame);
  }

  function kick() { if (!raf) raf = win.requestAnimationFrame(frame); }

  function emit() {
    const r = rows[idx];
    doc.dispatchEvent(new win.CustomEvent('graph:current', {
      detail: { index: idx, total: rows.length, hash: r.hash, branch: r.branch, label: label[r.branch] || r.branch, kind: r.kind },
    }));
  }

  function setCurrent(i) {
    if (i === idx && c) return;
    idx = i;
    state = focusReducer(state, rows[i].branch);
    retarget();
    emit();
    kick();
  }

  function detect() {
    if (pinned >= 0) return;
    const pageTop = page.getBoundingClientRect().top + win.scrollY;
    const line = win.scrollY - pageTop + win.innerHeight * 0.6;
    const atBottom = win.innerHeight + win.scrollY >= doc.documentElement.scrollHeight - 2;
    setCurrent(pickCurrent(Y, line, atBottom, -1));
  }

  function go(i) {
    const n = Math.max(0, Math.min(rows.length - 1, i));
    setCurrent(n);
    pinned = n;
    const pageTop = page.getBoundingClientRect().top + win.scrollY;
    win.scrollTo({ top: pageTop + Y[n] - win.innerHeight * 0.25, behavior: motion.matches ? 'instant' : 'smooth' });
  }

  function onClick(e) {
    if (e.button !== 0 || e.target.closest('a, button, input, label, summary')) return;
    const box = svg.getBoundingClientRect();
    let best = -1;
    let bestD = 16;
    rows.forEach((r, i) => {
      if (r.branch !== 'main' && S[r.branch] && S[r.branch].op < 0.5) return;
      const d = Math.hypot(e.clientX - (box.left + nodeX(i)), e.clientY - (box.top + Y[i]));
      if (d <= bestD) { bestD = d; best = i; }
    });
    if (best >= 0) go(best);
  }

  let pending = 0;
  const relayout = () => { if (!pending) pending = win.requestAnimationFrame(() => { pending = 0; layout(); detect(); }); };
  new win.ResizeObserver(relayout).observe(page);
  doc.fonts?.ready.then(relayout);
  win.addEventListener('scroll', () => win.requestAnimationFrame(detect), { passive: true });
  win.addEventListener('pageshow', relayout);
  const unpin = () => { if (pinned >= 0) { pinned = -1; win.requestAnimationFrame(detect); } };
  for (const ev of ['wheel', 'touchstart', 'mousedown']) win.addEventListener(ev, unpin, { passive: true });
  doc.addEventListener('focusin', unpin);
  doc.addEventListener('keydown', (e) => {
    if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(e.key)) unpin();
  });
  win.addEventListener('hashchange', () => { unpin(); relayout(); });
  motion.addEventListener('change', kick);
  doc.addEventListener('click', onClick);

  layout();
  detect();
  emit();

  const projects = () => rows.map((r, i) => (r.kind === 'project' ? i : -1)).filter((i) => i >= 0);
  return {
    rows,
    get index() { return idx; },
    go,
    step(d) { go(idx + d); },
    project(d) {
      const list = projects();
      const target = d > 0 ? list.find((i) => i > idx) : list.reverse().find((i) => i < idx);
      if (target !== undefined) go(target);
    },
    land() {
      const a = rows[idx].el.closest('.entry')?.querySelector('a.pc-att');
      if (a) { a.click(); return true; }
      return false;
    },
  };
}
