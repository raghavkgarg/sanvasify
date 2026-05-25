'use strict';

const pages = [
  { name: 'Home', url: 'index.html' },
  { name: 'Check SIF NAV', url: 'nav.html' },
  { name: 'NAV Trends', url: 'nav_trends.html' },
  { name: 'Compare', url: 'compare.html' },
];

export function initNavigation(currentPage) {
  const placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) return;

  const nav = document.createElement('nav');
  nav.className = 'main-nav';
  for (const page of pages) {
    const a = document.createElement('a');
    a.href = page.url;
    a.textContent = page.name;
    a.className = 'nav-link';
    if (page.url === currentPage) a.classList.add('active');
    nav.appendChild(a);
  }
  placeholder.replaceWith(nav);
}
