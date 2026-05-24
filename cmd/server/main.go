package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/raghavkgarg/sanvasify/pkg/api"
	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/db"
	"github.com/raghavkgarg/sanvasify/pkg/nav"
	"github.com/raghavkgarg/sanvasify/pkg/store"
)

var logger *slog.Logger

func main() {
	// Setup logging to both file and stdout with source location
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
					// Trim path to show only relative to sanvasify/
					if idx := strings.Index(src.File, "sanvasify/"); idx != -1 {
						src.File = src.File[idx+len("sanvasify/"):]
					}
				}
			}
			return a
		},
	}
	logger = slog.New(slog.NewTextHandler(io.MultiWriter(os.Stdout, logFile), opts))
	slog.SetDefault(logger)

	logger.Info("starting server")
	ctx := context.Background()

	var dataStore store.Store
	var database *db.DB

	if conf.Cfg.UseDB {
		logger.Info("using database mode")
		var err error
		database, err = db.New(conf.Cfg.DBPath)
		if err != nil {
			logger.Error("failed to open database", "error", err)
			os.Exit(1)
		}
		defer database.Close()

		if err := database.InitSchema(ctx); err != nil {
			logger.Error("failed to initialize schema", "error", err)
			os.Exit(1)
		}

		// Check if database has data
		var rowCount int
		err = database.DB().QueryRowContext(ctx, "SELECT COUNT(*) FROM sif_schemes").Scan(&rowCount)
		if err != nil {
			logger.Error("failed to check database data", "error", err)
			os.Exit(1)
		}

		if rowCount == 0 {
			logger.Error("database is empty. Load data using: duckdb " + conf.Cfg.DBPath + " -c \"CREATE TABLE sif_schemes AS SELECT * FROM 'data/nav_reports/*.parquet'\"")
			os.Exit(1)
		}

		logger.Info("database loaded", "schemes", rowCount)
		dataStore = database
	} else {
		logger.Info("using in-memory mode")
		if conf.Cfg.InputFile == "" {
			logger.Error("input file not configured")
			os.Exit(1)
		}

		f, err := os.Open(conf.Cfg.InputFile)
		if err != nil {
			logger.Error("failed to open data file", "error", err, "file", conf.Cfg.InputFile)
			os.Exit(1)
		}
		defer f.Close()

		report, err := nav.ParseNAVReport(f)
		if err != nil {
			logger.Error("failed to parse report", "error", err)
			os.Exit(1)
		}
		logger.Info("successfully parsed report", "strategies", len(report.Strategies))

		dataStore = store.NewMemoryStore(report)
	}

	s := api.NewServer(dataStore, database.DB(), logger)

	// Start server in goroutine
	go func() {
		if err := s.Start(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	logger.Info("server started, waiting for signals")
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// Graceful shutdown with timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	logger.Info("shutting down server")
	if err := s.Shutdown(shutdownCtx); err != nil {
		logger.Error("server shutdown error", "error", err)
	}

	dataStore.Close()
	logger.Info("server stopped")
}
