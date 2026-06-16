# Phase 14: Web SEO & Competitive Parity

## Tasks

### 1. Enhance Compare Page (`compare.html`) with Returns & Metrics
- **Dynamic Calculations (Frontend)**:
  - Fetch volatility data from `/api/analytics/volatility` in parallel to retrieve the daily standard deviation (`std_dev`) for all schemes.
  - Assume a risk-free rate of **6.0%** (standard Indian G-Sec/FD rate).
  - Compute **Sharpe Ratio** for each scheme:
    $$\text{Sharpe Ratio} = \frac{\text{Annualised Return} - 6.0}{\text{Daily StdDev} \times \sqrt{252}}$$ (where $\sqrt{252} \approx 15.874$).
  - Compute custom **"Alpha Shield"** rating based on the Sharpe Ratio and volatility profile:
    - `Sharpe Ratio >= 1.5` $\to$ **Excellent 🛡️**
    - `Sharpe Ratio >= 1.0` $\to$ **High 🛡️**
    - `Sharpe Ratio >= 0.5` $\to$ **Moderate 🛡️**
    - `Sharpe Ratio < 0.5` $\to$ **Low 🛡️**
- **Fund Card Badges**:
  - Render Sharpe Ratio and Alpha Shield as badges alongside the existing 1M, 3M, Annualised, and SI returns badges on each fund card.
- **Benchmark Comparison (Nifty 500 TRI)**:
  - Add a dedicated benchmark status block on `compare.html` showing Nifty 500 TRI returns:
    - 1M Return: **+1.20%**
    - 3M Return: **+3.50%**
    - Annualised: **+12.80%**
    - Sharpe Ratio: **0.85**
    - Alpha Shield: **Moderate 🛡️**
  - **Normalized Charting**:
    - When comparing multiple schemes on the ECharts chart, normalize starting NAV to **100** on the earliest date of the selected date range.
    - Plot the normalized benchmark line (growing at the annualised 12.80% rate, compounded daily) alongside the normalized selected schemes.

- [x] **1. Enhance Compare Page (`compare.html`) with Returns & Metrics**
  - [x] Update `web/static/js/compare.js` to load volatility ratings.
  - [x] Implement Sharpe Ratio and Alpha Shield logic.
  - [x] Render Sharpe Ratio and Alpha Shield badges on the cards.
  - [x] Add a benchmark stats panel to `compare.html`.
  - [x] Implement chart normalization (starting at 100) and plot the Nifty 500 TRI benchmark series.
- [x] **2. On-Page SEO Optimization for Compare Page**
  - [x] Update `<title>`, `<meta name="description">`, `<meta name="keywords">` in `compare.html` to target "SIF Investment Returns".
  - [x] Inject structured FAQ JSON-LD schema on `compare.html`.
- [x] **3. Homepage "Top Performers" Widget**
  - [x] Add a prominent section/widget on `index.html` displaying the top 2-3 funds with the best 1-month or 3-month returns.
  - [x] Use explicit SEO-friendly terms like "Top Performer".
- [x] **4. Interactive Routing Improvements**
  - [x] Update links on `compare.html` and `analytics.html` to direct to `nav_trends.html?code=[scheme_code]` instead of `nav.html`.
- [x] **5. Theme-Consistent Logo Strategy**
  - [x] Ensure that SVG colors adapt correctly via CSS Custom Properties. If there are any missing theme properties or hardcoded styles, resolve them.
- [x] **6. On-Page SEO Optimization for General Pages**
  - [x] Update `<title>`, `<meta name="description">`, `<meta name="keywords">`, and header tags across `index.html`, `nav_trends.html`, and `guide.html`.
  - [x] Add/update JSON-LD FAQ Schema on `index.html`.
  - [x] Add "Understanding SIF Investment Returns" section to `guide.html`.

### 7. Advanced SEO & Search Discovery Enhancements
- **Metadata & Canonicals**:
  - Add `<link rel="canonical" href="https://sanvasify.com/..." />` across all pages to consolidate link equity and prevent duplicate content flags.
- **Advanced JSON-LD Structured Data**:
  - Add `BreadcrumbList` schema to helper pages (`guide.html`, `compare.html`) to improve SERP breadcrumb display.
  - Implement a `Dataset` or `Table` schema structure for the NAV lists on `nav.html` and `analytics.html`.
- **Search Optimization for SIF Queries**:
  - Add specific keywords targeting "SEBI Specialized Investment Funds", "SIF NAV tracker India", and "Equity Long-Short SIF performance".
- **Performance & CWV (Core Web Vitals)**:
  - Optimize resource loading: defer heavy scripts (like ECharts) and ensure critical CSS is parsed first to lower LCP (Largest Contentful Paint) and improve INP (Interaction to Next Paint).

- [x] **7. Advanced SEO & Search Discovery Enhancements**
  - [x] Implement canonical links across all HTML templates.
  - [x] Integrate BreadcrumbList and Dataset JSON-LD schemas on relevant pages.
  - [x] Expand keyword targeting on SIF-specific queries ("SEBI Specialized Investment Funds", "SIF NAV tracker").
  - [x] Conduct Core Web Vitals optimization audit (deferred scripts, image optimization).

