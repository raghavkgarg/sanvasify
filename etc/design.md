# Sanvasify Application Design

## Application Design

*   **Language:** Go
*   **Framework:** Standard library `net/http`
*   **Architecture:**
    *   `main` package for application entry point.
    *   `pkg/server` package for web server logic (handlers, routing, etc.).
    *   `pkg/conf` package for configuration loading.
    *   `pkg/nav` package for data parsing and processing.
    *   In-memory `Store` for efficient data lookups.
*   **Configuration:**
    *   Configuration is loaded from `config/Config.toml`.
    *   The configuration includes the input data file path and the server port.
*   **Frontend:**
    *   Static HTML, CSS, and JavaScript files are served from the `web/static` directory.
    *   The frontend communicates with the backend via a JSON API.

## Performance Characteristics

*   **Data Loading:** The application loads the entire data file into memory on startup. This can lead to a long startup time and high memory usage if the data file is large.
*   **Data Access:** The data is stored in an in-memory `Store` with maps for efficient lookups. This makes data access very fast (O(1) for lookups by code).
*   **API Performance:** The API endpoints that use the `Store` for lookups are very performant. The `handleSearch` function, while improved, still iterates over all schemes, which could be slow for large datasets.
*   **Scalability:** The application runs as a single instance. It can be scaled by running multiple instances behind a load balancer, but there is no shared state between instances. Each instance would have its own in--memory copy of the data.
