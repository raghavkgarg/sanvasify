package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// loggingMiddleware logs the incoming HTTP request.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf(
			"%s %s %s %v",
			r.Method,
			r.RequestURI,
			r.Proto,
			time.Since(start),
		)
	})
}

func main() {
	// 1. Configuration
	// Define command-line flags for port and static file directory.
	// This makes the server flexible for different environments.
	port := flag.Int("port", 8080, "Port for the server to listen on")
	staticDir := flag.String("dir", "ui/static", "The directory to serve static files from")
	flag.Parse()

	// 2. Handler Setup
	// Create a file server handler. http.Dir is a type that implements http.FileSystem.
	fs := http.FileServer(http.Dir(*staticDir))

	// It's best practice to create your own ServeMux to have more control
	// and avoid potential security issues with the default global mux.
	mux := http.NewServeMux()

	// Register the file server handler for all requests.
	// The handler will look for files in the `staticDir` that match the request path.
	mux.Handle("/", fs)

	// 3. Server Initialization and Startup
	addr := fmt.Sprintf(":%d", *port)
	log.Printf("Starting web server on http://localhost%s", addr)
	log.Printf("Serving files from directory: %s", *staticDir)

	// ListenAndServe starts an HTTP server with a given address and handler.
	// It always returns a non-nil error. We use log.Fatal to print the error
	// and exit the program if the server fails to start.
	srv := &http.Server{
		Addr:    addr,
		Handler: loggingMiddleware(mux),
		// Good practice to set timeouts to avoid resource exhaustion.
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Run our server in a goroutine so that it doesn't block.
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("could not start server: %v\n", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server with a timeout of 5 seconds.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}
