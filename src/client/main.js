// Entry point. Each subsystem starts here.
import { startFlight } from './flight.js';
import { startGraph } from './graph.js';
import { startStars } from './stars.js';
import { startGrain } from './grain.js';

startStars(document.getElementById('stars'));
startGrain(document.getElementById('grain'));
startFlight(document);
const graph = startGraph(document);
window.__site = { graph };
