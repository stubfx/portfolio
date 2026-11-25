// Starfield on a fixed canvas: three depth layers drifting with scroll.
import { makeStars, starCount, starOffset } from './stars-core.mjs';

const ALPHA = [0.32, 0.5, 0.78];

export function startStars(canvas, { reduced } = {}) {
  if (!canvas || !canvas.getContext) return () => {};
  const win = canvas.ownerDocument.defaultView;
  const ctx = canvas.getContext('2d');
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const isReduced = () => (reduced ?? motion.matches);
  let stars = [];
  let w = 0, h = 0, raf = 0;

  function size() {
    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    w = win.innerWidth;
    h = win.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const layers = w < 600 ? 2 : 3;
    stars = makeStars({ count: starCount(w, h), layers, seed: 2015, w, h });
    draw();
  }

  function draw() {
    raf = 0;
    if (canvas.ownerDocument.hidden) return;
    ctx.clearRect(0, 0, w, h);
    const y0 = win.scrollY;
    const off = [0, 1, 2].map((l) => starOffset(y0, l, h, isReduced()));
    ctx.fillStyle = '#cdd6f4';
    for (const s of stars) {
      let y = s.y - off[s.layer];
      if (y < 0) y += h;
      ctx.globalAlpha = ALPHA[s.layer];
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const schedule = () => { if (!raf) raf = win.requestAnimationFrame(draw); };
  win.addEventListener('scroll', () => { if (!isReduced()) schedule(); }, { passive: true });
  win.addEventListener('resize', size, { passive: true });
  canvas.ownerDocument.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', schedule);
  size();
  return () => { if (raf) win.cancelAnimationFrame(raf); };
}
