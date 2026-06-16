'use strict';
import { chartColors, fetchJSON } from './common.js';

const el = document.getElementById('overview-chart');
if (el) init();

async function init() {
  const c = chartColors();
  try {
    const data = await fetchJSON('/api/schemes/compare');
    if (!data || !data.length) return;

    // Render Top Performers widget safely
    try {
      renderTopPerformers(data);
    } catch (widgetErr) {
      console.error('Error rendering top performers widget:', widgetErr);
      const container = document.getElementById('top-performers-container');
      if (container) {
        container.innerHTML =
          '<div class="empty-state"><p>Unable to load top performers.</p></div>';
      }
    }

    // Group by strategy and compute averages
    const groups = {};
    for (const d of data) {
      if (!d) continue;
      const key = d.fund_strategy || 'Other';
      if (!groups[key]) groups[key] = { ann: [], m1: [], m3: [] };
      if (d.ret_annualised != null) groups[key].ann.push(d.ret_annualised);
      if (d.ret_1m != null) groups[key].m1.push(d.ret_1m);
      if (d.ret_3m != null) groups[key].m3.push(d.ret_3m);
    }

    const strategies = Object.keys(groups);
    const avg = (arr) =>
      arr.length
        ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)
        : 0;

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
  } catch (err) {
    console.error('Error in dashboard init:', err);
  }
}

function shortName(name) {
  if (!name) return '';
  return name
    .replace(/ - (Regular|Direct) Plan.*$/i, '')
    .replace(/ - (Growth|IDCW).*$/i, '');
}

function strategyLabel(s) {
  if (!s) return '';
  return s.replace(' Fund', '')
    .replace('Long-Short', 'L/S')
    .replace('Active Asset Allocator', 'Active Allocator')
    .replace('Sector Rotation', 'Sector Rot');
}

function retBadge(label, val) {
  if (val == null) {
    return `<div class="ret-badge neutral"><span class="ret-label">${label}</span><span class="ret-value">—</span></div>`;
  }
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) {
    return `<div class="ret-badge neutral"><span class="ret-label">${label}</span><span class="ret-value">—</span></div>`;
  }
  const cls = num > 0 ? 'positive' : num < 0 ? 'negative' : 'neutral';
  return `<div class="ret-badge ${cls}"><span class="ret-label">${label}</span><span class="ret-value">${
    num.toFixed(2)
  }%</span></div>`;
}

function renderTopPerformers(data) {
  const container = document.getElementById('top-performers-container');
  if (!container) return;

  // Filter growth/direct variants safely
  const growthDirect = data.filter((f) =>
    f &&
    f.scheme_name &&
    f.scheme_name.toLowerCase().includes('growth') &&
    f.scheme_name.toLowerCase().includes('direct')
  );

  // Sort by 3m return descending
  const topFunds = [...growthDirect]
    .filter((f) => f.ret_3m != null)
    .sort((a, b) => {
      const valA = typeof a.ret_3m === 'number'
        ? a.ret_3m
        : parseFloat(a.ret_3m);
      const valB = typeof b.ret_3m === 'number'
        ? b.ret_3m
        : parseFloat(b.ret_3m);
      return valB - valA;
    })
    .slice(0, 3);

  if (!topFunds.length) {
    container.innerHTML =
      '<div class="empty-state"><p>No top performing funds found.</p></div>';
    return;
  }

  container.innerHTML = '';
  for (const fund of topFunds) {
    const card = document.createElement('div');
    card.className = 'top-performer-card';
    const navVal = fund.nav != null
      ? (typeof fund.nav === 'number' ? fund.nav : parseFloat(fund.nav))
      : null;
    const navText = navVal != null && !isNaN(navVal)
      ? `₹${navVal.toFixed(2)}`
      : '--';

    card.innerHTML = `
      <div class="top-performer-header">
        <div class="top-performer-title" title="${fund.scheme_name || ''}">${
      shortName(fund.scheme_name)
    }</div>
        <div class="top-performer-meta">
          <span class="top-performer-company">${fund.fund_company || ''}</span>
          <span class="top-performer-badge">${
      strategyLabel(fund.fund_strategy)
    }</span>
        </div>
      </div>
      <div class="top-performer-returns">
        ${retBadge('3M', fund.ret_3m)}
        ${retBadge('1M', fund.ret_1m)}
        ${retBadge('Annualised', fund.ret_annualised)}
      </div>
      <div class="top-performer-footer">
        <div class="top-performer-nav">${navText}</div>
        <a href="nav_trends.html?code=${
      fund.scheme_code || ''
    }" class="top-performer-link">View Details →</a>
      </div>
    `;
    container.appendChild(card);
  }
}
