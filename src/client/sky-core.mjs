// The sky's maths, pure and tested: ordered dither, value noise, the palette ramp, the calm lane,
// lazy rows, twinkle and meteors. sky.js puts them on a canvas.

export function rng(seed) {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Ordered-dither thresholds for an n x n Bayer matrix (n a power of two), row-major, in (0, 1). */
export function bayer(n) {
  let m = [[0]];
  while (m.length < n) {
    const k = m.length;
    const out = Array.from({ length: k * 2 }, () => new Array(k * 2));
    for (let y = 0; y < k; y++) {
      for (let x = 0; x < k; x++) {
        const v = m[y][x] * 4;
        out[y][x] = v; out[y][x + k] = v + 2; out[y + k][x] = v + 3; out[y + k][x + k] = v + 1;
      }
    }
    m = out;
  }
  return Float32Array.from(m.flat(), (v) => (v + 0.5) / (n * n));
}

/** Value noise on a wrapped 64 x 64 lattice, smoothstep-interpolated: (x, y) -> [0, 1]. */
export function noise(seed) {
  const r = rng(seed);
  const g = Float32Array.from({ length: 64 * 64 }, r);
  const at = (x, y) => g[((y & 63) << 6) | (x & 63)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Four octaves of value noise, normalised to [0, 1]. */
export const fbm = (n, x, y) => (8 * n(x, y) + 4 * n(x * 2.03, y * 2.03) + 2 * n(x * 4.1, y * 4.1) + n(x * 8.3, y * 8.3)) / 15;

/** The palette level that is exactly the page's base: the calm lane sits on it, flat. */
export const baseLevel = (levels) => Math.round(0.4 * (levels - 1));

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const CRUST = [17, 17, 27];

/** The sky's colour levels: darker than the page, the page's own base exactly, then a faint accent lift. */
export function ramp(levels, base, accent) {
  const dark = mix(base, CRUST, 0.45), top = mix(base, accent, 0.2), kb = baseLevel(levels), last = levels - 1;
  return Array.from({ length: levels }, (_, i) => {
    if (i === kb) return base.slice();
    return i < kb ? mix(dark, base, i / kb) : mix(base, top, (i - kb) / (last - kb));
  });
}

/** Ordered-dither quantization of a value in [0, 1] to a palette level. */
export function quantize(v, levels, threshold) {
  const last = levels - 1;
  const q = Math.floor(v * last + threshold);
  return q > last ? last : q < 0 ? 0 : q;
}

/**
 * How much sky shows per column: `min` inside the reading column [left, right], rising with a smoothstep to 1
 * over `fall` columns outside it. No column (null) means sky everywhere.
 */
export function laneFactors(width, left, right, fall, min) {
  const f = new Float32Array(width).fill(1);
  if (left == null || right == null) return f;
  for (let x = 0; x < width; x++) {
    const d = x < left ? left - x : x > right ? x - right : 0;
    const t = Math.min(1, d / fall);
    f[x] = min + (1 - min) * t * t * (3 - 2 * t);
  }
  return f;
}

/** Rows of a tall buffer, baked on first use only (a long page never bakes sky it never shows). */
export function lazyRows(width, height, bake) {
  const rows = new Array(height);
  let baked = 0;
  return {
    get(y) {
      let row = rows[y];
      if (!row) { row = rows[y] = new Uint8Array(width); bake(y, row); baked++; }
      return row;
    },
    has: (y) => !!rows[y],
    get baked() { return baked; },
  };
}

/** Palette cycling: the brightness of a twinkle group at a phase, in [0, 1]. */
export const twinkle = (phase, group) => 0.5 + 0.5 * Math.sin((phase + group * 1.7) * 0.9);

/** One step of a shooting star: move, push the head onto a trail of at most 8, age. */
export function stepMeteor(m) {
  const x = m.x + m.vx, y = m.y + m.vy;
  return { ...m, x, y, life: m.life - 1, trail: [[x, y], ...m.trail].slice(0, 8) };
}

/** A 32-bit integer hash (lowbias32): neighbouring inputs give unrelated outputs. */
export function hash32(x) {
  x = (x | 0) ^ (x >>> 16); x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * The stars of one world row: positions and twinkle groups, the same whatever order rows are baked in.
 * Each row's seed goes through a hash first: seeding the generator with y itself would line the stars up.
 * @returns {{ x: number, g: number }[]}
 */
export function starsForRow(y, width, density) {
  const r = rng(hash32(y * 2654435761 + 1013904223) || 1);
  const out = [];
  for (let i = 0, n = Math.floor(width * density + r()); i < n; i++) out.push({ x: Math.floor(r() * width), g: Math.floor(r() * 4) });
  return out;
}

/**
 * The pixels a shooting star draws this tick: its trail, head bright and tail dim (palette slots 12..15).
 * Over its last `fadeTicks` ticks it burns out instead of vanishing: an ordered-dither dissolve (a pixel shows
 * only while its threshold is under the star's remaining brightness) while its colours step down.
 * @returns {{ x: number, y: number, slot: number }[]}
 */
export function meteorPixels(m, fadeTicks, threshold) {
  const a = Math.max(0, Math.min(1, m.life / fadeTicks));
  if (a <= 0) return [];
  const dim = Math.round((1 - a) * 3), out = [];
  m.trail.forEach(([mx, my], k) => {
    const x = Math.round(mx), y = Math.round(my);
    if (a < 1 && threshold(x, y) >= a) return;
    out.push({ x, y, slot: 12 + Math.min(3, (k >> 1) + dim) });
  });
  return out;
}
