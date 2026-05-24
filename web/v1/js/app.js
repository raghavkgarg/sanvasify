// @ts-nocheck: page script — strict types pending
import { initNavigation } from './navigation.js';
import {
  fetchJSON,
  formatDate,
  getNAVStats,
  plotNAVChart,
  updateStatsUI,
} from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize navigation first (on every page)
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  initNavigation(currentPath);

  const schemeSelect = document.getElementById('scheme-select');
  const resultCard = document.getElementById('result-card');
  const schemeNameEl = document.getElementById('scheme-name');
  const navValueEl = document.getElementById('nav-value');
  const navDateEl = document.getElementById('nav-date');
  const schemeCodeEl = document.getElementById('scheme-code');

  // Exit early if we are not on the check NAV page
  if (!schemeSelect) return;

  // Trends elements
  const chartContainer = document.getElementById('chart-container');
  const statsCard = document.getElementById('stats-card');
  let chart = null;

  // Initialize ECharts
  function initChart() {
    if (!chartContainer) return;
    chart = echarts.init(chartContainer);
    chart.setOption({
      title: {
        text: 'Select a scheme to view performance trends',
        left: 'center',
        top: 'center',
        textStyle: { color: '#6688a3', fontSize: 16 },
      },
    });
  }

  // Load NAV history for a scheme
  async function loadNAVHistory(schemeCode) {
    try {
      const data = await fetchJSON(`/api/nav/history?code=${schemeCode}`);
      plotNAVChart(chart, data);
      updateStats(data);
    } catch (error) {
      console.error('Error loading NAV history:', error);
    }
  }

  function updateStats(data) {
    const stats = getNAVStats(data);
    if (!stats) {
      if (statsCard) statsCard.style.display = 'none';
      return;
    }

    updateStatsUI({
      current: document.getElementById('current-nav'),
      highest: document.getElementById('highest-nav'),
      lowest: document.getElementById('lowest-nav'),
      change: document.getElementById('nav-change'),
    }, stats);

    statsCard.style.display = 'block';

    // Force chart to recalculate width now that statsCard takes up space
    if (chart) {
      setTimeout(() => chart.resize(), 0);
    }
  }

  // Handle window resize
  window.addEventListener('resize', () => chart && chart.resize());

  // Initialize chart
  initChart();

  function hideResults() {
    resultCard.style.display = 'none';
    if (statsCard) statsCard.style.display = 'none';
    if (chart) {
      chart.clear();
      initChart();
    }
  }

  let allSchemes = [];
  const filterOrder = [
    { id: 'filter-strategy', field: 'fund_strategy', label: 'Fund Strategy' },
    { id: 'filter-company', field: 'fund_company', label: 'Fund Company' },
    { id: 'filter-dist-mode', field: 'dist_mode', label: 'Distribution Mode' },
  ];

  // 1. Fetch the list of schemes to populate the dropdown
  fetchJSON('/api/schemes')
    .then((schemes) => {
      // Store for advanced search filtering
      // Filter to include both Open Ended and Interval schemes as requested
      allSchemes = schemes.filter((s) => {
        const type = (s.fund_type || '').toUpperCase();
        return type.includes('OPEN ENDED') || type.includes('INTERVAL');
      });

      // Attach change listeners to handle the cascade once
      filterOrder.forEach((filter, index) => {
        const el = document.getElementById(filter.id);
        if (el) {
          el.addEventListener('change', () => handleFilterChange(index));
        }
      });

      initCascadingFilters();

      // Sort schemes alphabetically by name
      schemes.sort((a, b) => a.scheme_name.localeCompare(b.scheme_name));

      schemeSelect.innerHTML =
        '<option value="" disabled selected>Select a scheme</option>';

      schemes.forEach((scheme) => {
        const option = document.createElement('option');
        option.value = scheme.scheme_code;
        option.textContent = scheme.scheme_name;
        schemeSelect.appendChild(option);
      });
    })
    .catch((error) => {
      console.error('Error fetching schemes:', error);
      schemeSelect.innerHTML =
        '<option value="" disabled selected>Error loading schemes</option>';
    });

  // 2. Listen for selection changes to fetch NAV details
  schemeSelect.addEventListener('change', (e) => {
    const code = e.target.value;
    if (!code) return;

    fetchJSON(`/api/nav?code=${code}`)
      .then((data) => {
        // Update UI with data
        schemeNameEl.textContent = data.scheme_name;
        navValueEl.textContent = `₹ ${data.net_asset_value}`;
        navDateEl.textContent = formatDate(data.date);
        schemeCodeEl.textContent = data.scheme_code;

        // Show the card
        resultCard.style.display = 'block';

        // Fetch Trends
        loadNAVHistory(code);
      })
      .catch((error) => {
        console.error('Error fetching NAV:', error);
        alert('Failed to fetch details for the selected scheme.');
      });
  });

  // 3. Cascading Filters Logic
  function initCascadingFilters() {
    // Reset all dropdowns to initial state
    filterOrder.forEach((filter) => {
      const el = document.getElementById(filter.id);
      if (el) {
        el.innerHTML =
          `<option value="" disabled selected>Select ${filter.label}</option>`;
        el.value = '';
      }
    });

    // Populate the first dropdown in the hierarchy
    populateFilterDropdown(0, allSchemes);
  }

  function populateFilterDropdown(index, data) {
    const filter = filterOrder[index];
    const select = document.getElementById(filter.id);
    if (!select) return;

    let uniqueValues;
    if (filter.field === 'dist_mode') {
      // Create combined "Distribution Mode" options (e.g., Growth Regular)
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

    // Default to "Growth Direct" if available for Distribution Mode
    if (
      filter.field === 'dist_mode' && uniqueValues.includes('Growth Direct')
    ) {
      select.value = 'Growth Direct';
    }
  }

  function handleFilterChange(index) {
    // Reset all child dropdowns further down the hierarchy
    for (let i = index + 1; i < filterOrder.length; i++) {
      const select = document.getElementById(filterOrder[i].id);
      if (select) {
        select.innerHTML = `<option value="" disabled selected>Select ${
          filterOrder[i].label
        }</option>`; // Ensure label is dynamic
        select.value = '';
      }
    }

    // Populate the immediate next dropdown based on all current selections
    if (index < filterOrder.length - 1) {
      const filteredSet = getFilteredSchemes(index);
      // If the current filter selection results in no valid options for the next dropdown,
      // then we should reset the next dropdown to its default state and not proceed further down the cascade.
      if (filteredSet.length === 0) {
        const nextSelect = document.getElementById(filterOrder[index + 1].id);
        if (nextSelect) {
          nextSelect.innerHTML =
            `<option value="" disabled selected>No options available</option>`;
        }
        hideResults();
      } else {
        populateFilterDropdown(index + 1, filteredSet);
      }
    }
  }

  function getFilteredSchemes(upToIndex) {
    let filtered = allSchemes;
    for (let i = 0; i <= upToIndex; i++) {
      const val = document.getElementById(filterOrder[i].id).value;
      if (val) {
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
    }
    return filtered;
  }

  // Function to check if all filters are selected and trigger the search
  function checkAndTriggerAdvancedSearch() {
    let allFiltersSelected = true;
    const params = new URLSearchParams();

    for (const filter of filterOrder) {
      const selectElement = document.getElementById(filter.id);
      // If any select element is missing or has no value (the disabled selected option)
      if (!selectElement || !selectElement.value) {
        allFiltersSelected = false;
        break;
      }

      // Append parameters
      if (filter.field === 'dist_mode') {
        const [dist, mode] = selectElement.value.split(' ');
        params.append('distribution_option', dist);
        params.append('purchase_mode', mode + ' Plan');
      } else {
        params.append(filter.field, selectElement.value);
      }
    }

    // If all filters have valid selections, trigger the fetch
    if (allFiltersSelected) {
      // Hide result card initially until new data is fetched
      hideResults();

      fetchJSON(`/api/search?${params}`)
        .then((data) => {
          schemeNameEl.textContent = data.scheme_name;
          navValueEl.textContent = `₹ ${data.net_asset_value}`;
          navDateEl.textContent = formatDate(data.date);
          schemeCodeEl.textContent = data.scheme_code;
          resultCard.style.display = 'block';

          // Fetch Trends
          loadNAVHistory(data.scheme_code);
        })
        .catch((error) => {
          alert(error.message);
          hideResults(); // Hide if no results or error
        });
    } else {
      // If not all filters are selected, ensure the result card is hidden
      hideResults();
    }
  }

  // Modify handleFilterChange to call checkAndTriggerAdvancedSearch
  const originalHandleFilterChange = handleFilterChange; // Store original reference if needed
  // deno-lint-ignore no-func-assign
  handleFilterChange = (index) => {
    originalHandleFilterChange(index); // Execute original logic (resetting children, populating next)
    checkAndTriggerAdvancedSearch(); // Then check and trigger search
  };

  // 4. (Removed) Handle Advanced Search button click - now automatic
  // Only include non-empty filter values

  // 5. Handle Reset Filters
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      initCascadingFilters();
      hideResults();
    });
  }
});
