package nav

import (
	"bufio"
	"io"
	"strings"
)

// Scheme represents a single mutual fund scheme row from the report.
type Scheme struct {
	Code                string `json:"scheme_code"`
	Name                string `json:"scheme_name"`
	ISINDivPayoutGrowth string `json:"isin_div_payout_growth"`
	ISINDivReinvestment string `json:"isin_div_reinvestment"`
	NetAssetValue       string `json:"net_asset_value"`
	RepurchasePrice     string `json:"repurchase_price"`
	SalePrice           string `json:"sale_price"`
	Date                string `json:"date"`

	// Context fields populated during parsing for easier flat searching/display
	StrategyName       string `json:"strategy_name,omitempty"`
	FundHouseName      string `json:"fund_house_name,omitempty"`
	FundType           string `json:"fund_type,omitempty"`
	FundCompany        string `json:"fund_company,omitempty"`
	FundStrategy       string `json:"fund_strategy,omitempty"`
	DistributionOption string `json:"distribution_option,omitempty"`
	PurchaseMode       string `json:"purchase_mode,omitempty"`
}

// FundHouse represents a mutual fund house (e.g., "ITI Mutual Fund") containing multiple schemes.
type FundHouse struct {
	Name    string    `json:"fund_house_name"`
	Schemes []*Scheme `json:"schemes"`
}

// Strategy represents an investment strategy category (e.g., "Open Ended Schemes (...)") containing multiple fund houses.
type Strategy struct {
	Name       string       `json:"strategy_name"`
	FundHouses []*FundHouse `json:"fund_houses"`
}

// NAVReport represents the entire parsed data structure.
type NAVReport struct {
	Strategies []*Strategy `json:"strategies"`
}

// ParseNAVReport parses the raw text data from the reader into a structured NAVReport.
func ParseNAVReport(r io.Reader) (*NAVReport, error) {
	scanner := bufio.NewScanner(r)
	report := &NAVReport{
		Strategies: make([]*Strategy, 0),
	}

	var currentStrategy *Strategy
	var currentFundHouse *FundHouse

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		// Skip the header line
		if strings.HasPrefix(line, "Scheme Code;") {
			continue
		}

		// Check if it's a data row (contains semicolons)
		if strings.Contains(line, ";") {
			parts := strings.Split(line, ";")
			// Ensure we have enough parts (header has 8 columns)
			if len(parts) >= 8 {
				scheme := &Scheme{
					Code:                parts[0],
					Name:                parts[1],
					ISINDivPayoutGrowth: parts[2],
					ISINDivReinvestment: parts[3],
					NetAssetValue:       parts[4],
					RepurchasePrice:     parts[5],
					SalePrice:           parts[6],
					Date:                parts[7],
				}

				scheme.DistributionOption = parseDistributionOption(scheme.Name)
				scheme.PurchaseMode = parsePurchaseMode(scheme.Name)

				// Populate context fields if context exists
				if currentStrategy != nil {
					scheme.StrategyName = currentStrategy.Name
					scheme.FundType = parseFundType(currentStrategy.Name)
					scheme.FundStrategy = parseFundStrategy(currentStrategy.Name)
				}
				if currentFundHouse != nil {
					scheme.FundHouseName = currentFundHouse.Name
					scheme.FundCompany = currentFundHouse.Name
					currentFundHouse.Schemes = append(currentFundHouse.Schemes, scheme)
				}
			}
			continue
		}

		// It's a category header (Strategy or Fund House)
		// Heuristic: Strategies in this file format contain parentheses "( ... )"
		if strings.Contains(line, "(") && strings.Contains(line, ")") {
			currentStrategy = &Strategy{
				Name:       line,
				FundHouses: make([]*FundHouse, 0),
			}
			report.Strategies = append(report.Strategies, currentStrategy)
			currentFundHouse = nil // Reset fund house context when strategy changes
		} else {
			// Assume it's a Fund House (e.g., "ITI Mutual Fund")
			if currentStrategy != nil {
				currentFundHouse = &FundHouse{
					Name:    line,
					Schemes: make([]*Scheme, 0),
				}
				currentStrategy.FundHouses = append(currentStrategy.FundHouses, currentFundHouse)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return report, nil
}

// Search filters the report for schemes matching the given strategy and fund house names.
// Empty strings for strategyQuery or fundHouseQuery mean "match any".
// The search is case-insensitive.
func (r *NAVReport) Search(strategyQuery, fundHouseQuery string) []Scheme {
	var results []Scheme
	strategyQuery = strings.ToLower(strings.TrimSpace(strategyQuery))
	fundHouseQuery = strings.ToLower(strings.TrimSpace(fundHouseQuery))

	for _, s := range r.Strategies {
		for _, fh := range s.FundHouses {
			for _, scheme := range fh.Schemes {
				matchStrategy := strategyQuery == "" || strings.Contains(strings.ToLower(scheme.StrategyName), strategyQuery)
				matchFundHouse := fundHouseQuery == "" || strings.Contains(strings.ToLower(scheme.FundHouseName), fundHouseQuery)

				if matchStrategy && matchFundHouse {
					results = append(results, *scheme)
				}
			}
		}
	}
	return results
}

func parseFundType(strategyName string) string {
	lower := strings.ToLower(strategyName)
	if strings.Contains(lower, "open ended") {
		return "Open Ended Fund"
	}
	if strings.Contains(lower, "close ended") {
		return "Close Ended Fund"
	}
	if strings.Contains(lower, "interval fund") {
		return "Interval Fund Schemes"
	}
	return ""
}

func parseFundStrategy(strategyName string) string {
	start := strings.Index(strategyName, "(")
	end := strings.LastIndex(strategyName, ")")
	if start != -1 && end != -1 && end > start {
		content := strategyName[start+1 : end]
		parts := strings.Split(content, " - ")
		if len(parts) > 1 {
			return strings.TrimSpace(parts[len(parts)-1])
		}
		return strings.TrimSpace(content)
	}
	return ""
}

func parseDistributionOption(schemeName string) string {
	lower := strings.ToLower(schemeName)
	if strings.Contains(lower, "growth") {
		return "Growth"
	}
	// IDCW Option is equal to Distribution Option : Income
	if strings.Contains(lower, "idcw") || strings.Contains(lower, "income") || strings.Contains(lower, "dividend") {
		return "Income"
	}
	return ""
}

func parsePurchaseMode(schemeName string) string {
	lower := strings.ToLower(schemeName)
	if strings.Contains(lower, "direct") {
		return "Direct Plan"
	}
	if strings.Contains(lower, "regular") {
		return "Regular Plan"
	}
	return ""
}
