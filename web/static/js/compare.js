'use strict';
import { chartColors, fetchJSON } from './common.js';

let allData = [], filtered = [], selected = [];
let sortCol = 'annualised', sortDir = 'desc', searchTerm = '';
let chartInstance = null;

const list = document.getElementById('fund-list');
const panel = document.getElementById('compare-panel');
const chartEl = document.getElementById('compare-chart');
const dateEl = document.getElementById('compare-date');

async function loadData(strategy) {
  list.innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><span>Loading funds...</span></div>';
  const url = strategy
    ? `/api/schemes/compare?strategy=${encodeURIComponent(strategy)}`
    : '/api/schemes/compare';
  const data = await fetchJSON(url);
  // Filter to show only 'Growth - Direct' variants
  allData = data.filter((f) =>
    f.scheme_name.toLowerCase().includes('growth') &&
    f.scheme_name.toLowerCase().includes('direct')
  );
  if (allData.length > 0) {
    dateEl.textContent = `NAV as of ${allData[0].date.split('T')[0]}`;
  }
  applyFilter();
}

function applyFilter() {
  filtered = allData;
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter((f) =>
      f.scheme_name.toLowerCase().includes(q) ||
      f.fund_company.toLowerCase().includes(q)
    );
  }
  filtered.sort((a, b) => {
    const av = getVal(a, sortCol), bv = getVal(b, sortCol);
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (sortDir === 'asc' ? 1 : -1);
  });
  render();
}

function getVal(row, col) {
  if (col === 'annualised') return row.ret_annualised ?? -Infinity;
  if (col === '1m') return row.ret_1m ?? -Infinity;
  if (col === '3m') return row.ret_3m ?? -Infinity;
  if (col === 'si') return row.ret_si ?? -Infinity;
  return 0;
}

function render() {
  list.innerHTML = '';
  for (const fund of filtered) {
    const card = document.createElement('div');
    card.className = 'fund-card';
    card.innerHTML = `
      <div class="fund-card-left">
        <div class="fund-card-name">${shortName(fund.scheme_name)}</div>
        <div class="fund-card-meta">
          <span class="fund-card-company">${fund.fund_company || ''}</span>
          <span class="fund-card-pill">${
      strategyLabel(fund.fund_strategy)
    }</span>
          <a href="nav.html?code=${
      fund.scheme_code
    }" class="fund-card-link">View Details →</a>
        </div>
      </div>
      <div class="fund-card-right">
        <span class="fund-card-nav-value">₹${
      fund.nav != null ? fund.nav.toFixed(2) : '--'
    }</span>
        <span class="fund-card-nav-date">as of ${
      fund.date ? fund.date.split('T')[0] : ''
    }</span>
      </div>
      ${retBadge('Annualised', fund.ret_annualised)}
      ${retBadge('1M', fund.ret_1m)}
      ${retBadge('3M', fund.ret_3m)}
      ${retBadge('SI', fund.ret_si)}
      <button class="btn btn-ghost compare-btn" data-code="${fund.scheme_code}">
        ${selected.includes(fund.scheme_code) ? '✓ Selected' : '⊞ Compare'}
      </button>`;
    list.appendChild(card);
  }

  list.querySelectorAll('.compare-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      if (selected.includes(code)) {
        selected = selected.filter((c) => c !== code);
      } else if (selected.length < 4) selected.push(code);
      render();
      updatePanel();
    });
  });
}

function shortName(name) {
  // Remove common suffixes for cleaner display
  return name.replace(/ - (Regular|Direct) Plan.*$/i, '').replace(
    / - (Growth|IDCW).*$/i,
    '',
  );
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
  const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
  return `<div class="ret-badge ${cls}"><span class="ret-label">${label}</span><span class="ret-value">${
    val.toFixed(2)
  }%</span></div>`;
}

async function updatePanel() {
  if (selected.length === 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  const c = chartColors();

  if (chartInstance) chartInstance.showLoading();

  try {
    // Fetch historical data for all selected schemes in parallel
    const histories = await Promise.all(
      selected.map(code => fetchJSON(`/api/nav/history?code=${code}`))
    );

    const funds = selected.map((code, i) => {
      const baseInfo = allData.find(f => f.scheme_code === code);
      return { ...baseInfo, history: histories[i] };
    }).filter(f => f.history && f.history.length > 0);

  if (chartInstance) chartInstance.dispose();
  chartInstance = echarts.init(chartEl);

    // Create a unique set of all dates across all selected funds to use as X-axis
    const allDates = [...new Set(histories.flat().map(d => d.date))].sort();

    const series = funds.map(f => {
      const dataMap = new Map(f.history.map(h => [h.date, h.net_asset_value]));
      const seriesData = allDates.map(date => dataMap.get(date) || null);

      return {
        name: shortName(f.scheme_name),
        type: 'line',
        data: seriesData,
        smooth: true,
        showSymbol: false,
        connectNulls: true,
        lineStyle: { width: 2 }
      };
    });

  chartInstance.setOption({
      tooltip: { 
        trigger: 'axis',
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        textStyle: { color: '#fff' }
      },
    legend: { top: 0, textStyle: { color: c.axis, fontSize: 12 } },
      grid: { top: 60, bottom: 60, left: 50, right: 20 },
    xAxis: {
      type: 'category',
        data: allDates,
        axisLabel: { 
          color: c.axis, 
          rotate: 30, 
          fontSize: 10,
          formatter: (v) => new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        },
    },
    yAxis: {
      type: 'value',
        scale: true,
        axisLabel: { color: c.axis, formatter: '₹{value}' },
      splitLine: { lineStyle: { color: c.grid } },
    },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 5 }],
      series: series
  });
  } catch (error) {
    console.error('Error rendering comparison chart:', error);
  } finally {
    if (chartInstance) chartInstance.hideLoading();
  }
}

// --- Events ---
document.querySelectorAll('.compare-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.compare-tab').forEach((t) =>
      t.classList.remove('active')
    );
    tab.classList.add('active');
    selected = [];
    updatePanel();
    loadData(tab.dataset.strategy);
  });
});

document.querySelectorAll('.sort-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach((b) =>
      b.classList.remove('active')
    );
    btn.classList.add('active');
    const col = btn.dataset.sort;
    if (sortCol === col) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    else {
      sortCol = col;
      sortDir = 'desc';
    }
    applyFilter();
  });
});

document.getElementById('compare-search').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  applyFilter();
});
document.getElementById('close-compare').addEventListener('click', () => {
  selected = [];
  updatePanel();
  render();
});
window.addEventListener(
  'resize',
  () => chartInstance && chartInstance.resize(),
);

loadData('');
