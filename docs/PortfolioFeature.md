# SIF Portfolio Management - Implementation Plan

To fully assimilate a true **Portfolio Management** system (rather than a simple watchlist), Sanvasify must track actual investments, calculate returns, and provide asset allocation insights. Here is the comprehensive breakdown:

## 1. Data Models (DuckDB)
Instead of a simple mapping table, we need a transactional ledger to compute true holdings and returns.

- [ ] **Create `user_transactions` Table**
  - Schema: `id`, `user_id` (FK), `scheme_code` (FK), `type` (BUY/SELL), `date` (DATE), `units` (DOUBLE), `price` (DOUBLE).
- [ ] **Create Database Queries for Aggregation**
  - **Holdings Query:** Aggregate transactions per `scheme_code` to calculate `total_units` and `average_cost`.
  - **Portfolio Summary Query:** Join holdings with the latest `sif_schemes` NAV to calculate `Total Invested`, `Current Value`, and `Absolute P&L`.

## 2. Backend API (Go)
The API needs to handle ledger entries and complex portfolio math.

- [ ] **Transaction Endpoints:**
  - `POST /api/portfolio/transactions`: Add a buy/sell trade.
  - `GET /api/portfolio/transactions`: List user's ledger.
- [ ] **Portfolio Dashboard Endpoints:**
  - `GET /api/portfolio/holdings`: Returns aggregated list of holdings with current NAV and P&L.
  - `GET /api/portfolio/summary`: Returns top-level metrics (Total Value, Total Invested, XIRR/Annualised return of the whole portfolio).
  - `GET /api/portfolio/history`: Calculates historical portfolio net worth over time for charting.

## 3. Authentication & Security
- [ ] **Enable / Verify Login Access:** Ensure the OAuth2/JWT logic in `pkg/auth/` is enabled.
- [ ] **Middleware:** Protect all `/api/portfolio/*` routes with `RequireAuth`.
- [ ] **Data Isolation:** Ensure all SQL queries strictly filter by the authenticated `user_id`.

## 4. Frontend Application (HTML/JS/CSS)
The UI needs to feel like a modern wealth dashboard.

- [ ] **Dashboard Layout (`portfolio.html`)**
  - **Summary Cards:** Total Net Worth, Total Invested, Overall Returns (Absolute & XIRR).
  - **Allocation Chart:** eCharts pie chart showing breakdown by `fund_strategy` (e.g., Hybrid vs Equity L/S).
  - **Growth Chart:** eCharts line chart mapping portfolio value over time.
- [ ] **Holdings View & Interactions**
  - Table showing: Scheme Name, Units, Avg Cost, Current Price, Current Value, P&L.
  - "Add Transaction" modal: Date picker, Buy/Sell toggle, Amount/Units input.
- [ ] **JavaScript Logic (`portfolio.js`)**
  - Fetch dashboard data and render charts via eCharts.
  - Handle form submissions for new transactions and optimistically update the UI.

## 5. Future Enhancements (V2 Portfolio)
- [ ] **CAS Import:** Allow users to upload NSDL/CDSL CAS (Consolidated Account Statement) PDFs to automatically parse and ingest transactions.
- [ ] **Tax Harvester:** Basic FIFO logic to show short-term vs long-term capital gains based on transaction dates.

## 6. Testing & Verification
- [ ] **Math Verification:** Write Go unit tests to ensure average cost and XIRR calculations are accurate.
- [ ] **API/Auth:** Test that users cannot fetch or modify another user's transactions.
- [ ] **UI:** Verify responsive design for the dashboard charts on mobile devices.
