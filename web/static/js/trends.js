'use strict';
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
loadSchemes(schemeSelect);

schemeSelect.addEventListener('change', (e) => {
  if (e.target.value) loadNAVHistory(chart, e.target.value, statsCard);
});
