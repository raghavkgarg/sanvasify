# Sanvasify — Session Summary

## OBJECTIVE
Build "Sanvasify" — a web platform for browsing, searching, and analyzing Indian mutual fund SIF (Specialized Investment Fund) schemes. Go + DuckDB + vanilla JS frontend, deployed on AWS EC2 ARM64.

## PRODUCTION STATE
- **URL:** https://sanvasify.com
- **Infra:** EC2 t4g.micro (ARM64), Ubuntu, Caddy (auto-SSL), systemd
- **Cost:** ~$5/month (mostly IPv4 address)
- **DB:** DuckDB with AMFI NAV data (Parquet-backed)

## SESSION LOG

| # | Date | Work | Key Outputs |
|---|------|------|-------------|
| 1 | Jan 18 | Project init | Go module, config (TOML), NAV parser, pkg/api (handlers, routes, server, store), README |
| 2 | Jan 20 | Architecture | D2 diagrams, .gitignore cleanup, restructure branch |
| 3 | Jan 20–23 | Fetcher + DB | Fetcher API, DuckDB integration, date-typed schema, NAV trends page, Chart.js |
| 4 | Jan 25–27 | Auth + polish | OAuth2 (Google/GitHub), JWT, gensecret cmd, docs restructure, search fix, trend graph fix |
| 5 | Apr 2–3 | Data pipeline | Loader cmd, auto date range, incremental fetch, DB update scripts, Makefile |
| 6 | Apr 3–5 | Ops hardening | Fetcher exit signals, untrack files, sorting fix, HTML updates |
| 7 | Apr 8–12 | Mobile strategy + deploy | Mobile strategy doc, NAV page redesign, deploy scripts, cloud docs |
| 8 | May 6–9 | IPv4 + scripts | IPv4 sequencing, sync scripts (bin/web/db), cost docs, v1 web folder |
| 9 | May 19–24 | Frontend v1 | New web design with themes, compare page, sync script timeout fixes |
| 10 | May 24 | Docs & tooling | .kiro skills/steering/agent, docs restructure (removed 10 redundant files), SESSION_SUMMARY + PHASES + ARCHITECTURE, Makefile rewrite (cleanup/test/lint-js targets), Go 1.26.3, staticcheck fixes, deno lint/fmt/check, govulncheck clean |
| 11 | May 24 | Frontend refactor + Compare page | Extracted common.js (shared chart/schemes/stats), rewrote trends.js (105→18 lines), fixed app.js monkey-patch, moved inline styles to CSS. Built compare page: API endpoint (server-side 1M/3M/annualised returns via DuckDB CTEs), compare.html + compare.js (strategy tabs, search, sort, best/worst highlight, ECharts compare panel) |
| 12 | May 25 | Design system + ES modules | CSS design tokens (dark/light themes), refactored style.css to use variables, theme toggle (localStorage), removed all inline styles. Converted all JS to ES modules (import/export). Ported compare page to web/static. Makefile: start/stop/restart/status/logs/kill/stage targets. Config.local.toml for dev. web/static now self-contained (web/v1 can be deleted). |

## TECHNICAL CONTEXT

### Binaries
- `cmd/server` — Web server (port 8080, serves API + static files)
- `cmd/fetch` — AMFI NAV data fetcher (incremental, date-range)
- `cmd/load` — Parquet/text → DuckDB loader
- `cmd/gensecret` — JWT secret generator

### Packages
- `pkg/api` — HTTP handlers, routes, server, middleware
- `pkg/auth` — OAuth2 (Google/GitHub), JWT, user store
- `pkg/conf` — TOML config loader
- `pkg/db` — DuckDB integration (schema, queries, parquet load)
- `pkg/fetcher` — AMFI HTTP client, date range calc, Parquet converter
- `pkg/nav` — NAV report text parser
- `pkg/store` — Store interface + in-memory implementation

### API Endpoints
```
GET /api/schemes              — All schemes (latest NAV)
GET /api/schemes/compare      — Computed returns (1M, 3M, annualised), optional ?strategy=
GET /api/nav?code=X           — Scheme detail
GET /api/nav/history?code=X   — Historical NAV data
GET /api/filters              — Filter options (fund type, strategy, company)
GET /api/search?...           — Search with filters
```

### Frontend (web/static/ — current)
- `index.html` — SIF guide + scheme browser navigation
- `nav.html` — Scheme detail + NAV chart (cascading filters)
- `nav_trends.html` — ECharts NAV trend visualization
- `compare.html` — Side-by-side scheme comparison (strategy tabs, sort, chart)
- `login.html` — OAuth login
- CSS: `design-tokens.css` (variables, dark/light themes), `style.css` (components), `login.css`
- JS (ES modules): `common.js` (shared API/chart/stats), `app.js`, `trends.js`, `compare.js`, `navigation.js`, `theme.js`, `login.js`
- `web/v1/` — Legacy, can be deleted

### Deploy Scripts
- `scripts/sync_bin.sh` — Deploy binary to EC2
- `scripts/sync_web.sh` — Deploy web assets to EC2
- `scripts/sync_db.sh` — Sync database to/from EC2
- `scripts/status_AWS.sh` — Check EC2/service health
- `scripts/run_local.sh` — Run server locally
