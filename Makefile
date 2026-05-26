.PHONY: build build-fetch build-load build-gensecret build-all
.PHONY: build-linux-arm64 build-linux-amd64
.PHONY: start stop restart status logs run kill stage
.PHONY: test test-all
.PHONY: package cleanup lint-js fmt-js check-js clean help

BINARY   := sanvasify
DIST     := dist
PORT     := 8080

UNAME_S := $(shell uname -s)

ifeq ($(UNAME_S),Darwin)
	BREW_PREFIX := $(shell command -v brew >/dev/null 2>&1 && brew --prefix || echo "/opt/homebrew")
	ARM64_CC  = $(BREW_PREFIX)/bin/aarch64-unknown-linux-gnu-gcc
	ARM64_CXX = $(BREW_PREFIX)/bin/aarch64-unknown-linux-gnu-g++
	AMD64_CC  = $(BREW_PREFIX)/bin/x86_64-unknown-linux-gnu-gcc
	AMD64_CXX = $(BREW_PREFIX)/bin/x86_64-unknown-linux-gnu-g++
else
	ARM64_CC  ?= aarch64-linux-gnu-gcc
	ARM64_CXX ?= aarch64-linux-gnu-g++
	AMD64_CC  ?= x86_64-linux-gnu-gcc
	AMD64_CXX ?= x86_64-linux-gnu-g++
endif

# --- Build ---

build:
	@go build -o $(DIST)/$(BINARY) ./cmd/server/

build-fetch:
	@go build -o $(DIST)/fetch ./cmd/fetch/

build-load:
	@go build -o $(DIST)/load ./cmd/load/

build-gensecret:
	@go build -o $(DIST)/gensecret ./cmd/gensecret/

build-all: build build-fetch build-load build-gensecret

build-linux-arm64:
	@CGO_ENABLED=1 GOOS=linux GOARCH=arm64 \
	CC=$(ARM64_CC) CXX=$(ARM64_CXX) \
	go build -ldflags "-s -w" -o $(DIST)/$(BINARY)-arm64 ./cmd/server/

build-linux-amd64:
	@CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
	CC=$(AMD64_CC) CXX=$(AMD64_CXX) \
	go build -ldflags "-s -w" -o $(DIST)/$(BINARY)-amd64 ./cmd/server/

# --- Package (full quality pipeline) ---

package: cleanup test build-all
	@echo "=== Package complete ==="

# --- Service management ---

stage:
	@rm -rf $(DIST)/web $(DIST)/config $(DIST)/data
	@cp -R web $(DIST)/
	@mkdir -p $(DIST)/config
	@if [ -f config/Config.local.toml ]; then \
		cp config/Config.local.toml $(DIST)/config/Config.toml; \
	else \
		cp config/Config.toml $(DIST)/config/Config.toml; \
	fi
	@[ -d data ] && cp -R data $(DIST)/ || true

start: build stage
	@./launchctl.sh start

stop:
	@./launchctl.sh stop

restart: build stage
	@./launchctl.sh restart

run: build stage stop
	@echo "Running $(BINARY) (foreground, Ctrl-C to stop)..."
	cd $(DIST) && ./$(BINARY)

status:
	@./launchctl.sh status

logs:
	@./launchctl.sh logs

kill:
	@echo "Killing stray $(BINARY) processes..."
	@-pkill -f "$(DIST)/$(BINARY)" 2>/dev/null || true
	@-lsof -ti :$(PORT) | xargs kill 2>/dev/null || true

# --- Tests ---

test:
	@echo "Running tests..."
	@go test -timeout 30s ./pkg/...

test-all: stop test

# --- Code quality ---

cleanup:
	@echo "=== Format ==="
	@gofmt -w .
	@echo "=== Modernize ==="
	@go fix ./...
	@echo "=== Vet ==="
	@go vet ./...
	@echo "=== Staticcheck ==="
	@staticcheck ./...
	@echo "=== Vulnerabilities ==="
	@govulncheck ./...
	@echo "=== All clean ==="

# --- JS ---

lint-js:
	@deno lint web/static/js/

fmt-js:
	@deno fmt web/static/js/ web/static/css/

check-js:
	@deno check web/static/js/*.js

# --- Utility ---

run-fetch: build-fetch
	@./$(DIST)/fetch $(ARGS)

run-load: build-load
	@./$(DIST)/load $(ARGS)

clean:
	@rm -rf $(DIST)/
	@echo "Cleaned"

help:
	@echo "Targets:"
	@echo "  build              Build server"
	@echo "  build-fetch        Build fetch CLI"
	@echo "  build-load         Build load CLI"
	@echo "  build-all          Build all binaries"
	@echo "  build-linux-arm64  Cross-compile for AWS Graviton"
	@echo "  build-linux-amd64  Cross-compile for x86 EC2"
	@echo ""
	@echo "  start              Build, stop strays, start server (background)"
	@echo "  stop               Stop server + kill stray processes"
	@echo "  restart            Stop then start"
	@echo "  run                Build, stop strays, run server (foreground)"
	@echo "  status             Check if server is running"
	@echo "  logs               Tail server logs"
	@echo "  kill               Kill stray processes on port $(PORT)"
	@echo ""
	@echo "  test               Run unit tests"
	@echo "  test-all           Stop server + run all tests"
	@echo ""
	@echo "  package            cleanup + test + build-all (release pipeline)"
	@echo "  cleanup            Format + modernize + vet + staticcheck + vulncheck"
	@echo ""
	@echo "  lint-js            Lint JS (deno)"
	@echo "  fmt-js             Format JS/CSS (deno)"
	@echo "  check-js           Type-check JS (deno)"
	@echo ""
	@echo "  run-fetch          Build + run fetch (ARGS='...')"
	@echo "  run-load           Build + run load (ARGS='...')"
	@echo "  clean              Remove dist/ and PID file"
