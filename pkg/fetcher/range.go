package fetcher

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/duckdb/duckdb-go/v2"
)

// CalculateIncrementalRange queries the database to find the lastest stored date
// and returns the next day as the 'from' date and today as the 'to' date.
func (f *Fetcher) CalculateIncrementalRange(dbPath string, defaultFrom string) (time.Time, time.Time, error) {
	db, err := sql.Open("duckdb", dbPath)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	var latestDate sql.NullTime
	// We use NullTime in case the table is empty
	query := "SELECT MAX(date) FROM sif_schemes"
	_ = db.QueryRow(query).Scan(&latestDate)

	now := time.Now()
	toDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)

	parsedDefault, err := time.Parse("2006-01-02", defaultFrom)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid default from date: %w", err)
	}

	// If the database has no records, fallback to the config's from_date
	if !latestDate.Valid {
		return parsedDefault, toDate, nil
	}

	// Calculate from_date as Latest Date - 5 days
	fromDate := latestDate.Time.AddDate(0, 0, -5)

	// Optional: Check if we are already up to date
	if fromDate.After(toDate) {
		return time.Time{}, time.Time{}, fmt.Errorf("data is already up to date (latest: %s)", latestDate.Time.Format("2006-01-02"))
	}

	return fromDate, toDate, nil
}
