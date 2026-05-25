// @ts-nocheck: page script — strict types pending
import { initNavigation } from './navigation.js';
import {
  autoResize,
  fetchJSON,
  formatDate,
  initChart,
  loadNAVHistory,
  loadSchemes,
} from './common.js';

document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  initNavigation(currentPath);

  const schemeSelect = document.getElementById('scheme-select');
  const resultCard = document.getElementById('result-card');
  const schemeNameEl = document.getElementById('scheme-name');
  const navValueEl = document.getElementById('nav-value');
  const navDateEl = document.getElementById('nav-date');
  const schemeCodeEl = document.getElementById('scheme-code');

  if (!schemeSelect) return;

  const chartContainer = document.getElementById('chart-container');
  const statsCard = document.getElementById('stats-card');
  const chart = chartContainer ? initChart(chartContainer) : null;
  if (chart) autoResize(chart);

  // --- Filter config ---
  const filterOrder = [
    { id: 'filter-strategy', field: 'fund_strategy', label: 'Fund Strategy' },
    { id: 'filter-company', field: 'fund_company', label: 'Fund Company' },
    { id: 'filter-dist-mode', field: 'dist_mode', label: 'Distribution Mode' },
  ];

  let allSchemes = [];

  function hideResults() {
    if (resultCard) resultCard.style.display = 'none';
    if (statsCard) statsCard.style.display = 'none';
    if (chart) {
      chart.clear();
      chart.setOption({
        title: {
          text: 'Select a scheme to view trends',
          left: 'center',
          top: 'center',
          textStyle: { color: '#6688a3', fontSize: 16 },
        },
      });
    }
  }

  function showResult(data) {
    if (schemeNameEl) schemeNameEl.textContent = data.scheme_name;
    if (navValueEl) navValueEl.textContent = `₹ ${data.net_asset_value}`;
    if (navDateEl) navDateEl.textContent = formatDate(data.date);
    if (schemeCodeEl) schemeCodeEl.textContent = data.scheme_code;
    if (resultCard) resultCard.style.display = 'block';
    if (chart) loadNAVHistory(chart, data.scheme_code, statsCard);
  }

  // --- Cascading filters ---

  function getFilteredSchemes(upToIndex) {
    let filtered = allSchemes;
    for (let i = 0; i <= upToIndex; i++) {
      const el = document.getElementById(filterOrder[i].id);
      const val = el ? el.value : '';
      if (!val) continue;
      if (filterOrder[i].field === 'dist_mode') {
        const [dist, mode] = val.split(' ');
        filtered = filtered.filter((s) =>
          s.distribution_option === dist &&
          (s.purchase_mode || '').includes(mode)
        );
      } else {
        filtered = filtered.filter((s) => s[filterOrder[i].field] === val);
      }
    }
    return filtered;
  }

  function populateFilterDropdown(index, data) {
    const filter = filterOrder[index];
    const select = document.getElementById(filter.id);
    if (!select) return;

    let uniqueValues;
    if (filter.field === 'dist_mode') {
      uniqueValues = [
        ...new Set(data.map((s) => {
          const dist = s.distribution_option || '';
          const mode = (s.purchase_mode || '').replace(' Plan', '');
          return dist && mode ? `${dist} ${mode}` : '';
        })),
      ].filter((v) => v).sort();
    } else {
      uniqueValues = [...new Set(data.map((s) => s[filter.field]))]
        .filter((v) => v)
        .sort();
    }

    select.innerHTML =
      `<option value="" disabled selected>Select ${filter.label}</option>`;
    uniqueValues.forEach((val) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      select.appendChild(opt);
    });

    if (
      filter.field === 'dist_mode' && uniqueValues.includes('Growth Direct')
    ) {
      select.value = 'Growth Direct';
    }
  }

  function handleFilterChange(index) {
    // Reset child dropdowns
    for (let i = index + 1; i < filterOrder.length; i++) {
      const select = document.getElementById(filterOrder[i].id);
      if (select) {
        select.innerHTML = `<option value="" disabled selected>Select ${
          filterOrder[i].label
        }</option>`;
        select.value = '';
      }
    }

    // Populate next dropdown
    if (index < filterOrder.length - 1) {
      const filteredSet = getFilteredSchemes(index);
      if (filteredSet.length === 0) {
        const nextSelect = document.getElementById(filterOrder[index + 1].id);
        if (nextSelect) {
          nextSelect.innerHTML =
            '<option value="" disabled selected>No options available</option>';
        }
        hideResults();
        return;
      }
      populateFilterDropdown(index + 1, filteredSet);
    }

    // Auto-trigger search if all filters selected
    triggerSearchIfReady();
  }

  function triggerSearchIfReady() {
    const params = new URLSearchParams();
    for (const filter of filterOrder) {
      const el = document.getElementById(filter.id);
      if (!el || !el.value) {
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

    hideResults();
    fetchJSON(`/api/search?${params}`)
      .then((data) => showResult(data))
      .catch((error) => {
        alert(error.message);
        hideResults();
      });
  }

  function initCascadingFilters() {
    filterOrder.forEach((filter) => {
      const el = document.getElementById(filter.id);
      if (el) {
        el.innerHTML =
          `<option value="" disabled selected>Select ${filter.label}</option>`;
        el.value = '';
      }
    });
    populateFilterDropdown(0, allSchemes);
  }

  // --- Init ---

  loadSchemes(schemeSelect).then((schemes) => {
    allSchemes = schemes.filter((s) => {
      const type = (s.fund_type || '').toUpperCase();
      return type.includes('OPEN ENDED') || type.includes('INTERVAL');
    });

    filterOrder.forEach((filter, index) => {
      const el = document.getElementById(filter.id);
      if (el) el.addEventListener('change', () => handleFilterChange(index));
    });

    initCascadingFilters();
  });

  // Quick search by scheme select
  schemeSelect.addEventListener('change', (e) => {
    const code = /** @type {HTMLSelectElement} */ (e.target).value;
    if (!code) return;
    fetchJSON(`/api/nav?code=${code}`)
      .then((data) => showResult(data))
      .catch((error) => {
        console.error('Error fetching NAV:', error);
        alert('Failed to fetch details for the selected scheme.');
      });
  });

  // Reset button
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      initCascadingFilters();
      hideResults();
    });
  }
});
