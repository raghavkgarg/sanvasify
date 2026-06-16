// Package db provides database storage implementation using DuckDB
// for mutual fund scheme data with SQL query support.
package db

import (
	"context"
	"database/sql"
	"fmt"
	_ "github.com/duckdb/duckdb-go/v2"
	"github.com/raghavkgarg/sanvasify/pkg/store"
)

type DB struct {
	conn *sql.DB
}

func New(dbPath string) (*DB, error) {
	conn, err := sql.Open("duckdb", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{conn: conn}, nil
}

func (d *DB) DB() *sql.DB {
	return d.conn
}

func (d *DB) Close() error {
	if d.conn != nil {
		return d.conn.Close()
	}
	return nil
}

func (d *DB) InitSchema(ctx context.Context) error {
	schema := `
	CREATE TABLE IF NOT EXISTS sif_schemes (
		scheme_code VARCHAR NOT NULL, -- Part of primary key
		scheme_name VARCHAR NOT NULL, -- Should always be present
		isin_div_payout_growth VARCHAR,
		isin_div_reinvestment VARCHAR,
		net_asset_value DOUBLE,
		repurchase_price DOUBLE,
		sale_price DOUBLE,
		date DATE NOT NULL, -- Part of primary key
		strategy_name VARCHAR,
		fund_house_name VARCHAR,
		fund_type VARCHAR,
		fund_company VARCHAR,
		fund_strategy VARCHAR,
		distribution_option VARCHAR,
		purchase_mode VARCHAR
		, PRIMARY KEY (scheme_code, date)
	);
	-- Primary key (scheme_code, date) automatically creates an index.
	-- No need for explicit index creation here.
	`
	if _, err := d.conn.ExecContext(ctx, schema); err != nil {
		return err
	}

	metricsSchema := `
	CREATE TABLE IF NOT EXISTS visitors (
		visitor_id VARCHAR PRIMARY KEY,
		first_visit_at TIMESTAMP,
		last_visit_at TIMESTAMP
	);
	`
	if _, err := d.conn.ExecContext(ctx, metricsSchema); err != nil {
		return err
	}

	indicesSchema := `
	CREATE TABLE IF NOT EXISTS sif_indices (
		index_code VARCHAR NOT NULL,
		index_name VARCHAR NOT NULL,
		value DOUBLE,
		date DATE NOT NULL,
		PRIMARY KEY (index_code, date)
	);
	`
	_, err := d.conn.ExecContext(ctx, indicesSchema)
	return err
}

func (d *DB) GetAllSchemes(ctx context.Context) ([]store.Scheme, error) {
	query := `
		SELECT s.* FROM sif_schemes s
		INNER JOIN (
			SELECT scheme_code, MAX(date) as max_date
			FROM sif_schemes
			GROUP BY scheme_code
		) latest ON s.scheme_code = latest.scheme_code AND s.date = latest.max_date
	`
	rows, err := d.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemes []store.Scheme
	for rows.Next() {
		var s store.Scheme
		err := rows.Scan(
			&s.Code, &s.Name, &s.ISINDivPayoutGrowth, &s.ISINDivReinvestment,
			&s.NetAssetValue, &s.RepurchasePrice, &s.SalePrice, &s.Date,
			&s.StrategyName, &s.FundHouseName, &s.FundType, &s.FundCompany,
			&s.FundStrategy, &s.DistributionOption, &s.PurchaseMode,
		)
		if err != nil {
			return nil, err
		}
		schemes = append(schemes, s)
	}
	return schemes, rows.Err()
}

func (d *DB) GetSchemeByCode(ctx context.Context, code string) (*store.Scheme, error) {
	query := `SELECT * FROM sif_schemes WHERE scheme_code = ? ORDER BY date DESC LIMIT 1`
	row := d.conn.QueryRowContext(ctx, query, code)

	var s store.Scheme
	err := row.Scan(
		&s.Code, &s.Name, &s.ISINDivPayoutGrowth, &s.ISINDivReinvestment,
		&s.NetAssetValue, &s.RepurchasePrice, &s.SalePrice, &s.Date,
		&s.StrategyName, &s.FundHouseName, &s.FundType, &s.FundCompany,
		&s.FundStrategy, &s.DistributionOption, &s.PurchaseMode,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (d *DB) SearchSchemes(ctx context.Context, filters map[string]string) ([]store.Scheme, error) {
	query := `
		SELECT s.* FROM sif_schemes s
		INNER JOIN (
			SELECT scheme_code, MAX(date) as max_date
			FROM sif_schemes
			GROUP BY scheme_code
		) latest ON s.scheme_code = latest.scheme_code AND s.date = latest.max_date
		WHERE 1=1
	`
	args := []any{}

	if v, ok := filters[store.ColumnFundType]; ok && v != "" {
		query += ` AND s.fund_type ILIKE ?`
		args = append(args, "%"+v+"%")
	}
	if v, ok := filters[store.ColumnFundStrategy]; ok && v != "" {
		query += ` AND s.fund_strategy ILIKE ?`
		args = append(args, "%"+v+"%")
	}
	if v, ok := filters[store.ColumnFundCompany]; ok && v != "" {
		query += ` AND s.fund_company ILIKE ?`
		args = append(args, "%"+v+"%")
	}
	if v, ok := filters[store.ColumnDistributionOption]; ok && v != "" {
		query += ` AND s.distribution_option ILIKE ?`
		args = append(args, "%"+v+"%")
	}
	if v, ok := filters[store.ColumnPurchaseMode]; ok && v != "" {
		query += ` AND s.purchase_mode ILIKE ?`
		args = append(args, "%"+v+"%")
	}

	rows, err := d.conn.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemes []store.Scheme
	for rows.Next() {
		var s store.Scheme
		err := rows.Scan(
			&s.Code, &s.Name, &s.ISINDivPayoutGrowth, &s.ISINDivReinvestment,
			&s.NetAssetValue, &s.RepurchasePrice, &s.SalePrice, &s.Date,
			&s.StrategyName, &s.FundHouseName, &s.FundType, &s.FundCompany,
			&s.FundStrategy, &s.DistributionOption, &s.PurchaseMode,
		)
		if err != nil {
			return nil, err
		}
		schemes = append(schemes, s)
	}
	return schemes, rows.Err()
}

// GetUniqueValues returns distinct values for a given column.
// The column parameter must be one of the valid filter columns to prevent SQL injection.
// Returns an error if the column name is invalid or the query fails.
func (d *DB) GetUniqueValues(ctx context.Context, column string) ([]string, error) {
	// Validate column name to prevent SQL injection
	validColumns := map[string]bool{
		store.ColumnFundType:           true,
		store.ColumnFundStrategy:       true,
		store.ColumnFundCompany:        true,
		store.ColumnDistributionOption: true,
		store.ColumnPurchaseMode:       true,
	}

	if !validColumns[column] {
		return nil, fmt.Errorf("invalid column name: %s", column)
	}

	query := fmt.Sprintf(`SELECT DISTINCT %s FROM sif_schemes WHERE %s IS NOT NULL AND %s != '' ORDER BY %s`, column, column, column, column)
	rows, err := d.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var values []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, rows.Err()
}

func (d *DB) GetNAVHistory(ctx context.Context, schemeCode string) ([]store.Scheme, error) {
	query := `SELECT * FROM sif_schemes WHERE scheme_code = ? ORDER BY date ASC`
	rows, err := d.conn.QueryContext(ctx, query, schemeCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemes []store.Scheme
	for rows.Next() {
		var s store.Scheme
		err := rows.Scan(
			&s.Code, &s.Name, &s.ISINDivPayoutGrowth, &s.ISINDivReinvestment,
			&s.NetAssetValue, &s.RepurchasePrice, &s.SalePrice, &s.Date,
			&s.StrategyName, &s.FundHouseName, &s.FundType, &s.FundCompany,
			&s.FundStrategy, &s.DistributionOption, &s.PurchaseMode,
		)
		if err != nil {
			return nil, err
		}
		schemes = append(schemes, s)
	}
	return schemes, rows.Err()
}

// SchemeReturn holds a scheme's latest NAV and computed period returns.
type SchemeReturn struct {
	Code          string   `json:"scheme_code"`
	Name          string   `json:"scheme_name"`
	NAV           *float64 `json:"nav"`
	Date          string   `json:"date"`
	FundStrategy  string   `json:"fund_strategy"`
	FundCompany   string   `json:"fund_company"`
	Ret1M         *float64 `json:"ret_1m"`
	Ret3M         *float64 `json:"ret_3m"`
	RetAnnualised *float64 `json:"ret_annualised"`
	RetSI         *float64 `json:"ret_si"`
}

// GetSchemeReturns computes 1M, 3M, and annualised returns for all schemes.
func (d *DB) GetSchemeReturns(ctx context.Context, strategy string) ([]SchemeReturn, error) {
	query := `
		WITH latest AS (
			SELECT scheme_code, MAX(date) AS max_date
			FROM sif_schemes
			GROUP BY scheme_code
		),
		current_nav AS (
			SELECT s.scheme_code, s.scheme_name, s.net_asset_value, s.date,
			       s.fund_strategy, s.fund_company
			FROM sif_schemes s
			JOIN latest l ON s.scheme_code = l.scheme_code AND s.date = l.max_date
		),
		nav_1m AS (
			SELECT s.scheme_code, s.net_asset_value
			FROM sif_schemes s
			JOIN latest l ON s.scheme_code = l.scheme_code
			WHERE s.date = (
				SELECT MAX(date) FROM sif_schemes
				WHERE scheme_code = s.scheme_code AND date <= l.max_date - INTERVAL '1 month'
			)
		),
		nav_3m AS (
			SELECT s.scheme_code, s.net_asset_value
			FROM sif_schemes s
			JOIN latest l ON s.scheme_code = l.scheme_code
			WHERE s.date = (
				SELECT MAX(date) FROM sif_schemes
				WHERE scheme_code = s.scheme_code AND date <= l.max_date - INTERVAL '3 months'
			)
		),
		nav_1y AS (
			SELECT s.scheme_code, s.net_asset_value
			FROM sif_schemes s
			JOIN latest l ON s.scheme_code = l.scheme_code
			WHERE s.date = (
				SELECT MAX(date) FROM sif_schemes
				WHERE scheme_code = s.scheme_code AND date <= l.max_date - INTERVAL '1 year'
			)
		),
		nav_si AS (
			SELECT s.scheme_code, s.net_asset_value
			FROM sif_schemes s
			WHERE s.date = (
				SELECT MIN(date) FROM sif_schemes WHERE scheme_code = s.scheme_code
			)
		)
		SELECT
			c.scheme_code, c.scheme_name, c.net_asset_value, c.date,
			c.fund_strategy, c.fund_company,
			CASE WHEN m1.net_asset_value > 0 THEN (c.net_asset_value - m1.net_asset_value) / m1.net_asset_value * 100 END AS ret_1m,
			CASE WHEN m3.net_asset_value > 0 THEN (c.net_asset_value - m3.net_asset_value) / m3.net_asset_value * 100 END AS ret_3m,
			CASE WHEN y1.net_asset_value > 0 THEN (c.net_asset_value - y1.net_asset_value) / y1.net_asset_value * 100 END AS ret_annualised,
			CASE WHEN si.net_asset_value > 0 THEN (c.net_asset_value - si.net_asset_value) / si.net_asset_value * 100 END AS ret_si
		FROM current_nav c
		LEFT JOIN nav_1m m1 ON c.scheme_code = m1.scheme_code
		LEFT JOIN nav_3m m3 ON c.scheme_code = m3.scheme_code
		LEFT JOIN nav_1y y1 ON c.scheme_code = y1.scheme_code
		LEFT JOIN nav_si si ON c.scheme_code = si.scheme_code
		WHERE 1=1
	`
	args := []any{}
	if strategy != "" {
		query += ` AND c.fund_strategy ILIKE ?`
		args = append(args, "%"+strategy+"%")
	}
	query += ` ORDER BY ret_annualised DESC NULLS LAST`

	rows, err := d.conn.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SchemeReturn
	for rows.Next() {
		var r SchemeReturn
		if err := rows.Scan(&r.Code, &r.Name, &r.NAV, &r.Date,
			&r.FundStrategy, &r.FundCompany,
			&r.Ret1M, &r.Ret3M, &r.RetAnnualised, &r.RetSI); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

func (d *DB) RecordVisit(ctx context.Context, visitorID string) error {
	query := `
		INSERT INTO visitors (visitor_id, first_visit_at, last_visit_at) 
		VALUES (?, now(), now())
		ON CONFLICT (visitor_id) DO UPDATE SET last_visit_at = now()
	`
	_, err := d.conn.ExecContext(ctx, query, visitorID)
	return err
}

func (d *DB) GetUniqueVisitorCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM visitors`
	var count int
	err := d.conn.QueryRowContext(ctx, query).Scan(&count)
	return count, err
}

// IndexValue represents a single historical index value.
type IndexValue struct {
	Code  string   `json:"index_code"`
	Name  string   `json:"index_name"`
	Value *float64 `json:"value"`
	Date  string   `json:"date"`
}

// IndexReturn holds an index's latest value and calculated period returns.
type IndexReturn struct {
	Code          string   `json:"index_code"`
	Name          string   `json:"index_name"`
	Value         *float64 `json:"value"`
	Date          string   `json:"date"`
	Ret1M         *float64 `json:"ret_1m"`
	Ret3M         *float64 `json:"ret_3m"`
	RetAnnualised *float64 `json:"ret_annualised"`
	RetSI         *float64 `json:"ret_si"`
}

func (d *DB) GetIndexHistory(ctx context.Context, code string) ([]IndexValue, error) {
	query := `SELECT index_code, index_name, value, date FROM sif_indices WHERE index_code = ? ORDER BY date ASC`
	rows, err := d.conn.QueryContext(ctx, query, code)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []IndexValue
	for rows.Next() {
		var v IndexValue
		var dateStr string
		err := rows.Scan(&v.Code, &v.Name, &v.Value, &dateStr)
		if err != nil {
			return nil, err
		}
		if len(dateStr) > 10 {
			dateStr = dateStr[:10]
		}
		v.Date = dateStr
		history = append(history, v)
	}
	return history, rows.Err()
}

func (d *DB) GetIndexReturns(ctx context.Context, code string) (*IndexReturn, error) {
	query := `
		WITH latest AS (
			SELECT index_code, MAX(date) AS max_date
			FROM sif_indices
			WHERE index_code = ?
			GROUP BY index_code
		),
		current_val AS (
			SELECT s.index_code, s.index_name, s.value, s.date
			FROM sif_indices s
			JOIN latest l ON s.index_code = l.index_code AND s.date = l.max_date
		),
		val_1m AS (
			SELECT s.index_code, s.value
			FROM sif_indices s
			JOIN latest l ON s.index_code = l.index_code
			WHERE s.date = (
				SELECT MAX(date) FROM sif_indices
				WHERE index_code = s.index_code AND date <= l.max_date - INTERVAL '1 month'
			)
		),
		val_3m AS (
			SELECT s.index_code, s.value
			FROM sif_indices s
			JOIN latest l ON s.index_code = l.index_code
			WHERE s.date = (
				SELECT MAX(date) FROM sif_indices
				WHERE index_code = s.index_code AND date <= l.max_date - INTERVAL '3 months'
			)
		),
		val_1y AS (
			SELECT s.index_code, s.value
			FROM sif_indices s
			JOIN latest l ON s.index_code = l.index_code
			WHERE s.date = (
				SELECT MAX(date) FROM sif_indices
				WHERE index_code = s.index_code AND date <= l.max_date - INTERVAL '1 year'
			)
		),
		val_si AS (
			SELECT s.index_code, s.value
			FROM sif_indices s
			WHERE s.date = (
				SELECT MIN(date) FROM sif_indices WHERE index_code = s.index_code
			)
		)
		SELECT
			c.index_code, c.index_name, c.value, c.date,
			CASE WHEN m1.value > 0 THEN (c.value - m1.value) / m1.value * 100 END AS ret_1m,
			CASE WHEN m3.value > 0 THEN (c.value - m3.value) / m3.value * 100 END AS ret_3m,
			CASE WHEN y1.value > 0 THEN (c.value - y1.value) / y1.value * 100 END AS ret_annualised,
			CASE WHEN si.value > 0 THEN (c.value - si.value) / si.value * 100 END AS ret_si
		FROM current_val c
		LEFT JOIN val_1m m1 ON c.index_code = m1.index_code
		LEFT JOIN val_3m m3 ON c.index_code = m3.index_code
		LEFT JOIN val_1y y1 ON c.index_code = y1.index_code
		LEFT JOIN val_si si ON c.index_code = si.index_code
	`
	row := d.conn.QueryRowContext(ctx, query, code)
	var r IndexReturn
	var dateStr string
	err := row.Scan(&r.Code, &r.Name, &r.Value, &dateStr, &r.Ret1M, &r.Ret3M, &r.RetAnnualised, &r.RetSI)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(dateStr) > 10 {
		dateStr = dateStr[:10]
	}
	r.Date = dateStr
	return &r, nil
}

func (d *DB) UpsertIndexValue(ctx context.Context, code, name string, value float64, date string) error {
	query := `
		INSERT INTO sif_indices (index_code, index_name, value, date)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (index_code, date) DO UPDATE SET value = excluded.value, index_name = excluded.index_name
	`
	_, err := d.conn.ExecContext(ctx, query, code, name, value, date)
	return err
}
