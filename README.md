# Sanvasify

A web application for browsing, searching, and analyzing mutual fund schemes in India. Features automated data fetching from AMFI (Association of Mutual Funds in India) with historical NAV trend visualization.

## Features

- **Browse & Search**: Advanced filtering across fund types, strategies, and companies
- **NAV Trends**: Interactive charts with historical performance statistics
- **Automated Data Fetching**: Scheduled AMFI data retrieval with configurable intervals
- **OAuth Authentication**: Optional Google/GitHub login (disabled by default)
- **Efficient Storage**: DuckDB database with Parquet columnar format

## Quick Start

```bash
# Clone and build
git clone https://github.com/raghavkgarg/sanvasify.git
cd sanvasify

# Create local config (one-time setup)
cp config/Config.toml config/Config.local.toml
# Edit config/Config.local.toml — set db_path to a local path, e.g.:
#   db_path = "data/sanvasify.db"

# Load data (if you have a parquet file)
make run-load ARGS="-file data/nav_reports/your_file.parquet"

# Start server (builds, stages assets to dist/, runs from dist/)
make start
```

Access at `http://localhost:8080`

### Makefile Targets

```
make start       # Build, stage, start server (background)
make stop        # Stop server + kill stray processes
make restart     # Stop then start
make run         # Build, stage, run foreground (Ctrl-C to stop)
make status      # Check if server is running
make logs        # Tail server logs
make kill        # Kill stray processes on port 8080
make cleanup     # Format + vet + staticcheck + vulncheck
make help        # Show all targets
```

> **Note:** `config/Config.local.toml` is gitignored. Each developer creates their own with machine-specific paths (db_path, etc.). If it doesn't exist, `make start` falls back to `config/Config.toml`.

## Project Structure

```
sanvasify/
├── cmd/
│   ├── server/       # Web server
│   ├── fetch/        # Data fetcher
│   ├── load/         # Data loader
│   └── gensecret/    # JWT secret generator
├── pkg/
│   ├── api/          # HTTP handlers & routing
│   ├── auth/         # OAuth2 + JWT authentication
│   ├── conf/         # Configuration
│   ├── db/           # DuckDB integration
│   ├── fetcher/      # AMFI data fetching
│   ├── store/        # Data storage & models
│   └── nav/          # NAV data parsing
├── web/static/       # Frontend (HTML/CSS/JS)
├── config/           # Configuration files
├── data/             # Parquet data files
└── docs/             # Documentation
```

## Configuration

Edit `config/Config.toml`:

```toml
use_db = true
db_path = "/tmp/sanvasify.db"
log_file = "/tmp/sanvasify.log"

[server]
port = 8080

[fetcher]
enabled = false
data_dir = "data/nav_reports"
from_date = "2026-01-16"
to_date = "2026-01-21"

[auth]
enabled = false  # Set true for production
```

**Environment Variables** (recommended for production):
```bash
export JWT_SECRET="your-jwt-secret"
export GOOGLE_CLIENT_SECRET="your-google-secret"
export GITHUB_CLIENT_SECRET="your-github-secret"
```

See `docs/CONFIGURATION.md` for all options.

## Authentication (Optional)

Authentication is **disabled by default** for development.

### Enable for Production

1. **Generate JWT secret:**
   ```bash
   go build -o dist/gensecret ./cmd/gensecret
   ./dist/gensecret
   ```

2. **Set up OAuth providers** (see `docs/AUTHENTICATION.md`):
   - Create Google OAuth client ID
   - Create GitHub OAuth app

3. **Configure:**
   ```toml
   [auth]
   enabled = true
   jwt_secret = "your-generated-secret"
   ```

4. **Access:** `http://localhost:8080/login.html`

## Data Fetching

Fetch historical NAV data from AMFI:

```bash
# Configure date range in config/Config.toml
go build -o dist/fetch ./cmd/fetch
./dist/fetch
```

The fetcher:
- Downloads NAV reports for each date
- Skips weekends/holidays automatically
- Converts to Parquet format
- Waits 60s between requests

See `docs/DATA_MANAGEMENT.md` for details.

## API Endpoints

```
GET  /api/schemes                    # All schemes (latest NAV)
GET  /api/nav?code=<code>            # Scheme details
GET  /api/nav/history?code=<code>   # Historical NAV data
GET  /api/filters                    # Filter options
GET  /api/search?fund_type=<type>   # Search schemes

# Authentication (when enabled)
GET  /api/auth/login?provider=google|github
GET  /api/auth/callback/{provider}
GET  /api/auth/me
GET  /api/auth/logout
```

## Deployment

### Build for Production

```bash
# Linux ARM64
GOOS=linux GOARCH=arm64 go build -o sanvasify ./cmd/server

# Linux AMD64
GOOS=linux GOARCH=amd64 go build -o sanvasify ./cmd/server
```

### Deploy

1. Copy binary, `config/`, and `web/` directories
2. Set environment variables for secrets
3. Enable auth in config
4. Run with process manager (systemd, supervisor, etc.)

See `docs/DEPLOYMENT.md` for detailed instructions.

## Documentation

- **[Configuration Guide](docs/CONFIGURATION.md)** - All config options
- **[Authentication Setup](docs/AUTHENTICATION.md)** - OAuth2 setup guide
- **[Data Management](docs/DATA_MANAGEMENT.md)** - Database & data fetching
- **[API Reference](docs/API.md)** - Complete API documentation
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment
- **[Architecture](docs/ARCHITECTURE.md)** - System design & decisions

## Development

### Requirements
- Go 1.25+
- DuckDB (embedded, no separate install needed)

### Key Dependencies
- `golang.org/x/oauth2@v0.34.0` - OAuth2 client
- `github.com/golang-jwt/jwt/v5@v5.3.0` - JWT tokens
- `github.com/marcboeker/go-duckdb` - DuckDB driver

### Code Quality
- Structured logging with `slog`
- Graceful shutdown (30s grace period)
- Context propagation for cancellation
- SQL injection protection
- HTTP timeouts

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
