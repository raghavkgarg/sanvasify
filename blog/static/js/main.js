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

  // --- Search Logic ---
  const searchToggle = document.getElementById('search-toggle');
  const searchModal = document.getElementById('search-modal');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const searchClose = document.getElementById('search-close');

  if (searchToggle && searchModal && searchInput && searchResults && searchClose) {
    let searchIndex = null;
    let selectedIndex = -1;

    async function loadSearchIndex() {
      if (searchIndex) return;
      try {
        const res = await fetch('/index.json');
        searchIndex = await res.json();
      } catch (err) {
        console.error('Failed to load search index:', err);
      }
    }

    function openSearch() {
      searchModal.showModal();
      document.body.style.overflow = 'hidden';
      loadSearchIndex();
      searchInput.focus();
    }

    function closeSearch() {
      searchModal.close();
      document.body.style.overflow = '';
      searchInput.value = '';
      searchResults.innerHTML = '<div class="search-empty-state">Type to start searching...</div>';
      selectedIndex = -1;
    }

    searchToggle.addEventListener('click', openSearch);
    searchClose.addEventListener('click', closeSearch);

    // Close when clicking outside of the search modal box
    searchModal.addEventListener('click', (e) => {
      const rect = searchModal.getBoundingClientRect();
      const isInDialog = (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
      if (!isInDialog) {
        closeSearch();
      }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // open: Cmd+K, Ctrl+K, or '/' (when not typing in an input)
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !isInput)) {
        e.preventDefault();
        openSearch();
      }
    });

    // Keyboard navigation within the modal
    searchInput.addEventListener('keydown', (e) => {
      const items = searchResults.querySelectorAll('.search-result-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        updateSelection(items);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          items[selectedIndex].click();
        }
      }
    });

    function updateSelection(items) {
      items.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add('selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('selected');
        }
      });
    }

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      selectedIndex = -1;

      if (!query) {
        searchResults.innerHTML = '<div class="search-empty-state">Type to start searching...</div>';
        return;
      }

      if (!searchIndex) {
        searchResults.innerHTML = '<div class="search-empty-state">Loading index...</div>';
        return;
      }

      const results = searchIndex.filter(post => {
        const titleMatch = post.title.toLowerCase().includes(query);
        const descMatch = post.description.toLowerCase().includes(query);
        const tagsMatch = post.tags && post.tags.some(tag => tag.toLowerCase().includes(query));
        return titleMatch || descMatch || tagsMatch;
      });

      if (!results.length) {
        searchResults.innerHTML = `<div class="search-empty-state">No results found for "${escapeHTML(query)}"</div>`;
        return;
      }

      searchResults.innerHTML = results.map((post, idx) => `
        <a href="${post.permalink}" class="search-result-item">
          <div class="search-result-meta">
            <span class="search-result-date">${post.date}</span>
          </div>
          <h5 class="search-result-title">${highlightMatch(post.title, query)}</h5>
          <p class="search-result-desc">${highlightMatch(post.description, query)}</p>
          ${post.tags ? `
            <div class="search-result-tags">
              ${post.tags.map(tag => `<span class="tag-mini">${highlightMatch(tag, query)}</span>`).join('')}
            </div>
          ` : ''}
        </a>
      `).join('');
    });

    function highlightMatch(text, query) {
      if (!text) return '';
      const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
      return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHTML(str) {
      return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }
  }
});
