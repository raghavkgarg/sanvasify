package api

import "net/http"

func (s *Server) routes() {
	s.router.HandleFunc("/api/schemes", s.handleSchemes())
	s.router.HandleFunc("/api/nav", s.handleNAV())
	s.router.HandleFunc("/api/filters", s.handleFilters())
	s.router.HandleFunc("/api/search", s.handleSearch())
	s.router.Handle("/", http.FileServer(http.Dir("web/static")))
}
