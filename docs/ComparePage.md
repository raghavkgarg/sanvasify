# SIF Comparison Tracker – Product Strategy

## 1. Objective
Build a clean, data-driven webpage that allows users to compare **Hybrid Long-Short SIFs** (Special Investment Funds) across key performance metrics — similar to the screenshot but interactive, sortable, and filterable.

## 2. Target Category (from screenshot)
- **Category:** Hybrid Long-Short
- **AMCs included:** Edelweiss, Tata, SBI, Quant, ICICI Prudential, Bandhan, Aditya Birla Capital

## 3. Data Points to Capture per Fund

| Field | Example (Altiva) |
|-------|------------------|
| Fund Name | Altiva Hybrid Long-Short Fund |
| AMC | Edelweiss Mutual Fund |
| NAV (as of date) | ₹10.63 |
| Annualised Return | 11.15% |
| 1M Return | 0.97% |
| 3M Return | 2.32% |
| 6M Return (if avail) | 6.33% |
| SI (Since Inception) | (optional) |

> Note: Some funds show `-` or missing values — handle gracefully.

## 4. Functional Requirements

### 4.1 View & Layout
- **Table view** (primary) – one row per fund
- **Card view** (optional toggle) – like ******
- Sticky header with column sorting

### 4.2 Comparison Features
- [ ] **Select up to 4 funds** to compare side-by-side
- [ ] **Highlight best / worst** per metric (color-coded: green = top, red = bottom)
- [ ] **Sortable columns** (NAV, Annualised, 1M, 3M)
- [ ] **Search by AMC or fund name**

### 4.3 Visual cues
- Positive returns → green text/background tint
- Negative returns → red text
- Zero or missing → gray

### 4.4 Data recency
- Show: *“NAV as of 22 May 2026”* at top (dynamic)

## 5. Data Source Strategy

### Option A – Static JSON (MVP)
- Manually collect data from screenshot + latest factsheets
- Update weekly via manual CSV/JSON upload

### Option B – Semi-automated (recommended)
- Use a Google Sheet as backend
- Sheet → JSON via sheet.best / SheetDB
- Update sheet daily with new NAV/returns

### Option C – Full API (future)
- Connect to MF API (e.g., MFAPI, Kuvera, or AMC sources)

## 6. Page Structure (like ******)

Header

Home | Education | Resources | Subscribe | Log In
Sub-header

Category: Hybrid Long-Short
Date: NAV as of 22 May 2026
Filters / Actions

Search AMC/Fund
Compare (checkbox/select)
Reset
Main Table
Fund | AMC | NAV | Annualised | 1M | 3M | Compare

Compare Panel (sticky bottom or modal)

Selected funds comparison chart (bar or simple table)
Footer



## 7. Technical Recommendations

| Layer | Tech |
|-------|------|
| Frontend | React / Vue or plain HTML + Tailwind CSS |
| State | LocalStorage for compare selection |
| Data | JSON + fetch |
| Charting (compare) | Chart.js or ApexCharts |
| Hosting | Vercel / Netlify / GitHub Pages |

## 8. MVP vs Future Enhancements

### MVP (first release)
- Static or Google Sheets data
- Sorting + compare (up to 3 funds)
- Highlight best/worst in each column

### V2
- Time-series chart (NAV trend)
- Download as PDF/CSV
- Email alerts on NAV change
- Add more SIF categories (Equity Long-Short, Ex-Top 100)

## 9. Sample UI Structure (ASCII)

+---------------------------------------------------------+
| Hybrid Long-Short SIFs NAV as of 22 May 2026 |
+---------------------------------------------------------+
| 🔍 Search AMC/Fund [ Compare (0/4) ] |
+---------------------------------------------------------+
| Fund ▼ AMC ▼ NAV ▼ Ann% ▼ 1M ▼ 3M ▼ 6M ▼ [ ] |
| Altiva Edel 10.63 11.15% 0.97% 2.32% 6.33% ☐ |
| Titanium Tata 9.99 -0.20% -1.35%-0.08% - ☐ |
| Magnum SBI 10.30 5.31% 0.98% 0.56% 2.97% ☐ |
| ... |
+---------------------------------------------------------+
| [ Compare Selected (2/4) ] |
+---------------------------------------------------------+

## 10. Success Metrics
- Time to compare 4 funds < 10 sec
- User can identify top 3 funds by 1M/3M/Annualised
- Data freshness displayed clearly

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|-------------|
| Outdated NAV data | Show last updated timestamp; add manual verify flag |
| Missing return fields | Display `--` instead of breaking sort |
| Compare panel complexity | Limit to 4 funds, use simple horizontal bar chart |

## 12. Immediate Next Steps
1. Extract all 7 funds’ data from screenshot into JSON
2. Build static HTML table with sorting
3. Implement compare checkbox + side-by-side modal
4. Deploy v0 on GitHub Pages
5. Replace with Google Sheets JSON endpoint
