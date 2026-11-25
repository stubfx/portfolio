// A Neovide-style block cursor: the leading edge springs ahead, the trailing edge catches up.
const HALF = 11;
const DEFAULT = { lead: 0.5, trail: 0.24, x: 0.4 };

const approach = (a, b, k) => (Math.abs(b - a) < 0.002 ? b : a + (b - a) * k);

/** One animation step. Pass k = null to snap (reduced motion). */
export function stepCursor(c, target, k = DEFAULT) {
  const top = target.y - HALF;
  const bot = target.y + HALF;
  if (!k) return { x: target.x, top, bot };
  const down = target.y > (c.top + c.bot) / 2;
  return {
    x: approach(c.x, target.x, k.x),
    top: approach(c.top, top, down ? k.trail : k.lead),
    bot: approach(c.bot, bot, down ? k.lead : k.trail),
  };
}

export const settled = (c, target) => c.x === target.x && c.top === target.y - HALF && c.bot === target.y + HALF;
