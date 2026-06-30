# Unique Visitor Count Implementation

## Overview
This document summarizes the final implementation of the unique visitor counting mechanism for the Sanvasify website. The goal was to track and display the number of unique users who have visited the site, while remaining privacy-compliant.

## Final Decisions
- **Tracking Method:** We used a client-side generated UUID stored in `localStorage`. This avoids intrusive fingerprinting while accurately counting distinct browser sessions.
- **Display Location:** As requested, the visitor count is configured to remain hidden until the total count reaches 1,000 visitors. Once the milestone is hit, it will be subtly displayed inside the navigation menu (`#nav-links`).

## Implementation Walkthrough

### 1. Database Updates
- **File modified:** `pkg/db/db.go`
- **Changes:** 
  - Added a `visitors` table initialization in the `InitSchema` function to store `visitor_id`, `first_visit_at`, and `last_visit_at`.
  - Implemented `RecordVisit` to insert a new visitor ID or update the `last_visit_at` timestamp if the user already exists.
  - Implemented `GetUniqueVisitorCount` to return the total row count from the `visitors` table.

### 2. API Endpoints
- **Files modified:** `pkg/api/handlers.go`, `pkg/api/routes.go`
- **Changes:**
  - Added a `POST /api/metrics/visit` endpoint that consumes a JSON body (`{"visitor_id": "uuid"}`) and registers the visit.
  - Added a `GET /api/metrics/visitors/count` endpoint that returns the current unique visitor count as JSON.
  - Registered both routes in the main API router under a new Metrics section.

### 3. Frontend Tracking & Display
- **File modified:** `web/static/js/common.js`
- **Changes:**
  - Implemented an asynchronous `trackVisitor` function that runs on page load (tied to `DOMContentLoaded`).
  - Uses `localStorage` to generate and persist a unique `sanvasify_visitor_id` per browser.
  - Uses `sessionStorage` (`sanvasify_visit_recorded`) to avoid pinging the `POST` endpoint on every single page navigation, ensuring we only record the visit once per active browser session to save bandwidth.
  - Fetches the total count via the `GET` endpoint and **only renders** the count in the DOM if `count >= 1000`.

The tracking logic is now fully integrated and actively logging visitors in DuckDB. The user interface will update automatically once the milestone is achieved.

---

## Local Verification & Testing

Follow these steps to check and verify the unique visitor count tracking on your local machine:

### 1. Start the Local Server
Build the project assets and start the web server in the foreground:
```bash
make run
```
By default, the server runs on `http://localhost:8080`.

### 2. Verify the Database Table Schema
Confirm that DuckDB automatically initialized the `visitors` table inside your active database:
```bash
duckdb /Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db "DESCRIBE visitors;"
```
You should see fields `visitor_id` (VARCHAR), `first_visit_at` (TIMESTAMP), and `last_visit_at` (TIMESTAMP).

* **View the Recorded Rows:**
  ```bash
  duckdb /Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db "SELECT * FROM visitors LIMIT 10;"
  ```
* **View the Total Count of Recorded Rows:**
  ```bash
  duckdb /Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db "SELECT COUNT(*) FROM visitors;"
  ```

### 3. Verify API Endpoints via Curl
You can directly test the API handlers using standard shell commands:
* **Record a Visit:**
  ```bash
  curl -X POST -H "Content-Type: application/json" -d '{"visitor_id": "test-local-uuid-999"}' http://localhost:8080/api/metrics/visit
  ```
* **Retrieve the Total Unique Count:**
  ```bash
  curl http://localhost:8080/api/metrics/visitors/count
  ```
  This should return a JSON response containing the updated count, e.g. `{"count": 1}`.

### 4. Verify Frontend Integration
1. Open your browser and access `http://localhost:8080/`.
2. Open the Developer Tools (**F12** or **Option + Cmd + I** on macOS) and navigate to the **Network** tab.
3. Reload the page and look for a `POST` request to `/api/metrics/visit`.
4. Inspect the **Application** -> **Storage** panel:
   * Under **Local Storage**, verify `sanvasify_visitor_id` is created with a UUID.
   * Under **Session Storage**, verify `sanvasify_visit_recorded` is set to `true`.
5. Refresh the page again. Confirm that `/api/metrics/visit` is **not** called a second time (due to the session storage sentinel safeguarding bandwidth).

### 5. Simulating the 1,000+ Milestone UI Display
The unique visitor count is hidden by default until it reaches 1,000. You can simulate and test the display milestone layout by bulk inserting dummy rows into your local DuckDB database:
```bash
duckdb /Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db "INSERT INTO visitors SELECT 'fake-uuid-' || i, now(), now() FROM range(1, 1005) t(i) ON CONFLICT DO NOTHING;"
```
After running this query, refresh the browser page. The navigation menu (`#nav-links`) will now display the visitor indicator: **"Unique Visitors: 1006"**.

---

## Production Deployment & Verification Checklist

When you are ready to deploy and verify these changes on production (AWS), follow these steps:

### 1. Cross-Compile and Deploy Binaries
Build the server binary for the AWS Graviton (ARM64) architecture and deploy the assets:
```bash
# Cross-compile for target architecture
make build-linux-arm64

# Deploy assets (using your target synchronization scripts)
# e.g., syncing binaries and web assets
./sync_bin.sh
./sync_web.sh
```

### 2. Verify Database Target Switchover
Make sure the active production instance config points to the consolidated `sanvas.db` (rather than the legacy `sanvasify.db`):
```bash
# Run the switchover script to target the consolidated database
./scripts/switch_db.sh sanvas
```
*Note: This script updates `/opt/sanvasify/config/Config.toml` on AWS, handles DB locks, and restarts the systemd services safely.*

### 3. Verify Live Visitor Counting
Test the live production endpoint using curl to ensure traffic logging is operational:
```bash
curl https://sanvasify.com/api/metrics/visitors/count
```
#######http://localhost:8080/api/metrics/visitors/count

Confirm that you get a successful JSON response (e.g., `{"count": 0}` if no visitors have loaded the pages yet).

### 4. Schedule the Table-Level Sync Script
To continuously load new NAV updates locally and sync them to AWS without overwriting server-side visitor logs, ensure the sync job is scheduled:
* Set up a cron task or daemon on your local machine to regularly execute `scripts/sync_db.sh`.
* Confirm that local executions export data to `sif_schemes.parquet`, transfer it to AWS, stop the service, perform the `INSERT ... ON CONFLICT` merge into `sanvas.db` on AWS, and restart the service smoothly.

---

For details on how visitor metrics are preserved during deployment, and the phased roadmap for transitioning from `sanvasify.db` to a consolidated multi-table database (`sanvas.db`), please refer to the consolidated [Database Expansion Strategy](file:///Users/raghavgarg/Projects/myGo/sanvasify/docs/dbexpansion.md).

