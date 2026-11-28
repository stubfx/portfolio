// WAYLAY: when the games start, three lives appear in the corner and nobody explains them.
// The punch line takes one, and it doesn't come back. Without this script there are no lives; the page reads the same.
const root = document.documentElement;
const start = document.querySelector('[data-s="then-risk-it-all"]');
const punch = document.querySelector('.punch');
if (start && punch) {
  let queued = false;
  const check = () => {
    queued = false;
    if (!root.dataset.lives && start.getBoundingClientRect().top < innerHeight * 0.5) root.dataset.lives = '3';
    if (punch.getBoundingClientRect().top < innerHeight * 0.55) {
      root.dataset.lives = '2';
      removeEventListener('scroll', onScroll);
    }
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
  addEventListener('scroll', onScroll, { passive: true });
  check();
}
