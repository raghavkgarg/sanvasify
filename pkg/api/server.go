package api

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/raghavkgarg/sanvasify/pkg/auth"
	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/store"
)

type Server struct {
	store        store.Store
	router       *http.ServeMux
	server       *http.Server
	authHandlers *auth.Handlers
	authMW       *auth.Middleware
}

func NewServer(dataStore store.Store, db *sql.DB, logger *slog.Logger) *Server {
	s := &Server{
		store:  dataStore,
		router: http.NewServeMux(),
	}

	// Initialize auth if configured
	if conf.Cfg.Auth.Enabled && conf.Cfg.Auth.JWTSecret != "" {
		authCfg := &auth.Config{
			JWTSecret:      conf.Cfg.Auth.JWTSecret,
			JWTExpiryHours: conf.Cfg.Auth.JWTExpiryHours,
			Google: auth.OAuthProvider{
				ClientID:     conf.Cfg.Auth.Google.ClientID,
				ClientSecret: conf.Cfg.Auth.Google.ClientSecret,
				RedirectURL:  conf.Cfg.Auth.Google.RedirectURL,
			},
			GitHub: auth.OAuthProvider{
				ClientID:     conf.Cfg.Auth.GitHub.ClientID,
				ClientSecret: conf.Cfg.Auth.GitHub.ClientSecret,
				RedirectURL:  conf.Cfg.Auth.GitHub.RedirectURL,
			},
		}

		oauthMgr := auth.NewOAuthManager(authCfg)
		jwtMgr := auth.NewJWTManager(authCfg.JWTSecret, authCfg.JWTExpiry())
		authStore, err := auth.NewDBStore(db)
		if err != nil {
			logger.Error("failed to initialize auth store", "error", err)
		} else {
			s.authHandlers = auth.NewHandlers(oauthMgr, jwtMgr, authStore, logger)
			s.authMW = auth.NewMiddleware(jwtMgr, logger)
		}
	}

	s.routes()
	
	port := strconv.Itoa(conf.Cfg.Server.Port)
	s.server = &http.Server{
		Addr:         ":" + port,
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	
	return s
}

func (s *Server) Start() error {
	slog.Info("server listening", "addr", s.server.Addr)
	return s.server.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	slog.Info("shutting down server")
	return s.server.Shutdown(ctx)
}
