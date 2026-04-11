# Mobile Phase 1 Strategy: iOS Native + Android PWA

This document defines the technical execution plan for Phase 1 of Sanvasify's mobile expansion.

## 1. Unified Go Backend Development Plan

The following changes transform the current web-centric backend into a Universal API.

| Step | Change | Targets | Why? |
| :--- | :--- | :--- | :--- |
| **1** | **API Versioning** (`/api/v1/`) | **Both** | Allows the backend to evolve without breaking "sticky" mobile apps already in the wild. |
| **2** | **JSON Error Standard** | **Both** | SwiftUI needs structured codes to show UI alerts; PWA needs it for consistent JS error handling. |
| **3** | **Pagination API** | **Both** | Mobile data is expensive/slow. Supports infinite scroll in SwiftUI and faster initial loads in PWA. |
| **4** | **CORS & Rate Limiting** | **Both** | Required for local iOS Simulators to reach the server and prevents "chatty" mobile apps from overloading the DB. |
| **5** | **JSON Auth Handover** | **SwiftUI** | Native apps cannot use `HttpOnly` cookies easily. Returns JWT in JSON body for Keychain storage. |
| **6** | **PWA Manifest & SW** | **PWA** | Enables "Add to Home Screen" on Android and provides offline browsing for mutual fund lists. |
| **7** | **Deep Link Metadata** | **Both** | Configures `apple-app-site-association` (iOS) and `assetlinks.json` (Android) to open the app via URLs. |
| **8** | **Push Registration** | **Both** | A single `/api/notifications/subscribe` endpoint to store browser push tokens or iOS device tokens. |

---

## 2. Implementation Sequence

### Level 1: Infrastructure (Do these first)
1.  **Refactor Handlers:** Update `pkg/api/handlers.go` to use a standard JSON response wrapper for both data and errors.
2.  **CORS Update:** Enable CORS in the Go server to allow the iOS Simulator to hit the backend.
3.  **Static Assets:** Prepare high-resolution icons (192x192, 512x512) for the PWA and iOS app icon.

### Level 2: Features
1.  **Auth Extension:** Add the mobile-specific callback to `pkg/auth`.
2.  **PWA Setup:** Create the `manifest.json` handler and service worker script in `web/static`.
3.  **Pagination:** Update DuckDB queries in `pkg/db` to support `LIMIT` and `OFFSET`.

### Level 3: Native Integration
1.  **SwiftUI Setup:** Initialize the Xcode project using Swift Package Manager (SPM).
2.  **Universal Links:** Deploy the `.well-known` configuration files to the server.
```

### Why these changes save you time:
1.  **CORS & Versioning:** By doing these now, you avoid the "development wall" where your simulator can't talk to your server, and you prevent the need for an emergency API rewrite 6 months from now.
2.  **Universal JSON:** Since the iOS app and the PWA will eventually use the *same* versioned API, you only write and debug your backend logic once.
3.  **PWA Manifest:** This is a one-time configuration in Go that instantly upgrades your Android experience from "a website" to "an app" with zero changes to your actual JavaScript code.

<!--
[PROMPT_SUGGESTION]Can you show me how to implement the JSON error helper in pkg/api/handlers.go?[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]What should the manifest.json look like for the Sanvasify PWA?[/PROMPT_SUGGESTION]
->
