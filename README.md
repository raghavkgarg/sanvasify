# Sanvasify

Sanvasify is a web application that allows users to browse, search, and filter information about mutual funds. It provides a simple and intuitive interface for exploring a large dataset of fund schemes.

## Project Structure

The project follows a standard Go application layout to keep the codebase organized and maintainable.

```
sanvasify/
├── cmd/
│   └── server/
│       └── main.go
├── pkg/
│   ├── conf/
│   │   └── config.go
│   ├── nav/
│   │   └── nav_report.go
│   └── api/
│       ├── handlers.go
│       ├── routes.go
│       ├── server.go
│       └── store.go
├── config/
│   ├── Config.toml
│   └── nav_report_2026-01-18.txt
├── web/
│   └── static/
│       ├── css/
│       │   └── style.css
│       ├── js/
│       │   └── app.js
│       └── index.html
├── etc/
│   ├── architecture.d2
│   ├── architecture.svg
│   ├── design.md
│   ├── fund_struct.txt
│   └── TODO.txt
├── go.mod
├── go.sum
└── README.md
```

-   `cmd/server/main.go`: The main entry point for the web server application.
-   `pkg/conf/`: Contains the configuration loading logic.
-   `pkg/nav/`: Handles parsing and processing of the mutual fund data.
-   `pkg/api/`: Contains the web server logic, including handlers, routing, and data storage.
-   `config/`: Configuration files and data sources.
-   `web/static/`: Contains all the frontend assets (HTML, CSS, JavaScript).
-   `etc/`: Documentation, architecture diagrams, and design notes.
-   `go.mod`: Defines the Go module and its dependencies.

## Getting Started

To run the web server on your local machine:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/raghavkgarg/sanvasify.git
    cd sanvasify
    ```

2.  **Run the application:**
    ```bash
    go build -o dist/sanvasify ./cmd/server
    cd dist
    ./sanvasify
    ```

3.  The server will start, and you can access the website at `http://localhost:8080` (or the port specified in your `config/Config.toml`).

## Configuration

The application is configured using the `config/Config.toml` file.

```toml
input_file = "config/nav_report_2026-01-18.txt"

[server]
port = 8080
```

-   `input_file`: The path to the mutual fund data file.
-   `server.port`: The port for the server to listen on.

## API Endpoints

The server exposes the following JSON API endpoints:

-   `GET /api/schemes`: Returns a list of all available mutual fund schemes.
-   `GET /api/nav?code=<scheme_code>`: Returns the details of a specific scheme by its code.
-   `GET /api/filters`: Returns a list of unique values for all filter categories (fund type, strategy, company, etc.).
-   `GET /api/search?fund_type=<type>&...`: Searches for schemes based on the provided filter criteria.

## Build and Deployment

To build a production-ready binary for Linux (ARM64):

```bash
GOOS=linux GOARCH=arm64 go build -o sanvasify-server ./cmd/server
```

This will create a single `sanvasify-server` binary that can be deployed to a server. You will also need to copy the `config/` and `web/` directories to the server.
