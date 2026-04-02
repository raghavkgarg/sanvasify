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

	// Calculate incremental date range based on existing DB data
	fromDate, toDate, err := f.CalculateIncrementalRange(conf.Cfg.DBPath, conf.Cfg.Fetcher.FromDate)
	if err != nil {
		if strings.Contains(err.Error(), "already up to date") {
			slog.Info(err.Error())
			return
		}
		slog.Error("failed to determine date range", "error", err)
		os.Exit(1)
	}

	slog.Info("fetching date range", "from", fromDate.Format("2006-01-02"), "to", toDate.Format("2006-01-02"))

	if err := f.FetchRange(context.Background(), fromDate, toDate, conf.Cfg.Fetcher.DelaySeconds); err != nil {
		slog.Error("fetch range failed", "error", err)
		os.Exit(1)
	}

	slog.Info("fetch completed successfully")
}
