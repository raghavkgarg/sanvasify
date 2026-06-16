package main

import (
	"context"
	"flag"
	"log/slog"
	"os"

	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/db"
	"github.com/raghavkgarg/sanvasify/pkg/fetcher"
)

func main() {
	dbPathOverride := flag.String("db", "", "Path to the database file (overrides config)")
	flag.Parse()

	// Load configuration
	if err := conf.Load("config/Config.toml"); err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	dbPath := conf.Cfg.DBPath
	if *dbPathOverride != "" {
		dbPath = *dbPathOverride
		slog.Info("Overriding database path", "path", dbPath)
	}

	// Initialize database connection
	database, err := db.New(dbPath)
	if err != nil {
		slog.Error("Failed to open database", "error", err, "path", dbPath)
		os.Exit(1)
	}
	defer database.Close()

	ctx := context.Background()

	slog.Info("Running local index fetcher job...")
	slog.Info("Fetching Nifty 500 index values from Yahoo Finance...")
	if err := fetcher.FetchIndexFromYahoo(ctx, database, "%5ECRSLDX", "NIFTY_500_TRI", "Nifty 500 TRI"); err != nil {
		slog.Error("Failed to fetch Nifty 500 index from Yahoo Finance", "error", err)
		os.Exit(1)
	}

	slog.Info("Successfully updated Nifty 500 TRI index in local database")
}
