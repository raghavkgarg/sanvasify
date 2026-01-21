package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/fetcher"
)

func main() {
	// Setup logging
	logFile, err := os.Create(fmt.Sprintf("%s.%v", conf.Cfg.LogFile, time.Now().Unix()))
	if err != nil {
		fmt.Printf("Couldn't create log file: %v\n", err)
		os.Exit(1)
	}
	defer logFile.Close()

	opts := &slog.HandlerOptions{
		AddSource: true,
		Level:     slog.LevelInfo,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == slog.SourceKey {
				if src, ok := a.Value.Any().(*slog.Source); ok {
					if idx := strings.Index(src.File, "sanvasify/"); idx != -1 {
						src.File = src.File[idx+len("sanvasify/"):]
					}
				}
			}
			return a
		},
	}
	logger := slog.New(slog.NewTextHandler(io.MultiWriter(os.Stdout, logFile), opts))
	slog.SetDefault(logger)

	slog.Info("starting NAV data fetch")

	f, err := fetcher.New(
		conf.Cfg.Fetcher.BaseURL,
		conf.Cfg.Fetcher.DataDir,
		conf.Cfg.Fetcher.RawDir,
	)
	if err != nil {
		slog.Error("failed to create fetcher", "error", err)
		os.Exit(1)
	}

	// Parse dates from config
	fromDate, err := time.Parse("2006-01-02", conf.Cfg.Fetcher.FromDate)
	if err != nil {
		slog.Error("failed to parse from_date", "error", err, "value", conf.Cfg.Fetcher.FromDate)
		os.Exit(1)
	}

	toDate, err := time.Parse("2006-01-02", conf.Cfg.Fetcher.ToDate)
	if err != nil {
		slog.Error("failed to parse to_date", "error", err, "value", conf.Cfg.Fetcher.ToDate)
		os.Exit(1)
	}

	slog.Info("fetching date range", "from", fromDate.Format("2006-01-02"), "to", toDate.Format("2006-01-02"))
	
	if err := f.FetchRange(context.Background(), fromDate, toDate); err != nil {
		slog.Error("fetch range failed", "error", err)
		os.Exit(1)
	}

	slog.Info("fetch completed successfully")
}
