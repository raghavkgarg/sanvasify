# SIF Analytics & Composite Scoring Upgrades

This document outlines the enhancements made to the Specialised Investment Fund (SIF) Analytics dashboard, the Category Champions composite scoring model, and the comparison sharing mechanisms.

---

## 1. Category Champions & Scoring Upgrades

### A. Direct Growth Scheme Filter
To prevent mixing regular plans with direct plans in the rankings (which skewed comparisons), the Go database ranking algorithm was updated.
* **Implementation Location**: `GetTopPerformers` in [analytics.go](file:///Users/raghavgarg/Projects/myGo/sanvasify/pkg/db/analytics.go)
* **Changes**: Added a case-insensitive check on the scheme name:
  ```go
  nameLower := strings.ToLower(m.Name)
  if strings.Contains(nameLower, "direct") && strings.Contains(nameLower, "growth") { ... }
  ```
  Only schemes meeting this criteria are normalized and evaluated.

### B. Naturally Distinct Category Rankings
Previously, Alpha Kings and Asymmetric Runners returned the exact same funds because both sorted lists of funds yielded identical ordering on the limited direct-growth dataset. We updated the sorting metrics for each category to match their mathematical purpose, producing distinct rankings:

1. **Alpha King (Aggressive Growth)**: Sorted by **Alpha desc** (active outperformance).
   * *Metric displayed*: **Alpha**
2. **Shield Guardian (Capital Preservation)**: Sorted by **lowest Max Drawdown desc** (closest to 0%, putting the absolute safest capital-protection funds first).
   * *Metric displayed*: **Max Drawdown**
3. **Asymmetric Runner (Tactical Hedging/Capture)**: Sorted by **Sortino Ratio desc** (outperformance relative to downside-only volatility).
   * *Metric displayed*: **Sortino Ratio**

* **Backend Changes**: Modified sort functions in [analytics.go](file:///Users/raghavgarg/Projects/myGo/sanvasify/pkg/db/analytics.go#L533-L553).
* **Frontend Changes**: Updated column definitions and metric mappings in [dashboard.js](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/js/dashboard.js) and [analytics.js](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/js/analytics.js).

---

## 2. Layout & UI Polish

### A. Banner Clipping Resolution
The absolute positioning of category banners (`top: -10px`) caused them to be cut off due to the `overflow: hidden` styling on the cards.
* **Fix**: Removed absolute positioning and converted the badges into `inline-flex` containers flowing naturally inside the top header of the cards. Adjusted padding to maintain a premium look.

### B. First-Tab Default & Navigation
* Moved the **Top Performers** tab to the first position in [analytics.html](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/analytics.html).
* Initialized `currentTab` to `'topPerformers'` in [analytics.js](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/js/analytics.js) so it opens by default.
* Renamed "Ann. Return" to "Ann. Ret" on the homepage Category Champions widget for clean alignment.

---

## 3. SEO, Inter-Page Links & URL Routing

### A. Deep Linking to Analytics Tabs
* Updated [analytics.js](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/js/analytics.js) to check the `?tab=XYZ` URL query parameter on page load, automatically activating that tab.
* In [guide.html](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/guide.html), wrapped the metric names (Alpha, Sortino, Sharpe, etc.) in hyperlinks pointing directly to `analytics.html?tab=riskMetrics` and wrapped category definitions with links to `analytics.html?tab=topPerformers`.
* Added an anchor `id="composite-model"` in [guide.html](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/guide.html) and linked to it directly from the description on the Top Performers tab header.

### B. FAQ Schema & Glossary
* Expanded the JSON-LD `FAQPage` schema in [guide.html](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/guide.html) with detailed answers about the **Multi-Factor Composite Score** calculation.
* Added an **SEO Glossary** section to the bottom of [index.html](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/index.html) explaining Cat III AIF, Alpha, Sharpe, and Sortino to capture long-tail keywords.

---

## 4. Interactive "Share Results" Feature
* Added a **Share** button to the comparison panel header in [compare.html](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/compare.html).
* In [compare.js](file:///Users/raghavgarg/Projects/myGo/sanvasify/web/static/js/compare.js):
  * Bound a click listener that formats a shareable URL containing the currently compared fund scheme codes (e.g. `compare.html?codes=120392,120393`) and copies it to the clipboard.
  * Added logic to parse the `codes` parameter on load and auto-populate the chart and badges.

---

## 5. Trust & Contact Footer
* Added support contact links to the footer across all HTML templates, using the official email `info@sanvasify.com` and the official X/Twitter handle `@sanvasify` (styled with the official `𝕏` icon).
