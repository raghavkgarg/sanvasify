// Package db provides database storage implementation using DuckDB
// for mutual fund scheme data with SQL query support.
package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/raghavkgarg/sanvasify/pkg/store"
	_ "github.com/duckdb/duckdb-go/v2"
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
	return d.conn.Close()
}

func (d *DB) InitSchema(ctx context.Context) error {
	schema := `
	CREATE TABLE IF NOT EXISTS sif_schemes (
		scheme_code VARCHAR NOT NULL,
		scheme_name VARCHAR NOT NULL,
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
	CREATE INDEX IF NOT EXISTS idx_scheme_code ON sif_schemes(scheme_code);
	CREATE INDEX IF NOT EXISTS idx_date ON sif_schemes(date);
	`
	_, err := d.conn.ExecContext(ctx, schema)
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
	args := []interface{}{}

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
		store.ColumnFundType:          true,
		store.ColumnFundStrategy:      true,
		store.ColumnFundCompany:       true,
		store.ColumnDistributionOption: true,
		store.ColumnPurchaseMode:      true,
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
