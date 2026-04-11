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

## Mobile Strategies

Five approaches evaluated, from highest to lowest effort.

### Strategy 1: Native Per-Platform

Separate native apps for each platform. Aligns with the project's minimal-dependency philosophy.

#### Android — Kotlin + Jetpack Compose

| Concern | Library | Why |
|---------|---------|-----|
| UI | Jetpack Compose | Built into Android SDK, declarative, no third-party UI framework |
| HTTP | `java.net.HttpURLConnection` or Ktor Client | Ktor is lightweight and Kotlin-native; `HttpURLConnection` needs zero dependencies |
| JSON | `kotlinx.serialization` | Kotlin-native, compile-time, no reflection |
| Charts | MPAndroidChart | Single-purpose, widely used, no bloat |
| Auth | AppAuth for Android | Standard OAuth2/PKCE library from OpenID Foundation |
| Image | Coil | Kotlin-first, lightweight (if needed for fund logos later) |

Build: Gradle with Kotlin DSL. Min SDK: API 26 (Android 8.0) — covers 95%+ of active devices.

#### iOS — Swift + SwiftUI

| Concern | Library | Why |
|---------|---------|-----|
| UI | SwiftUI | Built into iOS SDK, declarative |
| HTTP | `URLSession` | Built into Foundation, no dependency needed |
| JSON | `Codable` | Built into Swift, zero dependencies |
| Charts | Swift Charts (iOS 16+) | Apple's first-party charting framework |
| Auth | ASWebAuthenticationSession | Built-in OAuth/PKCE support, no third-party library |
| Keychain | Security framework | Built-in secure token storage |

Build: Xcode, Swift Package Manager. Min target: iOS 16 — covers 90%+ of active devices; required for Swift Charts.

#### Tradeoffs

- Best performance and smallest binary size
- No bridge/runtime overhead, direct access to platform APIs
- Simpler debugging and profiling with native tooling
- Two full codebases to maintain — all UI, networking, JSON parsing, and business logic written twice

### Strategy 2: Flutter

Flutter (3.41 / Dart 3.11 as of early 2026) — single Dart codebase for both platforms. Impeller is now the default rendering engine across all platforms, solving the historical jank/shader compilation issues. WebAssembly compilation for Flutter web is stable.

| Concern | Library | Why |
|---------|---------|-----|
| UI | Flutter widgets (Material / Cupertino) | Built-in, declarative, single codebase |
| HTTP | `http` / `dio` | Lightweight Dart-native HTTP clients |
| JSON | `json_serializable` + `json_annotation` | Compile-time codegen, no reflection |
| Charts | `fl_chart` or `syncfusion_flutter_charts` | Mature, single implementation for both platforms |
| Auth | `flutter_appauth` | Wraps AppAuth on both platforms, PKCE support |
| Secure Storage | `flutter_secure_storage` | Wraps Keychain (iOS) + EncryptedSharedPreferences (Android) |

#### Kotlin/Swift involvement

Flutter doesn't eliminate native languages entirely. Every Flutter app has `android/` and `ios/` directories with native project scaffolding (Gradle config, `AppDelegate.swift`, `AndroidManifest.xml`). Kotlin/Swift shows up in two cases:

- **Platform boilerplate** — configuring deep links for OAuth redirects, setting permissions, updating build settings. This is config-level work, not application logic.
- **Platform channels** — when native functionality isn't covered by an existing plugin (or a plugin is broken/abandoned), you write a thin Kotlin/Swift bridge. For Sanvasify this is unlikely — HTTP, charts, secure storage, and OAuth all have mature plugins.

In practice, expect ~95% Dart and occasional native config edits.

#### Tradeoffs

Pros:
- Single codebase — eliminates the "port to the other OS" step
- Hot reload for fast UI iteration
- Pixel-perfect UI parity across platforms
- Can also target web, potentially replacing `web/static/` entirely
- One charting library, one auth library, one secure storage library

Cons:
- Adds a runtime + rendering engine — contradicts the minimal-dependency philosophy
- Binary size ~15-20MB vs. 3-5MB for native apps this simple
- Dart is a third language alongside Go, Kotlin, and Swift
- Plugin ecosystem quality is uneven; some plugins are abandoned or poorly maintained
- Debugging adds a layer of indirection vs. native tooling

Current pain points (2026):
- Hot reload occasionally breaks on complex state changes
- Platform channels needed when plugins don't exist or break
- Web target works but is heavier than hand-written HTML/CSS/JS

### Strategy 3: iOS Native + Android PWA (Hybrid)

Build a native iOS app with Swift/SwiftUI. Serve Android users with the existing web frontend as a PWA. Apple controls the full stack (hardware, OS, SDK) so SwiftUI, Swift Charts, URLSession, Keychain, and ASWebAuthenticationSession work together seamlessly. Android's ecosystem is more fragmented, but Chrome has strong PWA support — and Sanvasify's feature set is almost entirely PWA-compatible.

#### PWA compatibility for Sanvasify

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

#### Tradeoffs

Pros:
- Zero additional Android code — the existing `web/static/` frontend serves Android users directly
- One native codebase (Swift/SwiftUI) instead of two
- Android Chrome supports install-to-home-screen, service workers, and Web Push
- Avoids Android fragmentation entirely
- Eliminates Android Studio from the toolchain

Cons:
- No Play Store presence without a TWA (Trusted Web Activity) wrapper
- Token storage is `localStorage` not EncryptedSharedPreferences — acceptable for a mutual fund browser, not for a banking app
- No biometric lock on Android (unless using TWA with native glue)
- Two different UX paradigms — native iOS feel vs. web feel on Android
- PWA on Android still feels like a web page in edge cases (pull-to-refresh, back button, splash screen)

### Strategy 4: Kotlin Multiplatform (KMP)

Share networking and data models in Kotlin across platforms, with native UI (Jetpack Compose on Android, SwiftUI on iOS). Compiles to native code, no runtime overhead. Production apps at Netflix, Duolingo, and Cash App. Compose Multiplatform reached stable in mid-2025 for shared UI.

The lightest cross-platform option if Flutter's runtime overhead is undesirable but maintaining two fully separate codebases is too costly.

### Strategy 5: Swift for Android (Emerging)

As of Swift 6.3 (March 2026), Apple officially supports Android as a compilation target. The Swift Android Workgroup is Apple-backed, and the SDK shipped as part of the official Swift release.

**What works today:**

- Swift compiles directly to native ARM machine code for Android (no VM, no bridge, NDK-comparable performance)
- `swift-java` and JNI Core enable interop with Kotlin/Java
- 25%+ of Swift Package Index already builds for Android
- Shared business logic, networking, data models, and background processing across iOS and Android

**What does NOT work:**

- SwiftUI does not run on Android — UI must still be written in Jetpack Compose or Android Views
- IDE integration and debugging workflows are rough
- CI/CD tooling is immature
- This is a shared-logic approach, not "write once, run everywhere"

**How it compares:** Philosophically identical to KMP — share logic, write native UI per platform. KMP has a multi-year head start. Swift for Android's advantage is only relevant if you already have a large Swift codebase to share.

**Skip.tools (third-party, worth watching):** Transpiles SwiftUI source code into Kotlin + Jetpack Compose, producing genuinely native Android apps from a single SwiftUI codebase. Not part of Apple's official SDK.

**Timeline expectations:**

- 6 months: improved tooling, more packages supporting Android, proof-of-concept apps
- 12-18 months: first major production apps using Swift shared logic on Android, CI/CD maturity
- 2-3 years: possible SwiftUI-on-Android story from Apple (speculative)

**Relevance to Sanvasify:** Low for now. The app's business logic lives in the Go backend, not in client-side Swift. An iOS native build would be mostly UI + thin API client — not the heavy shared-logic use case where this shines. Revisit if the tooling matures and a SwiftUI-on-Android path emerges.

## Strategy Comparison

### Effort and languages

| Strategy | Codebases | Languages | Effort |
|----------|-----------|-----------|--------|
| 1. Native both | 2 mobile + 1 backend | Go, Kotlin, Swift | High |
| 2. Flutter | 1 mobile + 1 backend | Go, Dart (+config-level Kotlin/Swift) | Medium |
| 3. iOS native + Android PWA | 1 mobile + 1 web (exists) + 1 backend | Go, Swift, JS (exists) | Low |
| 4. KMP | 1 shared + 2 UI + 1 backend | Go, Kotlin, Swift | Medium-High |
| 5. Swift for Android | 1 shared + 2 UI + 1 backend | Go, Swift, Kotlin (UI only) | Medium-High (immature tooling) |

### Dev toolchain

| Strategy | Required Tools | Disk footprint |
|----------|---------------|----------------|
| 1. Native both | Xcode, Android Studio, Kotlin/Gradle, Swift/SPM | ~20GB+ |
| 2. Flutter | Xcode, Android Studio, Flutter SDK, Dart SDK | ~25GB+ |
| 3. iOS native + Android PWA | Xcode only | ~12GB |
| 4. KMP | Xcode, Android Studio, Kotlin/Gradle | ~20GB+ |
| 5. Swift for Android | Xcode, Android Studio (for Compose UI), Swift toolchain | ~20GB+ |

- **Xcode** (~12GB) — required for any iOS development: building, signing, simulator, provisioning profiles
- **Android Studio** (~8GB) — required for Android builds: Kotlin, Gradle, SDK manager, emulator images
- **Flutter SDK** — adds ~3GB on top; still needs both Xcode and Android Studio for platform builds and signing
- **PWA** — no additional tooling; the existing development setup (Go backend + browser dev tools) is sufficient

## Feature Mapping

How web features translate to mobile:

| Web Feature | Native Equivalent | PWA Equivalent |
|-------------|-------------------|----------------|
| Scheme dropdown + cascading filters | Native search bar + filter sheet | Same as web (already works) |
| ECharts NAV trend chart | MPAndroidChart / Swift Charts / fl_chart | Same as web (ECharts) |
| OAuth redirect flow | In-app browser (AppAuth / ASWebAuthenticationSession) | Same as web (redirect) |
| Browser cookie auth | Keychain / EncryptedSharedPreferences + Bearer token | localStorage + Bearer token |
| Responsive CSS layout | Native adaptive layout (Compose / SwiftUI) | Same as web (responsive CSS) |

## Recommendation

The iOS native + Android PWA hybrid (Strategy 3) offers the best effort-to-value ratio for Sanvasify:

- The web frontend already exists and covers every feature the app needs
- The app doesn't require deep Android platform integration
- iOS users get the premium native experience where Apple's integrated stack shines
- Android users get a functional app with zero additional development effort
- Only Xcode is needed — no Android Studio, no Gradle, no Kotlin
- The main tradeoff is no Play Store distribution without a TWA wrapper

Flutter (Strategy 2) is the pragmatic fallback if a native Android experience becomes important — the app is simple enough (list, detail, chart) that it won't hit Flutter's rough edges.

The native-per-platform approach (Strategy 1) aligns with the project's minimal-dependency philosophy but doubles the mobile development and maintenance cost.

KMP (Strategy 4) and Swift for Android (Strategy 5) are better suited for projects with heavy client-side business logic. Sanvasify's logic lives in the Go backend, making these approaches overkill.

## Implementation Order

### For Strategy 3 (iOS native + Android PWA — recommended)

1. **Backend changes** — API versioning, pagination, JSON errors, CORS, mobile OAuth endpoint, rate limiting
2. **PWA enhancements** — service worker for offline caching, web app manifest for Android install-to-home-screen
3. **iOS app** — scheme list with search/filter → scheme detail with NAV chart → OAuth login with Keychain token storage
4. **Polish** — push notifications, biometric lock on iOS

### For Strategy 2 (Flutter — fallback)

1. **Backend changes** — same as above
2. **Flutter app** — scheme list with search/filter → scheme detail with NAV chart → OAuth login with secure storage
3. **Enhancements** — push notifications, offline caching, biometric lock
