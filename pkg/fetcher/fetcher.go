// Package fetcher provides functionality to download NAV reports from AMFI
// and convert them to Parquet format for efficient storage and querying.
package fetcher

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type Fetcher struct {
	baseURL string
	dataDir string
	rawDir  string
	client  *http.Client
}

func New(baseURL, dataDir, rawDir string) (*Fetcher, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data dir: %w", err)
	}
	if err := os.MkdirAll(rawDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create raw dir: %w", err)
	}

	return &Fetcher{
		baseURL: baseURL,
		dataDir: dataDir,
		rawDir:  rawDir,
		client:  &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (f *Fetcher) FetchAndConvert(ctx context.Context, date time.Time, parquetPath string) (string, error) {
	dateStr := date.Format("2006-01-02")

	// Download raw TXT
	rawPath := filepath.Join(f.rawDir, dateStr+".txt")
	if err := f.downloadRaw(ctx, date, rawPath); err != nil {
		return "", fmt.Errorf("failed to download: %w", err)
	}

	// Append to Parquet file
	if err := f.appendToParquet(rawPath, parquetPath); err != nil {
		return "", fmt.Errorf("failed to convert: %w", err)
	}

	return parquetPath, nil
}

// FetchRange iterates through a range of dates and fetches/converts data for each business day.
// It skips weekends and respects rate limits with a small delay between requests.
func (f *Fetcher) FetchRange(ctx context.Context, start, end time.Time, delaySeconds int) error {
	fileName := fmt.Sprintf("nav_data_%s_to_%s.parquet", start.Format("2006-01-02"), end.Format("2006-01-02"))
	parquetPath := filepath.Join(f.dataDir, fileName)

	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		// Skip weekends (Saturday=6, Sunday=0)
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}

		fmt.Printf("Fetching and converting: %s\n", d.Format("2006-01-02"))
		if _, err := f.FetchAndConvert(ctx, d, parquetPath); err != nil {
			// Log the error but continue with the next date in the range
			fmt.Printf("Warning: Failed for %s: %v\n", d.Format("2006-01-02"), err)
			continue
		}

		// Delay to respect AMFI rate limits
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(delaySeconds) * time.Second):
		}
	}
	return nil
}

func (f *Fetcher) downloadRaw(ctx context.Context, date time.Time, destPath string) error {
	url := f.buildURL(date)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	// Check if response is HTML (error page for weekends/holidays)
	// AMFI returns an HTML error page instead of data when no report is available
	contentType := resp.Header.Get("Content-Type")
	if contentType != "" && (contentType == "text/html" || contentType[:9] == "text/html") {
		return fmt.Errorf("no data available (weekend/holiday)")
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func (f *Fetcher) buildURL(date time.Time) string {
	// AMFI format: https://portal.amfiindia.com/SIF_DownloadNAVHistoryReport.aspx?frmdt=16-Jan-2026
	return fmt.Sprintf("%s?frmdt=%s", f.baseURL, date.Format("02-Jan-2006"))
}
