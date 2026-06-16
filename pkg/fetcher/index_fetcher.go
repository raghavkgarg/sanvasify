package fetcher

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/raghavkgarg/sanvasify/pkg/db"
)

// SeedIndicesFromCSV reads index values from a CSV file and loads them into the database.
func SeedIndicesFromCSV(ctx context.Context, database *db.DB, csvPath string, indexCode, indexName string) error {
	f, err := os.Open(csvPath)
	if err != nil {
		return fmt.Errorf("failed to open CSV file %s: %w", csvPath, err)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	// Read header
	if _, err := reader.Read(); err != nil {
		return fmt.Errorf("failed to read CSV header: %w", err)
	}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read CSV record: %w", err)
		}

		if len(record) < 2 {
			continue
		}

		dateStr := record[0]
		valStr := record[1]

		val, err := strconv.ParseFloat(valStr, 64)
		if err != nil {
			return fmt.Errorf("failed to parse index value '%s' as float: %w", valStr, err)
		}

		if err := database.UpsertIndexValue(ctx, indexCode, indexName, val, dateStr); err != nil {
			return fmt.Errorf("failed to insert index value into database: %w", err)
		}
	}

	return nil
}

type YahooChartResponse struct {
	Chart struct {
		Result []struct {
			Meta struct {
				Symbol string `json:"symbol"`
			} `json:"meta"`
			Timestamp []int64 `json:"timestamp"`
			Indicators struct {
				Adjclose []struct {
					Adjclose []float64 `json:"adjclose"`
				} `json:"adjclose"`
			} `json:"indicators"`
		} `json:"result"`
		Error interface{} `json:"error"`
	} `json:"chart"`
}

// FetchIndexFromYahoo fetches the latest few days of index values from Yahoo Finance.
func FetchIndexFromYahoo(ctx context.Context, database *db.DB, symbol, indexCode, indexName string) error {
	url := fmt.Sprintf("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=5d&interval=1d", symbol)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	
	// Add user-agent to look like a browser request to avoid 429 block
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP request to Yahoo Finance failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP request failed with status: %d", resp.StatusCode)
	}
	
	var chartResp YahooChartResponse
	if err := json.NewDecoder(resp.Body).Decode(&chartResp); err != nil {
		return fmt.Errorf("failed to decode Yahoo response: %w", err)
	}
	
	if len(chartResp.Chart.Result) == 0 {
		return fmt.Errorf("no chart result returned from Yahoo")
	}
	
	res := chartResp.Chart.Result[0]
	if len(res.Indicators.Adjclose) == 0 {
		return fmt.Errorf("no closing values found in result")
	}
	
	for i, ts := range res.Timestamp {
		if i >= len(res.Indicators.Adjclose[0].Adjclose) {
			break
		}
		
		val := res.Indicators.Adjclose[0].Adjclose[i]
		if val <= 0 {
			continue
		}
		
		t := time.Unix(ts, 0).UTC()
		dateStr := t.Format("2006-01-02")
		
		if err := database.UpsertIndexValue(ctx, indexCode, indexName, val, dateStr); err != nil {
			return fmt.Errorf("failed to upsert index value: %w", err)
		}
	}
	
	return nil
}
