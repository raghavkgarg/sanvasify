// NAV Trends Page
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
        const response = await fetch('/api/schemes');
        if (!response.ok) throw new Error('Failed to load schemes');
        
        schemes = await response.json();
        
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
        const response = await fetch(`/api/nav/history?code=${schemeCode}`);
        if (!response.ok) throw new Error('Failed to load NAV history');
        
        const data = await response.json();
        plotChart(data);
        updateStats(data);
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

// Plot chart with NAV data
function plotChart(data) {
    if (!data || data.length === 0) {
        chart.setOption({
            title: {
                text: 'No data available',
                left: 'center',
                top: 'center'
            }
        });
        return;
    }
    
    // Sort by date
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const dates = data.map(d => d.date);
    const navValues = data.map(d => parseFloat(d.net_asset_value) || 0);
    
    const option = {
        title: {
            text: data[0].scheme_name,
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                const date = params[0].axisValue;
                const nav = params[0].data;
                return `${date}<br/>NAV: ₹${nav.toFixed(4)}`;
            }
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: {
                rotate: 45,
                formatter: function(value) {
                    return new Date(value).toLocaleDateString('en-IN', { 
                        month: 'short', 
                        day: 'numeric' 
                    });
                }
            }
        },
        yAxis: {
            type: 'value',
            name: 'NAV (₹)',
            scale: true,
            axisLabel: {
                formatter: '₹{value}'
            }
        },
        series: [{
            name: 'NAV',
            type: 'line',
            data: navValues,
            smooth: true,
            lineStyle: {
                width: 2,
                color: '#4CAF50'
            },
            itemStyle: {
                color: '#4CAF50'
            },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                        offset: 0,
                        color: 'rgba(76, 175, 80, 0.3)'
                    }, {
                        offset: 1,
                        color: 'rgba(76, 175, 80, 0.05)'
                    }]
                }
            }
        }],
        grid: {
            left: '10%',
            right: '5%',
            bottom: '15%',
            top: '15%'
        },
        dataZoom: [{
            type: 'inside',
            start: 0,
            end: 100
        }, {
            start: 0,
            end: 100
        }]
    };
    
    chart.setOption(option, true);
}

// Update statistics
function updateStats(data) {
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
    
    const changeElement = document.getElementById('nav-change');
    const changeText = `₹${Math.abs(change).toFixed(4)} (${changePercent}%)`;
    changeElement.textContent = change >= 0 ? `+${changeText}` : `-${changeText}`;
    changeElement.style.color = change >= 0 ? '#4CAF50' : '#f56c6c';
    
    statsCard.style.display = 'block';
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
loadSchemes();
