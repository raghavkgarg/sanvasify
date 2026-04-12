
## Overview
**Last Updated:** 2024-04-04
**Currency:** INR

## 1. Initial Development Cost (Fixed/One-time)
*Focus: Phase 1 (iOS Native + Android PWA)*

| Item | Description | Estimated Hours | Cost | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Domain Name** | sanvasify.com (or equivalent) | N/A | ₹1,500 | Paid |
| **Backend (Go)** | Unified API, Versioning, Auth | 40 | Sweat Equity | In Progress |
| **PWA (Android)** | Manifest, Service Workers, Offline | 20 | Sweat Equity | Pending |
| **iOS (SwiftUI)** | Native Scheme Lists & Charts | 80 | Sweat Equity | Pending |
| **Store Setup** | Apple Developer ($99) + Google Play ($25) | N/A | ~₹10,500 | Pending |
| **Hardware** | MacBook (Personal Device) | N/A | ₹0 | Owned |

## 2. Recurring Monthly Costs
*Current operational burn for maintaining the infrastructure.*

| Service | Purpose | Estimated Cost/Mo |
| :--- | :--- | :--- |
| **AWS** | Static IP (Elastic IP) & EC2 Fee | ₹550 |
| **Domain** | Annual renewal amortized | ₹125 |
| **Compute** | DuckDB + Go Binary (T3.micro Free Tier) | ₹0 |
| **Total Monthly** | | **₹675** |

## 3. Estimated Time Effort (Pre-Launch)
To track future efforts, break down the **MOBILE_PHASE1.md** implementation:

*   **Level 1 Infra (API/CORS/JSON):** ~10 hours
*   **Level 2 Features (Auth/PWA/Pagination):** ~25 hours
*   **Level 3 Integration (SwiftUI/Universal Links):** ~45 hours

## 4. Key Assumptions & Notes
*   **Zero-Cost Strategy:** Leveraging AWS Free Tier for compute and personal hardware for development.
*   **Sweat Equity:** No external developer costs; all value is created through personal time investment.
*   **AWS Optimization:** The current ₹550 is primarily for the Static IP. To minimize this, ensure the Elastic IP is always associated with a running instance.
*   **Phased Approach:** Starting with PWA for Android avoids the Google Play fee until Phase 2.

## 5. Development Log (Future Tracking)
| Date | Feature | Hours Put | Notes |
| :--- | :--- | :--- | :--- |
| 2024-04-31 | Web Development Setup| 120 | Done intial development environment |
| 2024-04-04 | Setup Mobile Strategy Docs | 2 | Defined Phase 1 roadmap |
| ... | ... | ... | ... |
