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

	// Public API routes (no auth required)
	s.router.HandleFunc("/api/schemes", jsonMW(s.handleSchemes()))
	s.router.HandleFunc("/api/schemes/compare", jsonMW(s.handleCompare()))
	s.router.HandleFunc("/api/filters", jsonMW(s.handleFilters()))

	// Protected API routes (auth required)
	s.router.HandleFunc("/api/nav", authMW(s, jsonMW(s.handleNAV())))
	s.router.HandleFunc("/api/nav/history", authMW(s, jsonMW(s.handleNAVHistory())))
	s.router.HandleFunc("/api/search", authMW(s, jsonMW(s.handleSearch())))

	// Current version (design system v2) at root
	s.router.Handle("/", http.FileServer(http.Dir("web/static")))

	// Legacy version at /v0/
	v0Dir := http.Dir("web/v0")
	s.router.Handle("/v0/", http.StripPrefix("/v0/", http.FileServer(v0Dir)))

	// New version at /v1/
	v1Dir := http.Dir("web/v1")
	s.router.Handle("/v1/", http.StripPrefix("/v1/", http.FileServer(v1Dir)))

	// Latest version at /v2/
	v2Dir := http.Dir("web/v2")
	s.router.Handle("/v2/", http.StripPrefix("/v2/", http.FileServer(v2Dir)))

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
