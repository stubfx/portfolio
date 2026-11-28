// Bricks of the Future: bricks snap onto each chapter as it arrives, and the lamp follows the pointer.
// The page reads the same without this file; with reduced motion it does nothing.
const page = document.getElementById('page');
if (page && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('bricks-live');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('placed'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  for (const el of page.querySelectorAll('.s, .s figure, .s blockquote, .s .code')) io.observe(el);
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let x = 0, y = 0, raf = 0;
    const lamp = () => {
      raf = 0;
      page.style.setProperty('--px', (x / innerWidth * 2 - 1).toFixed(3));
      page.style.setProperty('--py', (y / innerHeight * 2 - 1).toFixed(3));
    };
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; raf ||= requestAnimationFrame(lamp); }, { passive: true });
  }
}
