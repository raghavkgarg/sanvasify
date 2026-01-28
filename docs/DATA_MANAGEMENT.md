# Data Management

## Overview

Sanvasify uses DuckDB for efficient storage and querying of mutual fund NAV data. Data is stored in Parquet format for optimal performance.

## Database Setup

### Initial Setup

The database is created automatically on first run:

```bash
./dist/sanvasify
```

This creates:
- Database file at `db_path` (default: `/tmp/sanvasify.db`)
- `sif_schemes` table with proper schema
- Indexes on `scheme_code` and `date` columns

**Note:** The server requires existing data in the database. If the database is empty, it will fail with instructions on how to load data.

### Manual Database Creation

```bash
duckdb /tmp/sanvasify.db
```

```sql
CREATE TABLE sif_schemes (
    scheme_code VARCHAR,
    scheme_name VARCHAR,
    isin_div_payout_growth VARCHAR,
    isin_div_reinvestment VARCHAR,
    net_asset_value DOUBLE,
    repurchase_price DOUBLE,
    sale_price DOUBLE,
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

## Data Fetching

### Fetch Historical Data

The `fetch` command downloads NAV reports from AMFI and converts them to Parquet format.

**Configure date range** in `config/Config.toml`:
```toml
[fetcher]
enabled = false  # Set true to enable
data_dir = "data/nav_reports"
from_date = "2025-01-01"
to_date = "2025-12-31"
```

**Run fetcher**:
```bash
go build -o dist/fetch ./cmd/fetch
./dist/fetch
```

### Fetcher Behavior

- Downloads one NAV report per date
- Skips weekends and holidays automatically
- Waits 60 seconds between requests (configurable)
- Converts text format to Parquet
- Appends to single `nav_data.parquet` file
- Logs progress and errors

### Date Range Tips

- AMFI data available from ~2006 onwards
- No data on weekends/holidays (fetcher skips automatically)
- Recommended: Fetch in monthly chunks for large ranges
- Example: Fetch 2024 data in 12 separate runs

## Data Format

### Parquet Schema

```
scheme_code: VARCHAR              # Unique identifier
scheme_name: VARCHAR              # Full scheme name
isin_div_payout_growth: VARCHAR   # ISIN for dividend payout/growth
isin_div_reinvestment: VARCHAR    # ISIN for dividend reinvestment
net_asset_value: DOUBLE           # Current NAV
repurchase_price: DOUBLE          # Repurchase price (if applicable)
sale_price: DOUBLE                # Sale price (if applicable)
date: DATE                        # NAV date (proper DATE type)
strategy_name: VARCHAR            # Investment strategy
fund_house_name: VARCHAR          # Fund house/AMC name
fund_type: VARCHAR                # Open/Close ended
fund_company: VARCHAR             # Company name
fund_strategy: VARCHAR            # Detailed strategy
distribution_option: VARCHAR      # Distribution option type
purchase_mode: VARCHAR            # Direct/Regular
```

### Loading Parquet Data

**Load data into database**:
```bash
# Drop existing data (if any)
duckdb /tmp/sanvasify.db -c "DELETE FROM sif_schemes"

# Load from Parquet with type conversion
duckdb /tmp/sanvasify.db -c "INSERT INTO sif_schemes SELECT 
  scheme_code, scheme_name, isin_div_payout_growth, isin_div_reinvestment,
  TRY_CAST(net_asset_value AS DOUBLE), 
  TRY_CAST(repurchase_price AS DOUBLE), 
  TRY_CAST(sale_price AS DOUBLE),
  date, strategy_name, fund_house_name, fund_type, fund_company,
  fund_strategy, distribution_option, purchase_mode
FROM 'data/nav_reports/*.parquet'"

# Create indexes
duckdb /tmp/sanvasify.db -c "CREATE INDEX IF NOT EXISTS idx_scheme_code ON sif_schemes(scheme_code)"
duckdb /tmp/sanvasify.db -c "CREATE INDEX IF NOT EXISTS idx_date ON sif_schemes(date)"

# Verify data
duckdb /tmp/sanvasify.db -c "SELECT COUNT(*) FROM sif_schemes"
duckdb /tmp/sanvasify.db -c "SELECT MIN(date), MAX(date) FROM sif_schemes"
```

**Note:** `TRY_CAST` converts VARCHAR to DOUBLE, returning NULL for empty strings or invalid values. This handles missing price data gracefully.

**Start the server**:
```bash
./dist/sanvasify
```

The server will verify data exists and display the row count on startup.

## Data Queries

### Common Queries

**Latest NAV for all schemes**:
```sql
SELECT DISTINCT ON (scheme_code) *
FROM sif_schemes
ORDER BY scheme_code, date DESC;
```

**Historical data for specific scheme**:
```sql
SELECT date, net_asset_value
FROM sif_schemes
WHERE scheme_code = '123456'
ORDER BY date ASC;
```

**Search by fund type**:
```sql
SELECT DISTINCT ON (scheme_code) *
FROM sif_schemes
WHERE fund_type ILIKE '%equity%'
ORDER BY scheme_code, date DESC;
```

**Get unique filter values**:
```sql
SELECT DISTINCT fund_type FROM sif_schemes ORDER BY fund_type;
SELECT DISTINCT fund_company FROM sif_schemes ORDER BY fund_company;
SELECT DISTINCT fund_strategy FROM sif_schemes ORDER BY fund_strategy;
```

## Performance Optimization

### Indexes

The application creates indexes on:
- `scheme_code`: Fast lookups by scheme
- `date`: Efficient date range queries

### Query Optimization

- Use `DISTINCT ON` for latest NAV per scheme
- Filter by `scheme_code` before sorting by date
- Use `ILIKE` for case-insensitive search
- Limit results for large datasets

### Database Maintenance

**Vacuum database** (reclaim space):
```sql
VACUUM;
```

**Analyze tables** (update statistics):
```sql
ANALYZE sif_schemes;
```

**Check database size**:
```bash
du -h /tmp/sanvasify.db
```

## Data Updates

### Incremental Updates

To add new data without replacing existing:

1. **Fetch new date range**:
   ```toml
   [fetcher]
   from_date = "2026-01-01"
   to_date = "2026-01-31"
   ```

2. **Run fetcher**:
   ```bash
   ./dist/fetch
   ```

3. **Load new data into database**:
   ```bash
   duckdb /tmp/sanvasify.db -c "INSERT INTO sif_schemes SELECT 
     scheme_code, scheme_name, isin_div_payout_growth, isin_div_reinvestment,
     TRY_CAST(net_asset_value AS DOUBLE), 
     TRY_CAST(repurchase_price AS DOUBLE), 
     TRY_CAST(sale_price AS DOUBLE),
     date, strategy_name, fund_house_name, fund_type, fund_company,
     fund_strategy, distribution_option, purchase_mode
   FROM 'data/nav_reports/nav_data_*.parquet'
   WHERE date >= '2026-01-01'"
   ```

4. **Restart server** to use updated data

### Full Refresh

To replace all data:

1. **Delete existing data**:
   ```bash
   duckdb /tmp/sanvasify.db -c "DELETE FROM sif_schemes"
   ```

2. **Fetch full date range**:
   ```toml
   [fetcher]
   from_date = "2020-01-01"
   to_date = "2026-01-31"
   ```

3. **Run fetcher**:
   ```bash
   ./dist/fetch
   ```

4. **Load all data**:
   ```bash
   duckdb /tmp/sanvasify.db -c "INSERT INTO sif_schemes SELECT 
     scheme_code, scheme_name, isin_div_payout_growth, isin_div_reinvestment,
     TRY_CAST(net_asset_value AS DOUBLE), 
     TRY_CAST(repurchase_price AS DOUBLE), 
     TRY_CAST(sale_price AS DOUBLE),
     date, strategy_name, fund_house_name, fund_type, fund_company,
     fund_strategy, distribution_option, purchase_mode
   FROM 'data/nav_reports/*.parquet'"
   ```

## Backup and Restore

### Backup Database

```bash
# Copy database file
cp /tmp/sanvasify.db /backup/sanvasify-$(date +%Y%m%d).db

# Or export to Parquet
duckdb /tmp/sanvasify.db -c "COPY sif_schemes TO 'backup.parquet' (FORMAT PARQUET)"
```

### Restore Database

```bash
# Restore from backup
cp /backup/sanvasify-20260126.db /tmp/sanvasify.db

# Or import from Parquet
duckdb /tmp/sanvasify.db -c "CREATE TABLE sif_schemes AS SELECT * FROM 'backup.parquet'"
```

## Troubleshooting

### "Database file not found"
- Check `db_path` in config
- Ensure directory exists and is writable
- Run server once to create database

### "Database is empty"
- Load data using the commands in "Loading Parquet Data" section
- Verify Parquet files exist in `data/nav_reports/`
- Check date range: `SELECT MIN(date), MAX(date) FROM sif_schemes`

### "Fetcher fails with 404"
- AMFI has no data for that date (weekend/holiday)
- Fetcher automatically skips and continues
- Check logs for actual errors

### "Conversion Error: Could not convert string to DECIMAL"
- Use `TRY_CAST` instead of direct casting when loading from Parquet
- This handles empty strings and invalid values gracefully
- See "Loading Parquet Data" section for correct syntax

### "Slow queries"
- Ensure indexes exist: `SHOW INDEXES FROM sif_schemes`
- Run `ANALYZE sif_schemes` to update statistics
- Check query plan: `EXPLAIN SELECT ...`

### "Database locked"
- Only one writer allowed at a time
- Stop server before running manual queries
- Use read-only mode: `duckdb -readonly /tmp/sanvasify.db`

## Data Sources

### AMFI NAV Reports

- **URL**: https://portal.amfiindia.com/SIF_DownloadNAVHistoryReport.aspx
- **Format**: Semicolon-delimited text
- **Frequency**: Daily (business days only)
- **History**: Available from ~2006
- **Rate Limit**: 60 second delay recommended

### Data Quality

- NAV values are as reported by fund houses
- Historical data may have corrections/adjustments
- Some schemes may have missing dates
- ISIN codes may change over time

## Best Practices

1. **Regular Backups**: Backup database before major updates
2. **Incremental Fetching**: Fetch new data daily/weekly
3. **Monitor Disk Space**: Parquet files grow over time
4. **Index Maintenance**: Run `ANALYZE` after large imports
5. **Log Rotation**: Configure log rotation for fetcher logs
6. **Error Handling**: Check fetcher logs for failed downloads
7. **Data Validation**: Verify data after fetching with sample queries
