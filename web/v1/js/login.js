function loginWith(provider) {
    window.location.href = `/api/auth/login?provider=${provider}`;
}

// Redirect if already logged in
fetch('/api/auth/me')
    .then(res => res.ok && (window.location.href = '/'))
    .catch(() => {});
