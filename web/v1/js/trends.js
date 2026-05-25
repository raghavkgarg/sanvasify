// @ts-nocheck: page script — strict types pending
import { initNavigation } from './navigation.js';
import {
  autoResize,
  initChart,
  loadNAVHistory,
  loadSchemes,
} from './common.js';

const schemeSelect = document.getElementById('scheme-select');
const chartContainer = document.getElementById('chart-container');
const statsCard = document.getElementById('stats-card');

const chart = initChart(chartContainer);
autoResize(chart);

schemeSelect.addEventListener('change', (e) => {
  const code = /** @type {HTMLSelectElement} */ (e.target).value;
  if (code) loadNAVHistory(chart, code, statsCard);
});

initNavigation('nav_trends.html');
loadSchemes(schemeSelect);
