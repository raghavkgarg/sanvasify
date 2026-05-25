package db

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

func GetLatestParquet(dir string) (string, error) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}

	var latestFile string
	var latestTime time.Time

	for _, entry := range files {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".parquet") {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			if info.ModTime().After(latestTime) {
				latestTime = info.ModTime()
				latestFile = filepath.Join(dir, entry.Name())
			}
		}
	}

	if latestFile == "" {
		return "", fmt.Errorf("no parquet files found in %s", dir)
	}
	return latestFile, nil
}

// parseDouble converts a string to float64, returning nil for empty strings or invalid values
func parseDouble(s string) any {
	if s == "" {
		return nil
	}
	val, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return val
}

// nullIfEmpty returns nil if the string is empty, otherwise returns the string
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (d *DB) LoadFromNAVReport(ctx context.Context, r io.Reader) error {
	report, err := nav.ParseNAVReport(r)
	if err != nil {
		return fmt.Errorf("failed to parse NAV report: %w", err)
	}

	tx, err := d.conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT OR REPLACE INTO sif_schemes VALUES (?, ?, ?, ?, ?, ?, ?, strptime(?, '%d-%b-%Y')::DATE, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	count := 0
	for _, strategy := range report.Strategies {
		for _, fundHouse := range strategy.FundHouses {
			for _, scheme := range fundHouse.Schemes {
				_, err := stmt.ExecContext(ctx,
					scheme.Code, scheme.Name,
					nullIfEmpty(scheme.ISINDivPayoutGrowth), nullIfEmpty(scheme.ISINDivReinvestment),
					parseDouble(scheme.NetAssetValue), parseDouble(scheme.RepurchasePrice), parseDouble(scheme.SalePrice),
					scheme.Date,
					nullIfEmpty(scheme.StrategyName), nullIfEmpty(scheme.FundHouseName),
					nullIfEmpty(scheme.FundType), nullIfEmpty(scheme.FundCompany),
					nullIfEmpty(scheme.FundStrategy), nullIfEmpty(scheme.DistributionOption), nullIfEmpty(scheme.PurchaseMode),
				)
				if err != nil {
					return fmt.Errorf("failed to insert scheme %s: %w", scheme.Code, err)
				}
				count++
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	slog.InfoContext(ctx, "loaded schemes into database", slog.Int("count", count))
	return nil
}

// LoadFromParquet loads data from a Parquet file into the database using DuckDB's native Parquet reader.
func (d *DB) LoadFromParquet(ctx context.Context, path string) error {
	// Explicitly specifying columns and conflict resolution to avoid Binder Errors
	// when DuckDB cannot infer the conflict target automatically.
	query := fmt.Sprintf(`
		INSERT INTO sif_schemes (
			scheme_code, scheme_name, isin_div_payout_growth, isin_div_reinvestment,
			net_asset_value, repurchase_price, sale_price, date,
			strategy_name, fund_house_name, fund_type, fund_company,
			fund_strategy, distribution_option, purchase_mode
		)
		SELECT 
			scheme_code, scheme_name, isin_div_payout_growth, isin_div_reinvestment,
			TRY_CAST(net_asset_value AS DOUBLE), TRY_CAST(repurchase_price AS DOUBLE), TRY_CAST(sale_price AS DOUBLE),
			date, strategy_name, fund_house_name, fund_type, fund_company,
			fund_strategy, distribution_option, purchase_mode
		FROM read_parquet('%s')
		ON CONFLICT (scheme_code, date) DO UPDATE SET 
			scheme_name = EXCLUDED.scheme_name,
			isin_div_payout_growth = EXCLUDED.isin_div_payout_growth,
			isin_div_reinvestment = EXCLUDED.isin_div_reinvestment,
			net_asset_value = EXCLUDED.net_asset_value,
			repurchase_price = EXCLUDED.repurchase_price,
			sale_price = EXCLUDED.sale_price,
			strategy_name = EXCLUDED.strategy_name,
			fund_house_name = EXCLUDED.fund_house_name,
			fund_type = EXCLUDED.fund_type,
			fund_company = EXCLUDED.fund_company,
			fund_strategy = EXCLUDED.fund_strategy,
			distribution_option = EXCLUDED.distribution_option,
			purchase_mode = EXCLUDED.purchase_mode
	`, path)

	res, err := d.conn.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to load parquet file: %w", err)
	}

	count, _ := res.RowsAffected()
	slog.InfoContext(ctx, "database update complete", "rows_affected", count, "source", filepath.Base(path))
	return nil
}
