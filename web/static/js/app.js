'use strict';
import {
  autoResize,
  computeStats,
  fetchJSON,
  initChart,
  loadSchemes,
  plotNAVChart,
  renderStats,
} from './common.js';

const schemeSelect = document.getElementById('scheme-select');
const resultCard = document.getElementById('result-card');
const schemeNameEl = document.getElementById('scheme-name');
const navValueEl = document.getElementById('nav-value');
const navDateEl = document.getElementById('nav-date');
const schemeCodeEl = document.getElementById('scheme-code');
const chartContainer = document.getElementById('chart-container');
const statsCard = document.getElementById('stats-card');

const chart = initChart(chartContainer);
autoResize(chart);

// --- NAV history (page-specific: shows result card + chart) ---
async function showNAVHistory(code) {
  try {
    const data = await fetchJSON(`/api/nav/history?code=${code}`);
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

function hideResults() {
  resultCard.style.display = 'none';
  if (statsCard) statsCard.style.display = 'none';
  if (chart) {
    chart.clear();
    initChart(chartContainer);
  }
}

// --- Cascading Filters ---
const filterOrder = [
  { id: 'filter-strategy', field: 'fund_strategy', label: 'Fund Strategy' },
  { id: 'filter-company', field: 'fund_company', label: 'Fund Company' },
  { id: 'filter-dist-mode', field: 'dist_mode', label: 'Distribution Mode' },
];

let allSchemes = [];

function initCascadingFilters() {
  filterOrder.forEach((f) => {
    const el = document.getElementById(f.id);
    if (el) {
      el.innerHTML =
        `<option value="" disabled selected>Select ${f.label}</option>`;
      el.value = '';
    }
  });
  populateFilterDropdown(0, allSchemes);
}

function populateFilterDropdown(index, data) {
  const filter = filterOrder[index];
  const select = document.getElementById(filter.id);
  if (!select) return;

  let values;
  if (filter.field === 'dist_mode') {
    values = [
      ...new Set(data.map((s) => {
        const dist = s.distribution_option || '';
        const mode = (s.purchase_mode || '').replace(' Plan', '');
        return dist && mode ? `${dist} ${mode}` : '';
      })),
    ].filter(Boolean).sort();
  } else {
    values = [...new Set(data.map((s) => s[filter.field]))].filter(Boolean)
      .sort();
  }

  select.innerHTML =
    `<option value="" disabled selected>Select ${filter.label}</option>`;
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  }
  if (filter.field === 'dist_mode' && values.includes('Growth Direct')) {
    select.value = 'Growth Direct';
  }
}

function getFilteredSchemes(upToIndex) {
  let filtered = allSchemes;
  for (let i = 0; i <= upToIndex; i++) {
    const val = document.getElementById(filterOrder[i].id)?.value;
    if (!val) continue;
    if (filterOrder[i].field === 'dist_mode') {
      const [dist, mode] = val.split(' ');
      filtered = filtered.filter((s) =>
        s.distribution_option === dist && (s.purchase_mode || '').includes(mode)
      );
    } else {
      filtered = filtered.filter((s) => s[filterOrder[i].field] === val);
    }
  }
  return filtered;
}

function handleFilterChange(index) {
  for (let i = index + 1; i < filterOrder.length; i++) {
    const sel = document.getElementById(filterOrder[i].id);
    if (sel) {
      sel.innerHTML = `<option value="" disabled selected>Select ${
        filterOrder[i].label
      }</option>`;
      sel.value = '';
    }
  }
  if (index < filterOrder.length - 1) {
    const filtered = getFilteredSchemes(index);
    if (filtered.length === 0) {
      const next = document.getElementById(filterOrder[index + 1].id);
      if (next) {
        next.innerHTML =
          '<option value="" disabled selected>No options available</option>';
      }
      hideResults();
    } else {
      populateFilterDropdown(index + 1, filtered);
    }
  }
  checkAndTriggerSearch();
}

async function checkAndTriggerSearch() {
  const params = new URLSearchParams();
  for (const filter of filterOrder) {
    const el = document.getElementById(filter.id);
    if (!el?.value) {
      hideResults();
      return;
    }
    if (filter.field === 'dist_mode') {
      const [dist, mode] = el.value.split(' ');
      params.append('distribution_option', dist);
      params.append('purchase_mode', mode + ' Plan');
    } else {
      params.append(filter.field, el.value);
    }
  }
  try {
    const data = await fetchJSON(`/api/search?${params}`);
    schemeNameEl.textContent = data.scheme_name;
    navValueEl.textContent = `₹ ${data.net_asset_value}`;
    navDateEl.textContent = data.date ? data.date.split('T')[0] : '';
    schemeCodeEl.textContent = data.scheme_code;
    resultCard.style.display = 'block';
    showNAVHistory(data.scheme_code);
  } catch (e) {
    alert(e.message);
    hideResults();
  }
}

// --- Init ---
(async () => {
  const schemes = await loadSchemes(schemeSelect);
  allSchemes = schemes.filter((s) => {
    const t = (s.fund_type || '').toUpperCase();
    return t.includes('OPEN ENDED') || t.includes('INTERVAL');
  });

  filterOrder.forEach((f, i) => {
    const el = document.getElementById(f.id);
    if (el) el.addEventListener('change', () => handleFilterChange(i));
  });
  initCascadingFilters();

  schemeSelect.addEventListener('change', async (e) => {
    const code = e.target.value;
    if (!code) return;
    try {
      const data = await fetchJSON(`/api/nav?code=${code}`);
      schemeNameEl.textContent = data.scheme_name;
      navValueEl.textContent = `₹ ${data.net_asset_value}`;
      navDateEl.textContent = data.date ? data.date.split('T')[0] : '';
      schemeCodeEl.textContent = data.scheme_code;
      resultCard.style.display = 'block';
      showNAVHistory(code);
    } catch (e) {
      console.error('Error fetching NAV:', e);
    }
  });

  // Auto-load scheme from URL parameter if present (e.g. from Compare page)
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get('code');
  if (codeParam) {
    schemeSelect.value = codeParam;
    if (schemeSelect.value === codeParam) {
      schemeSelect.dispatchEvent(new Event('change'));
    }
  }

  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      initCascadingFilters();
      hideResults();
    });
  }
})();
