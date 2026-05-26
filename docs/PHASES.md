# Sanvasify — Phases & Status

## Completed

### Phase 1: Foundation ✅
- Go module (`github.com/raghavkgarg/sanvasify`), Go 1.25
- TOML config (`config/Config.toml`)
- NAV report parser (`pkg/nav`)
- In-memory store with Store interface
- HTTP server with graceful shutdown (30s)
- Structured logging (`slog`, dual output: file + stdout)
- Makefile (cross-compile ARM64/AMD64)

### Phase 2: Database ✅
- DuckDB integration (`pkg/db`)
- Schema: `sif_schemes` table (code, name, NAV, date, fund metadata)
- Parquet file loading (DuckDB native `read_parquet`)
- Text report loading (parsed → INSERT)
- Dual mode: in-memory or DB-backed (config toggle)

### Phase 3: Data Pipeline ✅
- AMFI HTTP fetcher (`pkg/fetcher`) with configurable date range
- Incremental fetch (checks DB for latest date, fetches forward)
- Weekend/holiday skip logic
- Raw text → Parquet converter (`pkg/fetcher/converter.go`)
- 60s delay between requests (rate limiting)
- Exit code 2 for "nothing to do" (script-friendly)
- `cmd/fetch` and `cmd/load` CLIs

### Phase 4: REST API ✅
- 5 endpoints: schemes, nav, nav/history, filters, search
- JSON responses with no-cache headers
- Filter by: fund_type, fund_strategy, fund_company, distribution_option, purchase_mode
- SQL injection protection (parameterized queries)
- HTTP timeouts (read: 15s, write: 15s, idle: 60s)

### Phase 5: Authentication ✅
- OAuth2 (Google + GitHub) via `golang.org/x/oauth2`
- JWT tokens (`github.com/golang-jwt/jwt/v5`)
- Auth middleware (optional, disabled by default)
- User store in DuckDB
- `cmd/gensecret` for JWT secret generation
- Environment variable support for secrets

### Phase 6: Frontend ✅
- Vanilla JS + HTML/CSS (no frameworks, no bundler)
- Scheme browser with search and multi-filter
- NAV detail page
- NAV trends with Chart.js
- OAuth login page
- Responsive layout
- `web/v1/` is active version, `web/static/` is legacy

### Phase 7: Deployment ✅
- EC2 t4g.micro (ARM64, Ubuntu)
- Caddy reverse proxy (auto-SSL, Let's Encrypt)
- systemd service (`sanvasify` user)
- Cross-compile on macOS via Makefile
- Sync scripts: `sync_bin.sh`, `sync_web.sh`, `sync_db.sh`
- Status script: `status_AWS.sh`
- Domain: sanvasify.com

### Phase 8: Docs & Tooling ✅
- Restructured documentation (removed 10 redundant files, consolidated)
- Created SESSION_SUMMARY.md, PHASES.md, ARCHITECTURE.md
- Go linters: gofmt, go fix, go vet, staticcheck, govulncheck
- JS linters: deno lint, deno fmt, deno check
- Makefile with cleanup/test/lint-js/fmt-js/check-js targets
- .kiro skills, steering, and agent files
- Go 1.25 → 1.26.3 (resolved 9 stdlib vulnerabilities)
- Fixed: deprecated Arrow API, unused code, context key type, error conventions

### Phase 9: Compare Page & Frontend Refactor ✅
- Extracted `common.js` (initChart, autoResize, loadSchemes, loadNAVHistory, stats)
- Rewrote `trends.js` (105→18 lines) and `app.js` (removed monkey-patch, -29%)
- Moved nav.html inline styles to CSS classes
- New API: `GET /api/schemes/compare?strategy=X` (DuckDB CTEs for 1M/3M/annualised returns)
- New page: `compare.html` + `compare.js` (strategy tabs, search, sort, best/worst, ECharts compare)
- Refactored Server to hold `*db.DB` directly

### Phase 10: Frontend v2 ✅
- Design system (CSS custom properties, dark/light themes, theme toggle)
- ES modules, shared common.js, full-width data-first layout
- New palette (gray-900/white, muted gold accent), sticky top nav
- Guide page, dashboard performance snapshot chart
- Makefile lifecycle, Config.local.toml, launchctl service management

### Phase 11: Frontend Polish ✅
- Loading spinners, empty states, mobile hamburger menu
- Compare page card-list redesign with SI returns

### Phase 12: Analytics ✅
- Volatility Rating — rolling std dev, Low/Medium/High + percentile bar chart
- Trend Signal — 7d vs 30d MA crossover, SVG sparklines
- Anomaly Detection — Z-score >3σ, sized dot visualization
- Similar Funds — attribute + return profile similarity, top 3
- Analytics page (`analytics.html`) with visual-first tabbed UI
- API: `/api/analytics/{volatility,trends,anomalies,similar}`

## Future

### Phase 11: Remaining
- Embed static assets (`go:embed`) — single binary, no runtime file deps
  - Embed `web/static/` via `//go:embed` in a new `web/embed.go`
  - Embed `config/Config.toml` as default config (override via flag/env)
  - Remove `stage` target from Makefile once embedded

### Phase 12b: Analytics (needs 1+ year of data)
- **Performance Percentile** — PERCENT_RANK on annualised return (all null with <1yr data)
- **Auto-clustering** — K-means on [return, volatility, drawdown] (returns null without 1yr)

### Phase 13: Data Enrichment
- More AMFI data categories
- Historical data backfill
- Fund house analytics
- Sector/category aggregations

### Phase 14: Mobile
- Strategy documented in `docs/MOBILE_STRATEGY.md`
- PWA or native (Swift/Kotlin) — TBD
- API already mobile-ready (JSON, stateless)

### Phase 15: Cost Optimization
- IPv6-only to eliminate $3.72/month IPv4 charge
- Evaluate Cloudflare proxy
- Consider ARM64 Graviton spot instances
