// The sky: a lowbit, dithered galaxy behind every page, drawn the old way on purpose.
//
// - An indexed-colour framebuffer a third of the screen's size, scaled up with hard pixels. It holds the
//   whole page's sky (the screen plus a twentieth of the scroll), so scrolling is CSS: a scroll-driven
//   animation moves the canvas in whole-pixel steps on the compositor. No script runs on scroll.
// - The sky is baked row by row, the rows on screen first, a few dozen per tick so nothing stalls: value
//   noise and a band, ordered-dithered (Bayer 4x4) into 4 palette levels, so the dither moves with the sky.
//   Each row keeps its palette indices for two dither phases; alternating them makes the mid-tones breathe.
// - Dirty pixels: a frame touches only what changed (new rows, the pixels the lens and meteors covered, the
//   stars). Only a palette step or a breath recomposes the whole buffer, from the indices, one lookup a pixel.
// - Twinkle is palette cycling: stars belong to four colour groups; a twinkle tick rewrites star pixels only.
// - The reading column is a calm lane: almost flat page base, no stars, shooting stars pass behind it.
// - Shooting stars burn out with an ordered-dither dissolve over their last few ticks.
// - The pointer carries a faint dither lens: the sky lifts a touch around it and re-dithers (fine pointers only).
// - 10 ticks a second at rest, 30 while something moves; none when hidden.
// - Reduced motion: a still sky (no parallax, twinkle, breathing, shooting stars or lens).
import { bayer, noise, fbm, baseLevel, ramp, laneFactors, quantize, lazyRows, twinkle, stepMeteor, starsForRow, hash32, meteorPixels } from './sky-core.mjs';

const SCALE = 3, LEVELS = 4, BAYER = 4, STRENGTH = 1, STAR_DENSITY = 0.0015;
const SPEED = 0.05; // the sky moves at a twentieth of the scroll
const LANE_MIN = 0.08, LANE_FALL = 120; // behind the text: 8% of the sky's variation; fades in over 120 px
const IDLE_MS = 100, BUSY_MS = 33, FADE_MS = 1200, FADE_REDUCED_MS = 450, BREATHE_TICKS = 4;
const LENS = 0.12, LENS_R = 90; // the pointer's lift of the sky (in value) and its radius (screen px)
const BAKE_PER_TICK = 24; // rows baked per tick at most
const METEOR_FADE = 8; // a shooting star burns out over its last 8 ticks (about a quarter of a second)
const STAR_DIM = [88, 91, 112], STAR_MID = [166, 173, 200], STAR_HI = [205, 214, 244];
const METEOR = [[245, 224, 220], [205, 214, 244], [166, 173, 200], [108, 112, 134]];

const hexRgb = (h) => { const n = parseInt(String(h).trim().replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const pack = ([r, g, b]) => ((255 << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ lane?: () => [number, number] | null, colours?: () => { base: string, accent: string } }} o
 */
export function startSky(canvas, { lane = () => null, colours } = {}) {
  if (!canvas || !canvas.getContext) return null;
  const doc = canvas.ownerDocument, win = doc.defaultView;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = win.matchMedia('(pointer: fine)');
  const B = bayer(BAYER), bn = BAYER - 1, kb = baseLevel(LEVELS), vBase = kb / (LEVELS - 1);
  const sky = noise(1895), dust = noise(2015);
  const pal = new Uint32Array(16);

  let W = 0, H = 0, T = 0, rows = null, vals = null, laneF = null, starKeep = null, img = null, px = null;
  let order = [], next = 0, stars = []; // bake order (rows on screen first); baked star pixels [index, slot]
  let fresh = [], over = []; // rows baked since the last frame; pixels the lens and meteors drew last frame
  let tick = 0, phase = 0, timer = 0, meteors = [], nextMeteor = 0, laneKey = '', breathe = 0;
  const lens = { on: false, x: 0, y: 0, tx: 0, ty: 0 };
  const start = colours ? colours() : { base: '#1e1e2e', accent: '#b4befe' };
  let from = { base: hexRgb(start.base), accent: hexRgb(start.accent) }, to = from, fadeStart = 0, fadeMs = 0;

  const current = (now) => {
    if (!fadeMs) return to;
    const t = Math.min(1, (now - fadeStart) / fadeMs);
    return { base: mix(from.base, to.base, t), accent: mix(from.accent, to.accent, t) };
  };
  // The sky's offset for the current scroll, read only where it is free (events, rare ticks): never on scroll.
  const offsetRows = () => (reduce.matches ? 0 : Math.round(win.scrollY * SPEED) / SCALE);

  // One row, as palette indices for both dither phases ([phase 0 | phase 1], stars burned into both), and
  // the raw values (for the lens).
  function bake(y, row) {
    const y0 = T * 0.35, bw = Math.max(40, H * 0.55);
    const lv0 = row.subarray(0, W), lv1 = row.subarray(W, 2 * W);
    for (let x = 0; x < W; x++) {
      const d = (y - (y0 - 0.32 * x)) / bw, b = Math.exp(-d * d);
      let v = STRENGTH * ((0.12 + 0.88 * b) * (0.3 + 0.7 * fbm(sky, x / 38, y / 38)) - 0.3 * fbm(dust, x / 16 + 50, y / 16) * b);
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      v = vBase + (v - vBase) * laneF[x]; // exactly the base level (flat) as the lane closes
      vals[y * W + x] = v;
      lv0[x] = quantize(v, LEVELS, B[((y & bn) * BAYER) + (x & bn)]);
      lv1[x] = quantize(v, LEVELS, B[(((y + 1) & bn) * BAYER) + ((x + 1) & bn)]);
    }
    // Stars: hashed per row (no lines), thinned toward the lane by a per-star hash, none inside it.
    for (const s of starsForRow(y, W, STAR_DENSITY)) {
      if ((hash32(y * 4099 + s.x) / 4294967296) < starKeep[s.x]) { lv0[s.x] = lv1[s.x] = 8 + s.g; stars.push(y * W + s.x, 8 + s.g); }
    }
    fresh.push(y);
  }

  function build(onlyIfChanged) {
    const vw = win.innerWidth, vh = win.innerHeight, l = lane();
    const scrollMax = Math.max(0, doc.documentElement.scrollHeight - vh);
    const key = [vw, vh, scrollMax, l && l.map(Math.round)].join();
    if (onlyIfChanged && key === laneKey) return;
    laneKey = key;
    const travel = Math.round(scrollMax * SPEED); // screen px the sky moves over the whole page
    W = Math.ceil(vw / SCALE); H = Math.ceil(vh / SCALE) + 1; T = H + Math.ceil(travel / SCALE) + 1;
    canvas.width = W; canvas.height = T;
    canvas.style.width = `${W * SCALE}px`; canvas.style.height = `${T * SCALE}px`;
    canvas.style.setProperty('--sky-travel', `${travel}px`); // sky.css: the scroll-driven drift, in whole-pixel steps
    canvas.style.setProperty('--sky-steps', String(Math.max(1, travel)));
    img = ctx.createImageData(W, T); px = new Uint32Array(img.data.buffer);
    laneF = laneFactors(W, l ? l[0] / SCALE : null, l ? l[1] / SCALE : null, LANE_FALL / SCALE, LANE_MIN);
    starKeep = Float32Array.from(laneF, (f) => (f - LANE_MIN) / (1 - LANE_MIN)); // no stars in the lane
    vals = new Float32Array(W * T); stars = []; fresh = []; over = [];
    rows = lazyRows(2 * W, T, bake);
    const v0 = Math.min(T - 1, Math.floor(offsetRows())); // the rows on screen first, then outward
    order = [];
    for (let i = 0; i < T; i++) { const a = v0 + i, b = v0 - 1 - i; if (a < T) order.push(a); if (b >= 0) order.push(b); }
    next = 0;
    bakeSome(); paint(true); wake();
  }

  function bakeSome() {
    for (let n = 0; n < BAKE_PER_TICK && next < order.length; n++) rows.get(order[next++]);
  }
  const baking = () => next < order.length;

  function palette(now) {
    const c = current(now);
    ramp(LEVELS, c.base, c.accent).forEach((rgb, i) => { pal[i] = pack(rgb); });
    for (let g = 0; g < 4; g++) {
      const s = reduce.matches ? 0.5 : twinkle(phase, g);
      pal[8 + g] = pack(s < 0.5 ? mix(STAR_DIM, STAR_MID, s * 2) : mix(STAR_MID, STAR_HI, (s - 0.5) * 2));
    }
    METEOR.forEach((rgb, i) => { pal[12 + i] = pack(rgb); });
  }

  // One frame. `full` (a palette step or a breath) recomposes every row from its indices; otherwise only the
  // rows baked since the last frame, the pixels the lens and meteors covered, and the stars are rewritten.
  // Then the lens and the meteors go on top, remembered so the next frame can take them off.
  function paint(full) {
    const ph = !reduce.matches && breathe & 1 ? W : 0; // the breathing dither: alternate phases
    const row = (y) => {
      const o = y * W;
      if (!rows.has(y)) { px.fill(pal[kb], o, o + W); return; } // not baked yet: the flat base
      const r = rows.get(y);
      for (let x = 0; x < W; x++) px[o + x] = pal[r[ph + x]];
    };
    if (full) for (let y = 0; y < T; y++) row(y);
    else {
      for (const y of fresh) row(y);
      for (const i of over) { const y = (i / W) | 0; px[i] = rows.has(y) ? pal[rows.get(y)[ph + i - y * W]] : pal[kb]; }
      for (let i = 0; i < stars.length; i += 2) px[stars[i]] = pal[stars[i + 1]];
    }
    fresh = []; over = [];
    if (lens.on) {
      // The dither lens: around the pointer the sky lifts a touch and is re-dithered with the same thresholds.
      const R = LENS_R / SCALE, p = ph ? 1 : 0;
      const x0 = Math.max(0, Math.floor(lens.x - R)), x1 = Math.min(W - 1, Math.ceil(lens.x + R));
      const y0 = Math.max(0, Math.floor(lens.y - R)), y1 = Math.min(T - 1, Math.ceil(lens.y + R));
      for (let y = y0; y <= y1; y++) {
        if (!rows.has(y)) continue;
        const r = rows.get(y), o = y * W;
        for (let x = x0; x <= x1; x++) {
          const dx = (x - lens.x) / R, dy = (y - lens.y) / R, d2 = dx * dx + dy * dy;
          if (d2 >= 1 || r[x] >= 8) continue; // outside, or a star
          const k = 1 - d2;
          px[o + x] = pal[quantize(vals[o + x] + LENS * k * k * laneF[x], LEVELS, B[(((y + p) & bn) * BAYER) + ((x + p) & bn)])];
          over.push(o + x);
        }
      }
    }
    const dither = (x, y) => B[((y & bn) * BAYER) + (x & bn)];
    for (const m of meteors) {
      for (const { x, y, slot } of meteorPixels(m, METEOR_FADE, dither)) {
        if (x >= 0 && x < W && y >= 0 && y < T && laneF[x] > 0.5) { px[y * W + x] = pal[slot]; over.push(y * W + x); }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function spawn(at) {
    const r = Math.random, dir = r() < 0.5 ? 1 : -1, a = 0.35 + 0.25 * r(), top = offsetRows();
    meteors.push({ x: W * (0.15 + 0.7 * r()), y: top + H * (0.05 + 0.3 * r()), vx: dir * 1.6 * Math.cos(a), vy: 0.75 + 0.3 * r(), life: 44, trail: [], ...at });
  }

  function loop() {
    timer = 0;
    const now = win.performance.now();
    bakeSome();
    let full = false;
    if (!reduce.matches) {
      tick++; phase += 0.12;
      if (tick % BREATHE_TICKS === 0) { breathe++; full = true; }
      if (now > nextMeteor) { spawn(); nextMeteor = now + 7000 + Math.random() * 9000; }
      meteors = meteors.map(stepMeteor).filter((m) => m.life > 0);
      if (lens.on) { lens.x += (lens.tx - lens.x) * 0.35; lens.y += (lens.ty - lens.y) * 0.35; }
    }
    if (fadeMs) full = true; // a palette step: every pixel's colour moves
    if (fadeMs && now - fadeStart >= fadeMs) { from = to; fadeMs = 0; }
    palette(now);
    paint(full);
    const lensMoving = lens.on && Math.abs(lens.tx - lens.x) + Math.abs(lens.ty - lens.y) > 0.3;
    // `over` left on screen (a lens or a meteor's last pixels) needs one more frame to come off
    const busy = meteors.length || fadeMs || lensMoving || baking() || (over.length && !lens.on);
    if (!doc.hidden && (!reduce.matches || busy)) timer = win.setTimeout(loop, busy ? BUSY_MS : IDLE_MS);
  }
  function wake() { if (!timer && !doc.hidden) loop(); }

  // The pointer feeds the lens target; the loop eases toward it.
  win.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduce.matches || !fine.matches) return;
    lens.tx = e.clientX / SCALE; lens.ty = e.clientY / SCALE + offsetRows();
    if (!lens.on) { lens.on = true; lens.x = lens.tx; lens.y = lens.ty; }
    wake();
  }, { passive: true });
  doc.documentElement.addEventListener('pointerleave', () => { lens.on = false; wake(); });
  let rebuild = 0;
  const relayout = (onlyIfChanged) => { if (!rebuild) rebuild = win.requestAnimationFrame(() => { rebuild = 0; build(onlyIfChanged); }); };
  win.addEventListener('resize', () => relayout(false), { passive: true });
  doc.fonts?.ready.then(() => relayout(true)); // a rebuild only if the lane or the page height moved
  doc.addEventListener('visibilitychange', () => { win.clearTimeout(timer); timer = 0; wake(); });
  reduce.addEventListener('change', () => { lens.on = false; palette(win.performance.now()); paint(true); wake(); });

  nextMeteor = win.performance.now() + 4000 + Math.random() * 6000;
  palette(win.performance.now());
  build(false);

  return {
    /** Fade the palette to a base and accent (#rrggbb). */
    tint(base, accent) {
      const now = win.performance.now();
      const nxt = { base: hexRgb(base), accent: hexRgb(accent) };
      if (nxt.base.join() === to.base.join() && nxt.accent.join() === to.accent.join()) return;
      from = current(now); to = nxt; fadeStart = now; fadeMs = reduce.matches ? FADE_REDUCED_MS : FADE_MS;
      wake();
    },
    /** A shooting star now; `at` may fix its start (canvas low-res px) and velocity (per tick). */
    meteor(at) { if (!reduce.matches) { spawn(at); win.clearTimeout(timer); timer = 0; wake(); } },
    state() {
      const t = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
      return { w: W, h: H, rows: T, scale: SCALE, baked: rows ? rows.baked : 0, pending: baking(), reduced: reduce.matches,
        target: { base: t(to.base), accent: t(to.accent) }, fading: !!fadeMs, meteors: meteors.length,
        lens: lens.on ? [Math.round(lens.x), Math.round(lens.y)] : null };
    },
  };
}
