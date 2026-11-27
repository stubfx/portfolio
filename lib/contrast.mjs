// WCAG 2.x contrast, ported from the previous site (5ed1192:src/build/contrast.mjs), plus the theme tokens read from CSS.

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two #rrggbb colours, rounded to 2 decimals. */
export function contrastRatio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
}

const long = (hex) => (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex).toLowerCase();

function hexTokens(block) {
  const out = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?)\b/gi)) out[name] = long(value);
  return out;
}

/** The hex colour tokens of the day (:root) and night themes; night inherits what it doesn't override. */
export function readTokens(css) {
  const block = (re) => (re.exec(css)?.[1] ?? '');
  const day = hexTokens(block(/:root\s*\{([^}]*)\}/));
  const night = { ...day, ...hexTokens(block(/html\[data-theme="night"\]\s*\{([^}]*)\}/)) };
  return { day, night };
}
