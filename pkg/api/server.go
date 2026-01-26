package api

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/store"
)

type Server struct {
	store  store.Store
	router *http.ServeMux
	server *http.Server
}

func NewServer(dataStore store.Store) *Server {
	s := &Server{
		store:  dataStore,
		router: http.NewServeMux(),
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
