package fetcher

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"
)

// FetchRange downloads NAV reports for a date range from AMFI.
// It automatically skips weekends and holidays where no data is available.
// A configurable delay is enforced between requests to avoid overloading the server.
// Errors for individual dates are logged but don't stop the entire process.
func (f *Fetcher) FetchRange(ctx context.Context, fromDate, toDate time.Time, delaySeconds int) error {
	parquetPath := f.buildParquetPath(fromDate, toDate)
	current := fromDate
	count := 0

	for !current.After(toDate) {
		if count > 0 {
			slog.Info("waiting before next fetch", "delay_seconds", delaySeconds)
			time.Sleep(time.Duration(delaySeconds) * time.Second)
		}

		slog.Info("fetching NAV data", "date", current.Format("2006-01-02"))
		_, err := f.FetchAndConvert(ctx, current, parquetPath)
		if err != nil {
			slog.Error("failed to fetch", "date", current.Format("2006-01-02"), "error", err)
		}

		current = current.AddDate(0, 0, 1)
		count++
	}

	slog.Info("fetch range completed", "dates_processed", count, "parquet_file", parquetPath)
	return nil
}

func (f *Fetcher) buildParquetPath(fromDate, toDate time.Time) string {
	filename := fmt.Sprintf("nav_data_%s_to_%s.parquet",
		fromDate.Format("2006-01-02"),
		toDate.Format("2006-01-02"))
	return filepath.Join(f.dataDir, filename)
}
