'use strict';

// --- Theme-aware colors (read from CSS custom properties) ---
function getColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName)
    .trim();
}

export function chartColors() {
  return {
    line: getColor('--color-chart-line'),
    areaStart: getColor('--color-chart-area-start'),
    areaEnd: getColor('--color-chart-area-end'),
    tooltipBg: getColor('--color-chart-tooltip-bg'),
    axis: getColor('--color-chart-axis'),
    grid: getColor('--color-chart-grid'),
    positive: getColor('--color-positive'),
    negative: getColor('--color-negative'),
    bar1: getColor('--color-chart-bar-1'),
    bar2: getColor('--color-chart-bar-2'),
    bar3: getColor('--color-chart-bar-3'),
  };
}

// --- API ---
export async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// --- ECharts helpers ---
export function initChart(container) {
  const chart = echarts.init(container);
  const c = chartColors();
  chart.setOption({
    graphic: {
      type: 'group',
      left: 'center',
      top: 'middle',
      children: [
        {
          type: 'text',
          style: {
            text: '📈',
            font: '36px sans-serif',
            fill: c.axis,
            opacity: 0.4,
          },
          left: 'center',
          top: -20,
        },
        {
          type: 'text',
          style: {
            text: 'Select a scheme to view trends',
            font: '14px sans-serif',
            fill: c.axis,
            opacity: 0.7,
          },
          left: 'center',
          top: 24,
        },
      ],
    },
  });
  return chart;
}

export function autoResize(chart) {
  window.addEventListener('resize', () => chart && chart.resize());
}

export function plotNAVChart(chart, data) {
  if (!chart || !data || data.length === 0) return;
  const c = chartColors();
  const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dates = sorted.map((d) => d.date);
  const navValues = sorted.map((d) => parseFloat(d.net_asset_value) || 0);

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.tooltipBg,
      borderColor: c.line,
      textStyle: { color: '#fff' },
      formatter: (p) =>
        `${
          (p[0].axisValue || '').split('T')[0]
        }<br/>NAV: <strong style="color:${c.line}">₹${
          p[0].data.toFixed(4)
        }</strong>`,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        color: c.axis,
        rotate: 45,
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
      axisLabel: { color: c.axis, formatter: '₹{value}' },
      splitLine: { lineStyle: { color: c.grid } },
    },
    series: [{
      name: 'NAV',
      type: 'line',
      data: navValues,
      smooth: true,
      lineStyle: { width: 3, color: c.line },
      itemStyle: { color: c.line },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{ offset: 0, color: c.areaStart }, {
            offset: 1,
            color: c.areaEnd,
          }],
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
      handleStyle: { color: c.line },
    }],
  }, true);
}

// --- Scheme dropdown ---
export async function loadSchemes(selectEl) {
  selectEl.innerHTML = '<option value="" disabled selected>Loading...</option>';
  selectEl.disabled = true;
  try {
    const schemes = await fetchJSON('/api/schemes');
    schemes.sort((a, b) => a.scheme_name.localeCompare(b.scheme_name));
    selectEl.innerHTML =
      '<option value="" disabled selected>Select a scheme</option>';
    for (const s of schemes) {
      const o = document.createElement('option');
      o.value = s.scheme_code;
      o.textContent = s.scheme_name;
      selectEl.appendChild(o);
    }
    selectEl.disabled = false;
    return schemes;
  } catch (e) {
    console.error('Error loading schemes:', e);
    selectEl.innerHTML =
      '<option value="" disabled selected>Error loading schemes</option>';
    return [];
  }
}

// --- Stats ---
export function computeStats(data) {
  if (!data || data.length === 0) return null;
  const vals = data.map((d) => parseFloat(d.net_asset_value) || 0);
  const current = vals[vals.length - 1], first = vals[0];
  const highest = Math.max(...vals), lowest = Math.min(...vals);
  const change = current - first;
  return {
    current,
    highest,
    lowest,
    change,
    changePercent: ((change / first) * 100).toFixed(2),
    isPositive: change >= 0,
  };
}

export function renderStats(statsCard, stats) {
  if (!stats) return;
  const c = chartColors();
  document.getElementById('current-nav').textContent = `₹${
    stats.current.toFixed(4)
  }`;
  document.getElementById('highest-nav').textContent = `₹${
    stats.highest.toFixed(4)
  }`;
  document.getElementById('lowest-nav').textContent = `₹${
    stats.lowest.toFixed(4)
  }`;
  const el = document.getElementById('nav-change');
  el.textContent = `${stats.isPositive ? '+' : ''}₹${
    Math.abs(stats.change).toFixed(4)
  } (${stats.changePercent}%)`;
  el.style.color = stats.isPositive ? c.positive : c.negative;
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

/**
 * Injects the brand SVG icon into placeholders.
 * Extracted from logo.html triangles.
 */
function injectBrandLogo() {
  const placeholders = document.querySelectorAll('.brand-logo');
  if (placeholders.length === 0) return;

  const svgHtml = `
        <svg viewBox="155 55 650 290" xmlns="http://www.w3.org/2000/svg" class="logo-svg">
            <polygon points="560,60 800,340 320,340" class="logo-p3"/>
            <polygon points="440,80 640,340 240,340" class="logo-p2"/>
            <polygon points="320,100 480,340 160,340" class="logo-p1"/>
        </svg>`;

  placeholders.forEach((el) => {
    el.innerHTML = svgHtml;

    // Inject the tagline next to/under the brand name if it's missing
    const brandParent = el.closest('.brand');
    if (brandParent && !brandParent.querySelector('.brand-tagline')) {
      const tagline = document.createElement('div');
      tagline.className = 'brand-tagline';
      tagline.innerHTML = `
                <span class="logo-p1">Accumulate.</span>
                <span class="logo-p2">Invest.</span>
                <span class="logo-p3">Amplify.</span>`;
      brandParent.appendChild(tagline);
    }
  });
}

// --- Session Analytics ---
export function isBot() {
  const userAgent = navigator.userAgent;
  if (!userAgent) return false;
  return /bot|googlebot|crawler|spider|robot|crawling/i.test(userAgent);
}

async function initializeSession() {
  if (isBot()) return;

  try {
    let sessionToken = localStorage.getItem('sanvas_session_token');
    if (!sessionToken) {
      sessionToken = crypto.randomUUID
        ? crypto.randomUUID()
        : 's-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
      localStorage.setItem('sanvas_session_token', sessionToken);
    }

    // Ping backend once per session
    if (!sessionStorage.getItem('sanvas_session_active')) {
      try {
        const res = await fetch('/api/session/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: sessionToken }),
        });
        if (res.ok) {
          sessionStorage.setItem('sanvas_session_active', 'true');
        }
      } catch (e) {
        console.error('Failed to initialize session', e);
      }
    }

    // Fetch count and update UI if count >= 1000
    try {
      const res = await fetch('/api/session/count');
      if (res.ok) {
        const data = await res.json();
        if (data && data.count >= 1000) {
          const navLinks = document.getElementById('nav-links');
          if (navLinks) {
            let countEl = document.getElementById('session-count-display');
            if (!countEl) {
              countEl = document.createElement('span');
              countEl.id = 'session-count-display';
              countEl.className = 'session-count';
              countEl.style.marginLeft = '1rem';
              countEl.style.fontSize = '0.85rem';
              countEl.style.color = 'var(--color-text-muted)';
              countEl.style.opacity = '0.8';
              navLinks.appendChild(countEl);
            }
            countEl.textContent = `Unique Visitors: ${data.count}`;
          }
        }
      }
    } catch (e) {
      console.error('Failed to get session stats', e);
    }
  } catch (e) {
    console.warn(
      'Session tracking skipped (storage is disabled or unavailable):',
      e.message,
    );
  }
}

// Run injection when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectBrandLogo();
    initializeSession();
  });
} else {
  injectBrandLogo();
  initializeSession();
}
