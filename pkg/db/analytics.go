package db

import (
	"context"
	"sort"
	"strings"
)

// VolatilityRating holds a scheme's volatility metrics.
type VolatilityRating struct {
	Code       string   `json:"scheme_code"`
	Name       string   `json:"scheme_name"`
	StdDev     *float64 `json:"std_dev"`
	Rating     string   `json:"volatility_rating"` // Low, Medium, High
	Strategy   string   `json:"fund_strategy"`
	Company    string   `json:"fund_company"`
	Percentile *float64 `json:"percentile"`
}

// GetVolatilityRatings computes 30-day rolling std dev of daily returns per scheme.
func (d *DB) GetVolatilityRatings(ctx context.Context) ([]VolatilityRating, error) {
	query := `
		WITH daily_returns AS (
			SELECT scheme_code, scheme_name, fund_strategy, fund_company, date,
				(net_asset_value - LAG(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date))
				/ NULLIF(LAG(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date), 0) * 100 AS ret
			FROM sif_schemes
		),
		vol AS (
			SELECT scheme_code, scheme_name, fund_strategy, fund_company,
				STDDEV(ret) AS std_dev
			FROM daily_returns
			WHERE ret IS NOT NULL
			GROUP BY scheme_code, scheme_name, fund_strategy, fund_company
		)
		SELECT scheme_code, scheme_name, std_dev,
			CASE
				WHEN std_dev <= 0.5 THEN 'Low'
				WHEN std_dev <= 1.5 THEN 'Medium'
				ELSE 'High'
			END AS rating,
			fund_strategy, fund_company,
			PERCENT_RANK() OVER (ORDER BY std_dev) AS percentile
		FROM vol
		ORDER BY std_dev DESC NULLS LAST
	`
	rows, err := d.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []VolatilityRating
	for rows.Next() {
		var r VolatilityRating
		if err := rows.Scan(&r.Code, &r.Name, &r.StdDev, &r.Rating, &r.Strategy, &r.Company, &r.Percentile); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// TrendSignal holds MA crossover data for a scheme.
type TrendSignal struct {
	Code      string   `json:"scheme_code"`
	Name      string   `json:"scheme_name"`
	MA7       *float64 `json:"ma_7"`
	MA30      *float64 `json:"ma_30"`
	Signal    string   `json:"signal"` // Uptrend, Downtrend, Sideways
	Since     string   `json:"since"`
	LatestNAV *float64 `json:"nav"`
}

// GetTrendSignals computes 7-day vs 30-day MA crossover for each scheme.
func (d *DB) GetTrendSignals(ctx context.Context) ([]TrendSignal, error) {
	query := `
		WITH latest AS (
			SELECT scheme_code, MAX(date) AS max_date FROM sif_schemes GROUP BY scheme_code
		),
		with_ma AS (
			SELECT s.scheme_code, s.scheme_name, s.date, s.net_asset_value,
				AVG(s.net_asset_value) OVER (PARTITION BY s.scheme_code ORDER BY s.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma_7,
				AVG(s.net_asset_value) OVER (PARTITION BY s.scheme_code ORDER BY s.date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS ma_30
			FROM sif_schemes s
		),
		current AS (
			SELECT m.* FROM with_ma m JOIN latest l ON m.scheme_code = l.scheme_code AND m.date = l.max_date
		),
		crossover AS (
			SELECT m.scheme_code, m.date,
				CASE WHEN m.ma_7 > m.ma_30 THEN 'Uptrend' WHEN m.ma_7 < m.ma_30 THEN 'Downtrend' ELSE 'Sideways' END AS signal
			FROM with_ma m
		),
		signal_change AS (
			SELECT scheme_code, date, signal,
				LAG(signal) OVER (PARTITION BY scheme_code ORDER BY date) AS prev_signal
			FROM crossover
		),
		last_change AS (
			SELECT scheme_code, MAX(date) AS since
			FROM signal_change
			WHERE signal != prev_signal OR prev_signal IS NULL
			GROUP BY scheme_code
		)
		SELECT c.scheme_code, c.scheme_name, c.ma_7, c.ma_30,
			CASE WHEN c.ma_7 > c.ma_30 THEN 'Uptrend' WHEN c.ma_7 < c.ma_30 THEN 'Downtrend' ELSE 'Sideways' END AS signal,
			COALESCE(lc.since::VARCHAR, ''),
			c.net_asset_value
		FROM current c
		LEFT JOIN last_change lc ON c.scheme_code = lc.scheme_code
		ORDER BY c.scheme_code
	`
	rows, err := d.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []TrendSignal
	for rows.Next() {
		var r TrendSignal
		if err := rows.Scan(&r.Code, &r.Name, &r.MA7, &r.MA30, &r.Signal, &r.Since, &r.LatestNAV); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// Anomaly holds a detected anomalous daily return.
type Anomaly struct {
	Code   string   `json:"scheme_code"`
	Name   string   `json:"scheme_name"`
	Date   string   `json:"date"`
	Return *float64 `json:"daily_return"`
	ZScore *float64 `json:"z_score"`
	NAV    *float64 `json:"nav"`
}

// GetAnomalies detects daily returns with |Z-score| > 3.
func (d *DB) GetAnomalies(ctx context.Context) ([]Anomaly, error) {
	query := `
		WITH daily_returns AS (
			SELECT scheme_code, scheme_name, date, net_asset_value,
				(net_asset_value - LAG(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date))
				/ NULLIF(LAG(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date), 0) * 100 AS ret
			FROM sif_schemes
		),
		stats AS (
			SELECT scheme_code, AVG(ret) AS mean, STDDEV(ret) AS sd
			FROM daily_returns WHERE ret IS NOT NULL
			GROUP BY scheme_code
		)
		SELECT d.scheme_code, d.scheme_name, d.date::VARCHAR, d.ret,
			(d.ret - s.mean) / NULLIF(s.sd, 0) AS z_score,
			d.net_asset_value
		FROM daily_returns d
		JOIN stats s ON d.scheme_code = s.scheme_code
		WHERE d.ret IS NOT NULL AND ABS((d.ret - s.mean) / NULLIF(s.sd, 0)) > 3
		ORDER BY ABS((d.ret - s.mean) / NULLIF(s.sd, 0)) DESC
	`
	rows, err := d.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []Anomaly
	for rows.Next() {
		var r Anomaly
		if err := rows.Scan(&r.Code, &r.Name, &r.Date, &r.Return, &r.ZScore, &r.NAV); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// SimilarFund holds a fund and its similarity score to a reference fund.
type SimilarFund struct {
	Code       string   `json:"scheme_code"`
	Name       string   `json:"scheme_name"`
	Strategy   string   `json:"fund_strategy"`
	Company    string   `json:"fund_company"`
	Similarity *float64 `json:"similarity"` // 0-1
	NAV        *float64 `json:"nav"`
}

// GetSimilarFunds finds the top 3 most similar funds to the given scheme.
// Similarity is based on matching strategy/company + return profile closeness.
func (d *DB) GetSimilarFunds(ctx context.Context, schemeCode string) ([]SimilarFund, error) {
	query := `
		WITH latest AS (
			SELECT scheme_code, MAX(date) AS max_date FROM sif_schemes GROUP BY scheme_code
		),
		current AS (
			SELECT s.scheme_code, s.scheme_name, s.fund_strategy, s.fund_company, s.net_asset_value
			FROM sif_schemes s JOIN latest l ON s.scheme_code = l.scheme_code AND s.date = l.max_date
		),
		daily_returns AS (
			SELECT scheme_code,
				(net_asset_value - LAG(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date))
				/ NULLIF(LAG(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date), 0) * 100 AS ret
			FROM sif_schemes
		),
		stats AS (
			SELECT scheme_code, AVG(ret) AS avg_ret, STDDEV(ret) AS vol
			FROM daily_returns WHERE ret IS NOT NULL GROUP BY scheme_code
		),
		ref AS (
			SELECT c.scheme_code, c.fund_strategy, c.fund_company, s.avg_ret, s.vol
			FROM current c JOIN stats s ON c.scheme_code = s.scheme_code
			WHERE c.scheme_code = ?
		),
		scored AS (
			SELECT c.scheme_code, c.scheme_name, c.fund_strategy, c.fund_company, c.net_asset_value,
				(CASE WHEN c.fund_strategy = r.fund_strategy THEN 0.4 ELSE 0 END)
				+ (CASE WHEN c.fund_company = r.fund_company THEN 0.2 ELSE 0 END)
				+ (0.4 * (1.0 - LEAST(ABS(COALESCE(s.avg_ret,0) - COALESCE(r.avg_ret,0)) / NULLIF(GREATEST(ABS(r.avg_ret), 0.01), 0), 1.0)
					* 0.5
					+ 1.0 - LEAST(ABS(COALESCE(s.vol,0) - COALESCE(r.vol,0)) / NULLIF(GREATEST(ABS(r.vol), 0.01), 0), 1.0)
					* 0.5))
				AS similarity
			FROM current c
			CROSS JOIN ref r
			JOIN stats s ON c.scheme_code = s.scheme_code
			WHERE c.scheme_code != r.scheme_code
		)
		SELECT scheme_code, scheme_name, fund_strategy, fund_company, similarity, net_asset_value
		FROM scored
		ORDER BY similarity DESC
		LIMIT 3
	`
	rows, err := d.conn.QueryContext(ctx, query, schemeCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SimilarFund
	for rows.Next() {
		var r SimilarFund
		if err := rows.Scan(&r.Code, &r.Name, &r.Strategy, &r.Company, &r.Similarity, &r.NAV); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// RiskMetrics holds Beta, Alpha, Sharpe, Sortino, Max Drawdown, and Capture Ratios for a scheme.
type RiskMetrics struct {
	Code            string   `json:"scheme_code"`
	Name            string   `json:"scheme_name"`
	Strategy        string   `json:"fund_strategy"`
	Company         string   `json:"fund_company"`
	RetAnnualised   *float64 `json:"ret_annualised"`
	Beta            *float64 `json:"beta"`
	Alpha           *float64 `json:"alpha"`
	Sharpe          *float64 `json:"sharpe"`
	Sortino         *float64 `json:"sortino"`
	MaxDrawdown     *float64 `json:"max_drawdown"`
	UpsideCapture   *float64 `json:"upside_capture"`
	DownsideCapture *float64 `json:"downside_capture"`
	CompositeScore  *float64 `json:"composite_score"`
}

// GetRiskMetrics calculates advanced risk metrics relative to Nifty 500 TRI.
func (d *DB) GetRiskMetrics(ctx context.Context) ([]RiskMetrics, error) {
	query := `
		WITH latest AS (
			SELECT scheme_code, MAX(date) AS max_date
			FROM sif_schemes
			GROUP BY scheme_code
		),
		current_nav AS (
			SELECT s.scheme_code, s.scheme_name, s.net_asset_value, s.date,
			       s.fund_strategy, s.fund_company
			FROM sif_schemes s
			JOIN latest l ON s.scheme_code = l.scheme_code AND s.date = l.max_date
		),
		nav_si AS (
			SELECT s.scheme_code, s.net_asset_value, s.date
			FROM sif_schemes s
			WHERE s.date = (
				SELECT MIN(date) FROM sif_schemes WHERE scheme_code = s.scheme_code
			)
		),
		fund_returns AS (
			SELECT scheme_code, date, net_asset_value,
				(net_asset_value - LAG(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date))
				/ NULLIF(LAG(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date), 0) * 100 AS fund_ret
			FROM sif_schemes
		),
		index_returns AS (
			SELECT date,
				(value - LAG(value) OVER (ORDER BY date))
				/ NULLIF(LAG(value) OVER (ORDER BY date), 0) * 100 AS index_ret
			FROM sif_indices
			WHERE index_code = 'NIFTY_500_TRI'
		),
		joined_returns AS (
			SELECT f.scheme_code, f.fund_ret, i.index_ret
			FROM fund_returns f
			JOIN index_returns i ON f.date = i.date
			WHERE f.fund_ret IS NOT NULL AND i.index_ret IS NOT NULL
		),
		beta_calc AS (
			SELECT scheme_code,
				COVAR_SAMP(fund_ret, index_ret) / NULLIF(VAR_SAMP(index_ret), 0) AS beta
			FROM joined_returns
			GROUP BY scheme_code
		),
		vol_calc AS (
			SELECT scheme_code,
				STDDEV(fund_ret) AS std_dev
			FROM fund_returns
			WHERE fund_ret IS NOT NULL
			GROUP BY scheme_code
		),
		benchmark_ann_return AS (
			SELECT 
				(pow(c.value / si.value, 365.0 / (c.date - si.date)) - 1.0) * 100.0 AS bench_ann_ret
			FROM (
				SELECT value, date FROM sif_indices 
				WHERE index_code = 'NIFTY_500_TRI' 
				ORDER BY date DESC LIMIT 1
			) c
			CROSS JOIN (
				SELECT value, date FROM sif_indices 
				WHERE index_code = 'NIFTY_500_TRI' 
				ORDER BY date ASC LIMIT 1
			) si
			WHERE c.date - si.date >= 90
		),
		downside_variance AS (
			SELECT scheme_code,
				AVG(CASE WHEN fund_ret < 0 THEN fund_ret * fund_ret ELSE 0 END) AS down_var
			FROM fund_returns
			WHERE fund_ret IS NOT NULL
			GROUP BY scheme_code
		),
		peaks AS (
			SELECT scheme_code, date, net_asset_value,
				MAX(net_asset_value) OVER (PARTITION BY scheme_code ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS peak
			FROM sif_schemes
		),
		drawdowns AS (
			SELECT scheme_code, date, net_asset_value, peak,
				(net_asset_value - peak) / NULLIF(peak, 0) * 100 AS dd
			FROM peaks
		),
		max_dd_calc AS (
			SELECT scheme_code, MIN(dd) AS max_drawdown
			FROM drawdowns
			GROUP BY scheme_code
		),
		capture_calc AS (
			SELECT scheme_code,
				AVG(CASE WHEN index_ret > 0 THEN fund_ret END) / NULLIF(AVG(CASE WHEN index_ret > 0 THEN index_ret END), 0) * 100 AS upside_capture,
				AVG(CASE WHEN index_ret < 0 THEN fund_ret END) / NULLIF(AVG(CASE WHEN index_ret < 0 THEN index_ret END), 0) * 100 AS downside_capture
			FROM joined_returns
			GROUP BY scheme_code
		)
		SELECT
			c.scheme_code, c.scheme_name, c.fund_strategy, c.fund_company,
			CASE WHEN si.net_asset_value > 0 AND c.date - si.date >= 90 THEN (pow(c.net_asset_value / si.net_asset_value, 365.0 / (c.date - si.date)) - 1.0) * 100.0 END AS ret_annualised,
			b.beta,
			CASE 
				WHEN si.net_asset_value > 0 AND c.date - si.date >= 90 AND b.beta IS NOT NULL
				THEN ( (pow(c.net_asset_value / si.net_asset_value, 365.0 / (c.date - si.date)) - 1.0) * 100.0 )
				     - (6.0 + b.beta * (COALESCE((SELECT bench_ann_ret FROM benchmark_ann_return), 0.0) - 6.0))
			END AS alpha,
			CASE
				WHEN si.net_asset_value > 0 AND c.date - si.date >= 90 AND v.std_dev > 0
				THEN ((pow(c.net_asset_value / si.net_asset_value, 365.0 / (c.date - si.date)) - 1.0) * 100.0 - 6.0)
				     / (v.std_dev * 15.8745)
			END AS sharpe,
			CASE
				WHEN si.net_asset_value > 0 AND c.date - si.date >= 90 AND dv.down_var > 0
				THEN ((pow(c.net_asset_value / si.net_asset_value, 365.0 / (c.date - si.date)) - 1.0) * 100.0 - 6.0)
				     / (sqrt(dv.down_var) * 15.8745)
			END AS sortino,
			COALESCE(mdd.max_drawdown, 0.0) AS max_drawdown,
			cap.upside_capture,
			cap.downside_capture
		FROM current_nav c
		LEFT JOIN nav_si si ON c.scheme_code = si.scheme_code
		LEFT JOIN beta_calc b ON c.scheme_code = b.scheme_code
		LEFT JOIN vol_calc v ON c.scheme_code = v.scheme_code
		LEFT JOIN downside_variance dv ON c.scheme_code = dv.scheme_code
		LEFT JOIN max_dd_calc mdd ON c.scheme_code = mdd.scheme_code
		LEFT JOIN capture_calc cap ON c.scheme_code = cap.scheme_code
		ORDER BY alpha DESC NULLS LAST
	`
	rows, err := d.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []RiskMetrics
	for rows.Next() {
		var r RiskMetrics
		if err := rows.Scan(&r.Code, &r.Name, &r.Strategy, &r.Company, &r.RetAnnualised, &r.Beta, &r.Alpha, &r.Sharpe, &r.Sortino, &r.MaxDrawdown, &r.UpsideCapture, &r.DownsideCapture); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// TopPerformersResponse segments SIFs into Category Champions.
type TopPerformersResponse struct {
	AlphaKings        []RiskMetrics `json:"alpha_king"`
	ShieldGuardians   []RiskMetrics `json:"shield_guardian"`
	AsymmetricRunners []RiskMetrics `json:"asymmetric_runner"`
}

// GetTopPerformers groups and ranks schemes using the multi-factor scoring model.
func (d *DB) GetTopPerformers(ctx context.Context) (*TopPerformersResponse, error) {
	metrics, err := d.GetRiskMetrics(ctx)
	if err != nil {
		return nil, err
	}

	var valid []RiskMetrics
	for _, m := range metrics {
		nameLower := strings.ToLower(m.Name)
		if strings.Contains(nameLower, "direct") && strings.Contains(nameLower, "growth") {
			if m.RetAnnualised != nil && m.Beta != nil && m.Alpha != nil && m.Sharpe != nil && m.Sortino != nil && m.MaxDrawdown != nil && m.UpsideCapture != nil && m.DownsideCapture != nil {
				valid = append(valid, m)
			}
		}
	}

	if len(valid) == 0 {
		return &TopPerformersResponse{
			AlphaKings:        []RiskMetrics{},
			ShieldGuardians:   []RiskMetrics{},
			AsymmetricRunners: []RiskMetrics{},
		}, nil
	}

	// Min-Max limits
	first := valid[0]
	minAnn, maxAnn := *first.RetAnnualised, *first.RetAnnualised
	minBeta, maxBeta := *first.Beta, *first.Beta
	minAlpha, maxAlpha := *first.Alpha, *first.Alpha
	minSortino, maxSortino := *first.Sortino, *first.Sortino
	minSharpe, maxSharpe := *first.Sharpe, *first.Sharpe
	minDD, maxDD := *first.MaxDrawdown, *first.MaxDrawdown
	minSpread, maxSpread := *first.UpsideCapture-*first.DownsideCapture, *first.UpsideCapture-*first.DownsideCapture

	for _, m := range valid {
		if *m.RetAnnualised < minAnn {
			minAnn = *m.RetAnnualised
		}
		if *m.RetAnnualised > maxAnn {
			maxAnn = *m.RetAnnualised
		}
		if *m.Beta < minBeta {
			minBeta = *m.Beta
		}
		if *m.Beta > maxBeta {
			maxBeta = *m.Beta
		}
		if *m.Alpha < minAlpha {
			minAlpha = *m.Alpha
		}
		if *m.Alpha > maxAlpha {
			maxAlpha = *m.Alpha
		}
		if *m.Sortino < minSortino {
			minSortino = *m.Sortino
		}
		if *m.Sortino > maxSortino {
			maxSortino = *m.Sortino
		}
		if *m.Sharpe < minSharpe {
			minSharpe = *m.Sharpe
		}
		if *m.Sharpe > maxSharpe {
			maxSharpe = *m.Sharpe
		}
		if *m.MaxDrawdown < minDD {
			minDD = *m.MaxDrawdown
		}
		if *m.MaxDrawdown > maxDD {
			maxDD = *m.MaxDrawdown
		}
		spread := *m.UpsideCapture - *m.DownsideCapture
		if spread < minSpread {
			minSpread = spread
		}
		if spread > maxSpread {
			maxSpread = spread
		}
	}

	norm := func(val, min, max float64, invert bool) float64 {
		if max == min {
			return 50.0
		}
		if invert {
			return (max - val) / (max - min) * 100.0
		}
		return (val - min) / (max - min) * 100.0
	}

	for i := range valid {
		m := &valid[i]
		nAnn := norm(*m.RetAnnualised, minAnn, maxAnn, false)
		nBeta := norm(*m.Beta, minBeta, maxBeta, true)
		nAlpha := norm(*m.Alpha, minAlpha, maxAlpha, false)
		nSortino := norm(*m.Sortino, minSortino, maxSortino, false)
		nSharpe := norm(*m.Sharpe, minSharpe, maxSharpe, false)
		nDD := norm(*m.MaxDrawdown, minDD, maxDD, true)
		nSpread := norm(*m.UpsideCapture-*m.DownsideCapture, minSpread, maxSpread, false)

		score := 0.25*nAlpha + 0.10*nAnn + 0.20*nSortino + 0.15*nSharpe + 0.10*nDD + 0.10*nBeta + 0.10*nSpread
		m.CompositeScore = &score
	}

	limit := func(arr []RiskMetrics, n int) []RiskMetrics {
		if len(arr) < n {
			return arr
		}
		return arr[:n]
	}

	// 1. Alpha Kings: sorted by Alpha desc (pure active return)
	alphaKings := make([]RiskMetrics, len(valid))
	copy(alphaKings, valid)
	sort.Slice(alphaKings, func(i, j int) bool {
		return *alphaKings[i].Alpha > *alphaKings[j].Alpha
	})

	// 2. Shield Guardians: sorted by lowest Max Drawdown desc (closest to 0, preservation-focused)
	guardians := make([]RiskMetrics, len(valid))
	copy(guardians, valid)
	sort.Slice(guardians, func(i, j int) bool {
		// Drawdowns are negative numbers (e.g., -0.23% vs -5.0%), so > sorts closest to 0
		return *guardians[i].MaxDrawdown > *guardians[j].MaxDrawdown
	})

	// 3. Asymmetric Runners: sorted by Sortino Ratio desc (asymmetric risk-adjusted return)
	runners := make([]RiskMetrics, len(valid))
	copy(runners, valid)
	sort.Slice(runners, func(i, j int) bool {
		return *runners[i].Sortino > *runners[j].Sortino
	})

	return &TopPerformersResponse{
		AlphaKings:        limit(alphaKings, 3),
		ShieldGuardians:   limit(guardians, 3),
		AsymmetricRunners: limit(runners, 3),
	}, nil
}
