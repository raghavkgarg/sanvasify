# Mobile Strategy — Alternate Surfaces

Strategy for extending Sanvasify to iOS and Android while leveraging the existing Go backend as the shared core.

## Current Architecture Fitness

The backend is already well-positioned for mobile clients:

- **RESTful JSON API** — fully decoupled from the web frontend; mobile apps consume the same endpoints
- **Store interface abstraction** — business logic lives in `pkg/store` and `pkg/api/handlers.go`, not in the frontend
- **JWT auth with Bearer header** — the auth middleware already accepts `Authorization: Bearer <jwt>`, which is the standard mobile approach
- **Stateless design** — no server-side sessions; scales to mobile without changes

### Shared Core (no changes needed)

| Package | Role |
|---------|------|
| `pkg/store` | Data models and storage interface |
| `pkg/db` | DuckDB queries |
| `pkg/api/handlers.go` | Business logic / HTTP handlers |
| `pkg/fetcher` | AMFI data ingestion |
| `pkg/auth` (JWT validation) | Token verification |

### Web-only (replaced by native UI)

| Component | Role |
|-----------|------|
| `web/static/` | HTML, CSS, JavaScript, ECharts |

## Required Backend Changes

These are additive changes — no restructuring needed.

### 1. API Versioning

Prefix all routes with `/api/v1/`. Mobile apps in the wild can't be force-updated like a web page; versioning lets the API evolve without breaking older releases.

### 2. Pagination

`/api/schemes` and `/api/nav/history` currently return unbounded result sets. Add `?page=1&limit=50` support. Mobile devices have constrained bandwidth and memory.

### 3. Consistent JSON Error Responses

Some handlers use `http.Error()` (plain text), others return `{"error": "..."}`. Standardize all errors to JSON so mobile clients can parse them uniformly.

### 4. CORS Middleware

Not currently configured. Required for development (simulators hitting a remote API) and any future web-based mobile wrapper.

### 5. Mobile OAuth Flow

The current OAuth flow redirects to HTML pages and sets HttpOnly cookies. Mobile apps need:

- A callback endpoint that returns the JWT as a JSON response instead of a redirect
- Support for deep links / custom URL schemes as OAuth redirect URIs
- PKCE (Proof Key for Code Exchange) for public clients that can't hold a client secret

### 6. Rate Limiting

Mobile apps can be chatty. Add per-client rate limiting to protect the backend.

## Mobile Tech Stacks

Following the same project principles: minimal dependencies, lightweight, no unnecessary frameworks.

### Android

**Kotlin + Jetpack Compose** — the modern Android default, no extra frameworks needed.

| Concern | Library | Why |
|---------|---------|-----|
| UI | Jetpack Compose | Built into Android SDK, declarative, no third-party UI framework |
| HTTP | `java.net.HttpURLConnection` or Ktor Client | Ktor is lightweight and Kotlin-native; `HttpURLConnection` needs zero dependencies |
| JSON | `kotlinx.serialization` | Kotlin-native, compile-time, no reflection |
| Charts | MPAndroidChart | Single-purpose, widely used, no bloat |
| Auth | AppAuth for Android | Standard OAuth2/PKCE library from OpenID Foundation |
| Image | Coil | Kotlin-first, lightweight (if needed for fund logos later) |

**Build**: Gradle with Kotlin DSL, standard Android toolchain.

**Min SDK**: API 26 (Android 8.0) — covers 95%+ of active devices.

### iOS

**Swift + SwiftUI** — Apple's native stack, zero third-party UI dependencies.

| Concern | Library | Why |
|---------|---------|-----|
| UI | SwiftUI | Built into iOS SDK, declarative |
| HTTP | `URLSession` | Built into Foundation, no dependency needed |
| JSON | `Codable` | Built into Swift, zero dependencies |
| Charts | Swift Charts (iOS 16+) | Apple's first-party charting framework |
| Auth | ASWebAuthenticationSession | Built-in OAuth/PKCE support, no third-party library |
| Keychain | Security framework | Built-in secure token storage |

**Build**: Xcode, Swift Package Manager for any future dependencies.

**Min target**: iOS 16 — covers 90%+ of active devices; required for Swift Charts.

### Why Not Cross-Platform?

A cross-platform framework (Flutter, React Native, KMP) would add a dependency layer, build complexity, and a runtime that doesn't align with the project's minimal-dependency philosophy. The API surface is small (5 endpoints), the UI is straightforward (list, detail, chart), and native tooling gives:

- Better performance and smaller binary size
- No bridge/runtime overhead
- Direct access to platform APIs (biometrics, keychain, push notifications)
- Simpler debugging and profiling

If maintaining two codebases becomes a burden later, Kotlin Multiplatform (KMP) for shared networking/models with native UI is the lightest cross-platform option — it compiles to native code and doesn't require a runtime.

## Feature Mapping

How web features translate to mobile:

| Web Feature | Mobile Equivalent |
|-------------|-------------------|
| Scheme dropdown + cascading filters | Native search bar + filter sheet |
| ECharts NAV trend chart | MPAndroidChart / Swift Charts |
| OAuth redirect flow | In-app browser (AppAuth / ASWebAuthenticationSession) |
| Browser cookie auth | Keychain/EncryptedSharedPreferences + Bearer token |
| Responsive CSS layout | Native adaptive layout (Compose / SwiftUI) |

## Implementation Order

1. **Backend changes** — API versioning, pagination, JSON errors, mobile OAuth endpoint
2. **One platform first** — pick Android or iOS based on target user base
3. **Core screens** — scheme list with search/filter → scheme detail with NAV chart
4. **Auth** — OAuth login with secure token storage
5. **Second platform** — port to the other OS
6. **Enhancements** — push notifications, offline caching, biometric lock
