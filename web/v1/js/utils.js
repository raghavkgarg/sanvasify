// @ts-nocheck: page script — strict types pending
/**
 * Shared Utilities for Sanvasify Frontend
 */

export async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
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
