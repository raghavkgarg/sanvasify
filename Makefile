UNAME_S := $(shell uname -s)

# Detect architecture of the cross-compiler based on host OS
ifeq ($(UNAME_S),Darwin)
	# Detect Homebrew prefix (usually /opt/homebrew on Apple Silicon)
	BREW_PREFIX := $(shell command -v brew >/dev/null 2>&1 && brew --prefix || echo "/opt/homebrew")
	# macOS paths (via Homebrew messense tap)
	ARM64_CC  = $(BREW_PREFIX)/bin/aarch64-unknown-linux-gnu-gcc
	ARM64_CXX = $(BREW_PREFIX)/bin/aarch64-unknown-linux-gnu-g++
	AMD64_CC  = $(BREW_PREFIX)/bin/x86_64-unknown-linux-gnu-gcc
	AMD64_CXX = $(BREW_PREFIX)/bin/x86_64-unknown-linux-gnu-g++
else
	# Linux paths (native or standard packages)
	ARM64_CC  ?= aarch64-linux-gnu-gcc
	ARM64_CXX ?= aarch64-linux-gnu-g++
	AMD64_CC  ?= x86_64-linux-gnu-gcc
	AMD64_CXX ?= x86_64-linux-gnu-g++
endif

.PHONY: build-linux-arm64 build-linux-amd64 clean

# Build for AWS Graviton (ARM64)
build-linux-arm64:
	CGO_ENABLED=1 GOOS=linux GOARCH=arm64 \
	CC=$(ARM64_CC) CXX=$(ARM64_CXX) \
	go build -ldflags "-s -w" -o sanvasify cmd/server/main.go

# Build for Standard EC2 (AMD64)
build-linux-amd64:
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
	CC=$(AMD64_CC) CXX=$(AMD64_CXX) \
	go build -ldflags "-s -w" -o sanvasify cmd/server/main.go

clean:
	rm -f sanvasify