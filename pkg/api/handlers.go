package api

import (
	"encoding/json"
	"net/http"
)

func (s *Server) handleSchemes() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		schemes := s.store.GetAllSchemes()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		json.NewEncoder(w).Encode(schemes)
	}
}

func (s *Server) handleNAV() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Missing scheme code", http.StatusBadRequest)
			return
		}

		found := s.store.GetSchemeByCode(code)
		if found == nil {
			http.Error(w, "Scheme not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		json.NewEncoder(w).Encode(found)
	}
}

func (s *Server) handleFilters() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		options := s.store.GetFilterOptions()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(options)
	}
}

func (s *Server) handleSearch() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fType := r.URL.Query().Get("fund_type")
		fStrategy := r.URL.Query().Get("fund_strategy")
		fCompany := r.URL.Query().Get("fund_company")
		dist := r.URL.Query().Get("distribution_option")
		mode := r.URL.Query().Get("purchase_mode")

		schemes := s.store.SearchSchemes(fType, fStrategy, fCompany, dist, mode)

		if len(schemes) == 0 {
			http.Error(w, "No scheme found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		json.NewEncoder(w).Encode(schemes[0])
	}
}
