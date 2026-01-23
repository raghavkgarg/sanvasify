# Database Integration

## Overview

Sanvasify now supports two data storage modes:
1. **In-Memory Mode** (default) - Original text file parsing
2. **Database Mode** - DuckDB persistent storage

## Configuration

Edit `config/Config.toml`:

```toml
input_file = "config/nav_report_2026-01-18.txt"
use_db = true                    # false for in-memory mode
db_path = "/tmp/sanvasify.db"    # database file path

[server]
port = 8080
```

## Architecture

### Store Interface

All data access goes through the `store.Store` interface:

```go
type Store interface {
    GetAllSchemes(ctx context.Context) ([]Scheme, error)
    GetSchemeByCode(ctx context.Context, code string) (*Scheme, error)
    SearchSchemes(ctx context.Context, filters map[string]string) ([]Scheme, error)
    GetUniqueValues(ctx context.Context, column string) ([]string, error)
    Close() error
}
```

### Implementations

1. **MemoryStore** (`pkg/store/memory.go`)
   - Wraps existing `nav.NAVReport`
   - No persistence
   - Fast startup

2. **DB** (`pkg/db/db.go`)
   - DuckDB backend
   - Persistent storage
   - SQL queries with ILIKE for case-insensitive search

## Database Schema

```sql
CREATE TABLE sif_schemes (
    scheme_code VARCHAR NOT NULL,
    scheme_name VARCHAR NOT NULL,
    isin_div_payout_growth VARCHAR,
    isin_div_reinvestment VARCHAR,
    net_asset_value VARCHAR,
    repurchase_price VARCHAR,
    sale_price VARCHAR,
    date DATE,
    strategy_name VARCHAR,
    fund_house_name VARCHAR,
    fund_type VARCHAR,
    fund_company VARCHAR,
    fund_strategy VARCHAR,
    distribution_option VARCHAR,
    purchase_mode VARCHAR
);
CREATE INDEX idx_scheme_code ON sif_schemes(scheme_code);
CREATE INDEX idx_date ON sif_schemes(date);
```

Note: No PRIMARY KEY constraint since we store historical data (multiple rows per scheme).

## Data Loading

### From Text File

When `use_db = true` and `input_file` is specified:
- Database schema is initialized
- Text file is parsed using existing `nav.ParseNAVReport()`
- All schemes are bulk-inserted in a transaction
- Upsert logic handles re-runs (ON CONFLICT DO UPDATE)

### From Parquet Files (Recommended)

DuckDB can load parquet files directly without parsing:

```bash
# Connect to database
duckdb /tmp/sanvasify.db

# Drop existing data and load corrected parquet file
DROP TABLE IF EXISTS sif_schemes;
CREATE TABLE sif_schemes AS SELECT * FROM 'data/nav_reports/nav_data_corrected.parquet';
CREATE INDEX idx_scheme_code ON sif_schemes(scheme_code);
CREATE INDEX idx_date ON sif_schemes(date);
```

The `nav_data_corrected.parquet` file contains all historical data with proper DATE type for the date column.

**Note:** Old parquet files with VARCHAR date type are in `data/nav_reports/old/` for reference.

## Building

DuckDB uses pre-built static libraries for:
- macOS: amd64, arm64
- Linux: amd64, arm64
- Windows: amd64

Cross-compilation works seamlessly:

```bash
# Build for Linux ARM64 from macOS
GOOS=linux GOARCH=arm64 go build -o sanvasify-server ./cmd/server
```

### Library Distribution

**What gets checked into git:**
- ✅ `go.mod` and `go.sum` (dependency declarations, ~5KB)
- ❌ Pre-built DuckDB libraries (NOT checked in)

**How it works:**
1. Libraries are downloaded to `~/go/pkg/mod/` (Go's module cache)
2. Each platform binding is ~85MB (stored locally, not in repo)
3. During build, Go automatically links the correct platform's libraries
4. Final binary includes DuckDB statically linked (~50-80MB)

**For new developers:**
```bash
git clone <repo>
cd sanvasify
go build ./cmd/server  # Automatically downloads DuckDB bindings on first build
```

Go handles all library downloads automatically - no manual setup required!

### Library Distribution

**What gets checked into git:**
- ✅ `go.mod` and `go.sum` (dependency declarations, ~5KB)
- ❌ Pre-built DuckDB libraries (NOT checked in)

**How it works:**
1. Libraries are downloaded to `~/go/pkg/mod/` (Go's module cache)
2. Each platform binding is ~85MB (stored locally, not in repo)
3. During build, Go automatically links the correct platform's libraries
4. Final binary includes DuckDB statically linked (~50-80MB)

**For new developers:**
```bash
git clone <repo>
cd sanvasify
go build ./cmd/server  # Automatically downloads DuckDB bindings on first build
```

Go handles all library downloads automatically - no manual setup required!

## Future Enhancements

With DuckDB, you can now:
- Query CSV files directly: `SELECT * FROM read_csv_auto('file.csv')`
- Export to Parquet: `COPY (SELECT * FROM sif_schemes) TO 'schemes.parquet'`
- Use JSON extension for complex queries
- Add indexes for performance
- Implement incremental updates
