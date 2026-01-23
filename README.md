# Sanvasify

Sanvasify is a web application that allows users to browse, search, and analyze mutual fund schemes. It provides an intuitive interface for exploring fund data with automated data fetching from AMFI (Association of Mutual Funds in India) and historical NAV trend visualization.

## Features

- **Check SIF NAV**: View current Net Asset Value for mutual fund schemes with advanced filtering
- **NAV Trends**: Interactive charts showing historical NAV performance with statistics
- **Database Backend**: DuckDB for efficient storage and querying of historical data
- **Automated Data Fetching**: Scheduled fetching from AMFI with configurable intervals
- **Parquet Storage**: Efficient columnar storage format for NAV data

## Project Structure

The project follows a standard Go application layout to keep the codebase organized and maintainable.

```
sanvasify/
├── cmd/
│   ├── server/
│   │   └── main.go
│   └── fetch/
│       └── main.go
├── pkg/
│   ├── conf/
│   │   └── config.go
│   ├── nav/
│   │   └── nav_report.go
│   ├── fetcher/
│   │   ├── fetcher.go
│   │   ├── converter.go
│   │   └── range.go
│   └── api/
│       ├── handlers.go
│       ├── routes.go
│       ├── server.go
│       └── store.go
├── config/
│   └── Config.toml
├── data/
│   └── nav_reports/
│       └── nav_data.parquet
├── web/
│   └── static/
│       ├── css/
│       │   └── style.css
│       ├── js/
│       │   └── app.js
│       └── index.html
├── etc/
│   ├── architecture.d2
│   ├── architecture.svg
│   ├── design.md
│   ├── fund_struct.txt
│   └── TODO.txt
├── go.mod
├── go.sum
└── README.md
```

-   `cmd/server/main.go`: The main entry point for the web server application.
-   `cmd/fetch/main.go`: Command-line tool for fetching NAV data from AMFI.
-   `pkg/conf/`: Contains the configuration loading logic.
-   `pkg/nav/`: Handles parsing and processing of the mutual fund data.
-   `pkg/fetcher/`: Automated data fetching and conversion to Parquet format.
-   `pkg/api/`: Contains the web server logic, including handlers, routing, and data storage.
-   `config/`: Configuration files.
-   `data/nav_reports/`: Parquet data files containing NAV history.
-   `web/static/`: Contains all the frontend assets (HTML, CSS, JavaScript).
-   `etc/`: Documentation, architecture diagrams, and design notes.

## Getting Started

### Running the Web Server

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/raghavkgarg/sanvasify.git
    cd sanvasify
    ```

2.  **Build and run the application:**
    ```bash
    go build -o dist/sanvasify ./cmd/server
    cd dist
    ./sanvasify
    ```

3.  The server will start, and you can access the website at `http://localhost:8080` (or the port specified in your `config/Config.toml`).

4.  **Logs**: Application logs are written to both stdout and `/tmp/sanvasify.log.{timestamp}` (configurable in `config/Config.toml`).

### Fetching NAV Data

To fetch the latest NAV data from AMFI:

1.  **Configure the date range** in `config/Config.toml`:
    ```toml
    [fetcher]
    from_date = "2026-01-16"
    to_date = "2026-01-21"
    ```

2.  **Build and run the fetcher:**
    ```bash
    go build -o dist/fetch ./cmd/fetch
    cd dist
    ./fetch
    ```

The fetcher will:
- Download NAV reports from AMFI for each date in the range
- Skip weekends and holidays (when no data is available)
- Convert data to Parquet format
- Append all data to a single `nav_data.parquet` file
- Wait 60 seconds between requests to avoid overloading the server

## Configuration

The application is configured using the `config/Config.toml` file.

```toml
input_file = "config/nav_report_2026-01-18.txt"
use_db = true
db_path = "/tmp/sanvasify.db"
log_file = "/tmp/sanvasify.log"

[fetcher]
enabled = false
data_dir = "data/nav_reports"
raw_dir = "/tmp/sanvasify_raw"
base_url = "https://portal.amfiindia.com/SIF_DownloadNAVHistoryReport.aspx"
from_date = "2026-01-16"
to_date = "2026-01-21"

[server]
port = 8080
```

### Configuration Options

-   `input_file`: Path to a static NAV report file (legacy mode).
-   `use_db`: Enable SQLite database for data storage.
-   `db_path`: Path to the SQLite database file.
-   `log_file`: Path for application logs (timestamped files will be created).
-   `fetcher.enabled`: Enable automatic data fetching.
-   `fetcher.data_dir`: Directory for storing Parquet files.
-   `fetcher.raw_dir`: Directory for storing raw downloaded files.
-   `fetcher.base_url`: AMFI NAV report endpoint URL.
-   `fetcher.from_date`: Start date for fetching data (YYYY-MM-DD).
-   `fetcher.to_date`: End date for fetching data (YYYY-MM-DD).
-   `server.port`: The port for the server to listen on.

## API Endpoints

The server exposes the following JSON API endpoints:

-   `GET /api/schemes`: Returns a list of all available mutual fund schemes (latest NAV only).
-   `GET /api/nav?code=<scheme_code>`: Returns the latest NAV details of a specific scheme by its code.
-   `GET /api/nav/history?code=<scheme_code>`: Returns historical NAV data for a specific scheme.
-   `GET /api/filters`: Returns a list of unique values for all filter categories (fund type, strategy, company, etc.).
-   `GET /api/search?fund_type=<type>&...`: Searches for schemes based on the provided filter criteria.

## Data Format

NAV data is stored in Apache Parquet format with the following schema:

- `scheme_code`: Unique identifier for the scheme
- `scheme_name`: Full name of the mutual fund scheme
- `isin_div_payout_growth`: ISIN for dividend payout/growth option
- `isin_div_reinvestment`: ISIN for dividend reinvestment option
- `net_asset_value`: Current NAV value
- `repurchase_price`: Repurchase price (if applicable)
- `sale_price`: Sale price (if applicable)
- `date`: NAV date (DATE type for proper sorting)
- `strategy_name`: Investment strategy category
- `fund_house_name`: Fund house/AMC name
- `fund_type`: Type of fund (Open/Close ended)
- `fund_company`: Company name
- `fund_strategy`: Detailed strategy description
- `distribution_option`: Distribution option type
- `purchase_mode`: Purchase mode (Direct/Regular)

### Loading Data into Database

The recommended approach is to load from the corrected parquet file:

```bash
duckdb /tmp/sanvasify.db
```

```sql
DROP TABLE IF EXISTS sif_schemes;
CREATE TABLE sif_schemes AS SELECT * FROM 'data/nav_reports/nav_data_corrected.parquet';
CREATE INDEX idx_scheme_code ON sif_schemes(scheme_code);
CREATE INDEX idx_date ON sif_schemes(date);
```

This file contains historical data with proper DATE type for chronological sorting.

## Build and Deployment

### Server Binary

To build a production-ready binary for Linux (ARM64):

```bash
GOOS=linux GOARCH=arm64 go build -o sanvasify-server ./cmd/server
```

### Fetcher Binary

To build the data fetcher:

```bash
GOOS=linux GOARCH=arm64 go build -o sanvasify-fetch ./cmd/fetch
```

Deploy the binaries along with the `config/` and `web/` directories to your server.

## Features

### Code Quality
- **Structured Logging**: Uses Go 1.25 `slog` with source location and dual output (stdout + file)
- **Graceful Shutdown**: Server handles SIGINT/SIGTERM with 30-second grace period
- **Context Propagation**: Proper request cancellation and timeout support
- **Input Validation**: SQL injection prevention and config validation
- **Error Handling**: Comprehensive error handling with structured logging

### Security
- **SQL Injection Protection**: Column name validation in database queries
- **HTTP Timeouts**: Read/write/idle timeouts prevent resource exhaustion
- **Graceful Degradation**: Errors logged but don't crash the application

### Performance
- **Parquet Storage**: Efficient columnar storage for NAV data
- **Database Support**: DuckDB backend for large datasets with proper indexing
- **Middleware Pattern**: Efficient request processing with reusable middleware
- **Historical Data**: Optimized queries return only latest NAV per scheme by default

### User Interface
- **Responsive Design**: Works on desktop and mobile devices
- **Interactive Charts**: Apache ECharts 6.0 for NAV trend visualization
- **Advanced Filtering**: Multi-criteria search for fund schemes
- **Centralized Navigation**: Shared navigation component across all pages

## Notes

- The AMFI endpoint does not provide data for weekends and holidays. The fetcher automatically detects and skips these dates.
- A configurable delay (default 60 seconds) is enforced between consecutive HTTP requests to be respectful to the AMFI server.
- Historical data is stored with proper DATE type for accurate chronological sorting.
- The database stores multiple NAV values per scheme (one per date), but API endpoints return only the latest by default.
- Use `/api/nav/history` endpoint to retrieve full historical data for trend analysis.
- Logs are written to both stdout and timestamped files (configured via `log_file` setting).
- Structured logging with source location helps with debugging and monitoring.
- The in-memory store mode is deprecated and will be removed in future versions. Use database mode for all deployments.
