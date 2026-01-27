# Authentication Setup

## Overview

Sanvasify supports OAuth2 authentication with Google and GitHub providers. Authentication is **disabled by default** for development and can be enabled for production deployments.

## Quick Setup

1. Generate JWT secret
2. Create OAuth apps (Google/GitHub)
3. Configure credentials
4. Enable authentication

## Step 1: Generate JWT Secret

```bash
go build -o dist/gensecret ./cmd/gensecret
./dist/gensecret
```

Output:
```
Generated JWT Secret:
xK9mP2vL8nQ4rT6wY1zA3bC5dE7fG9hJ0kM

Add to config/Config.toml:
jwt_secret = "xK9mP2vL8nQ4rT6wY1zA3bC5dE7fG9hJ0kM"

Or set as environment variable:
export JWT_SECRET="xK9mP2vL8nQ4rT6wY1zA3bC5dE7fG9hJ0kM"
```

## Step 2: Set Up OAuth Providers

### Google OAuth

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a project** (or select existing)
3. **Enable Google+ API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"
4. **Create OAuth credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: "Sanvasify"
   - Authorized redirect URIs:
     - Development: `http://localhost:8080/api/auth/callback/google`
     - Production: `https://yourdomain.com/api/auth/callback/google`
5. **Copy credentials**:
   - Client ID: `123456789.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxxxxxxxxxxxx`

### GitHub OAuth

1. **Go to GitHub Settings**: https://github.com/settings/developers
2. **Click "New OAuth App"**
3. **Fill in details**:
   - Application name: "Sanvasify"
   - Homepage URL: `http://localhost:8080` (or production URL)
   - Authorization callback URL:
     - Development: `http://localhost:8080/api/auth/callback/github`
     - Production: `https://yourdomain.com/api/auth/callback/github`
4. **Register application**
5. **Copy credentials**:
   - Client ID: `Iv1.xxxxxxxxxxxxx`
   - Generate and copy Client Secret

## Step 3: Configure Credentials

### Option A: Environment Variables (Recommended)

```bash
export JWT_SECRET="your-generated-secret"
export GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxx"
export GITHUB_CLIENT_SECRET="your-github-secret"
```

Update `config/Config.toml`:
```toml
[auth]
enabled = true
jwt_expiry_hours = 24

[auth.google]
client_id = "123456789.apps.googleusercontent.com"
client_secret = ""  # Set via env var
redirect_url = "http://localhost:8080/api/auth/callback/google"

[auth.github]
client_id = "Iv1.xxxxxxxxxxxxx"
client_secret = ""  # Set via env var
redirect_url = "http://localhost:8080/api/auth/callback/github"
```

### Option B: Config File (Development Only)

```toml
[auth]
enabled = true
jwt_secret = "your-generated-secret"
jwt_expiry_hours = 24

[auth.google]
client_id = "123456789.apps.googleusercontent.com"
client_secret = "GOCSPX-xxxxxxxxxxxxx"
redirect_url = "http://localhost:8080/api/auth/callback/google"

[auth.github]
client_id = "Iv1.xxxxxxxxxxxxx"
client_secret = "your-github-secret"
redirect_url = "http://localhost:8080/api/auth/callback/github"
```

**⚠️ Warning**: Never commit secrets to version control!

## Step 4: Test Authentication

1. **Start server**:
   ```bash
   ./dist/sanvasify
   ```

2. **Access login page**: `http://localhost:8080/login.html`

3. **Test login flow**:
   - Click "Login with Google" or "Login with GitHub"
   - Authorize the application
   - Verify redirect to home page
   - Check user menu shows your name

4. **Test logout**:
   - Click "Logout" button
   - Verify redirect to login page

## Authentication Flow

1. User clicks "Login with Google/GitHub"
2. Frontend redirects to `/api/auth/login?provider=google`
3. Server generates state token, redirects to OAuth provider
4. User authorizes on provider's site
5. Provider redirects to `/api/auth/callback/google?code=...&state=...`
6. Server validates state, exchanges code for access token
7. Server fetches user info from provider API
8. Server creates/updates user in database
9. Server generates JWT, sets HttpOnly cookie
10. Server redirects to home page
11. Frontend loads user info from `/api/auth/me`

## Security Features

- **HttpOnly Cookies**: JWT stored in HttpOnly cookie (not accessible to JavaScript)
- **CSRF Protection**: State parameter validates OAuth callback
- **Token Expiry**: Configurable JWT expiration (default 24 hours)
- **Secure Secrets**: Environment variable support for production
- **HTTPS Required**: OAuth providers require HTTPS in production

## API Endpoints

```
GET  /api/auth/login?provider=google|github  # Initiate OAuth flow
GET  /api/auth/callback/google               # Google OAuth callback
GET  /api/auth/callback/github               # GitHub OAuth callback
GET  /api/auth/me                            # Get current user (protected)
GET  /api/auth/logout                        # Logout (clear cookie)
```

## User Database

Users are stored in DuckDB:

```sql
CREATE TABLE users (
    id VARCHAR PRIMARY KEY,           -- provider:email
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR,
    provider VARCHAR NOT NULL,        -- google/github
    created_at TIMESTAMP NOT NULL,
    last_login TIMESTAMP NOT NULL
)
```

## Troubleshooting

### "jwt_secret is required" error
- Ensure `jwt_secret` is set in config or `JWT_SECRET` env var
- Run `gensecret` to generate a new secret

### OAuth redirect mismatch
- Verify redirect URLs match exactly in OAuth app settings
- Check for http vs https mismatch
- Ensure port numbers match

### "Invalid state parameter" error
- CSRF protection triggered
- Clear cookies and try again
- Check server logs for state mismatch details

### User info not loading
- Check browser console for errors
- Verify `/api/auth/me` endpoint returns 200
- Check JWT cookie is set (browser dev tools > Application > Cookies)

### GitHub email is null
- GitHub users can hide their email
- App requests `user:email` scope to access verified emails
- Check GitHub account settings > Emails > "Keep my email addresses private"

## Production Deployment

1. **Update redirect URLs** in OAuth apps to production domain
2. **Use HTTPS** (required by OAuth providers)
3. **Set environment variables**:
   ```bash
   export JWT_SECRET="production-secret"
   export GOOGLE_CLIENT_SECRET="production-google-secret"
   export GITHUB_CLIENT_SECRET="production-github-secret"
   ```
4. **Keep secrets out of git**:
   ```toml
   [auth.google]
   client_secret = ""  # Empty in config file
   ```
5. **Configure log rotation** for audit trail
6. **Monitor failed login attempts**

## Disabling Authentication

Set `enabled = false` in config:

```toml
[auth]
enabled = false
```

The application will:
- Skip auth middleware on protected routes
- Hide login button in navigation
- Allow unrestricted access to all pages

Perfect for development and testing.
