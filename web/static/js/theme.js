// Theme toggle — persists to localStorage
(function () {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const STORAGE_KEY = 'sanvasify-theme';
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === 'light') {
    document.body.classList.add('theme-light');
    btn.textContent = '☀️';
  }

  btn.addEventListener('click', function () {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
    btn.textContent = isLight ? '☀️' : '🌙';
  });

  // Hamburger menu
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    // Close on link click
    links.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => links.classList.remove('open'))
    );
  }
})();
