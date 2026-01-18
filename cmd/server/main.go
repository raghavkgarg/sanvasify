package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"

	"sanvasify/data"
)

var report *data.NAVReport

func main() {
	port := flag.String("port", "8080", "port to serve on")
	dir := flag.String("dir", "web/static", "directory of static files")
	flag.Parse()

	// Load and parse the data file
	f, err := os.Open("data/SIF_DownloadNAVHistoryReport.aspx.txt")
	if err != nil {
		log.Fatalf("Failed to open data file: %v", err)
	}
	defer f.Close()

	report, err = data.ParseNAVReport(f)
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

	log.Printf("Serving %s on HTTP port: %s\n", *dir, *port)
	log.Fatal(http.ListenAndServe(":"+*port, nil))
}

// handleSchemes returns a list of all schemes for the dropdown
func handleSchemes(w http.ResponseWriter, r *http.Request) {
	schemes := make([]data.Scheme, 0)
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

	var found *data.Scheme
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
