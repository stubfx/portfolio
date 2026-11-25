// The home page flight: one rAF per scroll, writing only transform and opacity.
import { flightFrame, groundColor, segmentProgress } from './phases.mjs';

const isLog = (el) => el && el.classList.contains('logseg');
const isSeg = (el) => el && el.classList.contains('seg');
const IDENTITY = { y: 0, z: 0, opacity: 1 };

// Layout position, ignoring transforms (the flight transforms the logs it measures).
function layoutTop(el) {
  let y = 0;
  for (let e = el; e; e = e.offsetParent) y += e.offsetTop;
  return y;
}

export function startFlight(doc = document) {
  const win = doc.defaultView;
  const segs = [...doc.querySelectorAll('.seg')].map((seg) => ({
    seg,
    stage: seg.querySelector('.stage'),
    cover: seg.querySelector('.cover'),
    prev: isLog(seg.previousElementSibling) ? seg.previousElementSibling : null,
    next: isLog(seg.nextElementSibling) ? seg.nextElementSibling : null,
    chainPrev: isSeg(seg.previousElementSibling),
    chainNext: isSeg(seg.nextElementSibling),
    video: seg.querySelector('video'),
  }));
  if (!segs.length) return () => {};
  const logs = [...doc.querySelectorAll('.logseg')];
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const body = doc.body;
  let raf = 0;

  const progress = (s) => {
    const r = s.seg.getBoundingClientRect();
    return { p: segmentProgress(r.top, r.height, s.stage.offsetHeight), r };
  };

  function frame() {
    raf = 0;
    const reduced = motion.matches;
    const vh = win.innerHeight;
    const logState = new Map(logs.map((l) => [l, IDENTITY]));
    const pick = (log, v) => { if (log && v.opacity < logState.get(log).opacity) logState.set(log, v); };
    let ground = 0;
    let dim = 1;

    for (const s of segs) {
      const { p } = progress(s);
      const f = flightFrame(p, { reduced });
      const active = p > -0.02 && p < 1.02;
      pick(s.prev, f.prev);
      pick(s.next, f.next);
      let g = active ? f.ground : 0;
      if (s.chainNext && p >= 0.8 && p <= 1) g = 1;
      if (s.chainPrev && p >= 0 && p <= 0.2) g = 1;
      ground = Math.max(ground, g);
      if (active) dim = Math.min(dim, f.graphDim);

      const c = s.cover;
      const op = active ? f.cover.opacity : 0;
      c.style.opacity = op;
      c.style.visibility = op === 0 ? 'hidden' : '';
      c.style.transform = reduced ? '' : `perspective(1200px) translate3d(0,0,${f.cover.z}px) scale(${f.cover.scale})`;
      c.style.setProperty('--dwell', f.dwell);
      c.classList.toggle('live', op > 0.5);
      if (s.video) {
        if (op > 0 && !reduced && s.video.paused) s.video.play().catch(() => {});
        else if ((op === 0 || reduced) && !s.video.paused) s.video.pause();
      }
    }

    for (const [log, v] of logState) {
      log.style.opacity = v.opacity === 1 ? '' : v.opacity;
      if (reduced || (v.y === 0 && v.z === 0)) {
        log.style.transform = '';
      } else {
        const originY = vh / 2 - (layoutTop(log) - win.scrollY);
        log.style.transformOrigin = `50% ${originY}px`;
        log.style.transform = `perspective(1200px) translate3d(0,${v.y}vh,${v.z}px)`;
      }
    }

    body.style.setProperty('--bg', groundColor(ground));
    body.style.setProperty('--graph-dim', dim);
    body.style.setProperty('--ground', ground);
  }

  const schedule = () => { if (!raf) raf = win.requestAnimationFrame(frame); };

  // Keyboard users must never focus something they can't see.
  function reveal(e) {
    const t = e.target;
    const seg = t.closest && t.closest('.seg');
    const log = t.closest && t.closest('.logseg');
    const y0 = win.scrollY;
    if (seg) {
      const s = segs.find((x) => x.seg === seg);
      const { p, r } = progress(s);
      if (p < 0.3 || p > 0.8) win.scrollTo({ top: y0 + r.top + 0.55 * (r.height - s.stage.offsetHeight), behavior: 'instant' });
    } else if (log && parseFloat(win.getComputedStyle(log).opacity) < 0.99) {
      const before = segs.find((s) => s.next === log);
      const after = segs.find((s) => s.prev === log);
      let lo = -Infinity;
      let hi = Infinity;
      if (before) { const r = before.seg.getBoundingClientRect(); lo = y0 + r.bottom - before.stage.offsetHeight; }
      if (after) hi = y0 + after.seg.getBoundingClientRect().top;
      const want = layoutTop(t) - win.innerHeight * 0.35;
      win.scrollTo({ top: Math.max(lo, Math.min(want, Math.max(lo, hi))), behavior: 'instant' });
    }
    frame();
  }

  const opts = { passive: true };
  win.addEventListener('scroll', schedule, opts);
  win.addEventListener('resize', schedule, opts);
  win.addEventListener('pageshow', schedule);
  win.addEventListener('hashchange', schedule);
  win.addEventListener('load', schedule);
  motion.addEventListener('change', schedule);
  doc.addEventListener('focusin', reveal);
  doc.fonts?.ready.then(schedule);
  frame();

  return () => {
    win.removeEventListener('scroll', schedule, opts);
    win.removeEventListener('resize', schedule, opts);
    win.removeEventListener('pageshow', schedule);
    win.removeEventListener('hashchange', schedule);
    win.removeEventListener('load', schedule);
    motion.removeEventListener('change', schedule);
    doc.removeEventListener('focusin', reveal);
    if (raf) win.cancelAnimationFrame(raf);
  };
}
