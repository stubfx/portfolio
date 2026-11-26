// Entry point. Each subsystem starts here.
import { startGraph } from './graph.js';
import { startStars } from './stars.js';
import { startGrain } from './grain.js';
import { startHud } from './hud.js';
import { startVim } from './vim.js';

startStars(document.getElementById('stars'));
startGrain(document.getElementById('grain'));
startHud(document);
const graph = startGraph(document);
startVim(document, graph);
window.__site = { graph };
