'use strict';

function loginWith(provider) {
  window.location.href = `/api/auth/login?provider=${provider}`;
}

// Redirect if already logged in
fetch('/api/auth/me')
  .then((res) => {
    if (res.ok) window.location.href = '/';
  })
  .catch(() => {});

// Expose for onclick handlers
window.login = loginWith;
