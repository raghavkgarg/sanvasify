.PHONY: build build-fetch build-load build-gensecret build-all
.PHONY: build-linux-arm64 build-linux-amd64
.PHONY: test test-all
.PHONY: cleanup lint-js fmt-js check-js clean help

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
	@go build -o dist/sanvasify ./cmd/server/

build-fetch:
	@go build -o dist/fetch ./cmd/fetch/

build-load:
	@go build -o dist/load ./cmd/load/

build-gensecret:
	@go build -o dist/gensecret ./cmd/gensecret/

build-all: build build-fetch build-load build-gensecret

build-linux-arm64:
	@CGO_ENABLED=1 GOOS=linux GOARCH=arm64 \
	CC=$(ARM64_CC) CXX=$(ARM64_CXX) \
	go build -ldflags "-s -w" -o dist/sanvasify-arm64 ./cmd/server/

build-linux-amd64:
	@CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
	CC=$(AMD64_CC) CXX=$(AMD64_CXX) \
	go build -ldflags "-s -w" -o dist/sanvasify-amd64 ./cmd/server/

# --- Tests ---

test:
	@echo "Running tests..."
	@go test -timeout 30s ./pkg/...

test-all: test

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
	@deno lint

fmt-js:
	@deno fmt

check-js:
	@deno check web/v1/js/*.js

# --- Utility ---

clean:
	@rm -rf dist/
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
	@echo "  test               Run tests"
	@echo "  test-all           Run all tests"
	@echo ""
	@echo "  cleanup            Format + modernize + vet + staticcheck + vulncheck"
	@echo ""
	@echo "  lint-js            Lint JS (deno)"
	@echo "  fmt-js             Format JS (deno)"
	@echo "  check-js           Type-check JS (deno)"
	@echo ""
	@echo "  clean              Remove dist/"
