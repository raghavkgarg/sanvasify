# Cross-Compilation Guide: macOS → Linux (AWS EC2)

This guide explains how to build the Sanvasify binary on macOS for Linux servers (AWS EC2).

**Why is this needed?**
Sanvasify uses **DuckDB**, which relies on CGO and C++ standard libraries. Standard Go cross-compilation (`GOOS=linux go build`) fails because macOS does not have Linux C/C++ libraries. We use a dedicated cross-compiler toolchain to fix this.

## 1. Install Cross-Compiler Toolchain

We use `messense/macos-cross-toolchains` which provides a complete GCC toolchain for Linux on macOS.

### Option A: For Standard EC2 (AMD64 / x86_64)
*Most common (e.g., t2.micro, t3.medium, m5.large)*

```bash
brew install messense/macos-cross-toolchains/x86_64-unknown-linux-gnu
```

### Option B: For Graviton EC2 (ARM64)
*Newer/Cheaper (e.g., t4g.micro, c6g.large)*

```bash
brew install messense/macos-cross-toolchains/aarch64-unknown-linux-gnu
```

## 2. Build the Binary

Run the build command for your target architecture from the project root.

### Build for AMD64 (Standard Intel/AMD)

```bash
CC=x86_64-unknown-linux-gnu-gcc \
CXX=x86_64-unknown-linux-gnu-g++ \
CGO_ENABLED=1 \
GOOS=linux \
GOARCH=amd64 \
go build -ldflags "-s -w" -o sanvasify cmd/server/main.go
```

### Build for ARM64 (Graviton)

```bash
CC=aarch64-unknown-linux-gnu-gcc \
CXX=aarch64-unknown-linux-gnu-g++ \
CGO_ENABLED=1 \
GOOS=linux \
GOARCH=arm64 \
go build -ldflags "-s -w" -o sanvasify cmd/server/main.go
```

## 3. Verify the Binary

Check that the binary was built for the correct OS and Architecture:

```bash
file sanvasify
```

**Expected Output (AMD64):**
> sanvasify: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked...

**Expected Output (ARM64):**
> sanvasify: ELF 64-bit LSB executable, ARM aarch64, version 1 (SYSV), dynamically linked...

## 4. Deploy to AWS

Once built, copy the binary to your server:

```bash
# Replace key.pem and IP with your actual values
scp -i "sn1.pem" sanvasify ec2-user@13.234.173.198:~/

# On the server:
# 1. Stop service: sudo systemctl stop sanvasify
# 2. Move binary:  sudo mv ~/sanvasify /opt/sanvasify/bin/
# 3. Permission:   sudo chmod +x /opt/sanvasify/bin/sanvasify
# 4. Start service: sudo systemctl start sanvasify
```