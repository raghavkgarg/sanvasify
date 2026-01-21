package api

import (
	"strings"

	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

type FilterOptions struct {
	FundTypes           []string `json:"fund_types"`
	FundStrategies      []string `json:"fund_strategies"`
	FundCompanies       []string `json:"fund_companies"`
	DistributionOptions []string `json:"distribution_options"`
	PurchaseModes       []string `json:"purchase_modes"`
}

type Store struct {
	report              *nav.NAVReport
	schemesByCode       map[string]*nav.Scheme
	fundTypes           map[string]struct{}
	fundStrategies      map[string]struct{}
	fundCompanies       map[string]struct{}
	distributionOptions map[string]struct{}
	purchaseModes       map[string]struct{}
}

func NewStore(report *nav.NAVReport) *Store {
	s := &Store{
		report:              report,
		schemesByCode:       make(map[string]*nav.Scheme),
		fundTypes:           make(map[string]struct{}),
		fundStrategies:      make(map[string]struct{}),
		fundCompanies:       make(map[string]struct{}),
		distributionOptions: make(map[string]struct{}),
		purchaseModes:       make(map[string]struct{}),
	}

	for _, strategy := range report.Strategies {
		for _, fh := range strategy.FundHouses {
			for _, sch := range fh.Schemes {
				sch.FundType = strings.TrimSpace(sch.FundType)
				sch.FundStrategy = strings.TrimSpace(sch.FundStrategy)
				sch.FundCompany = strings.TrimSpace(sch.FundCompany)
				sch.DistributionOption = strings.TrimSpace(sch.DistributionOption)
				sch.PurchaseMode = strings.TrimSpace(sch.PurchaseMode)

				s.schemesByCode[sch.Code] = sch

				if sch.FundType != "" {
					s.fundTypes[sch.FundType] = struct{}{}
				}
				if sch.FundStrategy != "" {
					s.fundStrategies[sch.FundStrategy] = struct{}{}
				}
				if sch.FundCompany != "" {
					s.fundCompanies[sch.FundCompany] = struct{}{}
				}
				if sch.DistributionOption != "" {
					s.distributionOptions[sch.DistributionOption] = struct{}{}
				}
				if sch.PurchaseMode != "" {
					s.purchaseModes[sch.PurchaseMode] = struct{}{}
				}
			}
		}
	}

	return s
}

func (s *Store) GetAllSchemes() []*nav.Scheme {
	schemes := make([]*nav.Scheme, 0, len(s.schemesByCode))
	for _, sch := range s.schemesByCode {
		schemes = append(schemes, sch)
	}
	return schemes
}

func (s *Store) GetSchemeByCode(code string) *nav.Scheme {
	return s.schemesByCode[code]
}

func (s *Store) GetFilterOptions() *FilterOptions {
	options := &FilterOptions{
		FundTypes:           make([]string, 0, len(s.fundTypes)),
		FundStrategies:      make([]string, 0, len(s.fundStrategies)),
		FundCompanies:       make([]string, 0, len(s.fundCompanies)),
		DistributionOptions: make([]string, 0, len(s.distributionOptions)),
		PurchaseModes:       make([]string, 0, len(s.purchaseModes)),
	}

	for k := range s.fundTypes {
		options.FundTypes = append(options.FundTypes, k)
	}
	for k := range s.fundStrategies {
		options.FundStrategies = append(options.FundStrategies, k)
	}
	for k := range s.fundCompanies {
		options.FundCompanies = append(options.FundCompanies, k)
	}
	for k := range s.distributionOptions {
		options.DistributionOptions = append(options.DistributionOptions, k)
	}
	for k := range s.purchaseModes {
		options.PurchaseModes = append(options.PurchaseModes, k)
	}

	return options
}

func (s *Store) SearchSchemes(fType, fStrategy, fCompany, dist, mode string) []*nav.Scheme {
	fType = strings.TrimSpace(fType)
	fStrategy = strings.TrimSpace(fStrategy)
	fCompany = strings.TrimSpace(fCompany)
	dist = strings.TrimSpace(dist)
	mode = strings.TrimSpace(mode)

	schemes := make([]*nav.Scheme, 0)
	for _, sch := range s.schemesByCode {
		if (fType == "" || sch.FundType == fType) &&
			(fStrategy == "" || sch.FundStrategy == fStrategy) &&
			(fCompany == "" || sch.FundCompany == fCompany) &&
			(dist == "" || sch.DistributionOption == dist) &&
			(mode == "" || sch.PurchaseMode == mode) {
			schemes = append(schemes, sch)
		}
	}
	return schemes
}
