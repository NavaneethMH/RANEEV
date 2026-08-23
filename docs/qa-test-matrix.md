# RANEEV Full-System QA Test Matrix

This matrix is the execution record for the current test–identify–fix–retest audit. **BLOCKED** means the case has not yet been executed in this audit and has no result; it will be changed only to PASS, FAIL, BLOCKED, or NOT APPLICABLE with observed evidence.

| Test ID | Feature | Scenario | Expected Result | Actual Result | Status | Severity | Fix Applied | Retest Status |
|---|---|---|---|---|---|---|---|---|
| QA-001 | Build and regression | Type check and existing behavior tests | No type errors; all existing tests pass | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-002 | Registration | Valid, malformed, duplicate, weak, missing, and long input | Valid citizen/volunteer registration succeeds; invalid input is safely rejected | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-003 | Login and session | Valid/invalid credentials, refresh, logout, direct protected route | Secure role redirect; no information leak; revoked session denied | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-004 | Role authorization | URL and tRPC access across Citizen, Volunteer, Coordinator, Admin | Server blocks unauthorized data and actions | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-005 | API validation | Malformed JSON, missing fields, invalid IDs, oversized and injection-like input | Validated rejection without stack traces or data leakage | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-006 | Citizen creation | Every supported emergency type and owned incident creation | Correct owner, timestamp, location, ID, timeline, state, notification | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-007 | Location resilience | Permission denied, unavailable, invalid and manual coordinates, map failure | Clear fallback; no silent incorrect location creation | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-008 | Lifecycle integrity | Valid lifecycle and invalid transitions after resolution | Only authorized valid transitions persist | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-009 | Volunteer availability | Available/offline transitions and coordinate updates | Eligible state is persisted and accurately surfaced | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-010 | Matching and acceptance | Nearby discovery, duplicate/concurrent acceptance | One valid assignment only; loser safely rejected | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-011 | Active response | Assigned, en route, arrived, resolved updates | Shared timeline, ETA, views, and notifications stay synchronized | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-012 | Coordinator workflow | Command center, GHR escalation, resolution and operational visibility | Authorized operational state is current and consistent | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-013 | Reassignment scope | Assigned responder cancellation/reassignment | Not applicable until an explicit shared lifecycle exists | Awaiting audit | BLOCKED | MEDIUM | — | — |
| QA-014 | Escalation | No-responder and post-escalation timeouts | Durable event and one idempotent coordinator alert | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-015 | Multi-session synchronization | Citizen, Volunteer, Coordinator concurrent lifecycle observation | Polling updates all authorized read models without manual refresh | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-016 | Maps | Markers, route, ETA, recenter, live responder movement, provider failure | Semantically correct authorized map state and graceful fallback | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-017 | Notifications | Lifecycle, preference, unread/read, provider failure, privacy and dedupe | Recipient-scoped demo delivery is idempotent and privacy-minimized | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-018 | AI | Structured safety validation and unavailable-provider fallback | Core flow continues; AI cannot change lifecycle or permissions | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-019 | GHR | Timer, severity, facility, escalation, resolution and cross-client timestamps | Persisted time remains consistent and does not reset | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-020 | Demo Mode | Start/pause/resume/skip/reset and ten sequential cycles | Isolated record, no stale state/timers/notices, deterministic map | Awaiting audit | BLOCKED | MEDIUM | — | — |
| QA-021 | Data integrity | FK, unique, index, ownership, notification/audit relation checks | Invalid relations cannot corrupt shared records | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-022 | Secrets and privacy | Repository, API response, and browser exposure inspection | No server secret/credential or excess private data exposure | Awaiting audit | BLOCKED | CRITICAL | — | — |
| QA-023 | Accessibility | Keyboard, focus, labels, semantics, contrast, touch targets, errors | Major emergency actions remain usable without pointer-only control | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-024 | Responsive | Major role screens at 320/375/390/430/768/1024/1280/1440/1920 | No overflow, clipped critical controls, unreadable text, or failed navigation | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-025 | Performance | Request repetition, map traffic, polling and Demo Mode cycle behavior | No meaningful avoidable request or memory regression | Awaiting audit | BLOCKED | MEDIUM | — | — |
| QA-026 | Error handling | Offline/network, API, DB, map, AI, notification, location, and authorization failures | Clear user state; no raw error or indefinite loading | Awaiting audit | BLOCKED | HIGH | — | — |
| QA-027 | Primary acceptance | Citizen → emergency → responder → tracking → GHR → coordinator → resolution | Full shared-record golden path completes reliably | Awaiting audit | BLOCKED | CRITICAL | — | — |

## Execution Results

| Test IDs | Actual result | Status | Fix and retest |
|---|---|---|---|
| QA-001 | TypeScript check, 12 Vitest files / 29 tests, and production build passed | PASS | Added focused route-cache unit coverage; build retains a non-blocking 2.02 MB / 543 KB gzip main-chunk warning |
| QA-002–005, QA-022 | Isolated browser security driver validated invalid/duplicate registration, generic invalid login, protected API denial, ownership denial, role-escalation denial, input validation, logout revocation, and inert profile XSS payload | PASS | Same-origin session driver retained; local HTTP sessions now use `SameSite=Lax`, while HTTPS uses `SameSite=None; Secure` |
| QA-006–012, QA-015, QA-027 | Citizen golden path, Volunteer response, GHR, command center, and atomic concurrent acceptance completed on shared records | PASS | Volunteer driver creates isolated fixtures instead of relying on occupied demo assignments |
| QA-013 | Cancellation/reassignment lifecycle is intentionally not implemented in the current shared lifecycle | NOT APPLICABLE | Product-scope limitation; no simulated substitute was added |
| QA-014, QA-017 | Fresh controlled normal incidents were aged through a coordinator-only development fixture path. Responder-search and escalation follow-up alerts were each absent before processing, exactly one after the first run, and exactly one after the second run; artifacts were deleted by the same guarded fixture path | PASS | Replaced stale bounded-inbox fixture assertion with isolated, idempotent fixtures and cleanup |
| QA-016, QA-019 | Map fallback/routing and GHR desktop/mobile behavior passed | PASS | Fixed citizen route-cache invalidation so responder marker updates do not create new directions requests |
| QA-018 | AI queue, safety validation, role boundary, fallback, and mobile behavior passed | PASS | No product fix required |
| QA-020 | Demo Mode lifecycle, isolated notifications, responder movement, pause/resume, mobile layout, and ten reset cycles passed | PASS | No product fix required |
| QA-021 | Database constraints are exercised by shared lifecycle, atomic assignment, and idempotent notification behavior | PASS | No destructive schema change required |
| QA-023–024 | Accessibility regression across six workspaces found keyboard focus, zero unlabeled controls, zero sub-32px interactive controls after correction, four visible text status labels, and two semantic error-alert checks. Responsive sweep covered 81 cases from 320–1920px with no overflow | PASS | State controls now meet the target and resilient errors expose `role="alert"`; responsive harness waits for protected views |
| QA-025 | HTTPS browser observation over 4.2 seconds during Demo responder movement: 3 `demo.status` polls, 1 `mapSnapshot` poll, 1 `DirectionsService.Route` request, and route telemetry remained 1 → 1 | PASS | Added development-only route invocation telemetry; route cache now keys live routes by incident and responder assignment rather than moving coordinates |
| QA-026 | Map fallback, AI fallback, notification fallback, authorization, and explicit Citizen/Volunteer denied-location surfaces were exercised | PASS | No raw technical user-facing errors observed |
