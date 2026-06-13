package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"os"
	"path/filepath"
	"sort"

	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/db"
)

func main() {
	// Define command line flags
	reportPath := flag.String("file", "", "Path to the NAV report text file to load")
	dbPathOverride := flag.String("db", "", "Path to the database file (overrides config)")
	flag.Parse()

	// If no file is specified, automatically find the latest report
	if *reportPath == "" {
		latest, err := findLatestReport("data/nav_reports")
		if err != nil {
			slog.Error("No file specified and could not find latest report", "error", err)
			os.Exit(1)
		}
		*reportPath = latest
	}

	slog.Info("Picked report file for database update", "path", *reportPath)

	// Load application configuration
	if err := conf.Load("config/Config.toml"); err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	// Use overridden db path if provided
	dbPath := conf.Cfg.DBPath
	if *dbPathOverride != "" {
		dbPath = *dbPathOverride
		slog.Info("Overriding database path from command line", "path", dbPath)
	}

	// Initialize database connection using config or command line override
	database, err := db.New(dbPath)
	if err != nil {
		slog.Error("Failed to open database", "error", err, "path", dbPath)
		os.Exit(1)
	}
	defer database.Close()

	ctx := context.Background()

	// Ensure the database schema is initialized
	if err := database.InitSchema(ctx); err != nil {
		slog.Error("Failed to initialize schema", "error", err)
		os.Exit(1)
	}

	ext := filepath.Ext(*reportPath)
	slog.Info("Starting database update", "picked_file", *reportPath, "type", ext)

	// Handle Parquet vs Text files
	if ext == ".parquet" {
		// Assuming database.LoadFromParquet is implemented in pkg/db
		// DuckDB can load parquet directly: "INSERT OR REPLACE INTO sif_schemes SELECT * FROM read_parquet('path')"
		if err := database.LoadFromParquet(ctx, *reportPath); err != nil {
			slog.Error("Error during Parquet data load", "error", err)
			os.Exit(1)
		}
	} else {
		f, err := os.Open(*reportPath)
		if err != nil {
			slog.Error("Failed to open report file", "path", *reportPath, "error", err)
			os.Exit(1)
		}
		defer f.Close()

		if err := database.LoadFromNAVReport(ctx, f); err != nil {
			slog.Error("Error during text data load", "error", err)
			os.Exit(1)
		}
	}

	slog.Info("Database loading completed successfully")
}

// findLatestReport looks for the newest nav_data file in the given directory.
func findLatestReport(dir string) (string, error) {
	// Match both parquet and txt patterns
	patterns := []string{"nav_data_*.parquet", "nav_data_*.txt"}
	var allFiles []string

	for _, p := range patterns {
		matches, _ := filepath.Glob(filepath.Join(dir, p))
		allFiles = append(allFiles, matches...)
	}

	if len(allFiles) == 0 {
		return "", errors.New("no report files found in " + dir)
	}

	// Alphabetical sort on your naming convention (YYYY-MM-DD)
	// will correctly put the latest date at the end of the slice.
	sort.Strings(allFiles)
	latest := allFiles[len(allFiles)-1]

	return latest, nil
}
