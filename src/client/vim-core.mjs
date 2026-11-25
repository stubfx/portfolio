// Vim keys, pure. Letters act only in normal mode (WCAG 2.1.4), entered with Esc.

const GG_WINDOW = 450;
const MOTIONS = { j: 'next', k: 'prev', J: 'nextProject', K: 'prevProject', G: 'bottom', Enter: 'land', ':': 'openCmd' };
const QUIT = new Set(['q', 'q!', 'qa', 'qa!', 'wq', 'wq!', 'x', 'x!']);

export function vimKey(state, key, now) {
  if (key === 'Escape') {
    const normal = !state.normal;
    return { state: { normal, lastG: 0 }, action: normal ? null : { type: 'exitNormal' } };
  }
  if (!state.normal) return { state, action: null };
  if (key === 'i') return { state: { normal: false, lastG: 0 }, action: { type: 'exitNormal' } };
  if (key === 'g') {
    if (state.lastG && now - state.lastG <= GG_WINDOW) return { state: { ...state, lastG: 0 }, action: { type: 'top' } };
    return { state: { ...state, lastG: now || 1 }, action: null };
  }
  const type = MOTIONS[key];
  return { state: { ...state, lastG: 0 }, action: type ? { type } : null };
}

export function runCommand(text) {
  const cmd = text.trim();
  if (!cmd) return { message: '' };
  if (QUIT.has(cmd)) return { message: "You can't quit. You just can't stop." };
  if (cmd === 'help' || cmd === 'h') return { message: ':help colophon', action: 'help' };
  return { message: `E492: Not an editor command: ${cmd}` };
}
