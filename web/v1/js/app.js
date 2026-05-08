document.addEventListener('DOMContentLoaded', () => {
    const schemeSelect = document.getElementById('scheme-select');
    const resultCard = document.getElementById('result-card');
    const schemeNameEl = document.getElementById('scheme-name');
    const navValueEl = document.getElementById('nav-value');
    const navDateEl = document.getElementById('nav-date');
    const schemeCodeEl = document.getElementById('scheme-code');

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
                textStyle: { color: '#6688a3', fontSize: 16 }
            }
        });
    }

    // Load NAV history for a scheme
    async function loadNAVHistory(schemeCode) {
        try {
            const response = await fetch(`/api/nav/history?code=${schemeCode}`);
            if (!response.ok) throw new Error('Failed to load NAV history');
            const data = await response.json();
            plotChart(data);
            updateStats(data);
        } catch (error) {
            console.error('Error loading NAV history:', error);
            if (chart) {
                chart.setOption({
                    title: {
                        text: 'Trends currently unavailable',
                        left: 'center',
                        top: 'center',
                        textStyle: { color: '#f56c6c', fontSize: 16 }
                    }
                });
            }
        }
    }

    function plotChart(data) {
        if (!chart || !data || data.length === 0) return;
        data.sort((a, b) => new Date(a.date) - new Date(b.date));
        const dates = data.map(d => d.date);
        const navValues = data.map(d => parseFloat(d.net_asset_value) || 0);

        const option = {
            tooltip: {
                trigger: 'axis',
                backgroundColor: '#0F2E3F',
                borderColor: '#E2B13E',
                textStyle: { color: '#fff' },
                formatter: (params) => {
                    const date = params[0].axisValue ? params[0].axisValue.split('T')[0] : '';
                    const nav = params[0].data;
                    return `${date}<br/>NAV: <strong style="color:#E2B13E">₹${nav.toFixed(4)}</strong>`;
                }
            },
            xAxis: {
                type: 'category',
                data: dates,
                axisLabel: {
                    color: '#cbd5e6',
                    rotate: 45,
                    formatter: (value) => new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                }
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLabel: { color: '#cbd5e6', formatter: '₹{value}' },
                splitLine: { lineStyle: { color: 'rgba(203, 213, 230, 0.1)' } }
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
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: 'rgba(226, 177, 62, 0.3)' }, { offset: 1, color: 'rgba(226, 177, 62, 0.05)' }]
                    }
                }
            }],
            grid: { left: '3%', right: '4%', bottom: '10%', top: '5%', containLabel: true },
            dataZoom: [{ type: 'inside' }, { type: 'slider', handleStyle: { color: '#E2B13E' } }]
        };
        chart.setOption(option, true);
    }

    function updateStats(data) {
        if (!statsCard) return;
        if (!data || data.length === 0) {
            statsCard.style.display = 'none';
            return;
        }
        const navValues = data.map(d => parseFloat(d.net_asset_value) || 0);
        const current = navValues[navValues.length - 1];
        const first = navValues[0];
        const highest = Math.max(...navValues);
        const lowest = Math.min(...navValues);
        const change = current - first;
        const changePercent = ((change / first) * 100).toFixed(2);

        document.getElementById('current-nav').textContent = `₹${current.toFixed(4)}`;
        document.getElementById('highest-nav').textContent = `₹${highest.toFixed(4)}`;
        document.getElementById('lowest-nav').textContent = `₹${lowest.toFixed(4)}`;

        const changeEl = document.getElementById('nav-change');
        const changeText = `₹${Math.abs(change).toFixed(4)} (${changePercent}%)`;
        changeEl.textContent = change >= 0 ? `+${changeText}` : `-${changeText}`;
        changeEl.style.color = change >= 0 ? '#4CAF50' : '#f56c6c';
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
        { id: 'filter-dist-mode', field: 'dist_mode', label: 'Distribution Mode' }
    ];

    // 1. Fetch the list of schemes to populate the dropdown
    fetch('/api/schemes')
        .then(response => response.json())
        .then(schemes => {
            // Store for advanced search filtering
            // Filter to include both Open Ended and Interval schemes as requested
            allSchemes = schemes.filter(s => {
                const type = (s.fund_type || "").toUpperCase();
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

            schemeSelect.innerHTML = '<option value="" disabled selected>Select a scheme</option>';
            
            schemes.forEach(scheme => {
                const option = document.createElement('option');
                option.value = scheme.scheme_code;
                option.textContent = scheme.scheme_name;
                schemeSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error fetching schemes:', error);
            schemeSelect.innerHTML = '<option value="" disabled selected>Error loading schemes</option>';
        });

    // 2. Listen for selection changes to fetch NAV details
    schemeSelect.addEventListener('change', (e) => {
        const code = e.target.value;
        if (!code) return;

        fetch(`/api/nav?code=${code}`)
            .then(response => {
                if (!response.ok) throw new Error('Scheme not found');
                return response.json();
            })
            .then(data => {
                // Update UI with data
                schemeNameEl.textContent = data.scheme_name;
                navValueEl.textContent = `₹ ${data.net_asset_value}`;
                navDateEl.textContent = data.date ? data.date.split('T')[0] : '';
                schemeCodeEl.textContent = data.scheme_code;
                
                // Show the card
                resultCard.style.display = 'block';

                // Fetch Trends
                loadNAVHistory(code);
            })
            .catch(error => {
                console.error('Error fetching NAV:', error);
                alert('Failed to fetch details for the selected scheme.');
            });
    });

    // 3. Cascading Filters Logic
    function initCascadingFilters() {
        // Reset all dropdowns to initial state
        filterOrder.forEach(filter => {
            const el = document.getElementById(filter.id);
            if (el) {
                el.innerHTML = `<option value="" disabled selected>Select ${filter.label}</option>`;
                el.value = "";
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
            uniqueValues = [...new Set(data.map(s => {
                const dist = s.distribution_option || "";
                const mode = (s.purchase_mode || "").replace(" Plan", "");
                return dist && mode ? `${dist} ${mode}` : "";
            }))].filter(v => v).sort();
        } else {
            uniqueValues = [...new Set(data.map(s => s[filter.field]))]
                .filter(v => v)
                .sort();
        }
        
        select.innerHTML = `<option value="" disabled selected>Select ${filter.label}</option>`;
        uniqueValues.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            select.appendChild(opt);
        });
    }

    function handleFilterChange(index) {
        // Reset all child dropdowns further down the hierarchy
        for (let i = index + 1; i < filterOrder.length; i++) {
            const select = document.getElementById(filterOrder[i].id);
            if (select) {
                select.innerHTML = `<option value="" disabled selected>Select ${filterOrder[i].label}</option>`; // Ensure label is dynamic
                select.value = "";
            }
        }

        // Populate the immediate next dropdown based on all current selections
        if (index < filterOrder.length - 1) {
            const filteredSet = getFilteredSchemes(index);
            // If the current filter selection results in no valid options for the next dropdown,
            // then we should reset the next dropdown to its default state and not proceed further down the cascade.
            if (filteredSet.length === 0) {
                const nextSelect = document.getElementById(filterOrder[index + 1].id);
                if (nextSelect) nextSelect.innerHTML = `<option value="" disabled selected>No options available</option>`;
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
                    filtered = filtered.filter(s => 
                        s.distribution_option === dist && 
                        (s.purchase_mode || "").includes(mode)
                    );
                } else {
                    filtered = filtered.filter(s => s[filterOrder[i].field] === val);
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
                params.append('purchase_mode', mode + " Plan");
            } else {
                params.append(filter.field, selectElement.value);
            }
        }

        // If all filters have valid selections, trigger the fetch
        if (allFiltersSelected) {
            // Hide result card initially until new data is fetched
            hideResults();

            fetch(`/api/search?${params}`)
                .then(response => {
                    if (!response.ok) throw new Error('No scheme found matching these criteria');
                    return response.json();
                })
                .then(data => {
                    schemeNameEl.textContent = data.scheme_name;
                    navValueEl.textContent = `₹ ${data.net_asset_value}`;
                    navDateEl.textContent = data.date ? data.date.split('T')[0] : '';
                    schemeCodeEl.textContent = data.scheme_code;
                    resultCard.style.display = 'block';

                    // Fetch Trends
                    loadNAVHistory(data.scheme_code);
                })
                .catch(error => {
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
