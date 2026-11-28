// Card rows in the timeline (docs/DESIGN.md §7). They scroll natively; this adds the arrows, which move the
// row by most of its width and are disabled at each end. Instant with reduced motion.
const still = matchMedia('(prefers-reduced-motion: reduce)');
for (const row of document.querySelectorAll('.row')) {
  const list = row.querySelector('.cards');
  const [prev, next] = row.querySelectorAll('.row-btn');
  // A disabled button can't hold focus: hand it to the other arrow, so the keyboard keeps its place.
  const hand = (from, to) => { if (from.disabled && document.activeElement === from) to.focus(); };
  const update = () => {
    prev.disabled = list.scrollLeft <= 1;
    next.disabled = list.scrollLeft >= list.scrollWidth - list.clientWidth - 1;
    hand(prev, next);
    hand(next, prev);
  };
  const go = (dir) => list.scrollBy({ left: dir * list.clientWidth * 0.9, behavior: still.matches ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  list.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}
