// Shared navigation component
function createNavigation(currentPage) {
    const pages = [
        { name: 'Home', url: 'index.html' },
        { name: 'Check SIF NAV', url: 'check_sif_nav.html' },
        { name: 'NAV Trends', url: 'nav_trends.html' }
    ];

    const nav = document.createElement('nav');
    nav.className = 'main-nav';

    const navContainer = document.createElement('div');
    navContainer.className = 'nav-container';

    pages.forEach(page => {
        const link = document.createElement('a');
        link.href = page.url;
        link.textContent = page.name;
        link.className = 'nav-link';
        
        if (page.url === currentPage) {
            link.classList.add('active');
        }
        
        navContainer.appendChild(link);
    });

    nav.appendChild(navContainer);
    return nav;
}

// Insert navigation after brand container
function initNavigation(currentPage) {
    const brandContainer = document.querySelector('.brand-container');
    if (brandContainer) {
        const nav = createNavigation(currentPage);
        brandContainer.insertAdjacentElement('afterend', nav);
    }
}
