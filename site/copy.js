// copy .md (the page's Markdown, for a reader's own AI) and the rendered/raw switch. Both fetch the raw .md once.
const $ = (id) => document.getElementById(id);
let source = null;

async function markdown() {
  if (source === null) {
    const href = document.querySelector('link[rel="alternate"][type="text/markdown"]')?.href;
    source = await (await fetch(href)).text();
  }
  return source;
}

async function setRaw(on) {
  if (on) $('raw-pre').textContent = await markdown();
  $('v-rendered').setAttribute('aria-pressed', String(!on));
  $('v-raw').setAttribute('aria-pressed', String(on));
  $('page').hidden = on;
  $('raw').hidden = !on;
}

function flash(text) {
  const b = $('copy');
  b.textContent = text;
  setTimeout(() => { b.textContent = 'copy .md'; }, 1600);
}

export function initCopy() {
  $('copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(await markdown());
      flash('copied');
      return;
    } catch { /* no clipboard access: fall back to selecting the raw text */ }
    await setRaw(true);
    const range = document.createRange();
    range.selectNodeContents($('raw-pre'));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* unsupported */ }
    flash(ok ? 'copied' : 'selected');
  });
  $('v-rendered')?.addEventListener('click', () => setRaw(false));
  $('v-raw')?.addEventListener('click', () => setRaw(true));
}
