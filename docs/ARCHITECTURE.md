# Architecture

## System Overview

Sanvasify is a Go-based web application for browsing and analyzing mutual fund schemes in India. It follows a clean architecture with clear separation of concerns.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  HTML    │  │   CSS    │  │JavaScript│  │  Charts  │   │
│  │  Pages   │  │  Styles  │  │  Logic   │  │ (ECharts)│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/JSON
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Server (Go)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    HTTP Handlers                      │  │
│  │  • Schemes  • Search  • Filters  • Auth  • NAV      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Middleware                          │  │
│  │  • Logging  • CORS  • Auth  • Error Handling        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Business Logic                       │  │
│  │  • JWT Manager  • OAuth Manager  • Store Interface  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (DuckDB)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ sif_schemes  │  │    users     │  │   Indexes    │     │
│  │   (NAV data) │  │  (auth data) │  │ (performance)│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage (Parquet)                          │
│  • nav_data.parquet (historical NAV data)                   │
│  • Columnar format for efficient queries                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │     AMFI     │  │    Google    │  │   GitHub     │     │
│  │  (NAV data)  │  │    OAuth     │  │    OAuth     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend Layer

**Technology**: Vanilla JavaScript, HTML5, CSS3

**Components**:
- `index.html`: Main application page with scheme browser
- `login.html`: OAuth login page
- `app.js`: Scheme search and filtering logic
- `navigation.js`: Shared navigation with user menu
- `login.js`: OAuth login flow
- `style.css`: Application styles
- `login.css`: Login page styles

**Responsibilities**:
- User interface rendering
- API communication
- Client-side filtering
- Chart visualization (Apache ECharts)
- OAuth flow initiation

### 2. API Server Layer

**Technology**: Go 1.25, standard library `net/http`

**Packages**:

#### `pkg/api`
- `server.go`: HTTP server setup and lifecycle
- `routes.go`: Route registration and middleware
- `handlers.go`: HTTP request handlers
- `store.go`: Store interface definition

**Responsibilities**:
- HTTP request handling
- JSON serialization
- Middleware execution
- Graceful shutdown

#### `pkg/auth`
- `auth.go`: Core types, JWT manager, OAuth manager, middleware
- `handlers.go`: Auth endpoints (login, callback, logout, me)
- `store.go`: User database operations

**Responsibilities**:
- JWT token generation and validation
- OAuth2 flow management
- User authentication and authorization
- Session management

#### `pkg/conf`
- `config.go`: Configuration loading and validation

**Responsibilities**:
- TOML config parsing
- Environment variable override
- Configuration validation

#### `pkg/db`
- `db.go`: DuckDB integration and query execution

**Responsibilities**:
- Database connection management
- SQL query execution
- Result mapping to Go structs
- Index management

#### `pkg/fetcher`
- `fetcher.go`: AMFI data fetching
- `converter.go`: Text to Parquet conversion
- `range.go`: Date range generation

**Responsibilities**:
- HTTP requests to AMFI
- Data parsing and transformation
- Parquet file generation
- Error handling and retry logic

#### `pkg/nav`
- `nav_report.go`: NAV data parsing

**Responsibilities**:
- Text format parsing
- Data structure mapping
- Legacy format support

### 3. Data Layer

**Technology**: DuckDB (embedded analytical database)

**Schema**:

```sql
-- Scheme data
CREATE TABLE sif_schemes (
    scheme_code VARCHAR,
    scheme_name VARCHAR,
    isin_div_payout_growth VARCHAR,
    isin_div_reinvestment VARCHAR,
    net_asset_value DOUBLE,
    repurchase_price DOUBLE,
    sale_price DOUBLE,
    date DATE,
    strategy_name VARCHAR,
    fund_house_name VARCHAR,
    fund_type VARCHAR,
    fund_company VARCHAR,
    fund_strategy VARCHAR,
    distribution_option VARCHAR,
    purchase_mode VARCHAR
);

CREATE INDEX idx_scheme_code ON sif_schemes(scheme_code);
CREATE INDEX idx_date ON sif_schemes(date);

-- User data
CREATE TABLE users (
    id VARCHAR PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR,
    provider VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL,
    last_login TIMESTAMP NOT NULL
);
```

**Responsibilities**:
- Persistent data storage
- Efficient querying with indexes
- ACID transactions
- Parquet file integration

### 4. Storage Layer

**Technology**: Apache Parquet (columnar storage format)

**Files**:
- `data/nav_reports/nav_data.parquet`: Historical NAV data

**Responsibilities**:
- Efficient columnar storage
- Compression
- Fast analytical queries
- Schema evolution

## Data Flow

### Scheme Search Flow

```
User Input → Frontend Filter → API Request → Database Query → Result Set → JSON Response → UI Update
```

1. User enters search criteria
2. Frontend builds query parameters
3. API receives GET /api/search request
4. Database executes filtered query with ILIKE
5. Results mapped to Go structs
6. JSON serialization
7. Frontend renders results

### Authentication Flow

```
Login Click → OAuth Redirect → Provider Auth → Callback → Token Exchange → User Info → JWT Generation → Cookie Set → Redirect Home
```

1. User clicks "Login with Google/GitHub"
2. Frontend redirects to `/api/auth/login?provider=google`
3. Server generates state token, redirects to OAuth provider
4. User authorizes on provider's site
5. Provider redirects to `/api/auth/callback/google?code=...&state=...`
6. Server validates state, exchanges code for access token
7. Server fetches user info from provider API
8. Server creates/updates user in database
9. Server generates JWT, sets HttpOnly cookie
10. Server redirects to home page
11. Frontend loads user info from `/api/auth/me`

### Data Fetching Flow

```
Cron Job → Fetch Command → AMFI Request → Parse Response → Convert to Parquet → Append to File → Database Load
```

1. Scheduled cron job triggers fetch command
2. Fetcher generates date range
3. For each date, HTTP request to AMFI
4. Parse semicolon-delimited text response
5. Convert to Parquet format
6. Append to existing Parquet file
7. Server restart loads new data into database

## Design Decisions

### Why DuckDB?

- **Embedded**: No separate database server needed
- **Analytical**: Optimized for OLAP queries
- **Parquet Integration**: Native Parquet support
- **Performance**: Fast aggregations and filters
- **Simple Deployment**: Single binary + data file

### Why Parquet?

- **Columnar**: Efficient for analytical queries
- **Compression**: Smaller file sizes
- **Schema**: Strongly typed with schema evolution
- **Interoperability**: Standard format, works with many tools

### Why OAuth2?

- **Security**: No password storage
- **User Experience**: Single sign-on with existing accounts
- **Trust**: Users trust Google/GitHub more than new sites
- **Maintenance**: No password reset flows needed

### Why JWT?

- **Stateless**: No server-side session storage
- **Scalable**: Works across multiple servers
- **Standard**: Industry-standard token format
- **Flexible**: Can include custom claims

### Why Vanilla JavaScript?

- **Simplicity**: No build step or dependencies
- **Performance**: Fast load times
- **Maintainability**: Easy to understand and modify
- **Compatibility**: Works in all modern browsers

## Security Architecture

### Authentication

- **OAuth2**: Industry-standard authorization protocol
- **JWT**: Signed tokens with expiration
- **HttpOnly Cookies**: Prevents XSS attacks
- **CSRF Protection**: State parameter in OAuth flow

### Authorization

- **Middleware**: Centralized auth checking
- **Context Propagation**: User info in request context
- **Token Validation**: Signature and expiration checks

### Data Protection

- **SQL Injection**: Parameterized queries
- **XSS**: JSON encoding, no HTML rendering
- **Secrets Management**: Environment variables
- **HTTPS**: Required for OAuth in production

## Performance Characteristics

### Database

- **Indexes**: O(log n) lookups by scheme_code and date
- **Queries**: Optimized with DISTINCT ON for latest NAV
- **Memory**: Efficient columnar storage

### API

- **Concurrency**: Go's goroutines handle multiple requests
- **Timeouts**: Read/write/idle timeouts prevent resource exhaustion
- **Graceful Shutdown**: 30-second grace period for in-flight requests

### Frontend

- **Static Assets**: Served directly by Go server
- **Caching**: Browser caching for static files
- **Lazy Loading**: Charts loaded only when needed

## Scalability

### Current Limitations

- Single server instance
- No caching layer
- No pagination
- No rate limiting

### Scaling Options

1. **Horizontal Scaling**:
   - Multiple server instances behind load balancer
   - Shared database (network DuckDB or migrate to PostgreSQL)
   - Redis for session storage

2. **Vertical Scaling**:
   - Increase server resources (CPU, RAM)
   - Optimize database indexes
   - Add query caching

3. **Caching**:
   - Redis for frequently accessed data
   - CDN for static assets
   - HTTP caching headers

4. **Database**:
   - Read replicas for query distribution
   - Partitioning by date
   - Materialized views for aggregations

## Monitoring and Observability

### Logging

- **Structured Logging**: JSON format with `slog`
- **Log Levels**: Debug, Info, Warn, Error
- **Context**: Request ID, user ID, source location
- **Dual Output**: stdout + file

### Metrics (Future)

- Request count and latency
- Database query performance
- Authentication success/failure rates
- Error rates by endpoint

### Tracing (Future)

- Distributed tracing with OpenTelemetry
- Request flow visualization
- Performance bottleneck identification

## Future Enhancements

### Technical

- GraphQL API
- WebSocket for real-time updates
- Server-side rendering
- Progressive Web App (PWA)
- Docker containerization
- Kubernetes deployment

### Features

- User portfolios
- Price alerts
- Comparison tools
- Export to CSV/Excel
- Mobile app
- Email notifications

### Performance

- Query result caching
- Pagination
- Lazy loading
- Service worker for offline support
- Database query optimization

### Security

- Rate limiting
- API key authentication
- Two-factor authentication
- Audit logging
- Security headers
