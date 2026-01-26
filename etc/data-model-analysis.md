# Data Model Analysis: Text File vs Database

## Current State

### Text File Mode (Original)
- **Data Source**: Single NAV report text file (e.g., `nav_report_2026-01-18.txt`)
- **Data Snapshot**: One day's worth of NAV data
- **Scheme Count**: ~30 unique schemes (based on current test data)
- **Date Coverage**: Single date (e.g., "18-Jan-2026")
- **Storage**: In-memory after parsing

### Database Mode (Current Implementation)
- **Data Source**: Parquet files loaded into DuckDB
- **Data Snapshot**: 3 months of historical data (Oct 2025 - Jan 2026)
- **Total Records**: 1,414 rows
- **Unique Schemes**: 30 schemes
- **Unique Dates**: 69 dates (business days over 3 months)
- **Storage**: Persistent SQLite/DuckDB file

## Key Difference: Historical Data

The database now contains **multiple NAV values per scheme** - one for each business day:

```
Scheme SIF-1: 68 occurrences (68 different dates)
Scheme SIF-2: 68 occurrences
Scheme SIF-3: 68 occurrences
...
```

## Impact on Application Behavior

### 1. **GetAllSchemes() - BREAKING CHANGE**

**Text File Mode:**
```
Returns: 30 schemes (one per scheme_code)
```

**Database Mode:**
```
Returns: 1,414 schemes (30 schemes × ~68 dates each)
```

**Problem:** The API will return duplicate scheme codes with different dates/NAV values.

**Frontend Impact:**
- `/api/schemes` will return 1,414 rows instead of 30
- UI will show the same scheme multiple times
- Filters will have duplicate entries

### 2. **GetSchemeByCode() - RETURNS ARBITRARY DATE**

**Text File Mode:**
```sql
Returns: Single scheme with NAV for that day
```

**Database Mode:**
```sql
SELECT * FROM sif_schemes WHERE scheme_code = 'SIF-1'
Returns: First matching row (arbitrary date)
```

**Problem:** Without ORDER BY, you get a random date's NAV value.

### 3. **SearchSchemes() - RETURNS DUPLICATES**

**Text File Mode:**
```
Returns: Unique schemes matching filters
```

**Database Mode:**
```
Returns: All historical records matching filters
```

**Problem:** Same scheme appears multiple times with different dates.

### 4. **GetUniqueValues() - WORKS CORRECTLY**

This method uses `SELECT DISTINCT`, so it's unaffected:
```sql
SELECT DISTINCT fund_type FROM sif_schemes
```

## Required Fixes

### Option 1: Latest NAV Only (Recommended)

Modify queries to return only the most recent NAV for each scheme:

```sql
-- GetAllSchemes
SELECT * FROM sif_schemes 
WHERE (scheme_code, date) IN (
    SELECT scheme_code, MAX(date) 
    FROM sif_schemes 
    GROUP BY scheme_code
)

-- GetSchemeByCode
SELECT * FROM sif_schemes 
WHERE scheme_code = ? 
ORDER BY date DESC 
LIMIT 1

-- SearchSchemes
SELECT * FROM sif_schemes 
WHERE fund_type ILIKE ? 
  AND (scheme_code, date) IN (
      SELECT scheme_code, MAX(date) 
      FROM sif_schemes 
      GROUP BY scheme_code
  )
```

### Option 2: Add Date Filter to API

Add optional `date` parameter to API endpoints:
```
GET /api/schemes?date=2026-01-18
GET /api/nav?code=SIF-1&date=2026-01-18
```

### Option 3: Separate Historical API

Keep current API for latest data, add new endpoints for historical:
```
GET /api/schemes          -> Latest NAV only
GET /api/schemes/history  -> All historical data
GET /api/nav/history?code=SIF-1  -> Time series for scheme
```

## Recommended Approach

**Use Option 1** for immediate compatibility:
1. Update all DB queries to return latest NAV only
2. Maintains backward compatibility with existing frontend
3. No API changes required
4. Historical data available for future features

**Future Enhancement (Option 3):**
- Add `/api/nav/history?code=SIF-1` for time series charts
- Add `/api/schemes/compare?codes=SIF-1,SIF-2` for multi-scheme comparison
- Keep main API simple and fast

## Schema Consideration

The current schema stores `date` as VARCHAR. For proper date handling:

```sql
-- Convert date column to proper DATE type
ALTER TABLE sif_schemes ADD COLUMN date_parsed DATE;
UPDATE sif_schemes SET date_parsed = strptime(date, '%d-%b-%Y');
ALTER TABLE sif_schemes DROP COLUMN date;
ALTER TABLE sif_schemes RENAME COLUMN date_parsed TO date;
```

This enables:
- Proper date sorting: `ORDER BY date DESC`
- Date range queries: `WHERE date BETWEEN ? AND ?`
- Date functions: `MAX(date)`, `DATE_DIFF()`, etc.
