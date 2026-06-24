// Theme Toggle Logic matching main app
document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('theme-toggle');
  if (!themeBtn) return;

  const STORAGE_KEY = 'sanvasify-theme';
  const savedTheme = localStorage.getItem(STORAGE_KEY);

  // Set initial theme
  if (savedTheme === 'light') {
    document.body.classList.add('theme-light');
    updateToggleButton(true);
  } else {
    updateToggleButton(false);
  }

  themeBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
    updateToggleButton(isLight);
  });

  function updateToggleButton(isLight) {
    if (!isLight) {
      // Dark mode active (shows Sun icon to switch to light)
      themeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path>
          <path d="M12 20v2"></path>
          <path d="m4.93 4.93 1.41 1.41"></path>
          <path d="m17.66 17.66 1.41 1.41"></path>
          <path d="M2 12h2"></path>
          <path d="M20 12h2"></path>
          <path d="m6.34 17.66-1.41 1.41"></path>
          <path d="m19.07 4.93-1.41 1.41"></path>
        </svg>
      `;
    } else {
      // Light mode active (shows Moon icon to switch to dark)
      themeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>
      `;
    }
  }
});
