package api

import "net/http"

func (s *Server) routes() {
	// Auth routes (public)
	if s.authHandlers != nil {
		s.router.HandleFunc("/api/auth/login", s.authHandlers.LoginHandler)
		s.router.HandleFunc("/api/auth/callback/google", s.authHandlers.CallbackHandler)
		s.router.HandleFunc("/api/auth/callback/github", s.authHandlers.CallbackHandler)
		s.router.HandleFunc("/api/auth/logout", s.authHandlers.LogoutHandler)
		s.router.Handle("/api/auth/me", s.authMW.Authenticate(http.HandlerFunc(s.authHandlers.MeHandler)))
	}

	// API routes with middleware
	apiMux := http.NewServeMux()
	apiMux.HandleFunc("/api/schemes", s.handleSchemes())
	apiMux.HandleFunc("/api/nav", s.handleNAV())
	apiMux.HandleFunc("/api/nav/history", s.handleNAVHistory())
	apiMux.HandleFunc("/api/filters", s.handleFilters())
	apiMux.HandleFunc("/api/search", s.handleSearch())
	
	// Apply auth middleware only if configured
	var handler http.Handler = apiMux
	if s.authMW != nil {
		handler = s.authMW.Authenticate(handler)
	}
	// Always apply JSON and no-cache middleware
	s.router.Handle("/api/", jsonMiddleware(noCacheMiddleware(handler)))
	
	// Static files without middleware
	s.router.Handle("/", http.FileServer(http.Dir("web/static")))
}
