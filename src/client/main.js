// Entry point. Each subsystem starts here.
import { startReveal } from './reveal.js';
import { startWorld } from './world.js';
import { startGraph } from './graph.js';
import { startStars } from './stars.js';
import { startGrain } from './grain.js';
import { startHud } from './hud.js';
import { startVim } from './vim.js';

startStars(document.getElementById('stars'));
startGrain(document.getElementById('grain'), { toggle: document.getElementById('grainbtn') });
startHud(document);
startReveal(document); // before the graph, so its first jump finds rows already marked
startWorld(document); // before the graph, which announces the current row once at startup
const graph = startGraph(document);
startVim(document, graph);
window.__site = { graph };
