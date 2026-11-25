// Entry point. Each subsystem starts here.
import { startFlight } from './flight.js';
import { startGraph } from './graph.js';

startFlight(document);
const graph = startGraph(document);
window.__site = { graph };
