package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

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
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("could not start server: %v\n", err)
	}
}
