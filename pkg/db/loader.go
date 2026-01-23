package db

import (
	"context"
	"fmt"
	"io"

	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

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
					scheme.Code, scheme.Name, scheme.ISINDivPayoutGrowth, scheme.ISINDivReinvestment,
					scheme.NetAssetValue, scheme.RepurchasePrice, scheme.SalePrice, scheme.Date,
					scheme.StrategyName, scheme.FundHouseName, scheme.FundType, scheme.FundCompany,
					scheme.FundStrategy, scheme.DistributionOption, scheme.PurchaseMode,
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
