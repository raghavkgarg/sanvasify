'use strict';
import { chartColors, fetchJSON, isBot } from './common.js?v=1.0.5';

let allData = [], filtered = [], selected = [];
let sortCol = 'annualised', sortDir = 'desc', searchTerm = '';
let chartInstance = null;
let compareBenchmark = false;

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

  try {
    const [data, volatilityData] = await Promise.all([
      fetchJSON(url),
      fetchJSON('/api/analysis/volatility'),
    ]);

    const volMap = new Map(
      volatilityData.map((v) => [v.scheme_code, v.std_dev]),
    );

    // Filter to show only 'Growth - Direct' variants
    allData = data.filter((f) =>
      f.scheme_name.toLowerCase().includes('growth') &&
      f.scheme_name.toLowerCase().includes('direct')
    ).map((f) => {
      const stdDev = volMap.get(f.scheme_code) ?? null;
      let sharpe = null;
      let alphaShield = { text: 'LOW', shields: 1, class: 'shield-low' };
      if (stdDev !== null && stdDev > 0 && f.ret_annualised !== null) {
        sharpe = (f.ret_annualised - 6.0) / (stdDev * 15.8745);
        if (sharpe >= 3) alphaShield = { text: 'EXC', shields: 4, class: 'shield-excellent' };
        else if (sharpe >= 2) alphaShield = { text: 'HIGH', shields: 3, class: 'shield-high' };
        else if (sharpe >= 1) alphaShield = { text: 'MOD', shields: 2, class: 'shield-moderate' };
        else alphaShield = { text: 'LOW', shields: 1, class: 'shield-low' };
      }
      return { ...f, std_dev: stdDev, sharpe, alpha_shield: alphaShield };
    });

    if (allData.length > 0) {
      dateEl.textContent = `NAV as of ${allData[0].date.split('T')[0]}`;
    }
    applyFilter();

    // Auto-select funds from URL params if present
    const urlParams = new URLSearchParams(window.location.search);
    const codesParam = urlParams.get('codes');
    if (codesParam) {
      const parsedCodes = codesParam.split(',');
      selected = parsedCodes.filter(code => allData.some(f => f.scheme_code === code));
      if (selected.length > 0) {
        updatePanel();
        render();
      }
    }
  } catch (err) {
    console.error('Error loading compare data:', err);
    list.innerHTML =
      '<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>Failed to load comparison data. Please try again later.</p></div>';
  }
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
          <span class="fund-card-pill">${strategyLabel(fund.fund_strategy)
      }</span>
          <a href="nav_trends.html?code=${fund.scheme_code}" class="fund-card-link">View Details →</a>
        </div>
      </div>
      <div class="fund-card-right">
        <span class="fund-card-nav-value">₹${fund.nav != null ? fund.nav.toFixed(2) : '--'
      }</span>
        <span class="fund-card-nav-date">as of ${fund.date ? fund.date.split('T')[0] : ''
      }</span>
      </div>
      <div class="fund-card-returns">
        ${retBadge('Annualised', fund.ret_annualised)}
        ${retBadge('1M', fund.ret_1m)}
        ${retBadge('3M', fund.ret_3m)}
        ${retBadge('SI', fund.ret_si)}
        ${sharpeBadge('Sharpe', fund.sharpe)}
        ${shieldBadge('Shield', fund.alpha_shield)}
      </div>
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
  return `<div class="ret-badge ${cls}"><span class="ret-label">${label}</span><span class="ret-value">${val.toFixed(2)
    }%</span></div>`;
}

function sharpeBadge(label, val) {
  if (val == null) {
    return `<div class="ret-badge neutral"><span class="ret-label">${label}</span><span class="ret-value">—</span></div>`;
  }
  const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
  return `<div class="ret-badge ${cls}"><span class="ret-label">${label}</span><span class="ret-value">${val.toFixed(2)
    }</span></div>`;
}

function shieldBadge(label, rating) {
  if (!rating) {
    return `<div class="ret-badge neutral"><span class="ret-label">${label}</span><span class="ret-value">—</span></div>`;
  }
  let text = 'LOW';
  let shields = 1;
  let cls = 'shield-low';

  if (typeof rating === 'object') {
    text = rating.text;
    shields = rating.shields;
    cls = rating.class;
  } else {
    if (rating.includes('EXC') || rating.includes('Excellent')) {
      text = 'EXC'; shields = 4; cls = 'shield-excellent';
    } else if (rating.includes('HIGH') || rating.includes('High')) {
      text = 'HIGH'; shields = 3; cls = 'shield-high';
    } else if (rating.includes('MOD') || rating.includes('Moderate')) {
      text = 'MOD'; shields = 2; cls = 'shield-moderate';
    }
  }

  const shieldsHtml = '🛡️'.repeat(shields);
  return `
    <div class="ret-badge ${cls}">
      <span class="ret-label">${label}</span>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 1px; width: 100%;">
        <span class="shield-badge-text" style="font-size: 11px; font-weight: 600; font-family: var(--font-mono);">${text}</span>
        <span class="shield-badge-icons" style="font-size: 8px; letter-spacing: -0.5px; line-height: 1;">${shieldsHtml}</span>
      </div>
    </div>
  `;
}

async function updatePanel() {
  const totalCompared = selected.length + (compareBenchmark ? 1 : 0);
  if (totalCompared < 2 || selected.length === 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  const c = chartColors();

  if (chartInstance) chartInstance.showLoading();

  try {
    // Fetch historical data for all selected schemes in parallel
    const fetchPromises = selected.map((code) =>
      fetchJSON(`/api/nav/history?code=${code}`)
    );
    if (compareBenchmark) {
      fetchPromises.push(fetchJSON('/api/indices/history?code=NIFTY_500_TRI'));
    }

    const results = await Promise.all(fetchPromises);

    // Normalize all date strings to YYYY-MM-DD to ensure exact alignment
    results.forEach((history) => {
      if (Array.isArray(history)) {
        history.forEach((item) => {
          if (item && item.date) {
            item.date = item.date.slice(0, 10);
          }
        });
      }
    });

    let histories = [];
    let benchmarkHistory = null;
    if (compareBenchmark) {
      histories = results.slice(0, -1);
      benchmarkHistory = results[results.length - 1];
    } else {
      histories = results;
    }

    const funds = selected.map((code, i) => {
      const baseInfo = allData.find((f) => f.scheme_code === code);
      return { ...baseInfo, history: histories[i] };
    }).filter((f) => f.history && f.history.length > 0);

    if (chartInstance) chartInstance.dispose();
    chartInstance = echarts.init(chartEl);

    // Create a unique set of all dates across all selected funds (and benchmark) to use as X-axis
    const allHistories = [...histories];
    if (benchmarkHistory) {
      allHistories.push(benchmarkHistory);
    }
    const allDates = [...new Set(allHistories.flat().map((d) => d.date))]
      .sort();

    const series = funds.map((f) => {
      const dataMap = new Map(
        f.history.map((h) => [h.date, h.net_asset_value]),
      );

      // Find base NAV on the first day this fund has data in this range
      let baseNAV = null;
      for (const d of allDates) {
        if (dataMap.has(d)) {
          baseNAV = dataMap.get(d);
          break;
        }
      }

      const seriesData = allDates.map((date) => {
        const val = dataMap.get(date);
        if (val == null) return null;
        if (compareBenchmark) {
          if (baseNAV === null || baseNAV === 0) return null;
          return (val / baseNAV) * 100;
        }
        return val;
      });

      return {
        name: shortName(f.scheme_name),
        type: 'line',
        data: seriesData,
        smooth: true,
        showSymbol: false,
        connectNulls: true,
        lineStyle: { width: 2 },
      };
    });

    if (compareBenchmark && benchmarkHistory && allDates.length > 0) {
      const dataMap = new Map(benchmarkHistory.map((h) => [h.date, h.value]));

      // Find base value on the first day index has data in this range
      let baseVal = null;
      for (const d of allDates) {
        if (dataMap.has(d)) {
          baseVal = dataMap.get(d);
          break;
        }
      }

      const benchmarkSeriesData = allDates.map((date) => {
        const val = dataMap.get(date);
        if (val == null || baseVal === null || baseVal === 0) return null;
        return (val / baseVal) * 100;
      });

      series.push({
        name: 'Nifty 500 TRI (Benchmark)',
        type: 'line',
        data: benchmarkSeriesData,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        itemStyle: { color: '#ef4444' },
      });
    }

    chartInstance.setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        textStyle: { color: '#fff' },
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
          formatter: (v) =>
            new Date(v).toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
            }),
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { color: c.axis, formatter: '{value}' },
        splitLine: { lineStyle: { color: c.grid } },
      },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 5 }],
      series: series,
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
const benchCompareBtn = document.getElementById('benchmark-compare-btn');
if (benchCompareBtn) {
  benchCompareBtn.addEventListener('click', () => {
    compareBenchmark = !compareBenchmark;
    benchCompareBtn.textContent = compareBenchmark ? '✓ Selected' : '⊞ Compare';
    updatePanel();
  });
}
window.addEventListener(
  'resize',
  () => chartInstance && chartInstance.resize(),
);

function updateBenchmarkBadge(prefix, val, isPercentage) {
  const badge = document.getElementById(`${prefix}-badge`);
  const valEl = document.getElementById(`${prefix}-val`);
  if (!badge || !valEl) return;

  if (val == null) {
    badge.className = 'ret-badge neutral';
    valEl.textContent = '—';
    return;
  }

  const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
  badge.className = `ret-badge ${cls}`;
  valEl.textContent = `${val > 0 ? '+' : ''}${val.toFixed(2)}${isPercentage ? '%' : ''
    }`;
}

async function loadBenchmarkMetrics() {
  if (isBot()) return;
  try {
    const returnData = await fetchJSON(
      '/api/indices/compare?code=NIFTY_500_TRI',
    );
    const historyData = await fetchJSON(
      '/api/indices/history?code=NIFTY_500_TRI',
    );

    if (returnData) {
      updateBenchmarkBadge('bench-annualised', returnData.ret_annualised, true);
      updateBenchmarkBadge('bench-1m', returnData.ret_1m, true);
      updateBenchmarkBadge('bench-3m', returnData.ret_3m, true);
      updateBenchmarkBadge('bench-si', returnData.ret_si, true);
    }

    if (historyData && historyData.length > 1) {
      // Calculate Daily Standard Deviation from history
      const dailyReturns = [];
      for (let i = 1; i < historyData.length; i++) {
        const prev = historyData[i - 1].value;
        const curr = historyData[i].value;
        if (prev > 0) {
          dailyReturns.push((curr - prev) / prev * 100);
        }
      }

      if (dailyReturns.length > 0) {
        const mean = dailyReturns.reduce((sum, r) => sum + r, 0) /
          dailyReturns.length;
        const variance = dailyReturns.reduce((sum, r) =>
          sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev > 0 && returnData && returnData.ret_annualised != null) {
          const annualised = returnData.ret_annualised;
          const sharpe = (annualised - 6.0) / (stdDev * 15.8745);

          let shield = { text: 'LOW', shields: 1, class: 'shield-low' };
          if (sharpe >= 3) {
            shield = { text: 'EXC', shields: 4, class: 'shield-excellent' };
          } else if (sharpe >= 2) {
            shield = { text: 'HIGH', shields: 3, class: 'shield-high' };
          } else if (sharpe >= 1) {
            shield = { text: 'MOD', shields: 2, class: 'shield-moderate' };
          }

          const sharpeVal = document.getElementById('bench-sharpe-val');
          const sharpeBadge = document.getElementById('bench-sharpe-badge');
          if (sharpeVal && sharpeBadge) {
            sharpeVal.textContent = sharpe.toFixed(2);
            sharpeBadge.className = `ret-badge ${sharpe > 0 ? 'positive' : 'negative'
              }`;
          }

          const shieldText = document.getElementById('bench-shield-text');
          const shieldIcons = document.getElementById('bench-shield-icons');
          const shieldBadge = document.getElementById('bench-shield-badge');
          if (shieldText && shieldIcons && shieldBadge) {
            shieldText.textContent = shield.text;
            shieldIcons.textContent = '🛡️'.repeat(shield.shields);
            shieldBadge.className = `ret-badge ${shield.class}`;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error loading benchmark metrics:', err);
  }
}

const shareBtn = document.getElementById('share-comparison');
if (shareBtn) {
  shareBtn.addEventListener('click', () => {
    if (selected.length === 0) return;
    const url = new URL(window.location.href);
    url.searchParams.set('codes', selected.join(','));
    navigator.clipboard.writeText(url.toString()).then(() => {
      const originalText = shareBtn.innerHTML;
      shareBtn.innerHTML = '<span>✓</span> Copied!';
      setTimeout(() => {
        shareBtn.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Error copying to clipboard:', err);
    });
  });
}

loadBenchmarkMetrics();
loadData('');
