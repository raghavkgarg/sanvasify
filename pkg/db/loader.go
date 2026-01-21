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
		INSERT INTO schemes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (scheme_code) DO UPDATE SET
			scheme_name = excluded.scheme_name,
			isin_div_payout_growth = excluded.isin_div_payout_growth,
			isin_div_reinvestment = excluded.isin_div_reinvestment,
			net_asset_value = excluded.net_asset_value,
			repurchase_price = excluded.repurchase_price,
			sale_price = excluded.sale_price,
			date = excluded.date,
			strategy_name = excluded.strategy_name,
			fund_house_name = excluded.fund_house_name,
			fund_type = excluded.fund_type,
			fund_company = excluded.fund_company,
			fund_strategy = excluded.fund_strategy,
			distribution_option = excluded.distribution_option,
			purchase_mode = excluded.purchase_mode
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
