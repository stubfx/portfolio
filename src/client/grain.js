// Film grain: a 128 px noise tile on an oversized layer, jumped with transforms 8 times a second.
import { grainTile, grainOffset } from './grain-core.mjs';

const SIZE = 128;

export function startGrain(el, { reduced } = {}) {
  if (!el) return () => {};
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const isReduced = () => (reduced ?? motion.matches);

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
    if (!isReduced() && !doc.hidden) timer = win.setInterval(tick, 125);
    else el.style.transform = '';
  };
  doc.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  sync();
  return () => win.clearInterval(timer);
}
