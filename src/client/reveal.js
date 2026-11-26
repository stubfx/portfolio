// Once-only fade-ins for the log.
//
// CSS never hides anything on its own: only rows this script marks .rv (below the fold at startup)
// start hidden, and only while html.js holds. Every path that could leave a row hidden reveals it
// at once instead (.in plus .now, which turns transitions off): focus, graph jumps, hash links,
// reload and Back (rows found in view on the first frame or on pageshow), print, and reduced
// motion switching on. Each row is revealed once and never hidden again.

const ROWS = '.log > .row';

/**
 * @param {Document} doc
 * @returns {null | { reveal(el: Element, instant?: boolean): void }} null under reduced motion
 *   or without IntersectionObserver, where nothing is ever hidden.
 */
export function startReveal(doc) {
  const win = doc.defaultView;
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches || !('IntersectionObserver' in win)) return null;
  const rows = [...doc.querySelectorAll(ROWS)];
  if (!rows.length) return null;

  // One read pass, then one write pass: rows whose top is at or below the fold start hidden.
  const fold = win.innerHeight;
  const below = rows.filter((r) => r.getBoundingClientRect().top >= fold);
  for (const r of below) r.classList.add('rv');

  const io = new win.IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) reveal(e.target);
  }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
  for (const r of below) io.observe(r);

  function reveal(el, instant = false) {
    const row = el?.closest?.(ROWS);
    if (!row || !row.classList.contains('rv')) return;
    if (!row.classList.contains('in')) {
      io.unobserve(row);
      row.classList.add('in');
    }
    if (instant) row.classList.add('now');
  }

  const pending = () => rows.filter((r) => r.classList.contains('rv') && !r.classList.contains('in'));
  const revealAll = () => { for (const r of pending()) reveal(r, true); };
  // Rows already on screen when the browser restores a scroll position (reload, Back) or jumps late.
  function revealInView() {
    const h = win.innerHeight;
    const seen = pending().filter((r) => { const b = r.getBoundingClientRect(); return b.bottom > 0 && b.top < h; });
    for (const r of seen) reveal(r, true);
  }
  const revealHash = () => {
    const raw = win.location.hash.slice(1);
    let id = raw;
    try { id = decodeURIComponent(raw); } catch { /* a malformed fragment is just an unknown target */ }
    if (id) reveal(doc.getElementById(id), true);
  };

  doc.addEventListener('focusin', (e) => reveal(e.target, true));
  doc.addEventListener('graph:go', (e) => reveal(e.detail?.el, true));
  win.addEventListener('hashchange', revealHash);
  win.addEventListener('pageshow', revealInView);
  win.addEventListener('beforeprint', revealAll);
  reduce.addEventListener('change', (e) => { if (e.matches) revealAll(); });
  revealHash();
  win.requestAnimationFrame(revealInView);

  return { reveal };
}
