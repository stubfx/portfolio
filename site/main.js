// Every page: the day/night switch, copy .md and the raw view, the film grain.
import { initTheme } from './theme.js';
import { initCopy } from './copy.js';
import { startGrain } from './grain.js';

initTheme();
initCopy();
startGrain(document.getElementById('grain'));
