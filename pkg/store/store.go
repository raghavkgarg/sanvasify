// Package store defines the data storage interface and implementations
// for mutual fund scheme data. It provides both in-memory and database-backed storage.
package store

import (
	"context"
)

type Scheme struct {
	Code                string `json:"scheme_code"`
	Name                string `json:"scheme_name"`
	ISINDivPayoutGrowth string `json:"isin_div_payout_growth"`
	ISINDivReinvestment string `json:"isin_div_reinvestment"`
	NetAssetValue       string `json:"net_asset_value"`
	RepurchasePrice     string `json:"repurchase_price"`
	SalePrice           string `json:"sale_price"`
	Date                string `json:"date"`
	StrategyName        string `json:"strategy_name,omitempty"`
	FundHouseName       string `json:"fund_house_name,omitempty"`
	FundType            string `json:"fund_type,omitempty"`
	FundCompany         string `json:"fund_company,omitempty"`
	FundStrategy        string `json:"fund_strategy,omitempty"`
	DistributionOption  string `json:"distribution_option,omitempty"`
	PurchaseMode        string `json:"purchase_mode,omitempty"`
}

// Store defines the interface for accessing mutual fund scheme data.
// Implementations can use in-memory storage or database backends.
type Store interface {
	GetAllSchemes(ctx context.Context) ([]Scheme, error)
	GetSchemeByCode(ctx context.Context, code string) (*Scheme, error)
	SearchSchemes(ctx context.Context, filters map[string]string) ([]Scheme, error)
	GetUniqueValues(ctx context.Context, column string) ([]string, error)
	Close() error
}
