'use strict';
import { chartColors, fetchJSON } from './common.js';

const el = document.getElementById('overview-chart');
if (el) init();

async function init() {
  const c = chartColors();
  const data = await fetchJSON('/api/schemes/compare');
  if (!data.length) return;

  // Group by strategy and compute averages
  const groups = {};
  for (const d of data) {
    const key = d.fund_strategy || 'Other';
    if (!groups[key]) groups[key] = { ann: [], m1: [], m3: [] };
    if (d.ret_annualised != null) groups[key].ann.push(d.ret_annualised);
    if (d.ret_1m != null) groups[key].m1.push(d.ret_1m);
    if (d.ret_3m != null) groups[key].m3.push(d.ret_3m);
  }

  const strategies = Object.keys(groups);
  const avg = (arr) =>
    arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;

  const chart = echarts.init(el);
  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { color: c.axis, fontSize: 12 } },
    grid: { top: 36, bottom: 24, left: 50, right: 16 },
    xAxis: {
      type: 'category',
      data: strategies,
      axisLabel: { color: c.axis, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: c.axis, formatter: '{value}%' },
      splitLine: { lineStyle: { color: c.grid } },
    },
    series: [
      {
        name: 'Annualised',
        type: 'bar',
        data: strategies.map((s) => avg(groups[s].ann)),
        itemStyle: { color: c.bar1 },
        barMaxWidth: 32,
      },
      {
        name: '1 Month',
        type: 'bar',
        data: strategies.map((s) => avg(groups[s].m1)),
        itemStyle: { color: c.bar2 },
        barMaxWidth: 32,
      },
      {
        name: '3 Month',
        type: 'bar',
        data: strategies.map((s) => avg(groups[s].m3)),
        itemStyle: { color: c.bar3 },
        barMaxWidth: 32,
      },
    ],
  });
  window.addEventListener('resize', () => chart.resize());
}
