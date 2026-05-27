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

schemeSelect.addEventListener('change', (e) => {
  if (e.target.value) loadNAVHistory(chart, e.target.value, statsCard);
});

(async () => {
  await loadSchemes(schemeSelect);
  const urlParams = new URLSearchParams(window.location.search);
  const codeToLoad = urlParams.get('code') || 'SIF-1';
  schemeSelect.value = codeToLoad;
  if (schemeSelect.value === codeToLoad) {
    schemeSelect.dispatchEvent(new Event('change'));
  }
})();
