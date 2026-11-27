// Film grain: one grey noise tile, shifted a few times per second.
// Ported from the previous site (5ed1192: src/client/grain-core.mjs, with rng from src/client/sky-core.mjs).

export function rng(seed) {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function grainTile(size, seed) {
  const r = rng(seed);
  const px = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.floor(r() * 256);
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  return px;
}

/** A random offset within one tile, so the shift never shows an edge. */
export function grainOffset(size, random = Math.random) {
  return [-Math.floor(random() * size), -Math.floor(random() * size)].map((v) => v + 0);
}
