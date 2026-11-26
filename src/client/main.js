// Entry point. Each subsystem starts here.
import { startReveal } from './reveal.js';
import { startWorld } from './world.js';
import { startGraph } from './graph.js';
import { startSky } from './sky.js';
import { startGrain } from './grain.js';
import { startHud } from './hud.js';
import { startVim } from './vim.js';

const root = getComputedStyle(document.body);
const prop = (name) => root.getPropertyValue(name).trim();
const sky = startSky(document.getElementById('sky'), {
  // the reading column, where the sky goes calm (measured on layout only)
  lane: () => { const f = document.querySelector('main .frame'); if (!f) return null; const r = f.getBoundingClientRect(); return [r.left, r.right]; },
  // a project page's own palette, else the site's
  colours: () => ({ base: prop('--bg') || prop('--base'), accent: prop('--p-accent') || prop('--lavender') }),
});
startGrain(document.getElementById('grain'), { toggle: document.getElementById('grainbtn') });
startHud(document);
startReveal(document); // before the graph, so its first jump finds rows already marked
startWorld(document); // before the graph, which announces the current row once at startup
const graph = startGraph(document);
startVim(document, graph);
window.__site = { graph, sky };
