// Entry point. Each subsystem starts here.
import { startFlight } from './flight.js';
import { startGraph } from './graph.js';
import { startStars } from './stars.js';
import { startGrain } from './grain.js';
import { startHud } from './hud.js';
import { startVim } from './vim.js';

startStars(document.getElementById('stars'));
startGrain(document.getElementById('grain'));
startHud(document);
startFlight(document);
const graph = startGraph(document);
startVim(document, graph);
window.__site = { graph };
