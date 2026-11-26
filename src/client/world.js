// Entering a world: while a project or work entry is the current row, its layer in #world is on.
// The graph announces the current row (graph:current). A new world fades in on top of the old one; once
// it has fully arrived, the worlds beneath it are covered and are dropped at once (.cut), unseen. So a
// switch blends one translucent layer, not two (world.css), and nothing translucent stays on screen.
// Class flips only: no layout reads, no style writes.

/**
 * @param {Document} doc
 * @returns {null | { readonly hash: string | null }} hash: the current row's; null before the first one.
 */
export function startWorld(doc) {
  const stack = doc.getElementById('world');
  if (!stack) return null;
  let hash = null;
  let top = null;

  // The top world has fully faded in: everything under it is covered.
  stack.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'opacity' || e.target !== top || !top.classList.contains('on')) return;
    for (const i of stack.children) {
      if (i !== top && i.classList.contains('on')) { i.classList.add('cut'); i.classList.remove('on'); }
    }
  });

  doc.addEventListener('graph:current', (e) => {
    hash = e.detail?.hash ?? null;
    const next = hash ? stack.querySelector(`i[data-hash~="${CSS.escape(hash)}"]`) : null;
    if (next === top) return;
    top?.classList.remove('top');
    if (next) {
      next.classList.remove('cut');
      next.classList.add('on', 'top');
    } else {
      // Back to the plain background: every world still showing fades out together.
      for (const i of stack.children) i.classList.remove('on');
    }
    top = next;
  });
  return { get hash() { return hash; } };
}
