# Sanvasify Static Web Server

A simple, robust, and production-ready static file server written in Go. This project serves a standard HTML, CSS, and JavaScript website and is designed for cross-compilation and deployment on ARM64 Linux servers, such as AWS EC2 t4g instances.

## Features

-   **Configurable:** Set the server port and static file directory via command-line flags.
-   **Request Logging:** All incoming requests are logged to standard output with their method, path, and duration, providing visibility into server traffic.
-   **Graceful Shutdown:** The server shuts down gracefully on a `SIGINT` or `SIGTERM` signal, ensuring in-flight requests are completed before the process exits.
-   **Production Hardened:** Includes sensible timeouts for reading requests and writing responses to prevent resource exhaustion from slow clients.

## Project Structure

The project is organized to keep backend, frontend, and documentation separate and clean.

```
sanvasify/
├── go.mod
├── main.go
└── ui/
    └── static/
        ├── css/
        │   └── style.css
        ├── js/
        │   └── app.js
        └── index.html
```

-   `main.go`: The Go web server application.
-   `go.mod`: Defines the Go module.
-   `ui/static/`: Contains all frontend assets (HTML, CSS, JS, images, etc.).

## Prerequisites

-   Go (version 1.22 or newer recommended)
-   An AWS account with a configured EC2 instance (for deployment)
-   An SSH key pair for accessing the EC2 instance

## Getting Started

### Local Development

To run the web server on your local machine for development:

1.  Navigate to the project root directory:
    ```bash
    cd /path/to/myGo/sanvasify
    ```

2.  Run the application:
    ```bash
    go run .
    ```

3.  The server will start, and you can access the website at `http://localhost:8080`.

### Configuration

The server can be configured with command-line flags:

-   `-port`: The port for the server to listen on. (Default: `8080`)
-   `-dir`: The directory to serve static files from. (Default: `ui/static`)

**Example:** Run on port 3000 and serve files from a `dist` directory.
```bash
go run . -port 3000 -dir dist
```

## Build Process

To prepare the application for production, you need to cross-compile it from your development machine (macOS ARM64) for the target production server (Linux ARM64).

Run the following command from the project root:

```bash
GOOS=linux GOARCH=arm64 go build -o sanvasify-server .
```

This command creates a single, self-contained binary named `sanvasify-server` that is ready for deployment.

## Deployment to AWS EC2

This workflow details how to deploy and run the application on a `t4g.micro` EC2 instance.

### 1. EC2 Security Group Rules

Ensure your EC2 instance's security group has the following **inbound rules**:

-   **SSH (Port 22):** To allow you to connect and copy files. Set the source to your IP for security.
-   **HTTP (Port 80):** To allow public web traffic to your site. Set the source to `Anywhere-IPv4` (`0.0.0.0/0`).

### 2. Copy Files to EC2

Use `scp` to securely copy the compiled binary and the static assets to your EC2 instance. Replace the placeholders with your key path and instance IP/DNS.

```bash
# Copy the compiled binary
scp -i /path/to/your-key.pem ./sanvasify-server ec2-user@your-ec2-ip:~/

# Copy the entire 'ui' directory containing your static files
scp -i /path/to/your-key.pem -r ./ui ec2-user@your-ec2-ip:~/
```

### 3. Run the Server

Connect to your instance via SSH and run the server.

```bash
# 1. SSH into the instance
ssh -i /path/to/your-key.pem ec2-user@your-ec2-ip

# 2. Make the binary executable
chmod +x ./sanvasify-server

# 3. Run the server on port 80 in the background
sudo nohup ./sanvasify-server -port 80 -dir ./ui/static > server.log 2>&1 &
```

Your website is now live and accessible via your EC2 instance's public IP address. You can check `server.log` for any application logs.