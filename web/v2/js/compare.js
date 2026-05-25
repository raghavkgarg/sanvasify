'use strict';
import { fetchJSON, chartColors } from './common.js';

let allData = [], filtered = [], selected = [];
let sortCol = 'annualised', sortDir = 'desc', searchTerm = '';
let chartInstance = null;

const tbody = document.getElementById('compare-body');
const panel = document.getElementById('compare-panel');
const chartEl = document.getElementById('compare-chart');
const dateEl = document.getElementById('compare-date');

async function loadData(strategy) {
  const url = strategy ? `/api/schemes/compare?strategy=${encodeURIComponent(strategy)}` : '/api/schemes/compare';
  allData = await fetchJSON(url);
  if (allData.length > 0) dateEl.textContent = `NAV as of ${allData[0].date.split('T')[0]}`;
  applyFilter();
}

function applyFilter() {
  filtered = allData;
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    filtered = filtered.filter(f => f.scheme_name.toLowerCase().includes(q) || f.fund_company.toLowerCase().includes(q));
  }
  filtered.sort((a, b) => {
    const av = getVal(a, sortCol), bv = getVal(b, sortCol);
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (sortDir === 'asc' ? 1 : -1);
  });
  render();
}

function getVal(row, col) {
  if (col === 'name') return row.scheme_name || '';
  if (col === 'company') return row.fund_company || '';
  if (col === 'nav') return row.nav ?? -Infinity;
  if (col === 'annualised') return row.ret_annualised ?? -Infinity;
  if (col === '1m') return row.ret_1m ?? -Infinity;
  if (col === '3m') return row.ret_3m ?? -Infinity;
  return 0;
}

function render() {
  const best = getBestWorst();
  tbody.innerHTML = '';
  for (const fund of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="fund-name">${fund.scheme_name}</div></td>
      <td>${fund.fund_company || ''}</td>
      <td>${fund.nav != null ? fund.nav.toFixed(4) : '—'}</td>
      ${retCell(fund.ret_annualised, best.annualised)}
      ${retCell(fund.ret_1m, best.m1)}
      ${retCell(fund.ret_3m, best.m3)}
      <td><input type="checkbox" class="compare-chk" data-code="${fund.scheme_code}" ${selected.includes(fund.scheme_code) ? 'checked' : ''}/></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('.compare-chk').forEach(chk => {
    chk.addEventListener('change', e => {
      const code = e.target.dataset.code;
      if (e.target.checked) { if (selected.length >= 4) { e.target.checked = false; return; } selected.push(code); }
      else { selected = selected.filter(c => c !== code); }
      updatePanel();
    });
  });
}

function retCell(val, bestWorst) {
  if (val == null) return '<td class="neutral">—</td>';
  const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
  let extra = '';
  if (bestWorst && val === bestWorst.best) extra = ' best-cell';
  if (bestWorst && val === bestWorst.worst) extra = ' worst-cell';
  return `<td class="${cls}${extra}">${val.toFixed(2)}%</td>`;
}

function getBestWorst() {
  const vals = key => filtered.map(f => f[key]).filter(v => v != null);
  const bw = arr => arr.length ? { best: Math.max(...arr), worst: Math.min(...arr) } : null;
  return { annualised: bw(vals('ret_annualised')), m1: bw(vals('ret_1m')), m3: bw(vals('ret_3m')) };
}

function updatePanel() {
  if (selected.length === 0) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const c = chartColors();
  const funds = selected.map(code => allData.find(f => f.scheme_code === code)).filter(Boolean);
  if (chartInstance) chartInstance.dispose();
  chartInstance = echarts.init(chartEl);
  chartInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: c.axis } },
    grid: { top: 40, bottom: 30, left: 50, right: 20 },
    xAxis: { type: 'category', data: funds.map(f => f.scheme_name.split(' ').slice(0, 3).join(' ')), axisLabel: { color: c.axis, rotate: 15 } },
    yAxis: { type: 'value', axisLabel: { color: c.axis, formatter: '{value}%' }, splitLine: { lineStyle: { color: c.grid } } },
    series: [
      { name: 'Annualised', type: 'bar', data: funds.map(f => f.ret_annualised ?? 0), itemStyle: { color: c.bar1 } },
      { name: '1M', type: 'bar', data: funds.map(f => f.ret_1m ?? 0), itemStyle: { color: c.bar2 } },
      { name: '3M', type: 'bar', data: funds.map(f => f.ret_3m ?? 0), itemStyle: { color: c.bar3 } },
    ],
  });
}

// --- Events ---
document.querySelectorAll('.compare-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.compare-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    selected = [];
    updatePanel();
    loadData(tab.dataset.strategy);
  });
});

document.getElementById('compare-search').addEventListener('input', e => { searchTerm = e.target.value; applyFilter(); });

document.querySelectorAll('#compare-table th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'desc'; }
    document.querySelectorAll('#compare-table th[data-sort]').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    applyFilter();
  });
});

document.getElementById('close-compare').addEventListener('click', () => { selected = []; updatePanel(); render(); });
window.addEventListener('resize', () => chartInstance && chartInstance.resize());

loadData('');
