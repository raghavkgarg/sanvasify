# Configuration Guide

## Configuration File

Sanvasify uses `config/Config.toml` for configuration. All settings can be overridden with environment variables.

## Complete Configuration

```toml
# Legacy mode (deprecated)
input_file = "config/nav_report_2026-01-18.txt"

# Database settings
use_db = true
db_path = "/tmp/sanvasify.db"
log_file = "/tmp/sanvasify.log"

[server]
port = 8080

[fetcher]
enabled = false
data_dir = "data/nav_reports"
raw_dir = "/tmp/sanvasify_raw"
base_url = "https://portal.amfiindia.com/SIF_DownloadNAVHistoryReport.aspx"
from_date = "2026-01-16"
to_date = "2026-01-21"

[auth]
enabled = false
jwt_secret = ""
jwt_expiry_hours = 24

[auth.google]
client_id = ""
client_secret = ""
redirect_url = "http://localhost:8080/api/auth/callback/google"

[auth.github]
client_id = ""
client_secret = ""
redirect_url = "http://localhost:8080/api/auth/callback/github"
```

## Configuration Options

### Core Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `use_db` | bool | true | Use DuckDB database (recommended) |
| `db_path` | string | "/tmp/sanvasify.db" | Database file path |
| `log_file` | string | "/tmp/sanvasify.log" | Log file path (timestamped) |
| `input_file` | string | "" | Legacy text file mode (deprecated) |

### Server Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server.port` | int | 8080 | HTTP server port |

### Fetcher Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fetcher.enabled` | bool | false | Enable automatic data fetching |
| `fetcher.data_dir` | string | "data/nav_reports" | Parquet file directory |
| `fetcher.raw_dir` | string | "/tmp/sanvasify_raw" | Raw download directory |
| `fetcher.base_url` | string | AMFI URL | AMFI NAV report endpoint |
| `fetcher.from_date` | string | "" | Start date (YYYY-MM-DD) |
| `fetcher.to_date` | string | "" | End date (YYYY-MM-DD) |

### Authentication Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auth.enabled` | bool | false | Enable OAuth authentication |
| `auth.jwt_secret` | string | "" | JWT signing secret (required if enabled) |
| `auth.jwt_expiry_hours` | int | 24 | JWT token expiry in hours |

### OAuth Provider Settings

**Google:**
| Option | Type | Description |
|--------|------|-------------|
| `auth.google.client_id` | string | Google OAuth client ID |
| `auth.google.client_secret` | string | Google OAuth client secret |
| `auth.google.redirect_url` | string | OAuth callback URL |

**GitHub:**
| Option | Type | Description |
|--------|------|-------------|
| `auth.github.client_id` | string | GitHub OAuth client ID |
| `auth.github.client_secret` | string | GitHub OAuth client secret |
| `auth.github.redirect_url` | string | OAuth callback URL |

## Environment Variables

Environment variables override config file values:

```bash
# Authentication secrets (recommended for production)
export JWT_SECRET="your-jwt-secret"
export GOOGLE_CLIENT_SECRET="your-google-secret"
export GITHUB_CLIENT_SECRET="your-github-secret"
```

## Configuration Examples

### Development (No Auth)

```toml
use_db = true
db_path = "/tmp/sanvasify.db"
log_file = "/tmp/sanvasify.log"

[server]
port = 8080

[auth]
enabled = false
```

### Production (With Auth)

```toml
use_db = true
db_path = "/var/lib/sanvasify/sanvasify.db"
log_file = "/var/log/sanvasify/sanvasify.log"

[server]
port = 8080

[auth]
enabled = true
jwt_secret = ""  # Set via JWT_SECRET env var
jwt_expiry_hours = 24

[auth.google]
client_id = "123456789.apps.googleusercontent.com"
client_secret = ""  # Set via GOOGLE_CLIENT_SECRET env var
redirect_url = "https://yourdomain.com/api/auth/callback/google"

[auth.github]
client_id = "your-github-client-id"
client_secret = ""  # Set via GITHUB_CLIENT_SECRET env var
redirect_url = "https://yourdomain.com/api/auth/callback/github"
```

### Data Fetching

```toml
use_db = true
db_path = "/tmp/sanvasify.db"

[fetcher]
enabled = true
data_dir = "data/nav_reports"
from_date = "2025-01-01"
to_date = "2025-12-31"

[server]
port = 8080
```

## Validation

The application validates configuration on startup:

- Port must be 1-65535
- `db_path` required when `use_db = true`
- `input_file` required when `use_db = false`
- `jwt_secret` required when `auth.enabled = true`

Validation errors will prevent startup with clear error messages.

## Best Practices

1. **Secrets**: Use environment variables for all secrets in production
2. **Paths**: Use absolute paths for production deployments
3. **Logging**: Configure log rotation for `log_file` path
4. **Database**: Place `db_path` on persistent storage
5. **Auth**: Keep `client_secret` empty in version control
6. **Fetcher**: Disable `fetcher.enabled` in production (run separately)
