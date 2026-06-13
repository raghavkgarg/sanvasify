// Package api provides HTTP handlers and routing for the Sanvasify web application.
// It exposes REST endpoints for querying mutual fund scheme data.
package api

import (
	"encoding/json"
	"net/http"

	"github.com/raghavkgarg/sanvasify/pkg/store"
)

func (s *Server) handleSchemes() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		schemes, err := s.store.GetAllSchemes(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err := json.NewEncoder(w).Encode(schemes); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func (s *Server) handleNAV() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Missing scheme code", http.StatusBadRequest)
			return
		}

		found, err := s.store.GetSchemeByCode(r.Context(), code)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if found == nil {
			http.Error(w, "Scheme not found", http.StatusNotFound)
			return
		}

		if err := json.NewEncoder(w).Encode(found); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func (s *Server) handleFilters() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		options := make(map[string][]string)

		for _, col := range store.FilterColumns {
			values, err := s.store.GetUniqueValues(r.Context(), col)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			options[col] = values
		}

		if err := json.NewEncoder(w).Encode(options); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func (s *Server) handleSearch() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filters := map[string]string{
			store.ColumnFundType:           r.URL.Query().Get(store.ColumnFundType),
			store.ColumnFundStrategy:       r.URL.Query().Get(store.ColumnFundStrategy),
			store.ColumnFundCompany:        r.URL.Query().Get(store.ColumnFundCompany),
			store.ColumnDistributionOption: r.URL.Query().Get(store.ColumnDistributionOption),
			store.ColumnPurchaseMode:       r.URL.Query().Get(store.ColumnPurchaseMode),
		}

		schemes, err := s.store.SearchSchemes(r.Context(), filters)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if len(schemes) == 0 {
			http.Error(w, "No scheme found", http.StatusNotFound)
			return
		}

		if err := json.NewEncoder(w).Encode(schemes[0]); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func (s *Server) handleNAVHistory() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Missing scheme code", http.StatusBadRequest)
			return
		}

		history, err := s.store.GetNAVHistory(r.Context(), code)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if len(history) == 0 {
			http.Error(w, "No history found", http.StatusNotFound)
			return
		}

		if err := json.NewEncoder(w).Encode(history); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func (s *Server) handleCompare() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		strategy := r.URL.Query().Get("strategy")
		results, err := s.db.GetSchemeReturns(r.Context(), strategy)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err := json.NewEncoder(w).Encode(results); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}
}

func (s *Server) handleVolatility() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		results, err := s.db.GetVolatilityRatings(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(results)
	}
}

func (s *Server) handleTrends() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		results, err := s.db.GetTrendSignals(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(results)
	}
}

func (s *Server) handleAnomalies() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		results, err := s.db.GetAnomalies(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(results)
	}
}

func (s *Server) handleSimilar() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Missing scheme code", http.StatusBadRequest)
			return
		}
		results, err := s.db.GetSimilarFunds(r.Context(), code)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(results)
	}
}

func (s *Server) handleRecordVisit() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var payload struct {
			VisitorID string `json:"visitor_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if payload.VisitorID == "" {
			http.Error(w, "visitor_id is required", http.StatusBadRequest)
			return
		}

		if err := s.db.RecordVisit(r.Context(), payload.VisitorID); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func (s *Server) handleVisitorCount() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		count, err := s.db.GetUniqueVisitorCount(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]int{"count": count})
	}
}
