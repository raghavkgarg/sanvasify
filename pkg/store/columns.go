package store

// Column names for filtering and querying schemes
const (
	ColumnFundType           = "fund_type"
	ColumnFundStrategy       = "fund_strategy"
	ColumnFundCompany        = "fund_company"
	ColumnDistributionOption = "distribution_option"
	ColumnPurchaseMode       = "purchase_mode"
)

// FilterColumns returns all available filter column names
var FilterColumns = []string{
	ColumnFundType,
	ColumnFundStrategy,
	ColumnFundCompany,
	ColumnDistributionOption,
	ColumnPurchaseMode,
}
