// Starfield maths: deterministic stars in depth layers, drifting with scroll.

export function rng(seed) {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const SPEEDS = [0.02, 0.05, 0.1];

export function starCount(w, h) {
  return Math.max(40, Math.min(420, Math.round((180 * w * h) / (1280 * 800))));
}

export function makeStars({ count, layers, seed, w, h }) {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const layer = i % layers;
    return { x: r() * w, y: r() * h, r: 0.35 + layer * 0.35 + r() * 0.5, layer };
  });
}

/** Vertical drift for a layer, wrapped to the canvas height. Reduced motion: none. */
export function starOffset(scrollY, layer, h, reduced = false) {
  if (reduced || !h) return 0;
  const o = (scrollY * SPEEDS[layer]) % h;
  return o < 0 ? o + h : o;
}
