package api

import "net/http"

func (s *Server) routes() {
	// API routes with middleware
	apiMux := http.NewServeMux()
	apiMux.HandleFunc("/api/schemes", s.handleSchemes())
	apiMux.HandleFunc("/api/nav", s.handleNAV())
	apiMux.HandleFunc("/api/nav/history", s.handleNAVHistory())
	apiMux.HandleFunc("/api/filters", s.handleFilters())
	apiMux.HandleFunc("/api/search", s.handleSearch())
	
	// Apply middleware to API routes
	s.router.Handle("/api/", jsonMiddleware(noCacheMiddleware(apiMux)))
	
	// Static files without middleware
	s.router.Handle("/", http.FileServer(http.Dir("web/static")))
}
