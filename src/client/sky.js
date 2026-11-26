// The sky: a lowbit, dithered galaxy behind every page, drawn the old way on purpose.
//
// - An indexed-colour framebuffer a third of the screen's size, scaled up with hard pixels.
// - The sky is baked row by row on first use (a long page never bakes sky it never shows), at most a few dozen
//   rows per redraw so no task runs long: value noise and a band, ordered-dithered (Bayer 4x4) into 4 palette
//   levels in world space, so the dither scrolls with the sky and never crawls. Two dither phases are kept per
//   row; alternating them makes mid-tones breathe.
// - Coarse scroll moves the window through the buffer by whole low-res pixels; the remainder moves the canvas
//   by whole screen pixels (a fine-scroll register).
// - Twinkle is palette cycling: stars belong to four colour groups that cycle; no star is redrawn.
// - The reading column is a calm lane: almost flat page base, no stars, shooting stars pass behind it.
// - The pointer carries a faint dither lens: the sky lifts a touch around it and re-dithers (fine pointers only).
// - 10 redraws a second at rest, 30 while something moves; none when hidden.
// - Reduced motion: a still sky (no parallax, twinkle, breathing, shooting stars or lens).
import { bayer, noise, fbm, baseLevel, ramp, laneFactors, quantize, lazyRows, twinkle, stepMeteor, starsForRow, hash32 } from './sky-core.mjs';

const SCALE = 3, LEVELS = 4, BAYER = 4, STRENGTH = 1, STAR_DENSITY = 0.0015;
const SPEED = 0.05; // the sky moves at 5% of the scroll
const LANE_MIN = 0.08, LANE_FALL = 120; // behind the text: 8% of the sky's variation; fades in over 120 px
const IDLE_MS = 100, BUSY_MS = 33, FADE_MS = 1200, FADE_REDUCED_MS = 450;
const LENS = 0.12, LENS_R = 90; // the pointer's lift of the sky (in value) and its radius (screen px)
const BAKE_PER_FRAME = 24; // rows baked per redraw at most: the sky streams in, no long task
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

  let W = 0, H = 0, total = 0, rows = null, vals = null, laneF = null, starKeep = null, img = null, px = null;
  let coarse = 0, sy = win.scrollY, tick = 0, phase = 0, timer = 0, raf = 0, meteors = [], nextMeteor = 0;
  let pending = false, laneKey = '', shift = 0; // shift: the fine-scroll offset, screen px
  const lens = { on: false, x: 0, y: 0, tx: 0, ty: 0 };
  const start = colours ? colours() : { base: '#1e1e2e', accent: '#b4befe' };
  let from = { base: hexRgb(start.base), accent: hexRgb(start.accent) }, to = from, fadeStart = 0, fadeMs = 0;

  const current = (now) => {
    if (!fadeMs) return to;
    const t = Math.min(1, (now - fadeStart) / fadeMs);
    return { base: mix(from.base, to.base, t), accent: mix(from.accent, to.accent, t) };
  };

  function bake(y, row) { // one world row: two dither phases and the stars (palette indices), and the raw values
    const y0 = total * 0.35, bw = Math.max(40, H * 0.55);
    const lv0 = row.subarray(0, W), lv1 = row.subarray(W, 2 * W), star = row.subarray(2 * W, 3 * W);
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
      if ((hash32(y * 4099 + s.x) / 4294967296) < starKeep[s.x]) star[s.x] = 8 + s.g;
    }
  }

  function build(onlyIfChanged) {
    const vw = win.innerWidth, vh = win.innerHeight, l = lane();
    const key = [vw, vh, doc.documentElement.scrollHeight, l && l.map(Math.round)].join();
    if (onlyIfChanged && key === laneKey) return;
    laneKey = key;
    W = Math.ceil(vw / SCALE); H = Math.ceil(vh / SCALE) + 1;
    total = H + Math.ceil(Math.max(0, doc.documentElement.scrollHeight - vh) * SPEED / SCALE) + 1;
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * SCALE}px`; canvas.style.height = `${H * SCALE}px`;
    img = ctx.createImageData(W, H); px = new Uint32Array(img.data.buffer);
    laneF = laneFactors(W, l ? l[0] / SCALE : null, l ? l[1] / SCALE : null, LANE_FALL / SCALE, LANE_MIN);
    starKeep = Float32Array.from(laneF, (f) => (f - LANE_MIN) / (1 - LANE_MIN)); // no stars in the lane
    vals = new Float32Array(W * total);
    rows = lazyRows(3 * W, total, bake);
    coarse = -1; scroll(); blit(); wake();
  }

  function palette(now) {
    const c = current(now);
    ramp(LEVELS, c.base, c.accent).forEach((rgb, i) => { pal[i] = pack(rgb); });
    for (let g = 0; g < 4; g++) {
      const s = reduce.matches ? 0.5 : twinkle(phase, g);
      pal[8 + g] = pack(s < 0.5 ? mix(STAR_DIM, STAR_MID, s * 2) : mix(STAR_MID, STAR_HI, (s - 0.5) * 2));
    }
    METEOR.forEach((rgb, i) => { pal[12 + i] = pack(rgb); });
  }

  function blit() {
    raf = 0;
    const lvOff = !reduce.matches && (tick >> 1) & 1 ? W : 0; // the breathing dither: alternate phases
    let budget = BAKE_PER_FRAME;
    pending = false;
    for (let y = 0; y < H; y++) {
      const wy = Math.min(total - 1, coarse + y), o = y * W;
      if (!rows.has(wy) && budget-- <= 0) { px.fill(pal[kb], o, o + W); pending = true; continue; } // streams in next frame
      const row = rows.get(wy);
      for (let x = 0; x < W; x++) px[o + x] = pal[row[2 * W + x] || row[lvOff + x]];
    }
    if (lens.on) {
      // The dither lens: around the pointer the sky lifts a touch and is re-dithered with the same thresholds.
      const R = LENS_R / SCALE, ph = lvOff ? 1 : 0;
      const x0 = Math.max(0, Math.floor(lens.x - R)), x1 = Math.min(W - 1, Math.ceil(lens.x + R));
      const y0 = Math.max(0, Math.floor(lens.y - R)), y1 = Math.min(H - 1, Math.ceil(lens.y + R));
      for (let y = y0; y <= y1; y++) {
        const wy = Math.min(total - 1, coarse + y);
        if (!rows.has(wy)) continue;
        const row = rows.get(wy), o = y * W;
        for (let x = x0; x <= x1; x++) {
          const dx = (x - lens.x) / R, dy = (y - lens.y) / R, d2 = dx * dx + dy * dy;
          if (d2 >= 1 || row[2 * W + x]) continue;
          const k = 1 - d2;
          px[o + x] = pal[quantize(vals[wy * W + x] + LENS * k * k * laneF[x], LEVELS, B[(((wy + ph) & bn) * BAYER) + ((x + ph) & bn)])];
        }
      }
    }
    for (const m of meteors) {
      m.trail.forEach(([mx, my], k) => {
        const x = Math.round(mx), y = Math.round(my);
        if (x >= 0 && x < W && y >= 0 && y < H && laneF[x] > 0.5) px[y * W + x] = pal[12 + Math.min(3, k >> 1)];
      });
    }
    ctx.putImageData(img, 0, 0);
  }

  // Runs in an animation frame (the write phase) with the position the scroll event read.
  function scroll() {
    const o = reduce.matches ? 0 : sy * SPEED / SCALE;
    const c = Math.min(Math.floor(o), Math.max(0, total - H - 1));
    shift = Math.round((o - Math.floor(o)) * SCALE);
    canvas.style.transform = `translate3d(0,${-shift}px,0)`;
    if (c === coarse) return false;
    coarse = c;
    return true;
  }

  function spawn(at) {
    const r = Math.random, dir = r() < 0.5 ? 1 : -1, a = 0.35 + 0.25 * r();
    meteors.push({ x: W * (0.15 + 0.7 * r()), y: H * (0.05 + 0.3 * r()), vx: dir * 1.6 * Math.cos(a), vy: 0.75 + 0.3 * r(), life: 44, trail: [], ...at });
  }

  function loop() {
    timer = 0;
    const now = win.performance.now();
    if (!reduce.matches) {
      tick++; phase += 0.12;
      if (now > nextMeteor) { spawn(); nextMeteor = now + 7000 + Math.random() * 9000; }
      meteors = meteors.map(stepMeteor).filter((m) => m.life > 0);
      if (lens.on) { lens.x += (lens.tx - lens.x) * 0.35; lens.y += (lens.ty - lens.y) * 0.35; } // temporal smoothing
    }
    const fading = fadeMs && now - fadeStart < fadeMs;
    if (fadeMs && !fading) { from = to; fadeMs = 0; }
    if (!reduce.matches || fading || pending) { palette(now); blit(); } // a still sky still finishes streaming in
    const lensMoving = lens.on && Math.abs(lens.tx - lens.x) + Math.abs(lens.ty - lens.y) > 0.3;
    const busy = meteors.length || fadeMs || lensMoving || pending;
    if (!doc.hidden && (!reduce.matches || busy)) timer = win.setTimeout(loop, busy ? BUSY_MS : IDLE_MS);
  }
  function wake() { if (!timer && !doc.hidden) loop(); }

  // Read in the event, write in the frame: the handler only records the position.
  win.addEventListener('scroll', () => {
    sy = win.scrollY;
    if (!raf) raf = win.requestAnimationFrame(() => { raf = 0; if (scroll()) { blit(); if (pending) wake(); } });
  }, { passive: true });
  // The pointer feeds the lens target; the loop eases toward it (events only write numbers here).
  win.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduce.matches || !fine.matches) return;
    lens.tx = e.clientX / SCALE; lens.ty = (e.clientY + shift) / SCALE;
    if (!lens.on) { lens.on = true; lens.x = lens.tx; lens.y = lens.ty; }
    wake();
  }, { passive: true });
  doc.documentElement.addEventListener('pointerleave', () => { lens.on = false; wake(); });
  let rebuild = 0;
  const relayout = (onlyIfChanged) => { if (!rebuild) rebuild = win.requestAnimationFrame(() => { rebuild = 0; sy = win.scrollY; build(onlyIfChanged); }); };
  win.addEventListener('resize', () => relayout(false), { passive: true });
  doc.fonts?.ready.then(() => relayout(true)); // a rebuild only if the lane or the page height moved
  doc.addEventListener('visibilitychange', () => { win.clearTimeout(timer); timer = 0; wake(); });
  reduce.addEventListener('change', () => { lens.on = false; coarse = -1; scroll(); palette(win.performance.now()); blit(); wake(); });

  nextMeteor = win.performance.now() + 4000 + Math.random() * 6000;
  palette(win.performance.now());
  build(false);

  return {
    /** Fade the palette to a base and accent (#rrggbb). */
    tint(base, accent) {
      const now = win.performance.now();
      const next = { base: hexRgb(base), accent: hexRgb(accent) };
      if (next.base.join() === to.base.join() && next.accent.join() === to.accent.join()) return;
      from = current(now); to = next; fadeStart = now; fadeMs = reduce.matches ? FADE_REDUCED_MS : FADE_MS;
      wake();
    },
    /** A shooting star now; `at` may fix its start and velocity (low-res px, per tick). */
    meteor(at) { if (!reduce.matches) { spawn(at); win.clearTimeout(timer); timer = 0; wake(); } },
    state() {
      const t = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
      return { w: W, h: H, scale: SCALE, coarse, rows: total, baked: rows ? rows.baked : 0, reduced: reduce.matches,
        target: { base: t(to.base), accent: t(to.accent) }, fading: !!fadeMs, meteors: meteors.length, pending,
        lens: lens.on ? [Math.round(lens.x), Math.round(lens.y)] : null };
    },
  };
}
