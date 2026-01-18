package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

var report *nav.NAVReport

type FilterOptions struct {
	FundTypes           []string `json:"fund_types"`
	FundStrategies      []string `json:"fund_strategies"`
	FundCompanies       []string `json:"fund_companies"`
	DistributionOptions []string `json:"distribution_options"`
	PurchaseModes       []string `json:"purchase_modes"`
}

func main() {
	dir := flag.String("dir", "web/static", "directory of static files")
	flag.Parse()

	// Load and parse the data file
	f, err := os.Open(conf.Cfg.InputFile)
	if err != nil {
		log.Fatalf("Failed to open data file: %v", err)
	}
	defer f.Close()

	report, err = nav.ParseNAVReport(f)
	if err != nil {
		log.Fatalf("Failed to parse report: %v", err)
	}
	log.Printf("Successfully parsed %d strategies", len(report.Strategies))

	// Serve static files (Frontend)
	fs := http.FileServer(http.Dir(*dir))
	http.Handle("/", fs)

	// API Endpoints
	http.HandleFunc("/api/schemes", handleSchemes)
	http.HandleFunc("/api/nav", handleNAV)
	http.HandleFunc("/api/filters", handleFilters)
	http.HandleFunc("/api/search", handleSearch)

	port := strconv.Itoa(conf.Cfg.Server.Port)
	log.Printf("Serving %s on HTTP port: %s\n", *dir, port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

// handleSchemes returns a list of all schemes for the dropdown
func handleSchemes(w http.ResponseWriter, r *http.Request) {
	schemes := make([]nav.Scheme, 0)
	for _, s := range report.Strategies {
		for _, fh := range s.FundHouses {
			for _, sch := range fh.Schemes {
				schemes = append(schemes, *sch)
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	json.NewEncoder(w).Encode(schemes)
}

// handleNAV returns the details of a specific scheme by code
func handleNAV(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing scheme code", http.StatusBadRequest)
		return
	}

	var found *nav.Scheme
	// Search for the scheme in the loaded report
	for _, s := range report.Strategies {
		for _, fh := range s.FundHouses {
			for _, sch := range fh.Schemes {
				if sch.Code == code {
					found = sch
					break
				}
			}
			if found != nil {
				break
			}
		}
		if found != nil {
			break
		}
	}

	if found == nil {
		http.Error(w, "Scheme not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	json.NewEncoder(w).Encode(found)
}

// handleFilters returns unique values for the 5 filter categories
func handleFilters(w http.ResponseWriter, r *http.Request) {
	options := FilterOptions{
		FundTypes:           make([]string, 0),
		FundStrategies:      make([]string, 0),
		FundCompanies:       make([]string, 0),
		DistributionOptions: make([]string, 0),
		PurchaseModes:       make([]string, 0),
	}

	types := make(map[string]struct{})
	strategies := make(map[string]struct{})
	companies := make(map[string]struct{})
	dists := make(map[string]struct{})
	modes := make(map[string]struct{})

	for _, s := range report.Strategies {
		for _, fh := range s.FundHouses {
			for _, sch := range fh.Schemes {
				if sch.FundType != "" {
					types[sch.FundType] = struct{}{}
				}
				if sch.FundStrategy != "" {
					strategies[sch.FundStrategy] = struct{}{}
				}
				if sch.FundCompany != "" {
					companies[sch.FundCompany] = struct{}{}
				}
				if sch.DistributionOption != "" {
					dists[sch.DistributionOption] = struct{}{}
				}
				if sch.PurchaseMode != "" {
					modes[sch.PurchaseMode] = struct{}{}
				}
			}
		}
	}

	for k := range types {
		options.FundTypes = append(options.FundTypes, k)
	}
	for k := range strategies {
		options.FundStrategies = append(options.FundStrategies, k)
	}
	for k := range companies {
		options.FundCompanies = append(options.FundCompanies, k)
	}
	for k := range dists {
		options.DistributionOptions = append(options.DistributionOptions, k)
	}
	for k := range modes {
		options.PurchaseModes = append(options.PurchaseModes, k)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(options)
}

// handleSearch finds a scheme based on the 5 filter criteria
func handleSearch(w http.ResponseWriter, r *http.Request) {
	fType := r.URL.Query().Get("fund_type")
	fStrategy := r.URL.Query().Get("fund_strategy")
	fCompany := r.URL.Query().Get("fund_company")
	dist := r.URL.Query().Get("distribution_option")
	mode := r.URL.Query().Get("purchase_mode")

	var found *nav.Scheme

	for _, s := range report.Strategies {
		for _, fh := range s.FundHouses {
			for _, sch := range fh.Schemes {
				if (fType == "" || sch.FundType == fType) &&
					(fStrategy == "" || sch.FundStrategy == fStrategy) &&
					(fCompany == "" || sch.FundCompany == fCompany) &&
					(dist == "" || sch.DistributionOption == dist) &&
					(mode == "" || sch.PurchaseMode == mode) {
					found = sch
					goto Found
				}
			}
		}
	}
Found:

	if found == nil {
		http.Error(w, "No scheme found matching criteria", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	json.NewEncoder(w).Encode(found)
}
