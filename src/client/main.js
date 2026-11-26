// Entry point. Each subsystem starts here.
import { startReveal } from './reveal.js';
import { startGraph } from './graph.js';
import { startStars } from './stars.js';
import { startGrain } from './grain.js';
import { startHud } from './hud.js';
import { startVim } from './vim.js';

startStars(document.getElementById('stars'));
startGrain(document.getElementById('grain'));
startHud(document);
startReveal(document); // before the graph, so its first jump finds rows already marked
const graph = startGraph(document);
startVim(document, graph);
window.__site = { graph };
