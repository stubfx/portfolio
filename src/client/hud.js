// Status bar: position in the log and the time in Rome.

export function startHud(doc = document) {
  const win = doc.defaultView;
  const pos = doc.getElementById('pos');
  const clk = doc.getElementById('clkt'); // Luca's time in Rome, wherever you are (a small easter egg)

  doc.addEventListener('graph:current', (e) => {
    if (pos) pos.textContent = `${e.detail.index ? `HEAD~${e.detail.index}` : 'HEAD'} · ${e.detail.label}`;
  });

  if (clk) {
    const fmt = new win.Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
    const tick = () => { clk.textContent = fmt.format(new Date()); };
    tick();
    win.setInterval(tick, 30000);
  }
}
