# WEB LIVE TESTING AREAS CATALOG

Last updated: 2026-06-30  
Owner: User + Codex  
Status: Active testing backlog

## Purpose

This document is the master task list for real browser-based live testing of the Kezek web application.

It is intended for the same workflow used for the mobile audit:

1. The user selects an area such as `C2` or `H3`.
2. Codex performs a real live browser run where the environment allows it.
3. Automated checks and source inspection support the live result but do not replace it.
4. Any reproduced defect is added to [WEB_BUG_REGISTRY.md](./WEB_BUG_REGISTRY.md).
5. The selected area is updated with date, environment, evidence, result, and remaining gaps.

## Status model

- `not started`: no dedicated live run has been performed.
- `in progress`: the live run started but required scenarios remain.
- `blocked`: a specific external dependency prevents further progress.
- `verified`: the acceptance criteria were completed with live evidence.
- `verified with gaps`: the main scope passed, but named optional or environment-specific checks remain.

## Priority model

- `P0`: release-blocking core path, security boundary, auth, booking integrity, or destructive action.
- `P1`: important business workflow or major usability/resilience path.
- `P2`: hardening, edge case, browser/device expansion, or non-blocking presentation issue.

## Evidence model

Each completed live area should record:

- tested URL and build/commit;
- browser, viewport, operating system;
- account and role without exposing credentials;
- exact live steps;
- screenshots or browser snapshots;
- console errors and failed network requests;
- result: `PASS`, `FAIL`, or `BLOCKED`;
- related `WB-*` defects;
- automated checks used as supporting evidence.

## Progress snapshot

| Area | Name | Priority | Status |
| --- | --- | --- | --- |
| `A1-A4` | Runtime, deployment, configuration | `P0-P1` | `A1-A4 verified` |
| `B1-B4` | Public discovery and business pages | `P0-P2` | `B1-B4 verified` |
| `C1-C6` | Authentication and session | `P0-P1` | `C1 verified; C2 not applicable (social-only); C3 in progress; C4-C6 not started` |
| `D1-D6` | Public and authenticated booking | `P0-P1` | `not started` |
| `E1-E5` | Client cabinet | `P0-P2` | `not started` |
| `F1-F4` | Roles, guards, business selection | `P0-P1` | `not started` |
| `G1-G4` | Owner/manager dashboard | `P1` | `not started` |
| `H1-H5` | QuickDesk and booking operations | `P0-P1` | `not started` |
| `I1-I6` | Business configuration | `P1-P2` | `not started` |
| `J1-J5` | Staff workspace and shifts | `P0-P1` | `not started` |
| `K1-K5` | Finance integrity | `P0-P1` | `not started` |
| `L1-L4` | Promotions, packages, ratings | `P1-P2` | `not started` |
| `M1-M6` | Super-admin cabinet | `P0-P2` | `not started` |
| `N1-N4` | Notifications and integrations | `P0-P2` | `not started` |
| `O1-O5` | UI, responsive, i18n, accessibility | `P1-P2` | `not started` |
| `P1-P5` | Resilience, performance, security | `P0-P2` | `not started` |
| `Q1-Q4` | Release readiness | `P0-P1` | `not started` |

---

## A. Runtime, deployment, and configuration

### A1. Public boot and server rendering (`P0`)

Tasks:

- cold-load `/`, `/auth/sign-in`, `/terms`, and `/privacy`;
- verify server-rendered content appears without a blank shell;
- reload each route directly instead of entering only through client navigation;
- inspect browser console for hydration or Server Component errors;
- verify browser Back/Forward does not break rendered state.

Done when:

- every public entry route loads directly with the expected status and UI;
- no production error boundary, hydration mismatch, infinite spinner, or redirect loop appears.

Status: `verified`

### 2026-06-23 - A1 Public boot and server rendering

- status: `in progress`
- result: `FAIL`
- build: local dev build, commit `3dfe9f5c`
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest, 1280x720 desktop and 390x844 responsive smoke
- steps:
  1. Opened `/`, `/auth/sign-in`, `/terms`, and `/privacy` directly in separate fresh tabs.
  2. Verified each route returned HTTP `200` without a redirect and contained its expected marker in the raw server-rendered HTML.
  3. Inspected rendered headings, visible content, loading indicators, error surfaces, console errors, and application request logs.
  4. Reloaded every route directly.
  5. Navigated through all four routes and exercised browser Back and Forward across the full sequence.
  6. Repeated a responsive smoke at 390x844 and measured horizontal document overflow.
- expected:
  - all entry routes render from SSR without a blank shell, hydration mismatch, error boundary, infinite spinner, or redirect loop
  - reload and browser history preserve usable rendered state
- actual:
  - all four routes returned `200` and expected content was present in raw HTML before hydration
  - all routes displayed the expected H1 and no infinite loading state or redirect loop appeared
  - reload and Back/Forward preserved the expected route and rendered content
  - `/auth/sign-in` emitted a reproducible React hydration mismatch in `TelegramLoginWidgetComponent`
  - public telemetry requests failed with `500`/`404`; repeated metrics requests reached `429`
  - `/terms` and `/privacy` overflowed horizontally at the mobile viewport
- evidence:
  - desktop screenshots: `apps/web/test-results/live-a1-2026-06-23/home.png`, `auth-sign-in.png`, `terms.png`, `privacy.png`
  - mobile screenshots: `apps/web/test-results/live-a1-2026-06-23/terms-mobile-390.png`, `privacy-mobile-390.png`
  - HTTP SSR checks: four `200` responses, expected marker present, no `__next_error__`
  - console: hydration mismatch reproduced on cold load and reload of `/auth/sign-in`
  - request log: `%TEMP%\kezek-a1-live\web.stdout.log`
  - supporting automation: `playwright test --workers=1 e2e/smoke-public.spec.ts --reporter=line` — 3 passed
- bugs:
  - `WB-001`
  - `WB-002`
  - `WB-003`
- remaining gaps:
  - `WB-001`, `WB-002`, and `WB-003` were resolved and verified in the subsequent post-fix run below
  - production-build behavior belongs to `A3` and was not used to mark A1 verified

### 2026-06-23 - A1 post-fix live verification

- status: `verified`
- result: `PASS`
- build: local dev build with uncommitted A1 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest, desktop and 390x844 mobile viewport
- steps:
  1. Cold-loaded and reloaded `/auth/sign-in`; inspected console and Telegram widget state.
  2. Repeated direct loads of `/`, `/auth/sign-in`, `/terms`, and `/privacy`.
  3. Repeated browser Back and Forward across all four routes.
  4. Inspected the application request log for failed metrics and analytics requests.
  5. Measured document and viewport widths on `/terms` and `/privacy`.
- actual:
  - all four routes rendered expected content with HTTP `200`
  - no hydration or Server Component errors appeared
  - no blank shell, infinite spinner, redirect loop, or broken history state appeared
  - no failing local metrics or analytics requests were emitted
  - legal pages had no horizontal overflow at the tested mobile viewport
- evidence:
  - `apps/web/test-results/live-a1-postfix-2026-06-23/auth-sign-in-postfix.png`
  - `apps/web/test-results/live-a1-postfix-2026-06-23/terms-mobile-postfix.png`
  - `apps/web/test-results/live-a1-postfix-2026-06-23/privacy-mobile-postfix.png`
  - request log: `%TEMP%\kezek-a1-postfix\web.stdout.log`
  - supporting automation: typecheck passed; metrics tests 6/6 passed; public Playwright smoke 3/3 passed
- bugs:
  - `WB-001` verified
  - `WB-002` verified
  - `WB-003` verified
- remaining gaps:
  - none for A1

### A2. Environment and service wiring (`P0`)

Tasks:

- verify expected Supabase, API, auth callback, webhook, and public origin behavior;
- check missing/invalid runtime configuration on a controlled local or staging build;
- verify production pages do not depend on localhost resources;
- inspect failed network requests for wrong hosts, mixed content, CORS, and certificate errors.

Done when:

- configuration failures are explicit and safe;
- valid builds use the intended environment consistently.

Status: `verified`

### 2026-06-23 - A2 Environment and service wiring

- status: `in progress`
- result: `FAIL`
- build: local dev build with uncommitted A1 fixes based on commit `3dfe9f5c`
- environment:
  - valid run: `http://localhost:3000`, in-app Chromium, Windows, guest, 1280x720
  - controlled invalid-env run: `http://localhost:3000`, `NEXT_PUBLIC_SUPABASE_URL` set to a non-URL value, dummy Supabase keys, non-URL `NEXT_PUBLIC_SITE_ORIGIN`
- steps:
  1. Confirmed current `.env.local` variable names/states without printing secret values.
  2. Opened `/`, `/auth/sign-in`, `/auth/whatsapp`, `/auth/callback?code=invalid-a2-code`, `/auth/callback-yandex?code=invalid-a2-code&state=a2`, and `/map` in the browser.
  3. Captured visible UI, console warnings/errors, screenshots, and observed page asset hosts for each route.
  4. Waited 8 seconds on invalid auth callback routes to verify whether they recover, redirect, or fail explicitly.
  5. Sent safe non-destructive HTTP checks to WhatsApp and Telegram webhook endpoints, Yandex callback API, branches map, and invalid nearby coordinates.
  6. Checked OPTIONS preflight behavior with a foreign `Origin`.
  7. Restarted the app in a controlled invalid runtime configuration and opened `/` and `/auth/sign-in` in the browser.
- expected:
  - valid local build uses the configured Supabase/API/auth/public-origin wiring consistently
  - invalid runtime configuration fails explicitly and safely
  - public pages do not depend on unintended hosts, mixed content, CORS-unsafe requests, or certificate-broken resources
  - invalid callbacks/webhooks return safe, understandable failure states
- actual:
  - valid public pages rendered and loaded same-origin assets; `/map` additionally loaded Yandex Maps over HTTPS
  - no browser console hydration errors, mixed-content errors, certificate errors, or CORS console errors were observed in the valid browser run
  - invalid WhatsApp webhook verification returned `403` with a safe JSON error
  - invalid branch coordinates returned `400` with a safe validation message
  - empty WhatsApp and Telegram webhook POSTs returned `200 ok` as no-op behavior; deeper authenticity/idempotency testing remains for `N2`/`N3`
  - invalid Yandex callback API returned `500`, and the callback UI stayed on an indefinite authorization spinner
  - invalid Supabase runtime configuration was explicit in logs, but `/` rendered a blank page and `/auth/sign-in` exposed a dev error boundary with stack details
- evidence:
  - browser screenshots: `apps/web/test-results/live-a2-2026-06-23/home.png`, `sign-in.png`, `whatsapp-auth.png`, `auth-callback-invalid.png`, `yandex-callback-invalid.png`, `map.png`
  - callback hang screenshots: `apps/web/test-results/live-a2-2026-06-23/auth-callback-invalid-long.png`, `yandex-callback-invalid-long.png`
  - invalid-env screenshots: `apps/web/test-results/live-a2-2026-06-23/invalid-env-home.png`, `invalid-env-sign-in.png`
  - browser evidence JSON: `apps/web/test-results/live-a2-2026-06-23/browser-assets-console.json`, `callback-invalid-long.json`, `invalid-env-browser.json`
  - valid request log: `%TEMP%\kezek-a2-live\web.stdout.log`
  - invalid-env request/error log: `%TEMP%\kezek-a2-invalid-env-2\web.stderr.log`
  - CORS/preflight spot check: `OPTIONS /api/webhooks/whatsapp` returned `204` without permissive `Access-Control-Allow-Origin`
- bugs:
  - `WB-004`
  - `WB-005`
- remaining gaps:
  - fix and post-fix live verify `WB-004` and `WB-005`
  - run the same host/resource checks against a staging or production deployment before marking "production pages do not depend on localhost resources" complete
  - webhook authenticity, replay, and provider-signature behavior belongs to `N2`/`N3` and was only lightly smoke-checked here

### 2026-06-23 - A2 post-fix live verification

- status: `verified with gaps`
- result: `PASS WITH GAPS`
- build: local dev build with uncommitted A1 and A2 fixes based on commit `3dfe9f5c`
- environment:
  - valid run: `http://localhost:3000`, in-app Chromium, Windows, guest, 1280x720
  - controlled invalid-env run: `http://localhost:3000`, `NEXT_PUBLIC_SUPABASE_URL` set to a non-URL value, dummy Supabase keys, non-URL `NEXT_PUBLIC_SITE_ORIGIN`
- steps:
  1. Re-ran typecheck after fixes.
  2. Re-ran targeted Jest coverage for Yandex callback routing.
  3. Opened `/auth/callback?code=invalid-a2-code` in the browser and verified it did not remain on a spinner.
  4. Opened `/auth/callback-yandex?code=invalid-a2-code&state=a2` and the underlying Yandex callback API path.
  5. Re-ran controlled invalid-env browser checks for `/` and `/auth/sign-in`.
  6. Re-ran a final normal-env browser smoke for `/`, invalid Supabase callback, and invalid Yandex callback.
  7. Re-ran public Playwright smoke as supporting evidence.
- expected:
  - invalid callback input fails explicitly and safely
  - invalid runtime configuration renders a clear safe state instead of a blank shell or stack trace
  - valid local environment still renders public routes and uses the intended local/public service wiring
- actual:
  - `/auth/callback?code=invalid-a2-code` rendered `Не удалось завершить авторизацию` with `Вернуться ко входу`
  - `/auth/callback-yandex?code=invalid-a2-code&state=a2` redirected to `/auth/sign-in?error=yandex_exchange_failed`
  - `GET /api/auth/yandex/callback?code=invalid-a2-code&redirect=%2F` returned `307` instead of `500`
  - controlled invalid-env `/` rendered the home page with `Сервис временно недоступен`, no blank shell, and no visible stack details
  - controlled invalid-env `/auth/sign-in` rendered the sign-in page with `Сервис временно недоступен`, no error boundary, and no visible stack details
  - final normal-env `/` rendered expected marketplace content without the invalid-config banner
- evidence:
  - valid screenshots: `apps/web/test-results/live-a2-postfix-2026-06-23/valid-home-final.png`, `valid-auth-callback-invalid-final.png`, `valid-yandex-callback-invalid-final.png`
  - invalid-env screenshots: `apps/web/test-results/live-a2-postfix-2026-06-23/invalid-env-home-final.png`, `invalid-env-sign-in-final.png`
  - browser evidence: `apps/web/test-results/live-a2-postfix-2026-06-23/valid-final.json`, `invalid-env-final.json`, `callback-postfix.json`
  - valid request log: `%TEMP%\kezek-a2-postfix-final-valid\web.stdout.log`
  - invalid-env request/error log: `%TEMP%\kezek-a2-postfix-invalid-env\web.stderr.log`
  - supporting automation:
    - `corepack pnpm -C apps/web typecheck` passed
    - `corepack pnpm -C apps/web exec jest --watchAll=false src/__tests__/lib/yandexAuthCallbackRouteService.test.ts src/__tests__/lib/yandexAuthCallbackHttpService.test.ts` passed, 5/5 tests
    - `corepack pnpm -C apps/web exec playwright test --workers=1 e2e/smoke-public.spec.ts --reporter=line` passed, 3/3 tests
- bugs:
  - `WB-004` verified
  - `WB-005` verified
- remaining gaps:
  - staging or production host/resource check is still required before claiming production pages never depend on localhost resources
  - webhook authenticity, replay, and provider-signature behavior remains in `N2`/`N3`

### 2026-06-27 - A2 production host/resource closure

- status: `verified`
- result: `PASS`
- build: local production build (`next build` + `next start`) with production-like public origin settings and uncommitted A1/A2 fixes based on commit `3dfe9f5c`
- environment:
  - app: `http://localhost:3000`, Next.js production server (`next start`)
  - public origin configuration: `NEXT_PUBLIC_SITE_ORIGIN=https://kezek.kg`, `NEXT_PUBLIC_BASE_URL=https://kezek.kg`, `NEXT_PUBLIC_APP_URL=https://kezek.kg`
  - browser: Chromium via Playwright, Windows, guest session, 1280x720
- steps:
  1. Built `apps/web` with production-like public origin environment values.
  2. Started the production server via `next start` without modifying `.env.local`.
  3. Cold-loaded `/`, `/auth/sign-in`, `/terms`, `/privacy`, `/map`, `/auth/callback?code=invalid-a2-code`, and `/auth/callback-yandex?code=invalid-a2-code&state=a2`.
  4. Captured UI screenshots, final URLs, HTTP statuses, headings, console messages, failed requests, failing HTTP responses, and loaded asset hosts.
  5. Inspected the run for hardcoded localhost/127.0.0.1 dependencies outside the serving origin, mixed-content candidates, CORS failures, certificate failures, and wrong-host resources.
- expected:
  - public pages in a valid production-like build do not depend on localhost resources except the local `next start` serving origin used by this controlled run
  - expected external resources use HTTPS and the intended providers
  - invalid callback paths fail explicitly and safely without an infinite spinner or production error boundary
- actual:
  - `/`, `/auth/sign-in`, `/terms`, `/privacy`, `/map`, and `/auth/callback?code=invalid-a2-code` loaded with HTTP `200`
  - `/auth/callback-yandex?code=invalid-a2-code&state=a2` redirected safely to `https://kezek.kg/auth/sign-in?error=yandex_exchange_failed`
  - no wrong localhost/127.0.0.1 resource requests were observed outside the controlled local serving origin
  - no mixed-content candidates, CORS console failures, certificate errors, failing HTTP responses, hydration errors, redirect loops, production error boundary, or infinite spinner were observed
  - `/map` loaded only expected HTTPS Yandex Maps hosts in addition to the local serving origin
  - same-origin browser prefetch/navigation aborts were observed as non-failing `net::ERR_ABORTED` noise, with no failed HTTP responses
- evidence:
  - production host/resource JSON: `apps/web/test-results/live-a2-prod-hostcheck-2026-06-27/prod-hostcheck.json`
  - screenshots: `apps/web/test-results/live-a2-prod-hostcheck-2026-06-27/home.png`, `sign-in.png`, `terms.png`, `privacy.png`, `map.png`, `auth-callback-invalid.png`, `yandex-callback-invalid.png`
  - runner: `apps/web/test-results/live-a2-prod-hostcheck-2026-06-27/hostcheck.mjs`
  - production server logs: `%TEMP%\kezek-a2-prod-hostcheck-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a2-prod-hostcheck-2026-06-27\web.stderr.log`
- bugs:
  - no new bugs found in this closure run
  - `WB-004` remains verified
  - `WB-005` remains verified
- remaining gaps:
  - none for A2
  - webhook authenticity, replay, and provider-signature depth remains assigned to `N2`/`N3`, not A2

### A3. Production build and deploy smoke (`P0`)

Tasks:

- test `next build` output or deployed production build, not only `next dev`;
- verify static assets, fonts, chunks, and images load after a fresh cache;
- test a hard refresh on nested dynamic routes;
- verify old chunks do not produce a broken page after deployment.

Done when:

- the deployed build is usable from a clean browser profile;
- no stale-chunk, missing asset, or production-only render failure appears.

Status: `verified`

### 2026-06-27 - A3 Production build and deploy smoke

- status: `in progress`
- result: `FAIL`
- build: local production build (`next build` + `next start`) with production-like public origin settings and uncommitted A1/A2 fixes based on commit `3dfe9f5c`
- environment:
  - app: `http://localhost:3000`, Next.js production server (`next start`)
  - public origin configuration: `NEXT_PUBLIC_SITE_ORIGIN=https://kezek.kg`, `NEXT_PUBLIC_BASE_URL=https://kezek.kg`, `NEXT_PUBLIC_APP_URL=https://kezek.kg`
  - browser: Chromium via Playwright, clean context, Windows, guest session, 1280x720
- steps:
  1. Ran `corepack pnpm -C apps/web build` and confirmed the optimized production build completed successfully.
  2. Started the built app via `next start`.
  3. Opened public entry routes and production-smoke routes in a clean browser context: `/`, `/auth/sign-in`, `/terms`, `/privacy`, `/map`, `/api-docs`.
  4. Hard-reloaded nested/dynamic routes directly: `/b/a3-nonexistent-smoke`, `/b/a3-nonexistent-smoke/booking`, `/b/a3-nonexistent-smoke/promotions`, `/booking/a3-nonexistent-id`, `/dashboard/staff/a3-staff-id/finance/stats`, `/admin/businesses/a3-business-id/branches/a3-branch-id`.
  5. Captured screenshots, final URLs, page markers, console errors, page errors, failed requests, failing HTTP responses, and static asset/chunk/font/image responses.
  6. Ran a controlled stale-chunk probe by requesting a non-existent `_next/static/chunks/...` URL after the home page was loaded and verified the current page remained usable.
- expected:
  - the production build is usable from a clean browser profile
  - static assets, chunks, fonts, and images load without missing-asset failures
  - direct reloads of nested/dynamic routes do not trigger production-only error boundaries or broken state
  - stale or missing chunk requests do not break an already rendered page
- actual:
  - `next build` completed successfully
  - all tested routes returned usable rendered pages or safe auth/public redirects with expected markers
  - all captured static assets/chunks/fonts/images loaded without `4xx`/`5xx`
  - hard reloads of nested/dynamic routes did not produce a Next production error boundary, page error, or infinite spinner
  - controlled stale-chunk probe returned `404` for the fabricated old chunk and the already rendered home page remained usable
  - `/map` emitted two production CSP console errors because Yandex Maps logging was blocked by `connect-src`
- evidence:
  - initial browser evidence: `apps/web/test-results/live-a3-prod-smoke-2026-06-27/prod-smoke.json`
  - initial screenshots: `apps/web/test-results/live-a3-prod-smoke-2026-06-27/home.png`, `sign-in.png`, `terms.png`, `privacy.png`, `map.png`, `api-docs.png`, `dynamic-business-missing.png`, `dynamic-business-booking-missing.png`, `dynamic-business-promotions-missing.png`, `dynamic-booking-missing.png`, `nested-dashboard-guard.png`, `nested-admin-guard.png`, `stale-chunk-probe.png`
  - runner: `apps/web/test-results/live-a3-prod-smoke-2026-06-27/prod-smoke.mjs`
  - production server logs: `%TEMP%\kezek-a3-prod-smoke-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a3-prod-smoke-2026-06-27\web.stderr.log`
- bugs:
  - `WB-006`
- remaining gaps:
  - fix and post-fix live verify `WB-006`

### 2026-06-27 - A3 post-fix live verification

- status: `verified`
- result: `PASS`
- build: local production build (`next build` + `next start`) with the `WB-006` CSP fix and uncommitted A1/A2/A3 fixes based on commit `3dfe9f5c`
- environment:
  - app: `http://localhost:3000`, Next.js production server (`next start`)
  - public origin configuration: `NEXT_PUBLIC_SITE_ORIGIN=https://kezek.kg`, `NEXT_PUBLIC_BASE_URL=https://kezek.kg`, `NEXT_PUBLIC_APP_URL=https://kezek.kg`
  - browser: Chromium via Playwright, clean context, Windows, guest session, 1280x720
- steps:
  1. Rebuilt the app after the CSP fix.
  2. Restarted `next start` from the fresh production output.
  3. Re-ran the full A3 live smoke against the same route set.
  4. Rechecked static assets, chunks, fonts, images, console errors, page errors, hard reloads, safe redirects, and the controlled stale-chunk probe.
- actual:
  - `next build` completed successfully after the fix
  - all tested public, nested, dynamic, and auth-guarded routes rendered usable states or safe redirects
  - all captured static assets/chunks/fonts/images loaded without `4xx`/`5xx`
  - `/map` no longer emitted the Yandex Maps CSP console error
  - no console errors, page errors, production error boundary, missing asset, infinite spinner, or broken hard-refresh state was observed
  - controlled stale-chunk probe returned `404` for the fabricated stale chunk and the already rendered page remained usable
- evidence:
  - post-fix browser evidence: `apps/web/test-results/live-a3-prod-smoke-2026-06-27-postfix/prod-smoke.json`
  - post-fix screenshots: `apps/web/test-results/live-a3-prod-smoke-2026-06-27-postfix/home.png`, `sign-in.png`, `terms.png`, `privacy.png`, `map.png`, `api-docs.png`, `dynamic-business-missing.png`, `dynamic-business-booking-missing.png`, `dynamic-business-promotions-missing.png`, `dynamic-booking-missing.png`, `nested-dashboard-guard.png`, `nested-admin-guard.png`, `stale-chunk-probe.png`
  - production server logs: `%TEMP%\kezek-a3-prod-smoke-2026-06-27-postfix\web.stdout.log`, `%TEMP%\kezek-a3-prod-smoke-2026-06-27-postfix\web.stderr.log`
- bugs:
  - `WB-006` verified
- remaining gaps:
  - none for A3

### A4. Error boundaries and not-found behavior (`P1`)

Tasks:

- open unknown public, cabinet, dashboard, staff, and admin routes;
- trigger controlled Server Component and client request failures where safe;
- verify retry/home actions;
- verify error surfaces do not expose stack traces or secrets.

Done when:

- invalid routes and controlled failures lead to understandable recovery UI.

Status: `verified`

### 2026-06-27 - A4 Error boundaries and not-found behavior

- status: `in progress`
- result: `FAIL`
- build: local production build (`next build` + `next start`) with uncommitted A1/A2/A3 fixes based on commit `3dfe9f5c`
- environment:
  - app: `http://localhost:3000`, Next.js production server (`next start`)
  - public origin configuration: `NEXT_PUBLIC_SITE_ORIGIN=https://kezek.kg`, `NEXT_PUBLIC_BASE_URL=https://kezek.kg`, `NEXT_PUBLIC_APP_URL=https://kezek.kg`
  - browser: in-app browser smoke plus Chromium via Playwright, clean context, Windows, guest session, 1280x720
- steps:
  1. Opened an unknown public route in the in-app browser and confirmed the visible not-found surface.
  2. Opened unknown public, cabinet, dashboard, staff, and admin routes in Chromium: `/__a4_unknown_public__`, `/cabinet/__a4_unknown__`, `/dashboard/__a4_unknown__`, `/staff/__a4_unknown__`, `/admin/__a4_unknown__`.
  3. Opened domain not-found routes: `/b/a4-nonexistent-business` and `/booking/a4-nonexistent-booking-id`.
  4. Triggered a safe controlled Server Component-style fallback route with `/b/%22a4-server-component-failure`.
  5. Triggered a safe controlled client request failure by intercepting the first `/api/branches/map` request on `/map` and returning `500`.
  6. Captured screenshots, visible text, links/buttons, console errors, page errors, failed requests, `5xx` responses, and leak indicators for stack traces, local paths, tokens, cookies, and secrets.
- expected:
  - invalid routes and controlled failures lead to understandable recovery UI
  - retry/home actions are visible where useful
  - error surfaces do not expose stack traces, local paths, tokens, cookies, or secrets
- actual:
  - unknown public/cabinet/dashboard/staff/admin routes rendered the default Next.js `404 / This page could not be found` surface
  - domain not-found routes rendered safe user-facing states and the booking not-found home action successfully returned to `/`
  - the controlled business fallback route rendered a safe `Бизнес не найден` state without stack details
  - controlled `/map` branches request failure was shown as `no data`, with no retry action
  - no stack traces, local paths, tokens, cookies, or secrets were observed
- evidence:
  - initial browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/a4-live.json`
  - initial screenshots: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/unknown-public.png`, `unknown-cabinet.png`, `unknown-dashboard.png`, `unknown-staff.png`, `unknown-admin.png`, `business-not-found.png`, `booking-not-found.png`, `server-component-controlled-failure.png`, `client-map-controlled-failure.png`
  - runner: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/a4-live.mjs`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27\web.stderr.log`
- bugs:
  - `WB-007`
  - `WB-008`
- remaining gaps:
  - fix and post-fix live verify `WB-007` and `WB-008`

### 2026-06-27 - A4 post-fix live verification

- status: `verified`
- result: `PASS`
- build: local production build (`next build` + `next start`) with uncommitted A1/A2/A3/A4 fixes based on commit `3dfe9f5c`
- environment:
  - app: `http://localhost:3000`, Next.js production server (`next start`)
  - public origin configuration: `NEXT_PUBLIC_SITE_ORIGIN=https://kezek.kg`, `NEXT_PUBLIC_BASE_URL=https://kezek.kg`, `NEXT_PUBLIC_APP_URL=https://kezek.kg`
  - browser: Chromium via Playwright, clean context, Windows, guest session, 1280x720
- steps:
  1. Rebuilt the app after A4 fixes.
  2. Restarted the production server via `next start`.
  3. Re-ran the A4 live route set and controlled `/map` failure.
  4. Verified not-found copy, explicit home/sign-in actions, controlled client failure retry, production error boundary absence, and leak indicators.
- actual:
  - unknown public/cabinet/dashboard/staff/admin routes rendered `Страница не найдена` with explicit `На главную` and `Войти` actions
  - default Next.js 404 text was no longer present
  - domain not-found and controlled business fallback routes remained safe and understandable
  - controlled `/map` branches request failure displayed `Не удалось загрузить филиалы. Попробуйте обновить список.` and a `Попробовать снова` action
  - clicking `Попробовать снова` re-ran the request and left the page usable
  - no page errors, production error boundary, stack traces, local paths, tokens, cookies, or secrets were observed
  - browser console still records expected resource errors for intentionally returned `404` documents and the controlled `500` request; these are test-triggered network statuses, not leaked app exceptions
- evidence:
  - post-fix browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/a4-live.json`
  - post-fix screenshots: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/unknown-public.png`, `unknown-cabinet.png`, `unknown-dashboard.png`, `unknown-staff.png`, `unknown-admin.png`, `business-not-found.png`, `booking-not-found.png`, `server-component-controlled-failure.png`, `client-map-controlled-failure.png`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stderr.log`
- bugs:
  - `WB-007` verified
  - `WB-008` verified
- remaining gaps:
  - none for A4

---

## B. Public discovery and business pages

### B1. Public home composition (`P0`)

Tasks:

- verify hero, navigation, search/discovery entry points, footer, and auth state;
- test cards and primary CTAs;
- verify authenticated and unauthenticated header variants;
- verify empty/error/loading states.

Done when:

- the public home page is usable and all primary entries navigate correctly.

Status: `verified`

### 2026-06-27 - B1 Public home composition

- status: `verified with gaps`
- build: local production build (`next build` + `next start`) with uncommitted A1-A4 fixes based on commit `3dfe9f5c`
- environment:
  - `http://localhost:3000`
  - Chromium/Playwright, Windows
  - guest session, desktop `1280x720`, mobile `390x844`
  - controlled invalid-env production run for the home error state
- tasks covered:
  1. Opened `/` directly as a guest and verified server-rendered hero, navigation, search/discovery entry points, marketplace cards, footer, and guest auth header.
  2. Tested search submission, empty search state, existing-business search, category filter, card “about” CTA, card booking CTA, hero primary CTA, hero map CTA, footer legal/data-deletion links, and mobile menu.
  3. Inspected browser console, page errors, failed requests, final URLs, status codes, mobile overflow, and direct route render state.
  4. Started a controlled invalid-env production server and verified the public home renders a safe warning + empty state instead of a blank page or production error boundary.
- evidence:
  - initial live evidence: `apps/web/test-results/live-b1-public-home-2026-06-27/b1-live.json`
  - post-fix live evidence: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/b1-live.json`
  - invalid-env evidence: `apps/web/test-results/live-b1-public-home-2026-06-27-invalid-env/b1-invalid-env.json`
  - screenshots:
    - `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/home-guest.png`
    - `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/card-book-cta.png`
    - `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/mobile-menu-guest.png`
    - `apps/web/test-results/live-b1-public-home-2026-06-27-invalid-env/home-invalid-env.png`
- result:
  - `/` loads directly with status `200`, visible hero, search/discovery UI, marketplace cards, footer, and guest sign-in entry.
  - Empty search state renders without blank shell or infinite spinner.
  - Primary navigation and CTAs route correctly:
    - card details: `/b/low-fade`
    - booking CTA: `/b/low-fade/booking?step=1&day=2026-06-27`
    - hero map CTA: `/map`
    - footer: `/privacy`, `/terms`, `/data-deletion`
  - Mobile menu opens at `390x844`; no horizontal overflow.
  - Controlled invalid-env home returns `200`, shows safe configuration warning and empty state, with no console errors, page errors, failed responses, blank shell, or production error boundary.
  - Found and fixed:
    - `WB-009`
    - `WB-010`
- remaining gaps:
  - authenticated header variant was not verified because no authenticated browser session could be established in the local environment.
  - WhatsApp sign-in was attempted and initially exposed `SUPABASE_SERVICE_ROLE_KEY`; fixed and post-fix live verified as safe unavailable (`WB-011`).
  - Google sign-in was attempted but `/auth/callback?code=...` rendered `Не удалось завершить авторизацию`; `/` still showed guest header after the attempt (`WB-012`, open).
  - route-level loading UI is not independently observable on `/`; verified no loading-only/infinite-spinner state during live runs.
- next step:
  - provide a safe working authenticated session/test user, fix the Google OAuth callback issue, or run the local server with the required WhatsApp service-role configuration, then re-run B1 authenticated-header verification and update this area to fully `verified` if it passes.

### 2026-06-27 - B1 authenticated header closure

- status: `verified`
- build: deployed production build
- environment:
  - `https://kezek.kg`
  - in-app Chromium, Windows
  - Google-authenticated session provided by the user
- tasks covered:
  1. Started from an authenticated session at `/dashboard`.
  2. Opened `https://kezek.kg/` in the same browser session.
  3. Verified authenticated root behavior and header state.
  4. Inspected browser console errors.
- evidence:
  - browser evidence: `apps/web/test-results/live-b1-authenticated-header-2026-06-27/authenticated-select-cabinet-header.json`
  - screenshot: `apps/web/test-results/live-b1-authenticated-header-2026-06-27/authenticated-select-cabinet-header.png`
- result:
  - authenticated `/` redirects to `/select-cabinet` by middleware design for this multi-cabinet role profile
  - header shows authenticated controls:
    - `Личный кабинет`
    - `Выйти`
  - guest sign-in links are absent (`signInLinks=0`)
  - no production error boundary, blank shell, loading-only state, or browser console errors appeared
  - WhatsApp auth was also retried by the user and showed the safe unavailable message fixed under `WB-011`
  - Google authentication succeeded in deployed production for the session used in this closure; local `WB-012` remains scoped to the local callback environment
- remaining gaps:
  - none for B1

### B2. Business page by slug (`P0`)

Tasks:

- open a valid `/b/[slug]` directly;
- verify business identity, branches, services, contacts, promotions, and booking CTA;
- verify inactive or unavailable entities are not shown as bookable;
- open invalid, deleted, and malformed slugs.

Done when:

- valid business information is internally consistent;
- invalid slugs fail gracefully without leaking internal details.

Status: `verified`

### 2026-06-27 - B2 Business page by slug

- status: `in progress`
- build:
  - deployed production `https://kezek.kg`
  - local production build (`next build` + `next start`) for `WB-013` post-fix verification
- environment:
  - in-app Chromium, Windows, Google-authenticated session
  - Playwright Chromium, Windows, guest/mobile `390x844`
- tasks covered:
  1. Opened valid `https://kezek.kg/b/low-fade` directly.
  2. Verified visible business identity, branch section, staff/team section, promotion/offer counters, and booking CTA links.
  3. Opened `https://kezek.kg/b/low-fade/booking` through the direct booking URL.
  4. Verified active branch selection in the booking flow and confirmed inactive/unavailable branch text did not appear in the available branch list.
  5. Opened invalid, deleted-like, and safely malformed slugs:
     - `/b/b2-live-invalid-slug-20260627`
     - `/b/low-fade-deleted-b2-20260627`
     - `/b/%3Cscript%3E`
  6. Inspected UI, console errors, failed responses, mobile overflow, stack leaks, blank/loading states, and not-found handling.
  7. Fixed and post-fix live verified the shared rating display bug.
- evidence:
  - valid business evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.json`
  - booking CTA evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/booking-low-fade.json`
  - branch select evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/booking-after-branch-select.json`
  - invalid route evidence:
    - `apps/web/test-results/live-b2-business-page-2026-06-27/invalid-slug.json`
    - `apps/web/test-results/live-b2-business-page-2026-06-27/deleted-like-slug.json`
    - `apps/web/test-results/live-b2-business-page-2026-06-27/malformed-safe-script-slug.json`
  - mobile/status evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-playwright/b2-playwright.json`
  - post-fix rating evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-postfix/b2-postfix.json`
  - screenshots:
    - `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.png`
    - `apps/web/test-results/live-b2-business-page-2026-06-27/booking-low-fade.png`
    - `apps/web/test-results/live-b2-business-page-2026-06-27/booking-after-branch-select.png`
    - `apps/web/test-results/live-b2-business-page-2026-06-27-playwright/valid-mobile.png`
    - `apps/web/test-results/live-b2-business-page-2026-06-27-postfix/valid-low-fade.png`
- result:
  - valid `/b/low-fade` loads with status `200`, business identity `Low Fade`, branch/team sections, and booking CTAs.
  - `/b/low-fade/booking` loads with status `200`; the active branch `Low Fade Юго-Восток` is selectable and moves the current step into a ready state.
  - invalid/deleted-like/malformed-safe slugs render `Бизнес не найден` with no blank shell, no production error boundary, no stack leak, and no console errors.
  - mobile valid/invalid routes have no horizontal overflow.
  - found and fixed:
    - `WB-013`
  - found and still open:
    - `WB-014`
    - `WB-015`
- remaining gaps:
  - production telemetry regression (`WB-015`) remains open for the deployed business page; current source already contains the corrected analytics path.
  - contacts could not be positively verified for `Low Fade` because no phone/contact value was rendered for this production fixture.
  - a truly deleted historical slug is not available; a deleted-like nonexistent slug was used and failed gracefully.

### 2026-06-27 - B2 closure and post-fix live verification

- status: `verified with gaps`
- result: `PASS WITH GAPS`
- build:
  - deployed production `https://kezek.kg` for the original valid/invalid route run
  - local production build (`next build` + `next start`) with the server forced to `TZ=UTC`
- environment:
  - in-app Chromium, Windows, Google-authenticated session
  - server timezone `UTC`, browser timezone `Asia/Almaty`
- tasks covered:
  1. Reproduced `WB-014` on a controlled production build with different server/browser timezones.
  2. Fixed timezone-dependent booking date rendering.
  3. Direct-loaded `/b/low-fade/booking`, selected the active branch, and advanced to the calendar step.
  4. Verified the booking summary, selected-date banner, calendar badge, and selected calendar day all show `27.06.2026`.
  5. Direct-loaded `/b/manly` and verified business identity, one active branch, three active staff members, one active promotion, and booking/promotions CTAs.
  6. Direct-loaded `/b/manly/promotions` and verified the visible `Первый визит со скидкой 50%` offer and booking CTA.
  7. Checked all three approved public business fixtures; all currently have empty business-level phone arrays, and the UI safely omits an empty contact badge.
- evidence:
  - hydration post-fix JSON: `apps/web/test-results/live-b2-business-page-2026-06-27-wb014-postfix/wb014-postfix.json`
  - hydration post-fix screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-wb014-postfix/booking-step2-utc-server.png`
  - Manly/promotions/contact-fixture evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-completion/manly-promotions-and-contacts.json`
  - screenshots:
    - `apps/web/test-results/live-b2-business-page-2026-06-27-completion/manly-business.png`
    - `apps/web/test-results/live-b2-business-page-2026-06-27-completion/manly-promotions.png`
  - supporting checks:
    - `corepack pnpm -C apps/web typecheck` passed
    - booking calendar and rating regression tests passed (`5/5`)
    - `corepack pnpm -C apps/web build` passed
- result details:
  - `WB-013` remains verified.
  - `WB-014` is fixed and post-fix live verified under the server/browser timezone split that reproduced production.
  - Valid business, branch, staff, promotion, and booking information is internally consistent for the tested fixtures.
  - Invalid, deleted-like, and safely malformed slugs fail with a user-facing not-found state and no internal detail leak.
- remaining gaps:
  - `WB-015` remains an open deployed-production telemetry regression until the corrected bundle is deployed; it does not block the visible B2 business-page acceptance criteria.
  - No approved production fixture currently contains a business-level phone value, so positive phone rendering could not be demonstrated; empty-contact behavior was verified.
  - No known historical deleted slug was available; the deleted-like nonexistent slug remains the safe substitute.

### 2026-06-27 - B2 full closure

- status: `verified`
- result: `PASS`
- build:
  - current local production build (`next build` + `next start`)
  - deployed production `https://kezek.kg` used for the release-state comparison
- environment:
  - in-app Chromium, Windows
  - responsive viewport `390x844`
  - isolated Supabase-compatible REST fixture bound only to `127.0.0.1`; no real records were created, edited, or deleted
- tasks completed:
  1. Direct-loaded `/b/b2-contact-live-20260627` against a controlled approved business fixture.
  2. Verified identity, test address, phone `+996 700 000 001`, active branch, active specialist, normalized ratings, and both booking CTAs in the rendered UI.
  3. Verified the page had no horizontal overflow and no browser console warnings or errors at the mobile breakpoint.
  4. Deleted only the isolated test business from the fixture service.
  5. Hard-reloaded the same slug and verified the recovery UI `Бизнес не найден` with no stack trace, runtime variable, secret, blank shell, overflow, or console error.
  6. Rechecked deployed telemetry endpoints: the stale path returns `404`, while the corrected deployed route is present; the stale frontend bundle remains tracked as `WB-015` under deployment area A3.
  7. Found `WB-016`: active services were omitted from the public business page.
  8. Added active-service loading and a localized service section, then rebuilt and repeated the live run.
  9. Verified one active service renders with branch, duration, and price range while an inactive fixture service is excluded by `active=eq.true`.
  10. Rebuilt against the real configured Supabase and direct-loaded `/b/low-fade`; verified three active services and their real branch/duration/price data.
- evidence:
  - complete live record: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/b2-complete.json`
  - positive contact screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/contact-fixture-mobile.png`
  - post-delete screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/deleted-fixture-mobile.png`
  - services post-fix screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/services-postfix-mobile.png`
  - real-Supabase services screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/services-postfix-real-supabase-mobile.png`
  - production build log: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/server2.log`
  - post-fix production build: passed (`next build`)
  - post-fix typecheck: passed
- result details:
  - All B2 tasks and both `Done when` conditions now have live-browser evidence.
  - Positive contact rendering and a real controlled create/exist/delete lifecycle are covered.
  - Active services are visible with internally consistent details; inactive services, branches, staff, and promotions are excluded by the public queries.
  - Real Supabase post-fix result for `Low Fade`: `3` services, `1` active branch, `2` active specialists, normalized `2.5` ratings, three booking links, no mobile overflow, and no console warnings/errors.
  - `WB-013`, `WB-014`, and `WB-016` are fixed and post-fix live verified on the current production build.
- remaining gaps:
  - none for B2
  - `WB-015` is an A3 deployment/release-state issue and remains open until the current frontend bundle is deployed; it does not reduce B2 test coverage of the current build.

### B3. Search, filters, and discovery (`P1`)

Tasks:

- test search input responsiveness and debounce;
- test categories and clear/reset behavior;
- test empty results and network failure;
- verify query state across navigation and reload where expected.

Done when:

- search and filters are deterministic, reversible, and do not show stale results.

Status: `verified`

### 2026-06-29 - B3 Search, filters, and discovery

- status: `verified`
- result: `PASS`
- build:
  - current local production build (`next build` + `next start`)
  - real configured Supabase for normal discovery scenarios
  - controlled unreachable Supabase endpoint on `localhost:3001` for failure handling
- environment:
  - in-app Chromium, Windows
  - default desktop viewport and responsive `390x844`
  - guest session; no real data was created, edited, or deleted
- live steps:
  1. Direct-loaded `/` and verified the three approved businesses and `barbershop` category.
  2. Typed `Man`, checked the pre-debounce state, then verified the debounced URL/result update to only `Manly`.
  3. Rapidly typed `L` → `Low` → `Low Fade` and verified cancelled intermediate queries do not produce stale cards.
  4. Selected `barbershop`, cleared only the category, and performed a full reset; query and result state changed reversibly.
  5. Queried `zzzz-b3-no-results-20260629`, verified the legitimate empty state, and hard-reloaded it with the query preserved.
  6. Navigated from `?q=Man` to `/b/manly`, then used Back/Forward; the query, input, result chip, and card were restored correctly.
  7. Started a controlled failure build and verified network failure is distinct from a legitimate empty result.
  8. Repeated normal search and failure surfaces at `390x844`, checking overflow and browser console output.
- defects:
  - `WB-017` found, fixed, and post-fix live verified.
  - `WB-018` found, fixed, and post-fix live verified.
- evidence:
  - before-fix record: `apps/web/test-results/live-b3-search-2026-06-29/b3-before-fix.json`
  - post-fix record: `apps/web/test-results/live-b3-search-2026-06-29/b3-postfix.json`
  - failure before fix: `apps/web/test-results/live-b3-search-2026-06-29/network-failure-before-fix.png`
  - search post-fix mobile: `apps/web/test-results/live-b3-search-2026-06-29/search-postfix-mobile.png`
  - failure post-fix mobile: `apps/web/test-results/live-b3-search-2026-06-29/network-failure-postfix-mobile.png`
- supporting checks:
  - `corepack pnpm -C apps/web typecheck` passed
  - `corepack pnpm -C apps/web build` passed
  - `HomeHeader.test.tsx`: `2/2` passed
- result details:
  - Search and category state are deterministic, URL-backed, reversible, and restored by reload/history navigation.
  - The debounce cancels stale intermediate input and does not display stale results.
  - Legitimate zero results and data-service failure now have distinct safe UI.
  - No browser console warnings/errors, secret leakage, blank shell, or horizontal overflow appeared.
- remaining gaps:
  - none for B3

### B4. Map and nearby branches (`P2`)

Tasks:

- open `/map` directly and through public navigation;
- grant, deny, and revoke location permission;
- verify markers, branch list, category filter, and nearest action;
- verify branch selection opens the correct business/booking path;
- verify missing coordinates and map provider errors.

Done when:

- map and list remain usable with or without location permission.

Status: `verified`

### 2026-06-30 - B4 Map and nearby branches

- status: `verified`
- result: `PASS`
- build:
  - current local production build (`next build` + `next start`)
  - real configured Supabase and Yandex Maps for the normal path
  - isolated Supabase-compatible fixture for missing-coordinate coverage
  - controlled missing Yandex Maps key for provider-failure coverage
- environment:
  - in-app Chromium, Windows, guest, desktop and `390x844`
  - installed Chrome permission context for controlled `granted → revoked` verification
  - safe public test coordinates near central Osh; no actual user location was recorded in evidence
- live steps:
  1. Direct-loaded `/map`; verified three real branches, three Yandex placemarks, `barbershop`, and three booking links.
  2. Opened `/map` through the public-home `Карта филиалов` link and confirmed the same map/list state.
  3. Selected and reset `barbershop`; list and marker counts remained deterministic for the current fixtures.
  4. Selected `Manly Фрунзенская`; verified its selected styling and navigation to `/b/manly/booking` with business heading `Manly`.
  5. Denied geolocation in the in-app browser; verified the denial guidance and that all three branches remained usable.
  6. Granted controlled geolocation; verified permission `granted` and distance-sorted results (`0.3`, `1.3`, `3.4` km).
  7. Revoked permission; verified state changed from `granted` to `prompt`, then reloaded and confirmed the complete list and booking links remained usable.
  8. Used an isolated fixture with one valid branch and one branch without coordinates; verified only the valid branch and one marker rendered, and the observed REST query required non-null `lat`/`lon`.
  9. Reproduced `WB-019` with a controlled provider failure, fixed the internal-detail leak, and repeated desktop/mobile live checks.
  10. Rebuilt with the real provider configuration and verified the final direct load again produced three markers, three list entries, and no new console warnings/errors.
- related defects:
  - `WB-019` found, fixed, and post-fix live verified.
  - `WB-006` remained non-regressed: final real-provider load emitted no new CSP/provider console errors.
  - `WB-008` remained non-regressed: branch list error handling and recovery implementation are still present; normal and controlled provider states kept the list independent from the canvas.
- evidence:
  - before-fix record: `apps/web/test-results/live-b4-map-2026-06-30/b4-before-fix.json`
  - final live record: `apps/web/test-results/live-b4-map-2026-06-30/b4-live.json`
  - provider error before fix: `apps/web/test-results/live-b4-map-2026-06-30/provider-error-before-fix.png`
  - provider error post-fix mobile: `apps/web/test-results/live-b4-map-2026-06-30/provider-error-postfix-mobile.png`
  - final map mobile: `apps/web/test-results/live-b4-map-2026-06-30/map-final-mobile.png`
  - final production server log: `apps/web/test-results/live-b4-map-2026-06-30/server-final.log`
- supporting checks:
  - `corepack pnpm -C apps/web typecheck` passed
  - controlled provider-failure `next build` passed
  - final real-configuration `next build` passed
- result details:
  - Map and branch list remain usable with granted, denied, revoked, or unavailable geolocation.
  - Missing-coordinate branches are excluded safely rather than rendered at `(0,0)`.
  - Provider failure degrades only the map canvas; discovery and booking paths remain usable.
  - Desktop and mobile checks showed no horizontal overflow, blank shell, secret leak, or new console error on the final real-provider build.
- remaining gaps:
  - none for B4

---

## C. Authentication and session

### C1. Sign-in UI and redirect decisions (`P0`)

Tasks:

- open `/auth/sign-in` as guest and authenticated users;
- verify provider hierarchy and field validation;
- verify `next`/return URL handling;
- verify existing sessions redirect to the correct role destination;
- test mobile and desktop viewport behavior.

Done when:

- sign-in has no redirect loop and the final destination follows role policy.

Status: `verified`

### 2026-06-30 - C1 Sign-in UI and redirect decisions

- status: `verified`
- result: `PASS after WB-020 fix`
- build:
  - current local production build (`next build` + `next start`) with uncommitted A1-A4/B1-B4/C1 fixes
  - deployed production `https://kezek.kg` for authenticated existing-session redirect behavior
- environment:
  - local app: `http://localhost:3000`, Next.js production server, in-app Chromium, Windows, guest session, desktop default viewport and `390x844` mobile viewport
  - production app: `https://kezek.kg`, in-app Chromium, authenticated Google session with owner/manager access and multiple businesses
- steps:
  1. Direct-loaded `/auth/sign-in` as a local guest and inspected SSR-visible UI, provider hierarchy, console warnings/errors, and horizontal overflow.
  2. Verified the social-only provider hierarchy and absence of unsupported e-mail/password controls.
  3. Opened `/auth/sign-in?next=%2Fb%2Fmanly%2Fbooking` and `/auth/sign-in?redirect=%2Fb%2Fmanly%2Fbooking` as a guest and inspected propagated return targets.
  4. Opened `/auth/sign-in?redirect=https%3A%2F%2Fevil.example%2Fafter-login` and direct `/auth/whatsapp?redirect=https%3A%2F%2Fevil.example%2Fafter-login` to verify unsafe return target handling.
  5. Clicked the Google sign-in CTA in the live browser; the already-authenticated Google flow completed and followed role policy to a production cabinet-selection route.
  6. Opened `https://kezek.kg/auth/sign-in?redirect=%2Fb%2Fmanly%2Fbooking` with the existing production session and waited for the client-side role-policy redirect.
  7. Rebuilt the candidate production bundle, restarted `next start`, and repeated the C1 post-fix live checks on desktop and mobile.
- evidence:
  - bug: `WB-020`
  - desktop post-fix record: `apps/web/test-results/live-c1-signin-2026-06-30/c1-postfix-desktop.json`
  - mobile post-fix record: `apps/web/test-results/live-c1-signin-2026-06-30/c1-postfix-mobile.json`
  - validation and authenticated-session record: `apps/web/test-results/live-c1-signin-2026-06-30/c1-validation-and-prod-session.json`
  - mobile screenshot: `apps/web/test-results/live-c1-signin-2026-06-30/c1-signin-mobile-postfix.png`
  - post-fix server log: `apps/web/test-results/live-c1-signin-2026-06-30/server-postfix.log`
- supporting checks:
  - `corepack pnpm -C apps/web test -- --runTestsByPath src/__tests__/lib/authReturnUrl.test.ts src/__tests__/lib/signInRedirectLogic.test.ts` passed, 2 suites / 11 tests
  - `corepack pnpm -C apps/web typecheck` passed
  - `corepack pnpm -C apps/web build` passed
- result details:
  - Guest sign-in renders the intended social-only provider hierarchy: Google, Yandex, WhatsApp, and Telegram availability messaging.
  - Required and invalid e-mail validation blocks submission client-side without sending a code.
  - `next` and `redirect` return URL aliases are deterministic and normalized to safe relative paths.
  - Unsafe absolute return URLs fall back to `/` and are not propagated to WhatsApp.
  - Existing production session redirects to `/select-business` for the tested owner/manager account with multiple businesses; no redirect loop, blank shell, error boundary, or console error appeared.
  - Desktop and mobile checks showed no horizontal overflow.
- remaining gaps:
  - none for C1 candidate build

### C2. Email/OTP and password recovery (`P0`)

Tasks:

- request sign-in code or link where enabled;
- verify invalid, expired, reused, and valid codes;
- run reset-password and update-password flows;
- verify email verification and post-signup paths;
- verify rate-limit and resend feedback.

Done when:

- valid credentials establish one session;
- invalid credentials never promote the session and show safe feedback.

Status: `not applicable`

Latest live run: `2026-06-30`, continued `2026-07-03`

- environment:
  - local production build at `http://localhost:3000` (`next build` + `next start`)
  - in-app Chromium on Windows; guest session; desktop and `390x844` mobile viewport
- live steps completed:
  - opened reset-password, update-password, verify-email/OTP, and post-sign-up entry paths directly;
  - exercised empty, malformed, expired/invalid, missing-session, resend, and unknown-address paths;
  - requested a reset link for a controlled test address and verified non-enumerating feedback;
  - checked browser console, redirects, session non-promotion, and mobile overflow after the fix.
- evidence:
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-initial-pages.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-invalid-interactions.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-postfix-desktop.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-request-link-code.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-final-live.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-reset-mobile-final.png`
- result: `NOT APPLICABLE — product policy confirmed as social-login only on 2026-07-03`
- related bugs:
  - `WB-021` fixed and post-fix live verified for invalid/error paths
  - `WB-022` verified; unsupported e-mail/password entry points removed
- supporting automated checks:
  - focused auth-message and return-URL suites: `7 passed`
  - web typecheck: passed
  - production build: passed
- scope decision and final live verification (`2026-07-03`):
  - the owner confirmed that Kezek does not plan e-mail/OTP or password authentication;
  - `/auth/sign-in` was changed to Google, Yandex, WhatsApp, and Telegram only;
  - direct loads of `/auth/reset-password`, `/auth/update-password`, and `/auth/verify-email` redirect safely to `/auth/sign-in`;
  - production build passed; final browser console was clean; no horizontal overflow was observed.
- final evidence:
  - `apps/web/test-results/live-c2-social-only-2026-07-03/c2-social-only-postfix-live.json`
  - `apps/web/test-results/live-c2-social-only-2026-07-03/c2-social-only-final-live.json`
- remaining gaps:
  - none for C2 because the feature is outside product scope;
  - real social-provider completion remains tracked by C3, C4, and C5.

### C3. Google and Yandex OAuth (`P0`)

Tasks:

- complete real Google login;
- complete Yandex login if enabled for release;
- test provider cancellation;
- verify callback route, final role destination, and session persistence;
- replay/back-refresh callback and verify idempotency.

Done when:

- provider callback establishes exactly one valid session and never gets stuck.

Status: `in progress`

Latest live run: `2026-07-03`

- environment:
  - local production candidate at `http://localhost:3000`
  - deployed provider callbacks at `https://kezek.kg`
  - in-app Chromium on Windows; real Google and Yandex identities
- live steps completed:
  - signed out of Kezek and completed a real Google OAuth flow;
  - verified role selection, client-cabinet destination, reload persistence, and Back/Forward behavior;
  - completed a real Yandex ID login; reproduced and fixed the registered-callback mismatch;
  - verified Yandex callback completion at `/cabinet/bookings`, reload persistence, and clean console;
  - exercised controlled provider cancellation and post-fix safe feedback;
  - replayed callback history and reproduced sensitive-fragment retention on deployed production.
- evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-google-live-sanitized.json`
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-google-persistence-replay.json`
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-postfix-live.json`
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-cancellation.json`
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-cancellation-postfix.json`
- result: `PARTIAL PASS`
- related bugs:
  - `WB-023`: fixed locally; production post-fix live pending
  - `WB-024`: verified
  - `WB-025`: P0 fixed locally; production post-fix live pending
  - `WB-026`: verified
- supporting automated checks:
  - OAuth redirect/callback/error suites: `10 passed`
  - web typecheck: passed
  - production build: passed
- remaining gaps:
  - deploy the callback-history and Google return-path fixes to `kezek.kg`;
  - repeat real Google and Yandex callbacks after deployment and confirm Back cannot reopen callback code/auth fragments;
  - confirm exactly one persisted session after the post-deploy replay test.

### C4. Telegram authentication and linking (`P0`)

Tasks:

- complete web Telegram login;
- test account linking for an already authenticated user;
- test denied, expired, and replayed payloads;
- verify return URL and role destination;
- verify Telegram reminder/banner behavior.

Done when:

- Telegram identity is linked or authenticated once with correct user ownership.

Status: `not started`

### C5. WhatsApp authentication (`P0`)

Tasks:

- submit valid and invalid phone numbers;
- send OTP and verify cooldown;
- enter invalid, expired, reused, and valid OTPs;
- verify session establishment, redirects, retry, and idempotency;
- test provider/service failure messaging.

Done when:

- the complete real OTP flow works and invalid paths cannot create a session.

Status: `not started`

### C6. Session restoration and sign-out (`P0`)

Tasks:

- reload, close/reopen browser, and open a protected link in a new tab;
- verify cookie/session restoration;
- sign out from each role;
- verify browser Back cannot reopen protected content;
- verify multi-tab logout propagation and stale-session cleanup.

Done when:

- logout invalidates protected access and valid sessions restore predictably.

Status: `not started`

---

## D. Public and authenticated booking

### D1. Booking entry and data loading (`P0`)

Tasks:

- open `/b/[slug]/booking` directly and from business, map, and search;
- verify branch, service, staff, schedule, and viewer metadata;
- test empty/error/loading states;
- verify inactive business/branch/service behavior.

Done when:

- only currently bookable data is selectable.

Status: `not started`

### D2. Booking step transitions (`P0`)

Tasks:

- select branch, one or multiple services, staff, date, and slot;
- verify disabled states before required choices;
- move Back/Forward between steps;
- verify selections and summary remain consistent;
- verify timezone and past-date restrictions.

Done when:

- all steps enforce valid state and produce a consistent summary.

Status: `not started`

### D3. Authenticated booking completion (`P0`)

Tasks:

- complete booking as an authenticated client;
- verify double-submit protection;
- verify success details and client cabinet entry;
- reload and confirm persistence;
- verify server-side conflict after a slot becomes unavailable.

Done when:

- exactly one correct booking is created and visible in all expected surfaces.

Status: `not started`

### D4. Guest booking (`P0`)

Tasks:

- choose booking without registration;
- validate guest name and phone;
- submit valid guest booking;
- verify duplicate and invalid phone handling;
- verify guest cannot access protected client data.

Done when:

- guest booking creates the expected booking without creating unauthorized access.

Status: `not started`

### D5. Promotions and packages in booking (`P1`)

Tasks:

- apply percentage, fixed/free, expired, limited, and minimum-order promotions;
- verify package-paid booking and remaining visits;
- verify summary, confirmation, cabinet, and finance show the same amount;
- verify repeated attendance does not consume a package twice.

Done when:

- discounts and packages produce consistent, idempotent totals.

Status: `not started`

### D6. Booking cancellation, attendance, and repeat (`P1`)

Tasks:

- cancel from client and workspace flows;
- mark confirmed/paid/no-show where role permits;
- verify repeat booking;
- verify status changes across QuickDesk, Cabinet, and analytics.

Done when:

- state transitions are authorized, visible everywhere, and not duplicated.

Status: `not started`

---

## E. Client cabinet

### E1. Cabinet home and booking lists (`P0`)

Tasks:

- verify upcoming, history, empty, loading, and error states;
- open booking details;
- verify pagination/filtering if present;
- verify data after booking create/cancel.

Done when:

- the client sees only their own correct bookings and statuses.

Status: `not started`

### E2. Client profile (`P1`)

Tasks:

- load and edit profile fields;
- test validation and server errors;
- reload and verify persistence;
- test phone update and identity constraints.

Done when:

- valid edits persist and invalid edits do not corrupt profile state.

Status: `not started`

### E3. Client packages and payments presentation (`P1`)

Tasks:

- verify active, expired, depleted, and absent packages;
- verify remaining visit counts after attendance;
- compare package state with dashboard records;
- verify inaccessible packages do not leak between clients.

Done when:

- package ownership and balances are accurate.

Status: `not started`

### E4. Reviews and feedback (`P2`)

Tasks:

- create and update an allowed review;
- test duplicate, invalid rating, and unauthorized update;
- verify rating surfaces update consistently.

Done when:

- review permissions and aggregate presentation are correct.

Status: `not started`

### E5. Client reminders and preferences (`P2`)

Tasks:

- verify name, Telegram, and WhatsApp reminder banners;
- dismiss/complete each reminder;
- reload and verify persistence;
- test locale-specific copy and links.

Done when:

- reminders reflect actual account state and do not reappear incorrectly.

Status: `not started`

---

## F. Roles, guards, and business selection

### F1. Default role routing (`P0`)

Tasks:

- login as client, staff, owner, manager, multi-role, and super-admin;
- verify default destination priority;
- verify direct `/select-cabinet` behavior;
- verify no redirect loops.

Done when:

- each account reaches the intended workspace deterministically.

Status: `not started`

### F2. Business selection and persistence (`P0`)

Tasks:

- open `/select-business`;
- choose between multiple businesses;
- verify current business in dashboard/API calls;
- reload and verify persistence;
- revoke access and verify stale selection recovery.

Done when:

- selected business always belongs to the user and controls displayed data.

Status: `not started`

### F3. Role switcher UX (`P1`)

Tasks:

- switch among client, staff, dashboard, and admin destinations where allowed;
- verify labels, current state, and Back behavior;
- verify no stale data from the previous role remains.

Done when:

- role switching is understandable and isolated.

Status: `not started`

### F4. Unauthorized access guards (`P0`)

Tasks:

- open protected dashboard, staff, cabinet, and admin routes under wrong roles;
- test direct URL, new tab, reload, and copied links;
- verify API actions reject unauthorized requests;
- verify no sensitive page content flashes before redirect.

Done when:

- UI and API authorization agree for every protected role boundary.

Status: `not started`

---

## G. Owner and manager dashboard

### G1. Dashboard entry and overview (`P1`)

Tasks:

- verify business identity and role-specific widgets;
- test loading, empty, error, and stale data;
- verify date/business filters.

Done when:

- dashboard summary matches the selected business and role.

Status: `not started`

### G2. Dashboard navigation (`P1`)

Tasks:

- traverse bookings, staff, services, branches, finance, analytics, and packages;
- verify active navigation and breadcrumbs;
- test browser Back/Forward and direct reload.

Done when:

- every workspace section is reachable and context remains correct.

Status: `not started`

### G3. Dashboard analytics (`P1`)

Tasks:

- verify overview and load analytics;
- test filters, empty periods, timezone boundaries, and refresh;
- compare visible totals with underlying bookings/shifts.

Done when:

- charts and summary values are internally consistent.

Status: `not started`

### G4. Integration status and warnings (`P2`)

Tasks:

- verify provider/integration status cards;
- test unavailable, partial, and healthy states;
- verify recovery links and refresh.

Done when:

- integration health is actionable and not misleading.

Status: `not started`

---

## H. QuickDesk and booking operations

### H1. QuickDesk baseline (`P0`)

Tasks:

- load current bookings and filters;
- verify list/calendar switching where available;
- test empty/error/loading states;
- verify business/branch/date context.

Done when:

- the operator sees the correct working set without cross-business leakage.

Status: `not started`

### H2. Quick booking and hold (`P0`)

Tasks:

- create booking for existing and guest clients;
- test quick hold and expiration behavior;
- test missing staff/service/date validation;
- test duplicate rapid submission.

Done when:

- one valid booking/hold is created with correct client and slot ownership.

Status: `not started`

### H3. Booking edits and status transitions (`P0`)

Tasks:

- edit booking data;
- transition hold → confirmed → paid/no-show;
- cancel booking;
- verify invalid transitions and permissions;
- verify updates in Cabinet, analytics, packages, and finance.

Done when:

- status machine and dependent calculations remain consistent.

Status: `not started`

### H4. Client search and creation (`P1`)

Tasks:

- search by name, phone, and other supported identifiers;
- test debounce, empty result, duplicate identity, and create-client paths;
- verify selected client remains attached through booking submission.

Done when:

- search and create behavior cannot attach a booking to the wrong client.

Status: `not started`

### H5. Concurrency and conflict handling (`P1`)

Tasks:

- open the same slot in two browser contexts;
- submit conflicting operations;
- edit stale booking data;
- verify conflict messaging and safe retry.

Done when:

- concurrent actions cannot silently overwrite or double-book.

Status: `not started`

---

## I. Business configuration

### I1. Branch management (`P1`)

Tasks:

- create, edit, schedule, and safely delete a test branch;
- verify address, coordinates, contacts, timezone, and active state;
- verify changes on public business and map.

Done when:

- branch lifecycle updates all dependent public and workspace surfaces.

Status: `not started`

### I2. Service management (`P1`)

Tasks:

- create, edit, disable, and delete test services;
- verify duration, price, category, staff links, and booking availability;
- test validation and duplicate names.

Done when:

- service configuration produces correct booking choices and totals.

Status: `not started`

### I3. Staff management (`P1`)

Tasks:

- create/link staff, edit profile, transfer, dismiss, restore, and delete where safe;
- test avatar upload/remove;
- verify role sync and booking availability.

Done when:

- staff lifecycle preserves authorization and historical records.

Status: `not started`

### I4. Schedule management (`P1`)

Tasks:

- edit branch and staff schedules;
- test breaks, day off, overnight/edge times, and invalid ranges;
- verify generated booking slots.

Done when:

- schedule changes create exactly the expected available slots.

Status: `not started`

### I5. Members and permissions (`P0`)

Tasks:

- invite/add member;
- grant, demote, revoke, and restore roles;
- verify immediate UI/API access changes;
- verify owner protections.

Done when:

- permission changes apply without privilege escalation or stale access.

Status: `not started`

### I6. Business identity and public card (`P2`)

Tasks:

- edit name, slug, description, contacts, media, and categories;
- verify slug collision and invalid values;
- verify public card and SEO metadata after update.

Done when:

- public identity is accurate and safe across direct/reloaded routes.

Status: `not started`

---

## J. Staff workspace and shifts

### J1. Staff cabinet baseline (`P1`)

Tasks:

- verify schedule, bookings, finance, profile, and navigation;
- test loading/empty/error states;
- verify staff cannot see another employee's private data.

Done when:

- staff workspace reflects the correct employee and business.

Status: `not started`

### J2. Shift open/close (`P0`)

Tasks:

- open shift;
- prevent duplicate open;
- add clients/items;
- close shift;
- verify read-only closed state and history.

Done when:

- one shift lifecycle completes with correct persisted totals.

Status: `not started`

### J3. Shift item editing and retry (`P0`)

Tasks:

- add, edit, and remove supported manual items;
- force request failure and retry;
- verify idempotency and preserved item IDs;
- verify totals after every mutation.

Done when:

- retry cannot duplicate items or corrupt totals.

Status: `not started`

### J4. Staff schedule and bookings (`P1`)

Tasks:

- verify daily/weekly schedule and date navigation;
- verify booking details and allowed actions;
- test empty day and unavailable data.

Done when:

- staff schedule agrees with branch and booking configuration.

Status: `not started`

### J5. Staff profile and avatar (`P2`)

Tasks:

- edit allowed profile data;
- upload/remove avatar;
- verify validation, file limits, persistence, and fallback.

Done when:

- profile media and data remain correct after reload.

Status: `not started`

---

## K. Finance integrity

### K1. Shift calculation baseline (`P0`)

Tasks:

- verify turnover, consumables, master share, salon share, guarantee, and top-up;
- test percentage/rate variants and rounding;
- compare staff and manager surfaces.

Done when:

- independently calculated totals match every UI section and API response.

Status: `not started`

### K2. Hours worked correction (`P0`)

Tasks:

- edit closed-shift hours;
- verify validation for negative, excessive, and open-shift values;
- verify automatic recalculation and audit entry.

Done when:

- correction updates all dependent totals once and leaves an audit trail.

Status: `not started`

### K3. Finance pages and filters (`P1`)

Tasks:

- verify all-staff and individual staff finance;
- test date ranges, empty periods, pagination, exports if present, and reload;
- compare summary with detail rows.

Done when:

- filtering cannot change or hide totals inconsistently.

Status: `not started`

### K4. Disputes and audit logs (`P1`)

Tasks:

- verify operation history after item edits and hour corrections;
- inspect actor, timestamp, before/after values, and reason;
- verify unauthorized users cannot access logs.

Done when:

- every financial correction is traceable and correctly scoped.

Status: `not started`

### K5. Cross-surface finance consistency (`P0`)

Tasks:

- compare QuickDesk, shift, staff finance, dashboard finance, packages, and analytics;
- test cancelled/no-show/package-paid/promotion bookings;
- verify timezone/date cutoffs.

Done when:

- the same business event produces the same financial meaning everywhere.

Status: `not started`

---

## L. Promotions, packages, and ratings

### L1. Promotion management (`P1`)

Tasks:

- create, edit, activate/deactivate, and delete test promotion;
- test date, usage, branch, service, minimum amount, and stacking rules;
- verify public presentation and booking calculation.

Done when:

- promotion eligibility and discount are correct end to end.

Status: `not started`

### L2. Visit package management (`P1`)

Tasks:

- create/edit package plan;
- sell package to client;
- consume visit through attendance;
- verify remaining balance, expiration, and duplicate attendance protection.

Done when:

- package lifecycle is consistent across client, QuickDesk, and dashboard.

Status: `not started`

### L3. Ratings and reviews (`P1`)

Tasks:

- verify rating configuration;
- create/update review and recalculate;
- verify business/branch/staff aggregates;
- verify debug/status surfaces only for authorized roles.

Done when:

- aggregate ratings reflect eligible reviews and configuration.

Status: `not started`

### L4. Edge conditions (`P2`)

Tasks:

- expired/disabled promotions and packages;
- zero remaining visits;
- overlapping promotions;
- deleted service/staff references;
- recalculation retry and partial failure.

Done when:

- edge states fail safely without incorrect discounts or balances.

Status: `not started`

---

## M. Super-admin cabinet

### M1. Admin entry and shell (`P0`)

Tasks:

- login as super-admin and open `/admin` directly;
- verify non-admin rejection;
- traverse admin navigation and reload nested pages;
- verify no production Server Component error.

Done when:

- the admin shell is stable and strictly guarded.

Status: `not started`

### M2. Businesses, branches, and owners (`P0`)

Tasks:

- create/edit a test business;
- create/edit/delete a test branch;
- assign/change owner;
- verify members and public visibility;
- verify destructive confirmations and dependencies.

Done when:

- entity lifecycle is correct and destructive actions cannot target the wrong entity.

Status: `not started`

### M3. Users and security actions (`P0`)

Tasks:

- search/create/update test user;
- suspend/restore, set password, send link, toggle super-admin where safe;
- verify current-user and last-admin protections;
- verify auditability and error feedback.

Done when:

- privileged user actions are guarded, explicit, and reversible where intended.

Status: `not started`

### M4. Roles and memberships (`P0`)

Tasks:

- create/edit/delete test role;
- assign and revoke roles;
- test multi-role user and business scope;
- verify API and UI permissions immediately.

Done when:

- role changes cannot grant broader access than selected.

Status: `not started`

### M5. Categories and system configuration (`P1`)

Tasks:

- create/edit/delete test category;
- verify use by services/businesses;
- test rating configuration and system settings;
- verify validation and dependency handling.

Done when:

- system configuration updates safely without orphaning active data.

Status: `not started`

### M6. Monitoring, analytics, and health (`P2`)

Tasks:

- verify monitoring, performance, health, funnel, load, promotion, and system analytics;
- test empty periods, filters, refresh, partial API failure, and retry;
- verify metrics do not expose sensitive payloads.

Done when:

- operational pages are accurate enough to diagnose real incidents.

Status: `not started`

---

## N. Notifications, webhooks, and integrations

### N1. Notification delivery (`P1`)

Tasks:

- trigger allowed booking/status notifications;
- verify recipient, locale, content, duplicate suppression, and failure handling;
- verify UI does not claim success when delivery fails.

Done when:

- notifications are sent once to the correct recipient with safe content.

Status: `not started`

### N2. Telegram webhook and linking (`P0`)

Tasks:

- verify webhook signature/authenticity controls;
- test valid, replayed, malformed, and unrelated updates;
- verify login/link confirmation behavior;
- inspect logs for secret leakage.

Done when:

- only valid updates can change authentication/link state.

Status: `not started`

### N3. WhatsApp webhook and OTP integration (`P0`)

Tasks:

- verify webhook verification and inbound event handling;
- test duplicate/reordered status events;
- test OTP send/verify provider failures;
- verify diagnostics endpoints are appropriately guarded.

Done when:

- provider events are idempotent, authenticated, and safely observable.

Status: `not started`

### N4. Cron and background jobs (`P2`)

Tasks:

- verify shift close, analytics, retention, health alert, and rating jobs in a controlled environment;
- test authorization, duplicate execution, partial failure, and retry;
- verify job effects and logs.

Done when:

- repeated job execution is safe and observable.

Status: `not started`

---

## O. UI, responsive, i18n, and accessibility

### O1. Desktop responsive baseline (`P1`)

Tasks:

- test 1280, 1440, and wide desktop layouts;
- verify headers, sidebars, tables, modals, and sticky actions;
- inspect horizontal overflow and clipped controls.

Done when:

- key public and workspace pages are usable at supported desktop widths.

Status: `not started`

### O2. Mobile and tablet web (`P1`)

Tasks:

- test 320, 360, 390, 412, 768, and 1024 CSS-pixel widths;
- verify mobile menu, forms, booking steps, cards, tables, and dialogs;
- test touch targets and virtual keyboard where possible.

Done when:

- critical flows remain complete without hidden or unreachable actions.

Status: `not started`

### O3. RU/KY/EN localization (`P1`)

Tasks:

- switch among supported languages;
- verify persistence and URL behavior;
- inspect missing keys, mixed languages, overflow, dates, money, and plurals;
- verify server and client content use the same locale.

Done when:

- no mojibake, untranslated key, or locale-inconsistent business value remains.

Status: `not started`

### O4. Keyboard and screen reader (`P1`)

Tasks:

- navigate core public, booking, cabinet, dashboard, staff, and admin paths by keyboard;
- inspect focus order, skip/navigation landmarks, dialog focus trap, and focus restoration;
- run a screen reader smoke where environment supports it;
- verify live/error announcements.

Done when:

- core actions are operable without a mouse and semantics are understandable.

Status: `not started`

### O5. Visual regression (`P2`)

Tasks:

- compare key pages with established visual baselines;
- test hover, focus, disabled, loading, empty, and error states;
- verify no accidental design divergence between related workspaces.

Done when:

- intentional changes are documented and accidental visual changes are absent.

Status: `not started`

---

## P. Resilience, performance, and security

### P1. API error and retry behavior (`P0`)

Tasks:

- intercept or reproduce 400, 401, 403, 404, 409, 429, 500, timeout, and offline states;
- verify readable errors and safe retries;
- verify critical actions do not fail silently;
- verify mutation retries are idempotent.

Done when:

- errors preserve user data and cannot duplicate business operations.

Status: `not started`

### P2. Browser state and interruption recovery (`P1`)

Tasks:

- reload mid-form, duplicate tab, background tab, navigate away/back, and restore closed tab;
- test interrupted auth, booking, QuickDesk, and admin edits;
- verify stale form/session handling.

Done when:

- interruption leads to deterministic recovery or explicit restart.

Status: `not started`

### P3. Performance and heavy data (`P1`)

Tasks:

- measure public first load and critical workspace navigation;
- test large bookings, staff, users, businesses, and finance lists;
- inspect pagination/virtualization, long tasks, request waterfalls, and memory;
- verify repeated navigation does not degrade.

Done when:

- supported data volumes remain responsive without unbounded DOM/memory growth.

Status: `not started`

### P4. Security and privacy (`P0`)

Tasks:

- inspect console, network, HTML, error pages, and browser storage for secrets;
- test open redirect, unsafe `next`, IDOR, role bypass, CSRF-sensitive mutations, and unguarded admin/debug endpoints;
- verify cookies and auth state behavior;
- verify sensitive values are masked in logs and UI.

Done when:

- no reproduced privilege escalation, cross-tenant access, or credential exposure remains.

Status: `not started`

### P5. Browser compatibility (`P2`)

Tasks:

- run critical smoke on current Chrome/Chromium, Firefox, and WebKit where available;
- test desktop and mobile emulation;
- record browser-specific unsupported behavior.

Done when:

- release-supported browsers complete auth, booking, and primary workspace entry.

Status: `not started`

---

## Q. Release readiness

### Q1. Automated baseline (`P0`)

Tasks:

- run web typecheck;
- run core and extended Jest suites;
- run public Playwright smoke;
- run authenticated and seeded groups when environment is prepared;
- run visual regression gate;
- record skipped specs and why.

Suggested commands:

```powershell
corepack pnpm -C apps/web typecheck
corepack pnpm -C apps/web test:ci:core
corepack pnpm -C apps/web test:ci:extended
corepack pnpm -C apps/web test:e2e:smoke
corepack pnpm -C apps/web test:e2e:auth-required
corepack pnpm -C apps/web test:e2e:seed-required
corepack pnpm -C apps/web test:e2e:visual
```

Done when:

- required suites pass and every skip is an explicit environment gap.

Status: `not started`

### Q2. Manual release smoke (`P0`)

Tasks:

- public home/business/map;
- one real auth provider and logout;
- complete booking and cancellation;
- QuickDesk status transition;
- staff shift open/add/close;
- owner dashboard entry;
- super-admin entry;
- network failure and recovery.

Done when:

- all release-critical role paths pass on the candidate build.

Status: `not started`

### Q3. Data cleanup and side-effect audit (`P1`)

Tasks:

- identify every test entity created during live QA;
- remove or archive approved test data;
- verify no real user or business was modified;
- record data intentionally retained for future tests.

Done when:

- the environment is left clean and reproducible.

Status: `not started`

### Q4. Final GO/NO-GO (`P0`)

Tasks:

- list open `WB-*` defects by severity;
- list blocked or untested live areas;
- confirm rollback and monitoring readiness;
- decide `GO`, `NO-GO`, or `GO WITH ACCEPTED RISKS`.

Release blockers:

- any open confirmed `P0`;
- broken auth, booking, QuickDesk, shift, or logout;
- incorrect financial calculations;
- cross-business or cross-role data exposure;
- destructive admin action targeting the wrong entity;
- secret/token leakage;
- production-only crash or Server Component render failure.

Status: `not started`

---

## Suggested execution waves

### Wave 1: public and critical paths

`A1`, `A3`, `B1`, `B2`, `C1`, `C3-C6`, `D1-D4`, `E1`, `F1`, `F4`, `Q1`

### Wave 2: business operations

`G1-G3`, `H1-H5`, `I1-I5`, `J1-J4`, `K1-K5`, `L1-L3`

### Wave 3: admin and integrations

`M1-M6`, `N1-N4`, `F2-F3`, `E2-E5`

### Wave 4: hardening and release

`A2`, `A4`, `B3-B4`, `O1-O5`, `P1-P5`, `Q2-Q4`

## Live run result template

```markdown
### YYYY-MM-DD - C3 Google/Yandex OAuth

- status: `verified | failed | blocked`
- build: commit/deploy
- environment: URL, browser, OS, viewport
- account/role: safe label only
- steps:
  1. ...
- expected:
  - ...
- actual:
  - ...
- evidence:
  - screenshot/snapshot/network/console
- bugs:
  - `WB-001` or `none`
- remaining gaps:
  - ...
```
