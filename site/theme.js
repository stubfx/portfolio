// Day (Latte, black text) and night (warm neutral). The head script applies the stored choice before the first paint.
const COLOUR = { day: '#eff1f5', night: '#1c1917' };

function show(t, doc) {
  doc.documentElement.dataset.theme = t;
  doc.getElementById('t-day')?.setAttribute('aria-pressed', String(t === 'day'));
  doc.getElementById('t-night')?.setAttribute('aria-pressed', String(t === 'night'));
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOUR[t]);
}

export function applyTheme(t, doc = document) {
  show(t, doc);
  try { doc.defaultView.localStorage.setItem('theme', t); } catch { /* storage blocked: this visit only */ }
}

export function initTheme(doc = document) {
  show(doc.documentElement.dataset.theme === 'night' ? 'night' : 'day', doc);
  doc.getElementById('t-day')?.addEventListener('click', () => applyTheme('day', doc));
  doc.getElementById('t-night')?.addEventListener('click', () => applyTheme('night', doc));
}
