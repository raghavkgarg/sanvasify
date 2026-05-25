# Sanvasify — Architecture

## Overview
Go web application for browsing and analyzing Indian mutual fund SIF schemes. Single binary, DuckDB embedded database, vanilla JS frontend.

## Stack
- **Language:** Go 1.25
- **Database:** DuckDB v2 (embedded, Parquet-native)
- **Frontend:** Vanilla JS, Chart.js, HTML/CSS
- **Infra:** AWS EC2 ARM64, Caddy (reverse proxy + auto-SSL), systemd

## Request Flow
```
Internet → Caddy (:443) → Go Server (:8080) → DuckDB
                                    ↓
                              Static Files (web/v1/)
```

## Package Layout
```
cmd/
├── server/     main.go — HTTP server, graceful shutdown
├── fetch/      main.go — AMFI data fetcher (incremental)
├── load/       main.go — Parquet/text → DuckDB loader
└── gensecret/  main.go — JWT secret generator

pkg/
├── api/        HTTP handlers, routes, server, middleware
├── auth/       OAuth2 (Google/GitHub), JWT, user store
├── conf/       TOML config loader (auto-loads on import)
├── db/         DuckDB connection, schema, queries, parquet load
├── fetcher/    AMFI HTTP client, date range, Parquet converter
├── nav/        NAV report text parser
└── store/      Store interface + in-memory implementation
```

## Data Model
Single table `sif_schemes`:
```sql
scheme_code     VARCHAR NOT NULL
scheme_name     VARCHAR NOT NULL
net_asset_value DOUBLE
repurchase_price DOUBLE
sale_price      DOUBLE
date            DATE NOT NULL
strategy_name   VARCHAR
fund_house_name VARCHAR
fund_type       VARCHAR
fund_company    VARCHAR
fund_strategy   VARCHAR
distribution_option VARCHAR
purchase_mode   VARCHAR
```
Primary key: `(scheme_code, date)`

## Data Pipeline
```
AMFI Portal → HTTP fetch → Raw text → Parse → Parquet → DuckDB
```
- Fetcher calculates incremental date range from DB
- Skips weekends/holidays
- 60s delay between requests (rate limit)
- Converter: text → Arrow → Parquet

## Authentication (Optional)
- Disabled by default for development
- OAuth2 flow: login → provider → callback → JWT cookie
- JWT stored in HTTP-only cookie, validated by middleware
- User records in DuckDB `users` table

## Key Design Decisions
1. **DuckDB over SQLite** — columnar storage, native Parquet, analytical queries
2. **Store interface** — allows in-memory mode for development without DB
3. **No framework** — stdlib `net/http` + `ServeMux`, minimal dependencies
4. **Vanilla JS frontend** — no build step, served directly
5. **Cross-compile on macOS** — CGO required for DuckDB, uses messense toolchain
6. **Caddy over Nginx** — automatic HTTPS, simpler config
