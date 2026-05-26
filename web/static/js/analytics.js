'use strict';
import { fetchJSON } from './common.js';

const content = document.getElementById('tab-content');
let currentTab = 'volatility';

function sectionHeader(title, description) {
  return `<div class="analytics-header">
    <h2 class="analytics-title">${title}</h2>
    <p class="analytics-desc">${description}</p>
  </div>`;
}

function shortName(name) {
  return name
    .replace(/ - (Regular|Direct) Plan.*$/i, '')
    .replace(/ - (Growth|IDCW).*$/i, '');
}

// Horizontal bar scaled 0-100%
function volBar(stdDev, maxStdDev, rating) {
  const pct = Math.min((stdDev / maxStdDev) * 100, 100);
  const color = rating === 'Low'
    ? 'var(--color-positive)'
    : rating === 'High'
    ? 'var(--color-negative)'
    : 'var(--color-accent)';
  return `<div class="vol-bar-track"><div class="vol-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

async function loadVolatility() {
  content.innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><span>Loading...</span></div>';
  const data = await fetchJSON('/api/analytics/volatility');
  const maxStd = Math.max(...data.map((r) => r.std_dev || 0));

  const header = sectionHeader(
    'Volatility Rating',
    'How much each fund swings day-to-day. Longer bar = bigger daily moves = higher risk.',
  );

  const legend =
    `<div class="vol-legend"><span class="vol-legend-item"><span class="vol-dot" style="background:var(--color-positive)"></span>Low</span><span class="vol-legend-item"><span class="vol-dot" style="background:var(--color-accent)"></span>Medium</span><span class="vol-legend-item"><span class="vol-dot" style="background:var(--color-negative)"></span>High</span></div>`;

  const rows = data.map((r) => `
    <div class="vol-row">
      <div class="vol-name">${shortName(r.scheme_name)}</div>
      <div class="vol-bar-wrap">
        ${volBar(r.std_dev, maxStd, r.volatility_rating)}
        <span class="vol-value">±${(r.std_dev || 0).toFixed(2)}%</span>
      </div>
    </div>`).join('');

  content.innerHTML = header + legend +
    `<div class="vol-chart">${rows}</div>`;
}

// SVG sparkline for trend
function trendLine(signal) {
  const color = signal === 'Uptrend'
    ? 'var(--color-positive)'
    : signal === 'Downtrend'
    ? 'var(--color-negative)'
    : 'var(--color-text-muted)';
  const path = signal === 'Uptrend'
    ? 'M2 22 C8 20, 12 16, 18 14 S28 10, 34 7 S42 4, 48 2'
    : signal === 'Downtrend'
    ? 'M2 2 C8 4, 12 8, 18 10 S28 14, 34 17 S42 20, 48 22'
    : 'M2 12 C8 11, 12 13, 18 12 S28 11, 34 13 S42 12, 48 12';
  return `<svg class="trend-spark" viewBox="0 0 50 24" preserveAspectRatio="none">
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}

async function loadTrends() {
  content.innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><span>Loading...</span></div>';
  const data = await fetchJSON('/api/analytics/trends');

  const header = sectionHeader(
    'Trend Signals',
    '7-day vs 30-day moving average crossover. Green rising = gaining momentum. Red falling = losing ground.',
  );

  const rows = data.map((r) => {
    const since = r.since ? r.since.split('T')[0] : '';
    const diff = r.ma_7 && r.ma_30
      ? ((r.ma_7 - r.ma_30) / r.ma_30 * 100).toFixed(2)
      : null;
    const diffCls = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
    return `
    <div class="trend-row">
      <div class="trend-info">
        <div class="trend-name">${shortName(r.scheme_name)}</div>
        <div class="trend-meta">
          ${since ? `<span class="trend-since">since ${since}</span>` : ''}
          <span class="trend-nav">₹${(r.nav || 0).toFixed(2)}</span>
        </div>
      </div>
      <div class="trend-spark-wrap">${trendLine(r.signal)}</div>
      <div class="trend-diff ${diffCls}">${diff > 0 ? '+' : ''}${
      diff || '—'
    }%</div>
    </div>`;
  }).join('');

  content.innerHTML = header + `<div class="trend-list">${rows}</div>`;
}

async function loadAnomalies() {
  content.innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><span>Loading...</span></div>';
  const data = await fetchJSON('/api/analytics/anomalies');

  const header = sectionHeader(
    'Unusual Moves',
    'Days when a fund moved far outside its normal range. Bigger circle = more extreme.',
  );

  if (!data || data.length === 0) {
    content.innerHTML = header +
      '<p class="analytics-desc">No unusual moves detected.</p>';
    return;
  }

  const maxZ = Math.max(...data.map((r) => Math.abs(r.z_score || 0)));
  const rows = data.map((r) => {
    const size = Math.max(12, (Math.abs(r.z_score) / maxZ) * 32);
    const color = r.daily_return > 0
      ? 'var(--color-positive)'
      : 'var(--color-negative)';
    const arrow = r.daily_return > 0 ? '↑' : '↓';
    return `
    <div class="anomaly-row">
      <div class="anomaly-dot" style="width:${size}px;height:${size}px;background:${color}"></div>
      <div class="anomaly-info">
        <div class="anomaly-name">${shortName(r.scheme_name)}</div>
        <div class="anomaly-meta">${r.date.split('T')[0]}</div>
      </div>
      <div class="anomaly-change" style="color:${color}">${arrow} ${
      Math.abs(r.daily_return).toFixed(2)
    }%</div>
      <div class="anomaly-z">${Math.abs(r.z_score).toFixed(1)}× normal</div>
    </div>`;
  }).join('');

  content.innerHTML = header + `<div class="anomaly-list">${rows}</div>`;
}

const loaders = {
  volatility: loadVolatility,
  trends: loadTrends,
  anomalies: loadAnomalies,
};

document.getElementById('analytics-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.compare-tab');
  if (!btn) return;
  document.querySelectorAll('.compare-tab').forEach((t) =>
    t.classList.remove('active')
  );
  btn.classList.add('active');
  currentTab = btn.dataset.tab;
  loaders[currentTab]();
});

loaders[currentTab]();
