// Theme management
export function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
    updateToggleButton(theme);
}

export function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    applyTheme(isLight ? 'dark' : 'light');
}

function updateToggleButton(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.textContent = theme === 'light' ? '🌙' : '☀️';
        btn.title = `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`;
    }
}

// Shared navigation component
export function createNavigation(currentPage) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    
    // Only add the Home link if we are not already on the index page
    if (currentPage !== 'index.html') {
        const link = document.createElement('a');
        link.href = 'index.html';
        link.textContent = '← Home';
        link.className = 'home-btn';
        container.appendChild(link);
    }
    
    const themeBtn = document.createElement('button');
    themeBtn.id = 'theme-toggle-btn';
    themeBtn.className = 'theme-toggle';
    themeBtn.onclick = toggleTheme;
    
    container.appendChild(themeBtn);
    
    return container;
}

// Insert navigation after brand container
export function initNavigation(currentPage) {
    // Use a dedicated placeholder to avoid header clutter
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (navPlaceholder) {
        const nav = createNavigation(currentPage);
        navPlaceholder.replaceWith(nav);
    }
    initTheme(); // Initialize theme after the toggle button exists in the DOM
}

// Expose functions for inline onclick handlers or fallback scripts if needed
if (typeof window !== 'undefined') {
    window.initNavigation = initNavigation;
}
