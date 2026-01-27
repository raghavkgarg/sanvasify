document.addEventListener('DOMContentLoaded', () => {
    const schemeSelect = document.getElementById('scheme-select');
    const resultCard = document.getElementById('result-card');
    const schemeNameEl = document.getElementById('scheme-name');
    const navValueEl = document.getElementById('nav-value');
    const navDateEl = document.getElementById('nav-date');
    const schemeCodeEl = document.getElementById('scheme-code');

    // 1. Fetch the list of schemes to populate the dropdown
    fetch('/api/schemes')
        .then(response => response.json())
        .then(schemes => {
            // Clear loading message
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
                navDateEl.textContent = data.date;
                schemeCodeEl.textContent = data.scheme_code;
                
                // Show the card
                resultCard.style.display = 'block';
            })
            .catch(error => {
                console.error('Error fetching NAV:', error);
                alert('Failed to fetch details for the selected scheme.');
            });
    });

    // 3. Fetch filter options for Advanced Search
    fetch('/api/filters')
        .then(response => response.json())
        .then(data => {
            populateSelect('filter-type', data.fund_type);
            populateSelect('filter-strategy', data.fund_strategy);
            populateSelect('filter-company', data.fund_company);
            populateSelect('filter-dist', data.distribution_option);
            populateSelect('filter-mode', data.purchase_mode);
        })
        .catch(error => console.error('Error fetching filters:', error));

    function populateSelect(id, options) {
        const select = document.getElementById(id);
        options.sort().forEach(opt => {
            if (opt) {
                const el = document.createElement('option');
                el.value = opt;
                el.textContent = opt;
                select.appendChild(el);
            }
        });
    }

    // 4. Handle Advanced Search
    document.getElementById('btn-advanced-search').addEventListener('click', () => {
        const filterType = document.getElementById('filter-type');
        const filterStrategy = document.getElementById('filter-strategy');
        const filterCompany = document.getElementById('filter-company');
        const filterDist = document.getElementById('filter-dist');
        const filterMode = document.getElementById('filter-mode');

        // Only include non-empty filter values
        const params = new URLSearchParams();
        if (filterType.value) params.append('fund_type', filterType.value);
        if (filterStrategy.value) params.append('fund_strategy', filterStrategy.value);
        if (filterCompany.value) params.append('fund_company', filterCompany.value);
        if (filterDist.value) params.append('distribution_option', filterDist.value);
        if (filterMode.value) params.append('purchase_mode', filterMode.value);

        // Check if at least one filter is selected
        if (params.toString() === '') {
            alert('Please select at least one filter');
            return;
        }

        fetch(`/api/search?${params}`)
            .then(response => {
                if (!response.ok) throw new Error('No scheme found matching these criteria');
                return response.json();
            })
            .then(data => {
                schemeNameEl.textContent = data.scheme_name;
                navValueEl.textContent = `₹ ${data.net_asset_value}`;
                navDateEl.textContent = data.date;
                schemeCodeEl.textContent = data.scheme_code;
                resultCard.style.display = 'block';
            })
            .catch(error => alert(error.message))
            .finally(() => {
                // Reset filters
                filterType.value = "";
                filterStrategy.value = "";
                filterCompany.value = "";
                filterDist.value = "";
                filterMode.value = "";
            });
    });
});
