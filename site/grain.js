// Ported unchanged from the previous site (5ed1192: src/client/grain.js). main.js starts it without a toggle.
// Film grain: a 128 px noise tile on an oversized layer, jumped with transforms 8 times a second.
// The grain toggle in the status bar switches it off (html.nograin: no layer, no timer), remembered per
// browser; the head script applies a saved "off" before the first paint.
import { grainTile, grainOffset } from './grain-core.mjs';

const SIZE = 128;
const KEY = 'grain';

export function startGrain(el, { reduced, toggle } = {}) {
  if (!el) return () => {};
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const root = doc.documentElement;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const isReduced = () => (reduced ?? motion.matches);
  const isOn = () => !root.classList.contains('nograin');

  const c = doc.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) return () => {};
  ctx.putImageData(new win.ImageData(grainTile(SIZE, 1895), SIZE, SIZE), 0, 0);
  el.style.backgroundImage = `url(${c.toDataURL('image/png')})`;

  let timer = 0;
  const tick = () => {
    const [x, y] = grainOffset(SIZE);
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
  };
  const sync = () => {
    win.clearInterval(timer);
    timer = 0;
    if (isOn() && !isReduced() && !doc.hidden) timer = win.setInterval(tick, 125);
    else el.style.transform = '';
  };

  if (toggle) {
    toggle.setAttribute('aria-pressed', String(isOn()));
    toggle.addEventListener('click', () => {
      const on = !isOn();
      root.classList.toggle('nograin', !on);
      toggle.setAttribute('aria-pressed', String(on));
      try { win.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked: this visit only */ }
      sync();
    });
  }

  doc.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  sync();
  return () => win.clearInterval(timer);
}
