// Logic graphs (lib/graph.mjs): each piece of a graph carries its moment (data-t) and its length (data-l), in ms.
// This hands them to the CSS as --t and --l, arms the graph, and plays it each time it comes into view.
// The drawing is CSS (site/style.css, "logic graphs"). Without this script, or with reduced motion, the graph is just there.
const graphs = document.querySelectorAll('.graph');
const play = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) e.target.classList.add('play'); }, { rootMargin: '0px 0px -15% 0px' });
const reset = new IntersectionObserver((es) => { for (const e of es) if (!e.isIntersecting) e.target.classList.remove('play'); });
for (const g of graphs) {
  for (const el of g.querySelectorAll('[data-t]')) {
    el.style.setProperty('--t', el.dataset.t);
    if (el.dataset.l) el.style.setProperty('--l', el.dataset.l);
  }
  g.classList.add('armed');
  play.observe(g);
  reset.observe(g);
}
