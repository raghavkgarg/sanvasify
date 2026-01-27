# Sanvasify Documentation

Complete documentation for the Sanvasify mutual fund analysis application.

## Getting Started

- **[README](../README.md)** - Quick start guide and overview
- **[Configuration Guide](CONFIGURATION.md)** - Complete configuration reference
- **[Authentication Setup](AUTHENTICATION.md)** - OAuth2 setup guide

## User Guides

- **[Data Management](DATA_MANAGEMENT.md)** - Database setup and data fetching
- **[API Reference](API.md)** - Complete API documentation

## Operations

- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
- **[Architecture](ARCHITECTURE.md)** - System design and technical decisions

## Development

- **[Architecture](ARCHITECTURE.md)** - Component architecture and data flows
- **[API Reference](API.md)** - Endpoint specifications for integration

## Reference

### etc/ Directory

Additional reference materials:

- **`etc/AUTH_IMPLEMENTATION.md`** - Authentication implementation history
- **`etc/TODO.txt`** - Project roadmap and tasks
- **`etc/architecture.d2`** - Architecture diagram source
- **`etc/architecture.svg`** - Architecture diagram (visual)
- **`etc/fund_struct.txt`** - Fund data structure reference

## Quick Links

### Common Tasks

**First Time Setup:**
1. [Quick Start](../README.md#quick-start)
2. [Configuration](CONFIGURATION.md#configuration-examples)
3. [Data Fetching](DATA_MANAGEMENT.md#fetch-historical-data)

**Enable Authentication:**
1. [Generate JWT Secret](AUTHENTICATION.md#step-1-generate-jwt-secret)
2. [Set Up OAuth Providers](AUTHENTICATION.md#step-2-set-up-oauth-providers)
3. [Configure Credentials](AUTHENTICATION.md#step-3-configure-credentials)

**Production Deployment:**
1. [Build for Production](DEPLOYMENT.md#build-for-production)
2. [Server Setup](DEPLOYMENT.md#server-setup)
3. [Systemd Service](DEPLOYMENT.md#systemd-service)
4. [Nginx Reverse Proxy](DEPLOYMENT.md#nginx-reverse-proxy)

### API Endpoints

- [Scheme Endpoints](API.md#scheme-endpoints)
- [Authentication Endpoints](API.md#authentication-endpoints)
- [Error Responses](API.md#error-responses)

### Configuration

- [Core Settings](CONFIGURATION.md#core-settings)
- [Server Settings](CONFIGURATION.md#server-settings)
- [Fetcher Settings](CONFIGURATION.md#fetcher-settings)
- [Authentication Settings](CONFIGURATION.md#authentication-settings)
- [Environment Variables](CONFIGURATION.md#environment-variables)

## Documentation Structure

```
docs/
├── INDEX.md              # This file
├── CONFIGURATION.md      # Configuration reference
├── AUTHENTICATION.md     # OAuth2 setup guide
├── DATA_MANAGEMENT.md    # Database and data fetching
├── API.md                # API documentation
├── DEPLOYMENT.md         # Production deployment
└── ARCHITECTURE.md       # System architecture

etc/
├── AUTH_IMPLEMENTATION.md  # Auth implementation history
├── TODO.txt                # Project roadmap
├── architecture.d2         # Diagram source
├── architecture.svg        # Diagram visual
└── fund_struct.txt         # Data structure reference
```

## Contributing

When updating documentation:

1. Keep README.md concise with links to detailed docs
2. Update relevant doc files in `docs/` directory
3. Keep examples up-to-date with code changes
4. Add new sections to this index
5. Update architecture diagrams when system changes

## Feedback

Found an issue or have a suggestion? Please open an issue on GitHub.
