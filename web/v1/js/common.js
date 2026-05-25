// @ts-nocheck: page script — strict types pending
/**
 * Shared Utilities for Sanvasify Frontend
 */

// --- API ---

export async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

// --- Formatting ---

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

// --- ECharts helpers ---

export function initChart(container) {
  const chart = echarts.init(container);
  chart.setOption({
    title: {
      text: 'Select a scheme to view trends',
      left: 'center',
      top: 'center',
      textStyle: { color: '#6688a3', fontSize: 16 },
    },
  });
  return chart;
}

export function autoResize(chart) {
  window.addEventListener('resize', () => chart && chart.resize());
}

export function plotNAVChart(chart, data, options = {}) {
  if (!chart || !data || data.length === 0) return;

  const sortedData = [...data].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );
  const dates = sortedData.map((d) => d.date);
  const navValues = sortedData.map((d) => parseFloat(d.net_asset_value) || 0);

  const defaultOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0F2E3F',
      borderColor: '#E2B13E',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const date = params[0].axisValue
          ? params[0].axisValue.split('T')[0]
          : '';
        const nav = params[0].data;
        return `${date}<br/>NAV: <strong style="color:#E2B13E">₹${
          nav.toFixed(4)
        }</strong>`;
      },
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        color: '#cbd5e6',
        rotate: 45,
        formatter: (value) =>
          new Date(value).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
          }),
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#cbd5e6', formatter: '₹{value}' },
      splitLine: { lineStyle: { color: 'rgba(203, 213, 230, 0.1)' } },
    },
    series: [{
      name: 'NAV',
      type: 'line',
      data: navValues,
      smooth: true,
      lineStyle: { width: 3, color: '#E2B13E' },
      itemStyle: { color: '#E2B13E' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(226, 177, 62, 0.3)' },
            { offset: 1, color: 'rgba(226, 177, 62, 0.05)' },
          ],
        },
      },
    }],
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '15%',
      containLabel: true,
    },
    dataZoom: [{ type: 'inside' }, {
      type: 'slider',
      handleStyle: { color: '#E2B13E' },
    }],
  };

  chart.setOption(Object.assign(defaultOption, options), true);
}

// --- Scheme dropdown ---

export async function loadSchemes(selectEl) {
  try {
    const schemes = await fetchJSON('/api/schemes');
    schemes.sort((a, b) => a.scheme_name.localeCompare(b.scheme_name));
    selectEl.innerHTML =
      '<option value="" disabled selected>Select a scheme</option>';
    schemes.forEach((scheme) => {
      const option = document.createElement('option');
      option.value = scheme.scheme_code;
      option.textContent = scheme.scheme_name;
      selectEl.appendChild(option);
    });
    return schemes;
  } catch (error) {
    console.error('Error loading schemes:', error);
    selectEl.innerHTML =
      '<option value="" disabled selected>Error loading schemes</option>';
    return [];
  }
}

// --- Stats ---

export function getNAVStats(data) {
  if (!data || data.length === 0) return null;

  const navValues = data.map((d) => parseFloat(d.net_asset_value) || 0);
  const current = navValues[navValues.length - 1];
  const first = navValues[0];
  const highest = Math.max(...navValues);
  const lowest = Math.min(...navValues);
  const change = current - first;
  const changePercent = ((change / first) * 100).toFixed(2);

  return {
    current,
    highest,
    lowest,
    change,
    changePercent,
    isPositive: change >= 0,
  };
}

export function updateStatsUI(elements, stats) {
  if (!stats) return;
  const { current, highest, lowest, change, changePercent, isPositive } = stats;

  elements.current.textContent = `₹${current.toFixed(4)}`;
  elements.highest.textContent = `₹${highest.toFixed(4)}`;
  elements.lowest.textContent = `₹${lowest.toFixed(4)}`;

  elements.change.textContent = `${isPositive ? '+' : ''}₹${
    Math.abs(change).toFixed(4)
  } (${changePercent}%)`;
  elements.change.style.color = isPositive ? '#4CAF50' : '#f56c6c';
}

// --- Shared NAV history loader ---

export async function loadNAVHistory(chart, schemeCode, statsCard) {
  try {
    const data = await fetchJSON(`/api/nav/history?code=${schemeCode}`);
    plotNAVChart(chart, data);

    const stats = getNAVStats(data);
    if (stats && statsCard) {
      updateStatsUI({
        current: document.getElementById('current-nav'),
        highest: document.getElementById('highest-nav'),
        lowest: document.getElementById('lowest-nav'),
        change: document.getElementById('nav-change'),
      }, stats);
      statsCard.style.display = 'block';
      setTimeout(() => chart.resize(), 0);
    }
  } catch (error) {
    console.error('Error loading NAV history:', error);
  }
}
