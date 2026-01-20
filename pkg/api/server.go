package api

import (
	"log"
	"net/http"
	"strconv"

	"github.com/raghavkgarg/sanvasify/pkg/conf"
	"github.com/raghavkgarg/sanvasify/pkg/nav"
)

type Server struct {
	store  *Store
	router *http.ServeMux
}

func NewServer(report *nav.NAVReport) *Server {
	s := &Server{
		store:  NewStore(report),
		router: http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) Start() {
	port := strconv.Itoa(conf.Cfg.Server.Port)
	log.Printf("Serving on HTTP port: %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, s.router))
}
