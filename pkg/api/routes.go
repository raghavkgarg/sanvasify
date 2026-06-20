package api

import (
	"net/http"
	"strings"
)

func (s *Server) routes() {
	// Auth routes (public)
	if s.authHandlers != nil {
		s.router.HandleFunc("/api/auth/login", s.authHandlers.LoginHandler)
		s.router.HandleFunc("/api/auth/callback/google", s.authHandlers.CallbackHandler)
		s.router.HandleFunc("/api/auth/callback/github", s.authHandlers.CallbackHandler)
		s.router.HandleFunc("/api/auth/logout", s.authHandlers.LogoutHandler)
		s.router.Handle("/api/auth/me", s.authMW.Authenticate(http.HandlerFunc(s.authHandlers.MeHandler)))
	}

	// Public API routes (no auth required)
	s.router.HandleFunc("/api/schemes", jsonMW(s.handleSchemes()))
	s.router.HandleFunc("/api/schemes/compare", jsonMW(s.handleCompare()))
	s.router.HandleFunc("/api/filters", jsonMW(s.handleFilters()))

	// Analytics routes (renamed to analysis to avoid Safari tracking warnings)
	s.router.HandleFunc("/api/analysis/volatility", jsonMW(s.handleVolatility()))
	s.router.HandleFunc("/api/analysis/trends", jsonMW(s.handleTrends()))
	s.router.HandleFunc("/api/analysis/anomalies", jsonMW(s.handleAnomalies()))
	s.router.HandleFunc("/api/analysis/similar", jsonMW(s.handleSimilar()))
	s.router.HandleFunc("/api/analysis/risk-metrics", jsonMW(s.handleRiskMetrics()))

	// Index routes
	s.router.HandleFunc("/api/indices/compare", jsonMW(s.handleIndexCompare()))
	s.router.HandleFunc("/api/indices/history", jsonMW(s.handleIndexHistory()))

	// Session/Stats routes
	s.router.HandleFunc("/api/session/init", jsonMW(s.handleSessionInit()))
	s.router.HandleFunc("/api/session/count", jsonMW(s.handleSessionCount()))

	// Protected API routes (auth required)
	s.router.HandleFunc("/api/nav", authMW(s, jsonMW(s.handleNAV())))
	s.router.HandleFunc("/api/nav/history", authMW(s, jsonMW(s.handleNAVHistory())))
	s.router.HandleFunc("/api/search", authMW(s, jsonMW(s.handleSearch())))

	// Current version (design system v2) at root
	s.router.Handle("/", staticCacheMW("web/static"))

	// Legacy version at /v0/
	s.router.Handle("/v0/", http.StripPrefix("/v0/", staticCacheMW("web/v0")))

	// New version at /v1/
	s.router.Handle("/v1/", http.StripPrefix("/v1/", staticCacheMW("web/v1")))

	// Latest version at /v2/
	s.router.Handle("/v2/", http.StripPrefix("/v2/", staticCacheMW("web/v2")))

}

// staticCacheMW wraps file servers with cache headers for static files
func staticCacheMW(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".js") ||
			strings.HasSuffix(path, ".svg") || strings.HasSuffix(path, ".png") ||
			strings.HasSuffix(path, ".jpg") || strings.HasSuffix(path, ".ico") {
			w.Header().Set("Cache-Control", "public, max-age=604800") // 7 days cache
		}
		fs.ServeHTTP(w, r)
	})
}

// jsonMW wraps handlers with JSON and no-cache middleware
func jsonMW(handler http.HandlerFunc) http.HandlerFunc {
	// Reuse the logic from middleware.go to ensure headers are consistent across the app.
	// This applies both jsonMiddleware (Content-Type) and noCacheMiddleware (Cache-Control/Expires).
	return noCacheMiddleware(jsonMiddleware(handler)).ServeHTTP
}

// authMW wraps protected endpoints with authentication
func authMW(s *Server, handler http.HandlerFunc) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.authMW != nil {
			s.authMW.Authenticate(handler).ServeHTTP(w, r)
		} else {
			handler(w, r)
		}
	})
}
