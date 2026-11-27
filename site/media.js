// Loops and embeds (only on pages that have them). Without JavaScript, loops keep their poster and native
// controls, and an embed is a plain link to the video.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

/** Silent loops play while at least half on screen, pause otherwise; click, Enter or Space toggles (WCAG 2.2.2). */
export function initLoops(root = document) {
  const loops = [...root.querySelectorAll('video.loop')];
  if (!loops.length) return;
  const state = new Map();

  const sync = (v) => {
    const s = state.get(v);
    if (reduce.matches) {
      v.controls = true;
      v.removeAttribute('tabindex');
      v.removeAttribute('role');
      v.removeAttribute('aria-pressed');
      v.removeAttribute('data-paused');
      if (!s.handPlayed) v.pause();
      return;
    }
    v.controls = false;
    v.tabIndex = 0;
    v.setAttribute('role', 'button');
    v.setAttribute('aria-pressed', String(s.paused));
    v.toggleAttribute('data-paused', s.paused);
    s.tag.textContent = s.paused ? 'play' : 'pause';
    if (s.visible && !s.paused && !document.hidden) v.play().catch(() => { v.controls = true; });
    else v.pause();
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) { state.get(e.target).visible = e.isIntersecting; sync(e.target); }
  }, { threshold: 0.5 });

  for (const v of loops) {
    const frame = document.createElement('span');
    frame.className = 'frame';
    v.replaceWith(frame);
    frame.append(v);
    const tag = document.createElement('span');
    tag.className = 'loop-tag';
    tag.setAttribute('aria-hidden', 'true');
    frame.append(tag);
    state.set(v, { visible: false, paused: false, handPlayed: false, tag });
    const toggle = () => { const s = state.get(v); s.paused = !s.paused; sync(v); };
    v.addEventListener('click', (e) => { if (!reduce.matches) { e.preventDefault(); toggle(); } });
    v.addEventListener('keydown', (e) => {
      if (reduce.matches || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      toggle();
    });
    v.addEventListener('play', () => { if (reduce.matches) state.get(v).handPlayed = true; });
    io.observe(v);
    sync(v);
  }
  document.addEventListener('visibilitychange', () => loops.forEach(sync));
  reduce.addEventListener('change', () => loops.forEach(sync));
}

/** An embed loads YouTube or Vimeo only when pressed; modified clicks still open the link. */
export function initEmbeds(root = document) {
  for (const a of root.querySelectorAll('a.embed')) {
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const box = document.createElement('div');
      box.className = 'embed playing';
      const f = document.createElement('iframe');
      f.src = a.dataset.embed;
      f.title = a.dataset.title;
      f.allow = 'autoplay; fullscreen; picture-in-picture';
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.allowFullscreen = true;
      box.append(f);
      a.replaceWith(box);
      f.focus();
    });
  }
}

initLoops();
initEmbeds();
