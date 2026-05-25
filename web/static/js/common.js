'use strict';

// --- API ---
export async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- ECharts helpers ---
export function initChart(container) {
  const chart = echarts.init(container);
  chart.setOption({
    title: {
      text: 'Select a scheme to vi
      ew trends', left: 'center', top: 'center', textStyle: { color: '#6688a3', fontSize: 16 } },
  });
  return chart;
}

export function autoResize(chart) {
  window.addEventListener('resize', () => chart && chart.resize());
}

export function plotNAVChart(chart, data) {
  if (!chart || !data || data.length === 0) return;
  const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dates = sorted.map(d => d.date);
  const navValues = sorted.map(d => parseFloat(d.net_asset_value) || 0);

  chart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: '#0F2E3F', borderColor: '#E2B13E', textStyle: { color: '#fff' },
      formatter: p => `${(p[0].axisValue || '').split('T')[0]}<br/>NAV: <strong style="color:#E2B13E">₹${p[0].data.toFixed(4)}</strong>` },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#cbd5e6', rotate: 45, formatter: v => new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#cbd5e6', formatter: '₹{value}' }, splitLine: { lineStyle: { color: 'rgba(203,213,230,0.1)' } } },
    series: [{ name: 'NAV', type: 'line', data: navValues, smooth: true, lineStyle: { width: 3, color: '#E2B13E' }, itemStyle: { color: '#E2B13E' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(226,177,62,0.3)' }, { offset: 1, color: 'rgba(226,177,62,0.05)' }] } } }],
    grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', handleStyle: { color: '#E2B13E' } }],
  }, true);
}

// --- Scheme dropdown ---
export async function loadSchemes(selectEl) {
  try {
    const schemes = await fetchJSON('/api/schemes');
    schemes.sort((a, b) => a.scheme_name.localeCompare(b.scheme_name));
    selectEl.innerHTML = '<option value="" disabled selected>Select a scheme</option>';
    for (const s of schemes) {
      const o = document.createElement('option');
      o.value = s.scheme_code;
      o.textContent = s.scheme_name;
      selectEl.appendChild(o);
    }
    return schemes;
  } catch (e) {
    console.error('Error loading schemes:', e);
    selectEl.innerHTML = '<option value="" disabled selected>Error loading schemes</option>';
    return [];
  }
}

// --- Stats ---
export function computeStats(data) {
  if (!data || data.length === 0) return null;
  const vals = data.map(d => parseFloat(d.net_asset_value) || 0);
  const current = vals[vals.length - 1], first = vals[0];
  const highest = Math.max(...vals), lowest = Math.min(...vals);
  const change = current - first;
  return { current, highest, lowest, change, changePercent: ((change / first) * 100).toFixed(2), isPositive: change >= 0 };
}

export function renderStats(statsCard, stats) {
  if (!stats) return;
  document.getElementById('current-nav').textContent = `₹${stats.current.toFixed(4)}`;
  document.getElementById('highest-nav').textContent = `₹${stats.highest.toFixed(4)}`;
  document.getElementById('lowest-nav').textContent = `₹${stats.lowest.toFixed(4)}`;
  const el = document.getElementById('nav-change');
  el.textContent = `${stats.isPositive ? '+' : ''}₹${Math.abs(stats.change).toFixed(4)} (${stats.changePercent}%)`;
  el.style.color = stats.isPositive ? '#4CAF50' : '#f56c6c';
  statsCard.style.display = 'block';
}

// --- Combined: load history, plot, show stats ---
export async function loadNAVHistory(chart, schemeCode, statsCard) {
  try {
    const data = await fetchJSON(`/api/nav/history?code=${schemeCode}`);
    plotNAVChart(chart, data);
    const stats = computeStats(data);
    if (stats && statsCard) {
      renderStats(statsCard, stats);
      setTimeout(() => chart.resize(), 0);
    }
  } catch (e) {
    console.error('Error loading NAV history:', e);
  }
}
