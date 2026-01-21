package fetcher

import (
	"context"
	"log/slog"
	"time"
)

// FetchRange downloads NAV reports for a date range from AMFI.
// It automatically skips weekends and holidays where no data is available.
// A 60-second delay is enforced between requests to avoid overloading the server.
// Errors for individual dates are logged but don't stop the entire process.
func (f *Fetcher) FetchRange(ctx context.Context, fromDate, toDate time.Time) error {
	current := fromDate
	count := 0

	for !current.After(toDate) {
		if count > 0 {
			slog.Info("waiting before next fetch", "delay_seconds", 60)
			time.Sleep(60 * time.Second)
		}

		slog.Info("fetching NAV data", "date", current.Format("2006-01-02"))
		parquetPath, err := f.FetchAndConvert(ctx, current)
		if err != nil {
			slog.Error("failed to fetch", "date", current.Format("2006-01-02"), "error", err)
		} else {
			slog.Info("created parquet file", "path", parquetPath)
		}

		current = current.AddDate(0, 0, 1)
		count++
	}

	slog.Info("fetch range completed", "dates_processed", count)
	return nil
}
