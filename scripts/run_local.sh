#!/bin/bash

# Path-agnostic build and run script for local development tasks
set -e

# 1. Determine the project root relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 2. Always execute from the project root to ensure config and data discovery
cd "$PROJECT_ROOT"

TASK=$1

case "$TASK" in
    fetch)
        echo ">>> Building and Running Fetcher..."
        go build -o dist/fetch ./cmd/fetch
        ./dist/fetch
        ;;
    load)
        echo ">>> Checking for running local server to prevent database locks..."
        if pgrep -f "dist/sanvasify" > /dev/null; then
            echo ">>> Stopping running local server..."
            pkill -f "dist/sanvasify" || true
            sleep 1
        fi
        echo ">>> Building and Running Loader..."
        go build -o dist/load ./cmd/load
        echo ">>> Updating sanvasify.db..."
        ./dist/load -db "/Users/raghavgarg/Projects/duckdb/sanvasify/sanvasify.db"
        echo ">>> Updating sanvas.db..."
        ./dist/load -db "/Users/raghavgarg/Projects/duckdb/sanvasify/sanvas.db"
        ;;
    server)
        echo ">>> Building and Running Server..."
        go build -o dist/sanvasify ./cmd/server
        ./dist/sanvasify
        ;;
    start)
        echo ">>> Running Server..."
        ./dist/sanvasify
        ;;
    stop)
        echo ">>> Stopping Local Server..."
        if  pgrep -f "dist/sanvasify" > /dev/null; then
            pkill -f "dist/sanvasify"
            echo "Server stopped."
        else
            echo "Server is not running."
        fi
        ;;
    *)
        echo "Usage: $0 {fetch|load|server|stop}"
        echo "Example: $0 server"
        exit 1
        ;;
esac