// Entry point. Each subsystem starts here.
import { startFlight } from './flight.js';

window.__site = true;
startFlight(document);
