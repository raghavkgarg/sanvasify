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
        echo ">>> Building and Running Loader..."
        go build -o dist/load ./cmd/load
        ./dist/load
        ;;
    server)
        echo ">>> Building and Running Server..."
        go build -o dist/sanvasify ./cmd/server
        ./dist/sanvasify
        ;;
    *)
        echo "Usage: $0 {fetch|load|server}"
        echo "Example: $0 server"
        exit 1
        ;;
esac