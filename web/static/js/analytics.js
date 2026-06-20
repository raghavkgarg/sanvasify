'use strict';
import { fetchJSON } from './common.js';

const content = document.getElementById('tab-content');
let currentTab = 'topPerformers';

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
  let data = await fetchJSON('/api/analysis/volatility');
  // Filter to show only 'Growth - Direct' variants
  data = data.filter((f) =>
    f.scheme_name.toLowerCase().includes('growth') &&
    f.scheme_name.toLowerCase().includes('direct')
  );
  const maxStd = Math.max(...data.map((r) => r.std_dev || 0));

  const header = sectionHeader(
    'Volatility Rating',
    'How much each fund swings day-to-day. Longer bar = bigger daily moves = higher risk.',
  );

  const explanation = `
    <div class="panel" style="margin: 0 var(--space-4) var(--space-6) var(--space-4); font-size: var(--text-sm); line-height: 1.6; color: var(--color-text-secondary);">
      <p><strong>Volatility</strong> measures the dispersion of daily returns for each fund. A higher standard deviation indicates greater daily price fluctuations and higher risk.</p>
      <p style="margin-top: 6px;">Funds are categorized into <strong>Low</strong> (std dev &le; 0.5%), <strong>Medium</strong> (std dev &le; 1.5%), and <strong>High</strong> (std dev &gt; 1.5%) volatility bands based on their daily movement profiles.</p>
    </div>
  `;

  const legend =
    `<div class="vol-legend"><span class="vol-legend-item"><span class="vol-dot" style="background:var(--color-positive)"></span>Low</span><span class="vol-legend-item"><span class="vol-dot" style="background:var(--color-accent)"></span>Medium</span><span class="vol-legend-item"><span class="vol-dot" style="background:var(--color-negative)"></span>High</span></div>`;

  const rows = data.map((r) => `
    <div class="vol-row">
      <a href="nav_trends.html?code=${r.scheme_code}" class="vol-name" style="text-decoration: none; color: inherit; cursor: pointer;">${shortName(r.scheme_name)
    }</a>
      <div class="vol-bar-wrap">
        ${volBar(r.std_dev, maxStd, r.volatility_rating)}
        <span class="vol-value">±${(r.std_dev || 0).toFixed(2)}%</span>
      </div>
    </div>`).join('');

  content.innerHTML = header + explanation + legend +
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
  let data = await fetchJSON('/api/analysis/trends');
  // Filter to show only 'Growth - Direct' variants
  data = data.filter((f) =>
    f.scheme_name.toLowerCase().includes('growth') &&
    f.scheme_name.toLowerCase().includes('direct')
  );

  const header = sectionHeader(
    'Trend Signals',
    '7-day vs 30-day moving average crossover. Green rising = gaining momentum. Red falling = losing ground.',
  );

  const explanation = `
    <div class="panel" style="margin: 0 var(--space-4) var(--space-6) var(--space-4); font-size: var(--text-sm); line-height: 1.6; color: var(--color-text-secondary);">
      <p><strong>Trend Signals</strong> are generated using a 7-day and 30-day Simple Moving Average (SMA) crossover system to detect shifts in NAV momentum.</p>
      <p style="margin-top: 6px;">An <strong>Uptrend</strong> indicates the short-term average has crossed above the long-term average (bullish momentum), while a <strong>Downtrend</strong> indicates it has crossed below (bearish momentum).</p>
    </div>
  `;

  const rows = data.map((r) => {
    const since = r.since ? r.since.split('T')[0] : '';
    const diff = r.ma_7 && r.ma_30
      ? ((r.ma_7 - r.ma_30) / r.ma_30 * 100).toFixed(2)
      : null;
    const diffCls = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
    return `
    <div class="trend-row">
      <div class="trend-info">
        <a href="nav_trends.html?code=${r.scheme_code}" class="trend-name" style="text-decoration: none; color: inherit; cursor: pointer;">${shortName(r.scheme_name)
      }</a>
        <div class="trend-meta">
          ${since ? `<span class="trend-since">since ${since}</span>` : ''}
          <span class="trend-nav">₹${(r.nav || 0).toFixed(2)}</span>
        </div>
      </div>
      <div class="trend-spark-wrap">${trendLine(r.signal)}</div>
      <div class="trend-diff ${diffCls}">${diff > 0 ? '+' : ''}${diff || '—'
      }%</div>
    </div>`;
  }).join('');

  content.innerHTML = header + explanation + `<div class="trend-list">${rows}</div>`;
}

async function loadAnomalies() {
  content.innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><span>Loading...</span></div>';
  let data = await fetchJSON('/api/analysis/anomalies');
  // Filter to show only 'Growth - Direct' variants
  data = data.filter((f) =>
    f.scheme_name.toLowerCase().includes('growth') &&
    f.scheme_name.toLowerCase().includes('direct')
  );

  const header = sectionHeader(
    'Unusual Moves',
    'Days when a fund moved far outside its normal range. Bigger circle = more extreme.',
  );

  const explanation = `
    <div class="panel" style="margin: 0 var(--space-4) var(--space-6) var(--space-4); font-size: var(--text-sm); line-height: 1.6; color: var(--color-text-secondary);">
      <p><strong>Anomalies</strong> are single-day NAV movements that are statistically unusual compared to a fund's historical performance.</p>
      <p style="margin-top: 6px;">We flag returns with a <strong>Z-score</strong> greater than 3.0 or less than -3.0, meaning the daily return was more than 3 standard deviations away from the fund's historical mean daily return.</p>
    </div>
  `;

  if (!data || data.length === 0) {
    content.innerHTML = header + explanation +
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
        <a href="nav_trends.html?code=${r.scheme_code}" class="anomaly-name" style="text-decoration: none; color: inherit; cursor: pointer;">${shortName(r.scheme_name)
      }</a>
        <div class="anomaly-meta">${r.date.split('T')[0]}</div>
      </div>
      <div class="anomaly-change" style="color:${color}">${arrow} ${Math.abs(r.daily_return).toFixed(2)
      }%</div>
      <div class="anomaly-z">${Math.abs(r.z_score).toFixed(1)}× normal</div>
    </div>`;
  }).join('');

  content.innerHTML = header + explanation + `<div class="anomaly-list">${rows}</div>`;
}

async function loadRiskMetrics() {
  content.innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><span>Loading risk & capture metrics...</span></div>';
  const header = sectionHeader(
    'Risk & Capture Metrics vs. Benchmark',
    'Evaluate capital preservation, downside risk-adjusted performance, and market capture ratios relative to the Nifty 500 TRI.'
  );
  try {
    let data = await fetchJSON('/api/analysis/risk-metrics');
    // Filter to show only 'Growth - Direct' variants
    data = data.filter((f) =>
      f.scheme_name.toLowerCase().includes('growth') &&
      f.scheme_name.toLowerCase().includes('direct')
    );

    const explanation = `
      <div class="panel" style="margin: 0 var(--space-4) var(--space-6) var(--space-4); font-size: var(--text-sm); line-height: 1.6; color: var(--color-text-secondary);">
        <p><strong>Beta (&beta;) / Alpha (&alpha;)</strong>: Beta measures market sensitivity (lower = insulated). Alpha is the excess risk-adjusted return relative to the benchmark (higher is better).</p>
        <p style="margin-top: 6px;"><strong>Sortino Ratio</strong>: Measures return per unit of <em>downside</em> risk. Unlike Sharpe, it does not penalize upside volatility. A Sortino &gt; 1.0 is considered good.</p>
        <p style="margin-top: 6px;"><strong>Max Drawdown</strong>: The largest peak-to-trough drop in NAV. Shows the maximum historical paper loss a fund suffered.</p>
        <p style="margin-top: 6px;"><strong>Capture Ratios</strong>: Upside Capture measures how much of index gains the fund captured during market rises. Downside Capture measures how much index loss the fund captured during drops. (Ideal: High Upside, Low Downside).</p>
      </div>
    `;

    const tableRows = data.map((r) => {
      const ann = r.ret_annualised != null ? `${r.ret_annualised.toFixed(2)}%` : '—';
      const beta = r.beta != null ? r.beta.toFixed(2) : '—';
      const alpha = r.alpha != null ? `${r.alpha > 0 ? '+' : ''}${r.alpha.toFixed(2)}%` : '—';
      const sortino = r.sortino != null ? r.sortino.toFixed(2) : '—';
      const maxDd = r.max_drawdown != null ? `${r.max_drawdown.toFixed(2)}%` : '—';
      const upCap = r.upside_capture != null ? `${r.upside_capture.toFixed(0)}%` : '—';
      const downCap = r.downside_capture != null ? `${r.downside_capture.toFixed(0)}%` : '—';

      // Beta coloring class
      let betaCls = 'ret-badge neutral';
      if (r.beta != null) {
        if (r.beta < 0.5) betaCls = 'ret-badge positive';
        else if (r.beta < 1.0) betaCls = 'ret-badge neutral';
        else betaCls = 'ret-badge negative';
      }

      // Alpha coloring class
      let alphaCls = 'ret-badge neutral';
      if (r.alpha != null) {
        if (r.alpha > 0) alphaCls = 'ret-badge positive';
        else if (r.alpha < 0) alphaCls = 'ret-badge negative';
      }

      // Sortino coloring class
      let sortinoCls = 'ret-badge neutral';
      if (r.sortino != null) {
        if (r.sortino > 1.0) sortinoCls = 'ret-badge positive';
        else if (r.sortino < 0) sortinoCls = 'ret-badge negative';
      }

      // Max Drawdown coloring class (smaller absolute drawdown is positive/green)
      let ddCls = 'ret-badge neutral';
      if (r.max_drawdown != null) {
        if (Math.abs(r.max_drawdown) < 8.0) ddCls = 'ret-badge positive';
        else if (Math.abs(r.max_drawdown) > 15.0) ddCls = 'ret-badge negative';
      }

      // Capture spread rating (Asymmetry)
      let captureHtml = '—';
      if (r.upside_capture != null && r.downside_capture != null) {
        const spread = r.upside_capture - r.downside_capture;
        const color = spread > 40 ? 'var(--color-positive)' : spread > 15 ? 'var(--color-accent)' : 'var(--color-text-muted)';
        captureHtml = `
          <div style="font-size: var(--text-xs); line-height: 1.2;">
            <div>Up: <strong style="color:var(--color-positive);">${upCap}</strong></div>
            <div style="margin-top: 1px;">Down: <strong style="color:var(--color-negative);">${downCap}</strong></div>
          </div>
        `;
      }

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="font-weight: 500; font-size: var(--text-sm); padding: var(--space-3) var(--space-4); text-align: left;">
            <a href="nav_trends.html?code=${r.scheme_code}" style="text-decoration: none; color: inherit; font-weight: 600;">${shortName(r.scheme_name)}</a>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">${r.fund_company || ''}</div>
          </td>
          <td style="font-weight: 600; text-align: right; vertical-align: middle; padding: var(--space-3) var(--space-4);">${ann}</td>
          <td style="text-align: center; vertical-align: middle; padding: var(--space-3) var(--space-4);">
            <span class="${betaCls}" style="padding: 2px 8px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;">${beta}</span>
          </td>
          <td style="text-align: right; vertical-align: middle; padding: var(--space-3) var(--space-4);">
            <span class="${alphaCls}" style="padding: 2px 8px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;">${alpha}</span>
          </td>
          <td style="text-align: center; vertical-align: middle; padding: var(--space-3) var(--space-4);">
            <span class="${sortinoCls}" style="padding: 2px 8px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;">${sortino}</span>
          </td>
          <td style="text-align: center; vertical-align: middle; padding: var(--space-3) var(--space-4);">
            <span class="${ddCls}" style="padding: 2px 8px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600;">${maxDd}</span>
          </td>
          <td style="text-align: center; vertical-align: middle; padding: var(--space-3) var(--space-4);">${captureHtml}</td>
        </tr>
      `;
    }).join('');

    const table = `
      <div style="overflow-x: auto; width: 100%;">
        <table style="width: 100%; border-collapse: collapse; margin-top: var(--space-4);">
          <thead>
            <tr style="border-bottom: 2px solid var(--color-border); color: var(--color-text-muted); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="text-align: left; padding: var(--space-3) var(--space-4);">Scheme / Fund House</th>
              <th style="text-align: left; padding: var(--space-3) var(--space-4);">Ann. Return</th>
              <th style="text-align: left; padding: var(--space-3) var(--space-4);">Beta (&beta;)</th>
              <th style="text-align: left; padding: var(--space-3) var(--space-4);">Alpha (&alpha;)</th>
              <th style="text-align: left; padding: var(--space-3) var(--space-4);">Sortino</th>
              <th style="text-align: left; padding: var(--space-3) var(--space-4);">Max DD</th>
              <th style="text-align: left; padding: var(--space-3) var(--space-4);">Capture (Up/Down)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;

    content.innerHTML = header + explanation + table;
  } catch (err) {
    console.error('Error loading risk metrics:', err);
    content.innerHTML = header +
      '<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>Failed to load risk metrics. Please try again later.</p></div>';
  }
}

async function loadTopPerformers() {
  content.innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><span>Loading leaders...</span></div>';
  const header = sectionHeader(
    'Top SIF Performers',
    'The category champions of the Specialised Investment Fund space, ranked dynamically using our <a href="guide.html#composite-model" style="color: var(--color-accent); text-decoration: none; font-weight: 600; border-bottom: 1px dashed var(--color-accent);">Multi-Factor Composite Score model</a>.'
  );
  try {
    const data = await fetchJSON('/api/analysis/top-performers');

    const renderCard = (fund, rank, badgeText, badgeClass, metricLabel, metricVal) => {
      const score = fund.composite_score != null ? fund.composite_score.toFixed(1) : '—';
      return `
        <div class="top-performer-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 700; background: var(--color-surface-alt); border: 1px solid var(--color-border); box-shadow: var(--shadow-xs); margin-bottom: var(--space-2);">
            <span>#${rank}</span> <span class="${badgeClass}" style="color: inherit; background: transparent; padding: 0; font-weight: 700;">${badgeText}</span>
          </div>
          
          <div>
            <div style="font-weight: 600; font-size: var(--text-sm); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${fund.scheme_name || ''}">
              <a href="nav_trends.html?code=${fund.scheme_code}" style="text-decoration: none; color: inherit; font-weight: 600;">${shortName(fund.scheme_name)}</a>
            </div>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">${fund.fund_company || ''}</div>
          </div>
          
          <div style="margin: var(--space-4) 0; display: flex; gap: var(--space-2); flex-wrap: wrap;">
            <div class="ret-badge positive" style="flex: 1; min-width: 70px; padding: 4px 6px;"><span class="ret-label">${metricLabel}</span><span class="ret-value" style="font-weight: 700; font-size: 11px;">${metricVal}</span></div>
            <div class="ret-badge positive" style="flex: 1; min-width: 70px; padding: 4px 6px;"><span class="ret-label">Ann. Ret</span><span class="ret-value" style="font-size: 11px;">${fund.ret_annualised != null ? fund.ret_annualised.toFixed(1) : '—'}%</span></div>
            <div class="ret-badge neutral" style="flex: 1; min-width: 70px; padding: 4px 6px;"><span class="ret-label">Beta</span><span class="ret-value" style="font-size: 11px;">${fund.beta != null ? fund.beta.toFixed(2) : '—'}</span></div>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-border); padding-top: var(--space-3); font-size: var(--text-xs);">
            <span style="color: var(--color-text-secondary); font-weight: 600; background: var(--color-accent-dim); color: var(--color-accent); padding: 2px 6px; border-radius: var(--radius-sm);">Score: ${score}/100</span>
            <a href="nav_trends.html?code=${fund.scheme_code || ''}" style="text-decoration: none; color: var(--color-accent); font-weight: 600;">Details →</a>
          </div>
        </div>
      `;
    };

    const renderColumn = (title, subtitle, icon, badgeClass, funds, metricLabel, metricValFn) => {
      const cardsHtml = funds.map((f, idx) => renderCard(f, idx + 1, title, badgeClass, metricLabel, metricValFn(f))).join('');
      return `
        <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: var(--space-5);">
          <div style="border-bottom: 2px solid var(--color-border); padding-bottom: var(--space-2); margin-bottom: var(--space-2);">
            <h3 style="font-size: var(--text-md); font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <span>${icon}</span> ${title}
            </h3>
            <p style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">${subtitle}</p>
          </div>
          ${cardsHtml}
        </div>
      `;
    };

    const grid = `
      <div style="display: flex; gap: var(--space-6); flex-wrap: wrap; margin-top: var(--space-4); padding: 0 var(--space-4);">
        ${renderColumn('Alpha King', 'Aggressive Growth Leaders', '👑', 'shield-excellent', data.alpha_king || [], 'Alpha', (f) => f.alpha != null ? `+${f.alpha.toFixed(2)}%` : '—')}
        ${renderColumn('Shield Guardian', 'Preservation & Defense', '🛡️', 'shield-high', data.shield_guardian || [], 'Max DD', (f) => f.max_drawdown != null ? `${f.max_drawdown.toFixed(1)}%` : '—')}
        ${renderColumn('Asymmetric Runner', 'Tactical Capture', '⚡', 'shield-moderate', data.asymmetric_runner || [], 'Sortino', (f) => f.sortino != null ? f.sortino.toFixed(2) : '—')}
      </div>
    `;

    content.innerHTML = header + grid;
  } catch (err) {
    console.error('Error loading top performers:', err);
    content.innerHTML = header +
      '<div class="empty-state"><span class="empty-state-icon">⚠️</span><p>Failed to load leaders. Please try again later.</p></div>';
  }
}

const loaders = {
  volatility: loadVolatility,
  trends: loadTrends,
  anomalies: loadAnomalies,
  riskMetrics: loadRiskMetrics,
  topPerformers: loadTopPerformers,
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

const urlParams = new URLSearchParams(window.location.search);
const tabParam = urlParams.get('tab');
if (tabParam && loaders[tabParam]) {
  currentTab = tabParam;
  document.querySelectorAll('.compare-tab').forEach((t) => {
    if (t.dataset.tab === currentTab) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
}

loaders[currentTab]();
