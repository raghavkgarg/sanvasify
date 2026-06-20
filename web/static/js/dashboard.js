'use strict';
import { chartColors, fetchJSON, isBot } from './common.js?v=1.0.5';

const el = document.getElementById('overview-chart');
if (el) init();

async function init() {
  if (isBot()) return;
  const c = chartColors();
  try {
    const [data, topPerformers] = await Promise.all([
      fetchJSON('/api/schemes/compare'),
      fetchJSON('/api/analysis/top-performers'),
    ]);
    if (!data || !data.length) return;

    // Render 3M Returns Top Performers widget safely
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

    // Render Composite Leaders widget safely
    try {
      renderCompositeLeaders(topPerformers);
    } catch (widgetErr) {
      console.error('Error rendering composite leaders widget:', widgetErr);
      const container = document.getElementById('composite-leaders-container');
      if (container) {
        container.innerHTML =
          '<div class="empty-state"><p>Unable to load category champions.</p></div>';
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
    num > 0 ? '+' : ''
  }${num.toFixed(2)}%</span></div>`;
}

function renderTopPerformers(data) {
  const container = document.getElementById('top-performers-container');
  if (!container) return;

  const growthDirect = data.filter((f) =>
    f &&
    f.scheme_name &&
    f.scheme_name.toLowerCase().includes('growth') &&
    f.scheme_name.toLowerCase().includes('direct')
  );

  const topFunds = [...growthDirect]
    .filter((f) => f.ret_3m != null)
    .sort((a, b) => {
      const valA = typeof a.ret_3m === 'number' ? a.ret_3m : parseFloat(a.ret_3m);
      const valB = typeof b.ret_3m === 'number' ? b.ret_3m : parseFloat(b.ret_3m);
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
    const navVal = fund.nav != null ? (typeof fund.nav === 'number' ? fund.nav : parseFloat(fund.nav)) : null;
    const navText = navVal != null && !isNaN(navVal) ? `₹${navVal.toFixed(2)}` : '--';

    card.innerHTML = `
      <div class="top-performer-header">
        <div class="top-performer-title" title="${fund.scheme_name || ''}">${shortName(fund.scheme_name)}</div>
        <div class="top-performer-meta">
          <span class="top-performer-company">${fund.fund_company || ''}</span>
          <span class="top-performer-badge">${strategyLabel(fund.fund_strategy)}</span>
        </div>
      </div>
      <div class="top-performer-returns">
        ${retBadge('3M', fund.ret_3m)}
        ${retBadge('1M', fund.ret_1m)}
        ${retBadge('Annualised', fund.ret_annualised)}
      </div>
      <div class="top-performer-footer">
        <div class="top-performer-nav">${navText}</div>
        <a href="nav_trends.html?code=${fund.scheme_code || ''}" class="top-performer-link">View Details →</a>
      </div>
    `;
    container.appendChild(card);
  }
}

function renderCompositeLeaders(topPerformers) {
  const container = document.getElementById('composite-leaders-container');
  if (!container) return;

  if (!topPerformers || (!topPerformers.alpha_king?.length && !topPerformers.shield_guardian?.length && !topPerformers.asymmetric_runner?.length)) {
    container.innerHTML =
      '<div class="empty-state"><p>No top performing funds found.</p></div>';
    return;
  }

  const categories = [
    {
      title: 'Alpha King',
      subtitle: 'Aggressive Growth Leader',
      icon: '👑',
      badgeClass: 'shield-excellent',
      fund: topPerformers.alpha_king?.[0],
      metricLabel: 'Active Alpha',
      metricVal: (f) => f.alpha != null ? `+${f.alpha.toFixed(2)}%` : '—',
    },
    {
      title: 'Shield Guardian',
      subtitle: 'Preservation & Defense',
      icon: '🛡️',
      badgeClass: 'shield-high',
      fund: topPerformers.shield_guardian?.[0],
      metricLabel: 'Max Drawdown',
      metricVal: (f) => f.max_drawdown != null ? `${f.max_drawdown.toFixed(1)}%` : '—',
    },
    {
      title: 'Asymmetric Runner',
      subtitle: 'Tactical Market Capture',
      icon: '⚡',
      badgeClass: 'shield-moderate',
      fund: topPerformers.asymmetric_runner?.[0],
      metricLabel: 'Sortino Ratio',
      metricVal: (f) => f.sortino != null ? f.sortino.toFixed(2) : '—',
    },
  ];

  container.innerHTML = '';
  for (const cat of categories) {
    const fund = cat.fund;
    if (!fund) continue;

    const card = document.createElement('div');
    card.className = 'top-performer-card';

    const score = fund.composite_score != null ? fund.composite_score.toFixed(1) : '—';

    card.innerHTML = `
      <a href="guide.html#composite-model" style="text-decoration: none; color: inherit; align-self: flex-start;">
        <div style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 700; background: var(--color-surface-alt); border: 1px solid var(--color-border); box-shadow: var(--shadow-xs); margin-bottom: var(--space-3); cursor: pointer; transition: transform var(--transition);">
          <span>${cat.icon}</span> <span class="${cat.badgeClass}" style="color: inherit; background: transparent; padding: 0; font-weight: 700;">${cat.title}</span>
        </div>
      </a>
      
      <div class="top-performer-header">
        <div class="top-performer-title" title="${fund.scheme_name || ''}">${shortName(fund.scheme_name)}</div>
        <div class="top-performer-meta">
          <span class="top-performer-company">${fund.fund_company || ''}</span>
          <span class="top-performer-badge" style="font-weight: 600; background: var(--color-accent-dim); color: var(--color-accent); border: 1px solid var(--color-accent-dim);">Score: ${score}/100</span>
        </div>
      </div>
      
      <div class="top-performer-returns" style="margin: var(--space-4) 0;">
        <div class="ret-badge positive" style="flex: 1; min-width: 80px;"><span class="ret-label">${cat.metricLabel}</span><span class="ret-value" style="font-weight:700;">${cat.metricVal(fund)}</span></div>
        ${retBadge('Ann. Ret', fund.ret_annualised)}
        <div class="ret-badge neutral" style="flex: 1; min-width: 80px;"><span class="ret-label">Beta (&beta;)</span><span class="ret-value">${fund.beta != null ? fund.beta.toFixed(2) : '—'}</span></div>
      </div>
      
      <div class="top-performer-footer">
        <div class="top-performer-nav">Max DD: ${fund.max_drawdown != null ? fund.max_drawdown.toFixed(1) : '—'}%</div>
        <a href="nav_trends.html?code=${fund.scheme_code || ''}" class="top-performer-link">View Details →</a>
      </div>
    `;
    container.appendChild(card);
  }
}
