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

## Future Roadmap & Strategic Expansion

To scale Sanvasify sustainably, we integrate our primary design files into a sequential, dependency-aware roadmap. 

### Logical Dependency & Ordering Rationale:
1. **Foundation First**: We cannot launch user-facing features like Portfolios or track live Visitors without migrating to a multi-table database (`sanvas.db`) where synchronizations do not overwrite production tables. Thus, **Database Consolidation** and **Visitor Tracking** are scheduled first.
2. **SEO & Core Value**: With a stable multi-table foundation, we expand organic reach via **SEO & Competitive Parity** to attract more traffic.
3. **User Engagement**: Once traffic flows and the database can isolate user data, we introduce the authenticated **Portfolio Management** system.
4. **Omnichannel Outreach**: After stabilizing the web application and portfolio REST APIs, we expand into the **Mobile Ecosystem** using a SwiftUI + PWA/TWA hybrid strategy.

---

### Phase 13: Database Consolidation & Visitor Tracking ✅
*Detailed strategy documented in [dbexpansion.md](file:///Users/raghavgarg/Projects/myGo/sanvasify/docs/dbexpansion.md) & [visitor.md](file:///Users/raghavgarg/Projects/myGo/sanvasify/docs/visitor.md)*

- **Consolidate to `sanvas.db`**: Retire the proposed `metrics.db` and merge `sif_schemes` and `visitors` into a single, multi-table SQLite/DuckDB schema.
- **Granular Sync Pipeline**: Replace full-db `scp` replacements with table-level Parquet transfers (`sync_db.sh`). Implement **Strategy B** (Brief Service Suspension) as the initial rollout sync mechanism, and prepare for **Strategy A** (Zero-Downtime Application-Led Merges).
- **Activate Privacy-Compliant Visitor Analytics**:
  - Store UUIDs locally (`localStorage`) and track sessions (`sessionStorage`).
  - Keep the display hidden until the visitor count exceeds 1,000, then render it in the main navigation.

### Phase 14: Web SEO & Competitive Parity ✅
*Detailed plan and implementation documented in [Phase14.md](file:///Users/raghavgarg/Projects/myGo/sanvasify/docs/Archive/Phase14.md)*

- **Compare Page Returns & Metrics**: Enhanced the compare page with Sharpe Ratio calculations, custom "Alpha Shield" risk-adjusted badges, and side-by-side performance cards.
- **Benchmark Comparison (Nifty 500 TRI)**: Integrated standard index returns and historical value tracking, supporting normalized charting starting at base 100 (when benchmark is selected).
- **Homepage "Top Performers"**: Added a dynamically populated top SIF returns widget to index page.
- **Theme-Consistent SVG Logo**: Configured logo properties to change colors dynamically in light/dark themes.
- **Interactive Routing**: Updated scheme details and comparison links to direct users to `nav_trends.html?code=[scheme_code]`.
- **Advanced SEO & Search Discovery**: Integrated canonical links, custom FAQPage/BreadcrumbList schemas, and targeted SIF keywords across all templates.

### Phase 15: Portfolio Management System 💼
*Detailed roadmap documented in [PortfolioFeature.md](file:///Users/raghavgarg/Projects/myGo/sanvasify/docs/PortfolioFeature.md)*

- **Transaction Ledger**: Create the `user_transactions` table in DuckDB to record buy/sell transactions (date, units, price, user_id).
- **Backend Portfolio API**: Implement Go endpoints for adding transactions (`POST /api/portfolio/transactions`), fetching aggregate holdings, calculating top-level XIRR/drawdown, and compiling net-worth history.
- **Secure Data Isolation**: Enable OAuth2/JWT middleware to protect all portfolio endpoints, isolating data queries by authenticated `user_id`.
- **API Security & Cache Tuning**: Implement API rate limiting on public endpoints (e.g. `/api/schemes` and `/api/analytics`) and configure HTTP `Cache-Control` headers for slow-changing public data to prevent scraping abuse and optimize database CPU cycles.
- **Wealth Dashboard UI**: Build `portfolio.html` featuring asset allocation pie charts and portfolio growth timeline charts powered by ECharts.
- **Portfolio V2**: Introduce FIFO-based tax harvesting calculations and CAS (Consolidated Account Statement) PDF importing capabilities.

### Phase 16: Mobile Surface Strategy 📱
*Detailed roadmap documented in [MOBILE_STRATEGY.md](file:///Users/raghavgarg/Projects/myGo/sanvasify/docs/MOBILE_STRATEGY.md)*

- **Backend Mobile Readiness**: Implement API versioning (`/api/v1/`), paginated queries (`?page=1&limit=50`), standardized JSON error responses, CORS configurations, and PKCE-supportive mobile OAuth flows.
- **Rollout Strategy**:
  - *Phase 1 (Validation)*: Build a premium native iOS client in SwiftUI using `URLSession` and Swift Charts, while serving Android users via the existing PWA.
  - *Phase 2 (Store Presence)*: Package the Android PWA as a Google Play Store-compatible Trusted Web Activity (TWA) with minimal code changes.
  - *Phase 3 (Maturity)*: Port the Android client to Jetpack Compose or Kotlin Multiplatform (KMP) as logic scales.

### Phase 17: Build & Deployment Optimizations 🛠️
- **Single-Binary Embedding (`go:embed`)**:
  - Embed `web/static/` via `//go:embed` inside `web/embed.go`.
  - Embed `config/Config.toml` as default configuration.
  - Simplify deployment by removing `stage` and static asset replication steps from the Makefile.
- **Cost Reduction**: Reconfigure AWS instances to utilize IPv6-only settings (saving $3.72/month on IPv4), evaluate Cloudflare proxies, and migrate to Graviton-based ARM64 spot instances.
- **Advanced Analytics**: Introduce **Performance Percentile** ranking and **K-Means Auto-clustering** once 1+ years of historical market data is logged.

