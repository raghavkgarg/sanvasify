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
});
