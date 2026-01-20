package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/raghavkgarg/sanvasify/pkg/api"
	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

func main() {
	log.Println("Starting server...")
	if conf.Cfg.InputFile == "" {
		log.Fatal("Input file not configured")
	}

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
	go s.Start()

	log.Println("Server started, waiting for signals...")
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")
}
