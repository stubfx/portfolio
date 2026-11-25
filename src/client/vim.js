// Vim normal mode for the whole site. Letters only act after Esc.
import { vimKey, runCommand } from './vim-core.mjs';

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export function startVim(doc = document, graph = null) {
  const win = doc.defaultView;
  const mode = doc.getElementById('mode');
  const form = doc.getElementById('cmdf');
  const input = doc.getElementById('cmdi');
  const msg = doc.getElementById('msg');
  let state = { normal: false, lastG: 0 };
  let msgTimer = 0;
  let returnFocus = null;

  function say(text, err = false) {
    if (!msg) return;
    win.clearTimeout(msgTimer);
    msg.textContent = text;
    msg.classList.toggle('err', err);
    if (text) msgTimer = win.setTimeout(() => { msg.textContent = ''; }, 3500);
  }

  function showMode() {
    if (!mode) return;
    mode.textContent = state.normal ? '-- NORMAL --' : 'esc · normal';
    mode.classList.toggle('normal', state.normal);
  }

  function openCmd() {
    if (!form) return;
    returnFocus = doc.activeElement;
    form.hidden = false;
    input.value = '';
    input.focus();
  }

  function closeCmd() {
    if (!form || form.hidden) return;
    form.hidden = true;
    if (returnFocus && returnFocus !== doc.body && returnFocus.focus) returnFocus.focus({ preventScroll: true });
    else input.blur();
  }

  const scrollBy = (f) => win.scrollBy({ top: win.innerHeight * f, behavior: 'smooth' });
  const run = {
    next: () => (graph ? graph.step(1) : scrollBy(0.2)),
    prev: () => (graph ? graph.step(-1) : scrollBy(-0.2)),
    nextProject: () => graph && graph.project(1),
    prevProject: () => graph && graph.project(-1),
    top: () => (graph ? graph.go(0) : win.scrollTo({ top: 0, behavior: 'smooth' })),
    bottom: () => (graph ? graph.go(graph.rows.length - 1) : win.scrollTo({ top: doc.documentElement.scrollHeight, behavior: 'smooth' })),
    land: () => !!(graph && graph.land()),
    openCmd,
    exitNormal: () => {},
  };

  doc.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.target.closest && e.target.closest(EDITABLE)) return;
    // Enter on a focused link or button keeps its normal meaning, even in normal mode.
    if (e.key === 'Enter' && e.target.closest && e.target.closest('a[href], button, summary, [role="button"], [role="link"]')) return;
    const was = state.normal;
    const { state: next, action } = vimKey(state, e.key, e.timeStamp || win.performance.now());
    state = next;
    if (was !== state.normal) {
      showMode();
      say(state.normal ? 'Normal mode: j and k move through the log, : opens commands, i or Esc to leave.' : '');
    }
    if (e.key === 'Escape' || (state.normal && e.key === 'g')) e.preventDefault();
    if (action && run[action.type]() !== false) e.preventDefault();
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const { message, action } = runCommand(input.value);
      closeCmd();
      if (action === 'help') { win.location.href = '/help/'; return; }
      say(message, message.startsWith('E'));
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCmd(); }
    });
    input.addEventListener('blur', () => win.setTimeout(closeCmd, 0));
  }

  showMode();
  return { get normal() { return state.normal; } };
}
