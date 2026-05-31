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

## Production Deployment & Database Sync Strategy

Currently, `scripts/sync_db.sh` uploads a fresh `sanvasify.db` from your local machine to AWS, replacing the existing database. Because the `visitors` table previously lived inside this same database, running the sync script would have overwritten and deleted all visitor data collected on AWS.

To solve this, we implemented a **Split Databases** strategy.

### Implemented Architecture: Split Databases
DuckDB allows the application to manage multiple database connections seamlessly. We have split the data into two isolated files:
1. `sanvasify.db`: Contains the mutual fund data (`sif_schemes`). This file gets completely overwritten by your `sync_db.sh` script whenever you pull new data.
2. `metrics.db`: Contains user-generated data (`visitors`). This file lives permanently on AWS and is **never** overwritten by the sync script.

### How Isolation is Achieved:
- **Zero Impact on Existing Code:** The primary `*sql.DB` connection in `pkg/db/db.go` remains untouched. All existing endpoints and queries for mutual fund data still route through `sanvasify.db` exactly as they did before.
- **Dynamic Path Resolution:** The application dynamically determines where `sanvasify.db` is located (e.g., `/Users/raghavgarg/Projects/duckdb/sanvasify/` locally or `/opt/sanvasify/data/` on AWS) and automatically spawns a secondary connection to a `metrics.db` file in that exact same directory.
- **Dedicated Metrics Connection:** The new visitor methods (`RecordVisit` and `GetUniqueVisitorCount`) are strictly routed to the secondary `metricsConn`.
- **Infrastructure Integrity:** Because `metrics.db` is a completely separate file, your `sync_db.sh` script required absolutely zero modifications. It will continue to overwrite `sanvasify.db` without ever touching `metrics.db`.

When you are ready to analyze the metrics locally, you can safely pull the visitor data from AWS to your local machine using SCP, as the file will be waiting for you right next to your main database file (e.g., `scp ... ec2-user@<AWS_IP>:/opt/sanvasify/data/metrics.db /Users/raghavgarg/Projects/duckdb/sanvasify/metrics.db`).
