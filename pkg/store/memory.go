package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

type MemoryStore struct {
	report *nav.NAVReport
}

// NewMemoryStore creates a new in-memory store from a parsed NAV report.
func NewMemoryStore(report *nav.NAVReport) *MemoryStore {
	return &MemoryStore{report: report}
}

func (m *MemoryStore) GetAllSchemes(ctx context.Context) ([]Scheme, error) {
	var schemes []Scheme
	for _, strategy := range m.report.Strategies {
		for _, fundHouse := range strategy.FundHouses {
			for _, s := range fundHouse.Schemes {
				schemes = append(schemes, navSchemeToStoreScheme(s))
			}
		}
	}
	return schemes, nil
}

func (m *MemoryStore) GetSchemeByCode(ctx context.Context, code string) (*Scheme, error) {
	for _, strategy := range m.report.Strategies {
		for _, fundHouse := range strategy.FundHouses {
			for _, s := range fundHouse.Schemes {
				if s.Code == code {
					scheme := navSchemeToStoreScheme(s)
					return &scheme, nil
				}
			}
		}
	}
	return nil, nil
}

func (m *MemoryStore) SearchSchemes(ctx context.Context, filters map[string]string) ([]Scheme, error) {
	var schemes []Scheme
	for _, strategy := range m.report.Strategies {
		for _, fundHouse := range strategy.FundHouses {
			for _, s := range fundHouse.Schemes {
				if matchesFilters(s, filters) {
					schemes = append(schemes, navSchemeToStoreScheme(s))
				}
			}
		}
	}
	return schemes, nil
}

func (m *MemoryStore) GetUniqueValues(ctx context.Context, column string) ([]string, error) {
	uniqueMap := make(map[string]bool)
	for _, strategy := range m.report.Strategies {
		for _, fundHouse := range strategy.FundHouses {
			for _, s := range fundHouse.Schemes {
				var value string
				switch column {
				case ColumnFundType:
					value = s.FundType
				case ColumnFundStrategy:
					value = s.FundStrategy
				case ColumnFundCompany:
					value = s.FundCompany
				case ColumnDistributionOption:
					value = s.DistributionOption
				case ColumnPurchaseMode:
					value = s.PurchaseMode
				}
				if value != "" {
					uniqueMap[value] = true
				}
			}
		}
	}

	var values []string
	for v := range uniqueMap {
		values = append(values, v)
	}
	return values, nil
}

func (m *MemoryStore) GetNAVHistory(ctx context.Context, schemeCode string) ([]Scheme, error) {
	return nil, fmt.Errorf("NAV history not supported in memory store mode - use database mode")
}

func (m *MemoryStore) Close() error {
	return nil
}

func navSchemeToStoreScheme(s *nav.Scheme) Scheme {
	return Scheme{
		Code:                s.Code,
		Name:                s.Name,
		ISINDivPayoutGrowth: s.ISINDivPayoutGrowth,
		ISINDivReinvestment: s.ISINDivReinvestment,
		NetAssetValue:       s.NetAssetValue,
		RepurchasePrice:     s.RepurchasePrice,
		SalePrice:           s.SalePrice,
		Date:                s.Date,
		StrategyName:        s.StrategyName,
		FundHouseName:       s.FundHouseName,
		FundType:            s.FundType,
		FundCompany:         s.FundCompany,
		FundStrategy:        s.FundStrategy,
		DistributionOption:  s.DistributionOption,
		PurchaseMode:        s.PurchaseMode,
	}
}

func matchesFilters(s *nav.Scheme, filters map[string]string) bool {
	for key, value := range filters {
		if value == "" {
			continue
		}
		var fieldValue string
		switch key {
		case ColumnFundType:
			fieldValue = s.FundType
		case ColumnFundStrategy:
			fieldValue = s.FundStrategy
		case ColumnFundCompany:
			fieldValue = s.FundCompany
		case ColumnDistributionOption:
			fieldValue = s.DistributionOption
		case ColumnPurchaseMode:
			fieldValue = s.PurchaseMode
		default:
			continue
		}
		if !strings.Contains(strings.ToLower(fieldValue), strings.ToLower(value)) {
			return false
		}
	}
	return true
}
