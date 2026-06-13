# API Reference

## Overview

Sanvasify provides a RESTful JSON API for accessing mutual fund scheme data and authentication.

Base URL: `http://localhost:8080/api`

## Scheme Endpoints

### Get All Schemes

Returns all schemes with their latest NAV.

```
GET /api/schemes
```

**Response**:
```json
[
  {
    "scheme_code": "123456",
    "scheme_name": "ABC Equity Fund - Direct Plan - Growth",
    "isin_div_payout_growth": "INF123456789",
    "isin_div_reinvestment": "",
    "net_asset_value": 125.45,
    "repurchase_price": 0,
    "sale_price": 0,
    "date": "2026-01-26",
    "strategy_name": "Equity",
    "fund_house_name": "ABC Mutual Fund",
    "fund_type": "Open Ended",
    "fund_company": "ABC",
    "fund_strategy": "Large Cap",
    "distribution_option": "Growth",
    "purchase_mode": "Direct"
  }
]
```

### Get Scheme by Code

Returns latest NAV details for a specific scheme.

```
GET /api/nav?code=<scheme_code>
```

**Parameters**:
- `code` (required): Scheme code

**Response**:
```json
{
  "scheme_code": "123456",
  "scheme_name": "ABC Equity Fund - Direct Plan - Growth",
  "net_asset_value": 125.45,
  "date": "2026-01-26",
  ...
}
```

**Error Response** (404):
```json
{
  "error": "Scheme not found"
}
```

### Get Historical NAV

Returns historical NAV data for a specific scheme.

```
GET /api/nav/history?code=<scheme_code>
```

**Parameters**:
- `code` (required): Scheme code

**Response**:
```json
[
  {
    "date": "2026-01-20",
    "net_asset_value": 123.45
  },
  {
    "date": "2026-01-21",
    "net_asset_value": 124.12
  },
  {
    "date": "2026-01-26",
    "net_asset_value": 125.45
  }
]
```

**Error Response** (404):
```json
{
  "error": "No history found for scheme"
}
```

### Search Schemes

Search schemes with multiple filter criteria.

```
GET /api/search?<filters>
```

**Parameters** (all optional):
- `fund_type`: Fund type (e.g., "Open Ended")
- `fund_company`: Company name (e.g., "HDFC")
- `fund_strategy`: Strategy (e.g., "Large Cap")
- `strategy_name`: Strategy category (e.g., "Equity")
- `distribution_option`: Distribution option (e.g., "Growth")
- `purchase_mode`: Purchase mode (e.g., "Direct")

**Example**:
```
GET /api/search?fund_type=Open%20Ended&fund_strategy=Large%20Cap&purchase_mode=Direct
```

**Response**:
```json
[
  {
    "scheme_code": "123456",
    "scheme_name": "ABC Equity Fund - Direct Plan - Growth",
    "net_asset_value": 125.45,
    ...
  }
]
```

### Get Filter Options

Returns unique values for all filter categories.

```
GET /api/filters
```

**Response**:
```json
{
  "fund_type": ["Open Ended", "Close Ended", "Interval Fund"],
  "fund_company": ["HDFC", "ICICI", "SBI", ...],
  "fund_strategy": ["Large Cap", "Mid Cap", "Small Cap", ...],
  "strategy_name": ["Equity", "Debt", "Hybrid", ...],
  "distribution_option": ["Growth", "Dividend Payout", "Dividend Reinvestment"],
  "purchase_mode": ["Direct", "Regular"]
}
```

## Authentication Endpoints

Available when `auth.enabled = true` in config.

### Initiate Login

Redirects to OAuth provider for authentication.

```
GET /api/auth/login?provider=<provider>
```

**Parameters**:
- `provider` (required): `google` or `github`

**Response**: HTTP 302 redirect to OAuth provider

### OAuth Callback

Handles OAuth callback from provider.

```
GET /api/auth/callback/google?code=<code>&state=<state>
GET /api/auth/callback/github?code=<code>&state=<state>
```

**Parameters** (provided by OAuth provider):
- `code`: Authorization code
- `state`: CSRF protection token

**Response**: HTTP 302 redirect to home page with auth cookie set

**Error Response** (400):
```json
{
  "error": "Invalid state parameter"
}
```

### Get Current User

Returns information about the currently authenticated user.

```
GET /api/auth/me
```

**Headers**:
- `Cookie: auth_token=<jwt>` (set automatically by browser)
- OR `Authorization: Bearer <jwt>`

**Response**:
```json
{
  "id": "google:user@example.com",
  "email": "user@example.com",
  "name": "John Doe",
  "provider": "google",
  "created_at": "2026-01-26T10:00:00Z",
  "last_login": "2026-01-26T15:30:00Z"
}
```

**Error Response** (401):
```json
{
  "error": "Unauthorized"
}
```

### Logout

Clears authentication cookie and logs out user.

```
GET /api/auth/logout
```

**Response**: HTTP 302 redirect to login page with cookie cleared

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "error": "Error message description"
}
```

## Rate Limiting

Currently no rate limiting is implemented. Consider adding rate limiting for production deployments.

## CORS

CORS is not configured by default. Add CORS middleware if serving frontend from different domain.

## Authentication

When authentication is enabled:
- Protected endpoints require valid JWT token
- Token provided via `auth_token` cookie or `Authorization` header
- Token expires after `jwt_expiry_hours` (default: 24 hours)
- Expired tokens return 401 Unauthorized

## Data Freshness

- `/api/schemes` returns latest NAV per scheme
- `/api/nav` returns latest NAV for specific scheme
- `/api/nav/history` returns all historical data
- Data updated when new Parquet files loaded (requires server restart)

## Performance

- All queries use database indexes for optimal performance
- Historical queries may be slower for schemes with many data points
- Consider pagination for large result sets (not currently implemented)

## Examples

### cURL Examples

**Get all schemes**:
```bash
curl http://localhost:8080/api/schemes
```

**Search schemes**:
```bash
curl "http://localhost:8080/api/search?fund_type=Open%20Ended&purchase_mode=Direct"
```

**Get historical NAV**:
```bash
curl "http://localhost:8080/api/nav/history?code=123456"
```

**Login with Google**:
```bash
curl -L http://localhost:8080/api/auth/login?provider=google
```

**Get current user**:
```bash
curl -H "Authorization: Bearer <jwt>" http://localhost:8080/api/auth/me
```

### JavaScript Examples

**Fetch all schemes**:
```javascript
fetch('/api/schemes')
  .then(res => res.json())
  .then(schemes => console.log(schemes));
```

**Search schemes**:
```javascript
const params = new URLSearchParams({
  fund_type: 'Open Ended',
  purchase_mode: 'Direct'
});

fetch(`/api/search?${params}`)
  .then(res => res.json())
  .then(schemes => console.log(schemes));
```

**Get historical NAV**:
```javascript
fetch('/api/nav/history?code=123456')
  .then(res => res.json())
  .then(history => console.log(history));
```

**Get current user**:
```javascript
fetch('/api/auth/me', {
  credentials: 'include'  // Include cookies
})
  .then(res => res.json())
  .then(user => console.log(user));
```

## Future Enhancements

Potential API improvements:
- Pagination for large result sets
- Sorting options
- Date range filtering for historical data
- Aggregated statistics endpoints
- Rate limiting
- API versioning
- GraphQL endpoint
