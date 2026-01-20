package main

import (
	"log"
	"os"

	"github.com/raghavkgarg/sanvasify/pkg/api"
	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

func main() {
	// Load and parse the data file
	f, err := os.Open(conf.Cfg.InputFile)
	if err != nil {
		log.Fatalf("Failed to open data file: %v", err)
	}
	defer f.Close()

	report, err := nav.ParseNAVReport(f)
	if err != nil {
		log.Fatalf("Failed to parse report: %v", err)
	}
	log.Printf("Successfully parsed %d strategies", len(report.Strategies))

	s := api.NewServer(report)
	s.Start()
}
