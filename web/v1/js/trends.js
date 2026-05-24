// NAV Trends Page
import { initNavigation } from './navigation.js';
import { fetchJSON, plotNAVChart, getNAVStats, updateStatsUI } from './utils.js';

const schemeSelect = document.getElementById('scheme-select');
const chartContainer = document.getElementById('chart-container');
const statsCard = document.getElementById('stats-card');

let chart = null;
let schemes = [];

// Initialize ECharts
function initChart() {
    chart = echarts.init(chartContainer);
    
    const option = {
        title: {
            text: 'Select a scheme to view trends',
            left: 'center',
            top: 'center',
            textStyle: {
                color: '#999',
                fontSize: 16
            }
        }
    };
    
    chart.setOption(option);
}

// Load schemes
async function loadSchemes() {
    try {
        schemes = await fetchJSON('/api/schemes');
        
        // Sort schemes alphabetically by name
        schemes.sort((a, b) => a.scheme_name.localeCompare(b.scheme_name));

        schemeSelect.innerHTML = '<option value="" disabled selected>Select a scheme</option>';
        schemes.forEach(scheme => {
            const option = document.createElement('option');
            option.value = scheme.scheme_code;
            option.textContent = scheme.scheme_name;
            schemeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading schemes:', error);
        schemeSelect.innerHTML = '<option value="" disabled selected>Error loading schemes</option>';
    }
}

// Load NAV history for a scheme
async function loadNAVHistory(schemeCode) {
    try {
        const data = await fetchJSON(`/api/nav/history?code=${schemeCode}`);
        plotNAVChart(chart, data);
        
        const stats = getNAVStats(data);
        if (stats) {
            updateStatsUI({
                current: document.getElementById('current-nav'),
                highest: document.getElementById('highest-nav'),
                lowest: document.getElementById('lowest-nav'),
                change: document.getElementById('nav-change')
            }, stats);
            statsCard.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading NAV history:', error);
        chart.setOption({
            title: {
                text: 'Error loading data',
                left: 'center',
                top: 'center',
                textStyle: {
                    color: '#f56c6c',
                    fontSize: 16
                }
            }
        });
    }
}

// Event listeners
schemeSelect.addEventListener('change', (e) => {
    const schemeCode = e.target.value;
    if (schemeCode) {
        loadNAVHistory(schemeCode);
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (chart) {
        chart.resize();
    }
});

// Initialize
initChart();
initNavigation('nav_trends.html');
loadSchemes();
