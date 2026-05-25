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
})();
