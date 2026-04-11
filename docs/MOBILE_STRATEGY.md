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

### Cross-Platform: Flutter

Flutter (3.41 / Dart 3.11 as of early 2026) is the most viable cross-platform option for this project. Impeller is now the default rendering engine across all platforms, solving the historical jank/shader compilation issues. WebAssembly compilation for Flutter web is stable.

| Concern | Library | Why |
|---------|---------|-----|
| UI | Flutter widgets (Material / Cupertino) | Built-in, declarative, single codebase |
| HTTP | `http` / `dio` | Lightweight Dart-native HTTP clients |
| JSON | `json_serializable` + `json_annotation` | Compile-time codegen, no reflection |
| Charts | `fl_chart` or `syncfusion_flutter_charts` | Mature, single implementation for both platforms |
| Auth | `flutter_appauth` | Wraps AppAuth on both platforms, PKCE support |
| Secure Storage | `flutter_secure_storage` | Wraps Keychain (iOS) + EncryptedSharedPreferences (Android) |

**Pros vs. native-per-platform:**

- Single codebase — eliminates the "port to the other OS" step entirely
- Hot reload for fast UI iteration
- Pixel-perfect UI parity across platforms
- Can also target web, potentially replacing `web/static/` entirely
- One charting library instead of mapping between MPAndroidChart and Swift Charts
- One auth library instead of AppAuth + ASWebAuthenticationSession

**Kotlin/Swift involvement:** Flutter doesn't eliminate native languages entirely. Every Flutter app has `android/` and `ios/` directories with native project scaffolding (Gradle config, `AppDelegate.swift`, `AndroidManifest.xml`). Kotlin/Swift shows up in two cases:

- **Platform boilerplate** — configuring deep links for OAuth redirects, setting permissions, updating build settings. This is config-level work, not application logic.
- **Platform channels** — when native functionality isn't covered by an existing plugin (or a plugin is broken/abandoned), you write a thin Kotlin/Swift bridge. For Sanvasify this is unlikely — HTTP, charts, secure storage, and OAuth all have mature plugins.

In practice, expect ~95% Dart and occasional native config edits. Compare this to the native strategy where 100% of UI, networking, JSON parsing, and business logic is written twice.

**Cons vs. native-per-platform:**

- Adds a runtime + rendering engine — contradicts the minimal-dependency philosophy
- Binary size ~15-20MB vs. 3-5MB for native apps this simple
- Dart is a third language alongside Go, Kotlin, and Swift
- Plugin ecosystem quality is uneven; some plugins are abandoned or poorly maintained
- Platform-specific behavior still requires platform channels (native code anyway)
- Debugging adds a layer of indirection vs. native tooling (Android Studio profiler, Xcode Instruments)
- Web performance still not on par with native HTML/CSS/JS for content-heavy apps (adequate for this project)

**Current Flutter pain points (2026):**

- Hot reload occasionally breaks on complex state changes
- Platform channels needed when plugins don't exist or break
- Web target works but is heavier than hand-written HTML/CSS/JS

### Hybrid: iOS Native + Android PWA

Leverage the existing web frontend for Android users while building a native iOS app. Apple controls the full stack (hardware, OS, SDK) so SwiftUI, Swift Charts, URLSession, Keychain, and ASWebAuthenticationSession work together seamlessly. Android's ecosystem is more fragmented, but its Chrome browser has strong PWA support — and Sanvasify's feature set is almost entirely PWA-compatible.

**PWA compatibility for Sanvasify features:**

| Feature | PWA support | Native needed? |
|---------|------------|----------------|
| API calls + JSON | Yes | No |
| List/search/filter | Yes | No |
| Charts (NAV trends) | Yes (ECharts already works) | No |
| OAuth login | Yes (redirect flow) | No |
| Secure token storage | Limited (localStorage, not Keychain-grade) | Preferred |
| Offline access | Service worker caching | Nice to have |
| Push notifications | Yes (Web Push on Android) | Nice to have |
| App Store presence | No (sideload via browser) | Yes if needed |

**Pros:**

- Zero additional Android code — the existing `web/static/` frontend serves Android users directly
- One native codebase (Swift/SwiftUI) instead of two
- The web app already works — nothing new to build for Android
- Android Chrome supports install-to-home-screen, service workers, and Web Push
- Avoids Android fragmentation entirely

**Cons:**

- No Play Store presence — Android users install from the browser (or wrap in a TWA/Trusted Web Activity for Play Store listing with minimal effort)
- Token storage is `localStorage` not EncryptedSharedPreferences — acceptable for a mutual fund browser, not for a banking app
- No biometric lock on Android (unless using TWA with native glue)
- Two different UX paradigms — native iOS feel vs. web feel on Android
- PWA on Android still feels like a web page in edge cases (pull-to-refresh behavior, back button handling, splash screen)

### Cross-Platform: Kotlin Multiplatform (KMP)

If maintaining two codebases becomes a burden but Flutter's runtime overhead is undesirable, KMP for shared networking/models with native UI is the lightest cross-platform option — it compiles to native code and doesn't require a runtime.

### Dev Toolchain Requirements

| Strategy | Required Tools | Disk footprint |
|----------|---------------|----------------|
| Native both | Xcode, Android Studio, Kotlin/Gradle, Swift/SPM | ~20GB+ |
| Flutter | Xcode, Android Studio, Flutter SDK, Dart SDK | ~25GB+ |
| iOS native + Android PWA | Xcode only | ~12GB |
| PWA only | Browser + existing Go/JS toolchain | Minimal |

- **Xcode** (~12GB) — required for any iOS development: building, signing, simulator, provisioning profiles
- **Android Studio** (~8GB) — required for Android builds: Kotlin, Gradle, SDK manager, emulator images
- **Flutter SDK** — adds ~3GB on top; still needs both Xcode and Android Studio for platform builds and signing
- **PWA** — no additional tooling; the existing development setup (Go backend + browser dev tools) is sufficient

The hybrid (iOS native + Android PWA) strategy eliminates Android Studio entirely, which is a meaningful reduction in toolchain complexity and maintenance overhead (SDK updates, Gradle version management, emulator upkeep).

### Recommendation

**Effort comparison:**

| Strategy | Codebases | Languages | Effort |
|----------|-----------|-----------|--------|
| Native both | 2 mobile + 1 backend | Go, Kotlin, Swift | High |
| Flutter | 1 mobile + 1 backend | Go, Dart | Medium |
| iOS native + Android PWA | 1 mobile + 1 web (exists) + 1 backend | Go, Swift, JS (exists) | Low |
| PWA only | 1 web (exists) + 1 backend | Go, JS (exists) | Lowest |

The native-per-platform approach aligns with the project's minimal-dependency philosophy. Flutter is pragmatic for a solo maintainer — the app is simple enough that it won't hit Flutter's rough edges, and maintaining two native codebases is real cost.

The iOS native + Android PWA hybrid offers the best effort-to-value ratio for Sanvasify specifically: the web frontend already exists and does everything the app needs, the app doesn't require deep Android platform integration, and iOS users get the premium native experience they expect. The main tradeoff is no Play Store distribution without a TWA wrapper.

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
