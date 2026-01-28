package db

import (
	"context"
	"fmt"
	"io"
	"strconv"

	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

// parseDouble converts a string to float64, returning nil for empty strings or invalid values
func parseDouble(s string) interface{} {
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
func nullIfEmpty(s string) interface{} {
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
		INSERT INTO sif_schemes VALUES (?, ?, ?, ?, ?, ?, ?, strptime(?, '%d-%b-%Y')::DATE, ?, ?, ?, ?, ?, ?, ?)
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

	fmt.Printf("Loaded %d schemes into database\n", count)
	return nil
}
