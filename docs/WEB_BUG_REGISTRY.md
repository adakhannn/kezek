# WEB BUG REGISTRY

Last updated: 2026-07-03  
Owner: User + Codex  
Status: Active

## Purpose

This registry contains defects reproduced during live testing of the Kezek web application.

Mobile-only defects remain in [MOBILE_BUG_REGISTRY.md](./MOBILE_BUG_REGISTRY.md).
The web testing scope and execution status are maintained in
[WEB_LIVE_TESTING_AREAS_CATALOG.md](./WEB_LIVE_TESTING_AREAS_CATALOG.md).

## Status values

- `open`
- `in progress`
- `fixed`
- `verified`
- `cannot reproduce`
- `accepted risk`

## Severity

- `P0`: release blocker, security/tenant boundary, data loss, critical workflow unavailable, or incorrect financial result.
- `P1`: major workflow or resilience defect without a safe practical workaround.
- `P2`: presentation, accessibility, browser compatibility, or lower-impact edge case.

## Bug template

```markdown
### WB-001
- id: `WB-001`
- date: `YYYY-MM-DD`
- area: `C3`
- severity: `P0 | P1 | P2`
- title: Short defect title
- build: commit/deploy URL
- environment: browser, OS, viewport, role
- preconditions:
  - ...
- steps:
  1. ...
- expected:
  - ...
- actual:
  - ...
- evidence:
  - screenshot/snapshot/console/network trace
- status: `open`
- owner: `Codex + User`
```

## Open bugs

### WB-027
- id: `WB-027`
- date: `2026-07-03`
- area: `C3`
- severity: `P0`
- title: Real Google OAuth reaches the deployed callback but ends on the authorization error surface
- build: deployed commit `0f57fd8d` at `https://kezek.kg`
- environment: in-app Chromium, Windows, real Google identity, clean Kezek production session
- steps:
  1. Open `/auth/sign-in?next=%2Fcabinet` on production.
  2. Click `Продолжить с Google` and complete the provider flow.
  3. Wait on `/auth/callback`.
- expected:
  - the callback establishes one session and replaces itself with `/cabinet` or the role-policy destination.
- actual:
  - callback receives `code`, `from`, and `next`, then renders `Не удалось завершить авторизацию`;
  - no redirect loop occurs and no raw provider error is exposed.
- evidence:
  - post-deploy live browser run on `2026-07-03`; authorization code intentionally omitted
- suspected cause:
  - automatic Supabase PKCE handling and explicit `exchangeCodeForSession` can race; an already-created session is not accepted when the explicit exchange reports an error.
- fix:
  - Google now returns to a dedicated server Route Handler that exchanges the PKCE code and writes auth cookies before redirecting to the existing role-routing callback;
  - the browser callback no longer owns the initial Google code exchange.
- verification:
  - typecheck and production build passed locally;
  - production post-fix live verification requires deploying the follow-up candidate.
- status: `fixed locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-026
- id: `WB-026`
- date: `2026-07-03`
- area: `C3`
- severity: `P1`
- title: OAuth cancellation returns to sign-in without any user feedback
- build: current local production candidate at `http://localhost:3000`
- environment: in-app Chromium, Windows, guest local Kezek session
- steps:
  1. Return from a provider callback with `error=access_denied`.
  2. Observe `/auth/sign-in?error=access_denied`.
- expected:
  - sign-in explains that authorization was cancelled and offers another attempt/provider.
- actual:
  - the normal sign-in screen appears with no error or cancellation feedback.
- evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-cancellation.json`
- fix:
  - added safe OAuth error mapping and rendered cancellation feedback on sign-in without exposing raw provider codes.
- post-fix live verification:
  - controlled `access_denied` callback returned to sign-in with `Вход отменён…` feedback;
  - raw provider code was absent from UI, console was clean, and no horizontal overflow appeared.
- post-fix evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-cancellation-postfix.json`
- status: `verified`
- owner: `Codex + User`

### WB-025
- id: `WB-025`
- date: `2026-07-03`
- area: `C3`
- severity: `P0`
- title: Yandex OAuth callback with sensitive auth fragment remains reachable through browser Back
- build: deployed callback at `https://kezek.kg`, reached from the local production candidate
- environment: in-app Chromium, Windows, authenticated real Yandex ID
- preconditions:
  - complete Yandex OAuth and reach `/cabinet/bookings`
- steps:
  1. Reload the destination and confirm the session persists.
  2. Press browser Back once.
- expected:
  - callback history is replaced after session establishment;
  - browser history never exposes reusable authentication material.
- actual:
  - Back returns to `/auth/callback` with sensitive authentication values in the URL fragment;
  - Forward returns to the cabinet and the session remains usable.
- evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-postfix-live.json` (all sensitive values redacted)
- fix:
  - local production candidate now completes all generic auth callback branches with `window.location.replace(targetPath)` instead of adding a history entry.
  - follow-up candidate also replaces `/auth/callback-yandex` with its API callback instead of adding the Yandex authorization code to browser history.
- post-deploy observation for commit `0f57fd8d`:
  - sensitive auth fragments no longer remain after generic callback completion;
  - session persists and replay is idempotent, but Back can still briefly reopen `/auth/callback-yandex` with a one-time code.
- status: `follow-up fix ready locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-024
- id: `WB-024`
- date: `2026-07-03`
- area: `C3`
- severity: `P0`
- title: Yandex OAuth is rejected because localhost redirect URI does not match the registered Callback URL
- build: current local production candidate at `http://localhost:3000`
- environment: in-app Chromium, Windows, real Yandex ID authorization
- preconditions:
  - Yandex OAuth is enabled and the user is signed out of Kezek
- steps:
  1. Open local `/auth/sign-in?next=%2Fcabinet`.
  2. Click `Войти через Яндекс` and authenticate with a real Yandex ID.
  3. Observe the provider response.
- expected:
  - the authorization request uses the exact registered release callback and returns to Kezek.
- actual:
  - Yandex responds with HTTP 400: `redirect_uri` does not match the Callback URL registered for the application;
  - the request sends `http://localhost:3000/auth/callback-yandex`.
- evidence:
  - real provider page at `oauth.yandex.ru/authorize` on `2026-07-03`; query values intentionally omitted
- fix:
  - introduced an explicit `NEXT_PUBLIC_YANDEX_REDIRECT_URI` contract shared by authorization and token exchange;
  - release fallback is `https://kezek.kg/auth/callback-yandex` instead of deriving the callback from localhost public origin.
- post-fix live verification:
  - real Yandex authorization accepted the corrected callback, reached production `/auth/callback-yandex`, and completed at `/cabinet/bookings`;
  - the resulting session survived direct reload and browser console was clean.
- post-fix evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-postfix-live.json`
- status: `verified`
- owner: `Codex + User`

### WB-023
- id: `WB-023`
- date: `2026-07-03`
- area: `C3`
- severity: `P1`
- title: Google OAuth loses the requested return path and leaves the callback code on the destination URL
- build: current local production candidate at `http://localhost:3000`; OAuth completion on `https://kezek.kg`
- environment: in-app Chromium, Windows, guest local Kezek session with an existing Google provider session
- preconditions:
  - open `/auth/sign-in?next=%2Fcabinet` on the local production build
- steps:
  1. Click `Продолжить с Google`.
  2. Complete/allow the Google provider flow.
  3. Observe the final Kezek route and address bar.
- expected:
  - OAuth returns through the configured callback for the initiating origin;
  - the safe `next=/cabinet` destination is preserved;
  - transient authorization codes are removed from the visible destination URL after exchange.
- actual:
  - the flow completed on production `/select-cabinet` instead of the requested `/cabinet`;
  - the final visible URL retained a transient `code` query parameter.
- evidence:
  - live browser reproduction on `2026-07-03`; code value intentionally omitted
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-google-live-sanitized.json`
- fix:
  - Google authorization now includes the sanitized return path in its callback URL;
  - generic callback completion now uses `window.location.replace` so transient callback URLs are removed from browser history.
- status: `fixed in local candidate; production post-fix live verification required`
- owner: `Codex + User`

### WB-022
- id: `WB-022`
- date: `2026-07-03`
- area: `C1/C2`
- severity: `P1`
- title: Sign-in UI exposes unsupported e-mail magic-link and password-recovery flows
- build: current local production candidate with uncommitted live-testing fixes
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest
- preconditions:
  - product authentication policy allows social providers only
- steps:
  1. Open `/auth/sign-in` as a guest.
  2. Observe the primary e-mail field and `Отправить код` action.
  3. Direct-load `/auth/reset-password`, `/auth/update-password`, and `/auth/verify-email`.
- expected:
  - only Google, Yandex, WhatsApp, and Telegram authentication entry points are offered;
  - unsupported e-mail/password routes do not expose functional forms.
- actual:
  - e-mail magic-link was presented as the first sign-in option;
  - reset-password, update-password, and verify-email routes were publicly reachable.
- evidence:
  - live browser reproduction on `/auth/sign-in` and `/auth/reset-password` (`2026-07-03`)
- fix:
  - removed the e-mail/OTP form and submission logic from the sign-in page;
  - changed unsupported reset/update/verify-email entry routes to server redirects to `/auth/sign-in`;
  - updated sign-in guidance to describe social authentication only.
- post-fix live verification:
  - local production build (`next build` + `next start`) on `2026-07-03`;
  - `/auth/sign-in` contains no e-mail/password input or e-mail OTP copy and exposes Google, Yandex, WhatsApp, and Telegram states;
  - `/auth/reset-password`, `/auth/update-password`, and `/auth/verify-email` all finish at `/auth/sign-in`;
  - desktop/mobile checks had no horizontal overflow and browser console warnings/errors were empty.
- post-fix evidence:
  - `apps/web/test-results/live-c2-social-only-2026-07-03/c2-social-only-postfix-live.json`
  - `apps/web/test-results/live-c2-social-only-2026-07-03/c2-social-only-final-live.json`
- status: `verified`
- owner: `Codex + User`

### WB-021
- id: `WB-021`
- date: `2026-06-30`
- area: `C2`
- severity: `P1`
- title: Email OTP and password recovery invalid paths expose raw provider errors and weak recovery UI
- build: current local production build (`next start`) with uncommitted A1-A4/B1-B4/C1 fixes
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest, desktop viewport
- preconditions:
  - the web application is running locally at `http://localhost:3000`
  - the browser has no local authenticated Kezek session
- steps:
  1. Open `/auth/reset-password` and click `Отправить ссылку` with an empty value.
  2. Enter `not-an-email` and click `Отправить ссылку`.
  3. Open `/auth/update-password` without a recovery session and click `Сменить пароль`.
  4. Enter a short password and click `Сменить пароль` again.
  5. Open `/auth/verify?mode=email&email=test%40example.com&redirect=%2Fcabinet`, enter `000000`, and submit.
  6. Click `Повторно отправить код`.
- expected:
  - Invalid, expired, unauthenticated, or rate-limited auth states show localized, understandable, non-sensitive recovery guidance.
  - Empty/invalid input is blocked client-side where possible.
  - Invalid credentials never establish or promote a session.
  - Reset/update-password pages clearly explain the action and next recovery step.
- actual:
  - Reset-password has no heading/description, uses `type=text`, is not `required`, and sends empty/invalid values to Supabase.
  - Empty reset shows raw `Password recovery requires an email`.
  - Invalid reset shows raw `Unable to validate email address: invalid format`.
  - Update-password without a recovery session shows raw `Auth session missing!`; repeated clicks duplicate the raw toast.
  - Invalid email OTP shows raw `Token has expired or is invalid`.
  - Resend for an unknown/non-signup email shows raw `Signups not allowed for otp`.
- evidence:
  - live page record: `apps/web/test-results/live-c2-email-password-2026-06-30/c2-initial-pages.json`
  - live interaction record: `apps/web/test-results/live-c2-email-password-2026-06-30/c2-invalid-interactions.json`
- fix:
  - added localized, non-enumerating auth error mapping in `apps/web/src/lib/authUserMessages.ts`;
  - rebuilt reset-password and update-password recovery UI with native validation, explicit session gating, and safe recovery actions;
  - applied the same safe mapping to email OTP verification/resend and sign-in submission paths.
- post-fix live verification (`2026-06-30`, local production build):
  - empty and malformed email values are blocked by native validation;
  - reset requests use non-enumerating success feedback;
  - missing recovery sessions, invalid OTP, resend for an unknown address, and provider-side invalid-email failures show localized safe messages;
  - invalid paths did not establish a session; desktop/mobile console remained clean and no horizontal overflow was observed.
- post-fix evidence:
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-postfix-desktop.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-request-link-code.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-final-live.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-reset-mobile-final.png`
- status: `verified; flow retired by social-only authentication policy on 2026-07-03`
- owner: `Codex + User`

### WB-020
- id: `WB-020`
- date: `2026-06-30`
- area: `C1`
- severity: `P1`
- title: Sign-in return URL handling drops `next` and accepts unsafe external redirects
- build: current local production build (`next start`) and deployed production `https://kezek.kg`
- environment: in-app Chromium, Windows, guest and authenticated Google session, desktop viewport
- preconditions:
  - the web application is running locally at `http://localhost:3000`
  - the browser has no local `localhost` Kezek session for the guest checks
  - the in-app browser has an authenticated production Google session for the existing-session check
- steps:
  1. Open `http://localhost:3000/auth/sign-in?next=%2Fb%2Fmanly%2Fbooking` as a guest.
  2. Inspect the WhatsApp login link and the page state.
  3. Open `http://localhost:3000/auth/sign-in?redirect=https%3A%2F%2Fevil.example%2Fafter-login` as a guest.
  4. Inspect the WhatsApp login link and the return URL propagated into sign-in state.
  5. Open `https://kezek.kg/auth/sign-in?redirect=%2Fb%2Fmanly%2Fbooking` as an authenticated user and wait for the role-policy redirect.
- expected:
  - `next` and `redirect` return URL aliases are handled consistently.
  - Only same-origin relative paths are accepted as post-auth return targets.
  - Unsafe absolute URLs are ignored or replaced with `/`.
  - Existing authenticated sessions redirect to the correct role-policy destination without a loop.
- actual:
  - `?next=/b/manly/booking` is ignored by the guest sign-in page; the WhatsApp link becomes `/auth/whatsapp?redirect=%2F`.
  - `?redirect=https://evil.example/after-login` is accepted and propagated into `/auth/whatsapp?redirect=...`.
  - The authenticated production session eventually redirects to `/select-business`, but the guest return URL handling is inconsistent and unsafe.
- evidence:
  - live browser state: `next` URL produced WhatsApp `redirect=%2F`
  - live browser state: external `redirect=https://evil.example/after-login` was preserved in the WhatsApp login link
  - production authenticated check redirected to `/select-business` with no console errors after waiting
- fix:
  - added shared `sanitizeAuthReturnPath` / `getAuthReturnPath` helpers for auth return URLs
  - made `/auth/sign-in` accept both `redirect` and `next` aliases while normalizing them to a safe relative path
  - sanitized callback, WhatsApp, verify, verify-email, Yandex sessionStorage, and final role-decision fallback return targets
  - blocked absolute, protocol-relative, empty, and backslash-based return URLs by falling back to `/`
- post-fix live verification:
  - rebuilt the production bundle and restarted `next start`
  - `http://localhost:3000/auth/sign-in?next=%2Fb%2Fmanly%2Fbooking` now renders the guest sign-in page with WhatsApp `redirect=%2Fb%2Fmanly%2Fbooking`
  - `http://localhost:3000/auth/sign-in?redirect=https%3A%2F%2Fevil.example%2Fafter-login` now renders the guest sign-in page with WhatsApp `redirect=%2F`
  - direct unsafe `/auth/whatsapp?redirect=https%3A%2F%2Fevil.example%2Fafter-login` renders safely with no visible external target
  - mobile `390x844` sign-in keeps the `next` return path, has no horizontal overflow, and emits no console warnings/errors
  - production authenticated `/auth/sign-in?redirect=%2Fb%2Fmanly%2Fbooking` redirects to `/select-business` with no loop or sign-in form
  - evidence:
    - `apps/web/test-results/live-c1-signin-2026-06-30/c1-postfix-desktop.json`
    - `apps/web/test-results/live-c1-signin-2026-06-30/c1-postfix-mobile.json`
    - `apps/web/test-results/live-c1-signin-2026-06-30/c1-validation-and-prod-session.json`
    - `apps/web/test-results/live-c1-signin-2026-06-30/c1-signin-mobile-postfix.png`
- supporting checks:
  - `corepack pnpm -C apps/web test -- --runTestsByPath src/__tests__/lib/authReturnUrl.test.ts src/__tests__/lib/signInRedirectLogic.test.ts` passed, 2 suites / 11 tests
  - `corepack pnpm -C apps/web typecheck` passed
  - `corepack pnpm -C apps/web build` passed
- status: `verified`
- owner: `Codex + User`

### WB-013
- id: `WB-013`
- date: `2026-06-27`
- area: `B2`
- severity: `P1`
- title: Business and booking pages display 0-100 rating scores as impossible star ratings
- build: deployed production `https://kezek.kg` and local workspace with uncommitted A1-A4/B1 fixes based on commit `3dfe9f5c`
- environment: in-app Chromium and Playwright Chromium, Windows, authenticated Google session and clean mobile viewport
- preconditions:
  - public business `low-fade` exists and has rating scores of `50`
- steps:
  1. Open `https://kezek.kg/b/low-fade` directly.
  2. Inspect the business, branch, and staff rating badges.
  3. Open `https://kezek.kg/b/low-fade/booking`.
  4. Inspect the business and branch rating badges in the booking flow.
- expected:
  - Star-style rating badges show a human-readable 0-5 rating, or clearly label the value as a 0-100 score.
- actual:
  - Business, branch, staff, and booking badges show `50.0` next to a star-style rating icon.
  - The shared `RatingDisplay` component is documented as receiving 0-100 scores but renders `value.toFixed(1)` directly.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.json`
  - booking evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/booking-low-fade.json`
  - mobile evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-playwright/b2-playwright.json`
  - screenshots: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.png`, `apps/web/test-results/live-b2-business-page-2026-06-27/booking-low-fade.png`
- fix:
  - normalized the shared `RatingDisplay` component to render 0-100 rating scores on a 0-5 public star scale
  - kept already-normalized 0-5 values supported and clamped out-of-range values to the display scale
  - added unit coverage for `formatRatingDisplayValue`
- post-fix verification:
  - targeted test: `src/__tests__/components/RatingDisplay.test.ts`
  - `next build` completed successfully
  - local production live post-fix `/b/low-fade`: `ratings=2.5,2.5,2.5,2.5`, `raw50=false`, `hasImpossibleRating=false`, `console=0`, `fail=0`
  - local production live post-fix `/b/low-fade/booking`: `ratings=2.5,2.5`, `raw50=false`, `hasImpossibleRating=false`, `console=0`, `fail=0`
  - evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-postfix/b2-postfix.json`
  - screenshots: `apps/web/test-results/live-b2-business-page-2026-06-27-postfix/valid-low-fade.png`, `apps/web/test-results/live-b2-business-page-2026-06-27-postfix/booking-low-fade.png`
- status: `verified`
- owner: `Codex + User`

### WB-014
- id: `WB-014`
- date: `2026-06-27`
- area: `B2/D1`
- severity: `P1`
- title: Booking page emits a hydration mismatch when server and browser timezones differ
- build: deployed production `https://kezek.kg`
- environment: in-app Chromium, Windows, Google-authenticated session
- preconditions:
  - user is authenticated in production
  - public business `low-fade` is available
- steps:
  1. Open `https://kezek.kg/b/low-fade/booking`.
  2. Inspect the browser console after the initial hydration.
  3. Select the active branch `Low Fade Юго-Восток` and continue to the date step.
- expected:
  - The booking page hydrates and advances without date text mismatches.
- actual:
  - The console records minified React error `#418` during initial hydration.
  - Reproduction with a local production server forced to `TZ=UTC` confirmed that business midnight was formatted as `26.06.2026` on the server and `27.06.2026` in the browser.
  - The page remained usable, but React had to recover from server/client text differences.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/booking-after-branch-select.json`
  - screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27/booking-after-branch-select.png`
  - post-fix live evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-wb014-postfix/wb014-postfix.json`
  - post-fix screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-wb014-postfix/booking-step2-utc-server.png`
- fix:
  - Added timezone-stable conversion between business dates and local calendar dates.
  - Booking day labels now format explicitly in the business timezone.
  - Calendar min/max, selected date, and user selections use stable calendar-day values instead of the runtime timezone.
  - Added regression tests in `src/__tests__/lib/bookingCalendarDate.test.ts`.
- post-fix verification:
  - `next build` passed.
  - Unit tests passed (`5/5` including rating and booking calendar regressions).
  - With the production server forced to `TZ=UTC`, direct load, branch selection, and the date step showed `27.06.2026 (суббота)` consistently.
  - The current-day button was enabled and selected, and no new console warnings or errors appeared.
- status: `verified`
- owner: `Codex + User`

### WB-019
- id: `WB-019`
- date: `2026-06-30`
- area: `B4`
- severity: `P2`
- title: Public map provider failure exposes internal environment configuration details
- build: current local production build with a controlled missing Yandex Maps key
- environment: in-app Chromium, Windows, guest
- preconditions:
  - build and start the web app with the Yandex Maps public key intentionally blank
- steps:
  1. Direct-load `/map`.
  2. Wait for provider initialization to fail.
  3. Inspect the map fallback, branch list, console, and visible error details.
- expected:
  - The user gets a safe provider-unavailable message and can continue through the branch list.
  - Internal variable names, repository paths, and developer setup links are not shown publicly.
- actual:
  - The branch list and all three booking links remain usable.
  - The public fallback displays `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`, `apps/web/.env.local`, and a Yandex developer URL.
- evidence:
  - live record: `apps/web/test-results/live-b4-map-2026-06-30/b4-before-fix.json`
  - screenshot: `apps/web/test-results/live-b4-map-2026-06-30/provider-error-before-fix.png`
- root cause:
  - The provider fallback rendered the raw loader error and had a special case that converted a missing-key error into developer setup instructions.
  - The raw message was also exposed through the paragraph `title` attribute.
- fix:
  - Replaced provider internals with a dedicated public `role="alert"` fallback: `Карта временно недоступна. Выберите филиал из списка.`
  - Kept detailed provider failures only in internal logging.
  - Preserved the independent branch list and booking links while the map canvas is unavailable.
- post-fix live verification:
  - Rebuilt and started the production build with the Yandex Maps key intentionally blank.
  - Direct-loaded `/map` on desktop and `390x844`.
  - Verified the safe fallback, three real branches, and three booking links remain visible and usable.
  - Verified no environment variable name, repository path, developer setup link, horizontal overflow, or stack detail appears.
  - Rebuilt again with the real provider configuration; the final direct load rendered three branch markers and emitted no new console warnings/errors.
  - evidence: `apps/web/test-results/live-b4-map-2026-06-30/b4-live.json`
  - screenshot: `apps/web/test-results/live-b4-map-2026-06-30/provider-error-postfix-mobile.png`
- status: `verified`
- owner: `Codex + User`

### WB-018
- id: `WB-018`
- date: `2026-06-29`
- area: `B3`
- severity: `P1`
- title: Marketplace network failure is shown as a normal empty catalog
- build: current local production build
- environment: in-app Chromium, Windows, controlled unreachable Supabase endpoint on `localhost:3001`
- preconditions:
  - start the production build with a valid-format but unreachable Supabase URL
- steps:
  1. Direct-load `/`.
  2. Wait for the server-rendered marketplace state.
  3. Inspect the result count, empty state, browser console, and visible error messaging.
- expected:
  - A network/data-service failure is explicitly distinguished from a legitimate zero-result catalog.
  - The page remains safe and does not leak connection details or stack traces.
- actual:
  - The business query error is ignored and the page renders `Ничего не найдено` with zero results.
  - The existing safe service-unavailable banner is not shown.
- evidence:
  - live record: `apps/web/test-results/live-b3-search-2026-06-29/b3-before-fix.json`
  - screenshot: `apps/web/test-results/live-b3-search-2026-06-29/network-failure-before-fix.png`
- root cause:
  - Supabase query results were destructured without checking their `error` fields, so transport/query failures were treated as empty arrays.
- fix:
  - Business, branch, and promotion query errors now enter the existing safe failure path.
  - Replaced the ambiguous normal empty state with a dedicated `Каталог временно недоступен` alert for service failures.
- post-fix live verification:
  - Rebuilt and started the production build with a controlled unreachable Supabase endpoint on `localhost:3001`.
  - Direct-loaded `/` on desktop and `390x844`; the dedicated recovery alert rendered, the legitimate empty-catalog message did not, and no stack, host, runtime variable, or secret leaked.
  - No console warnings/errors or horizontal overflow appeared.
  - evidence: `apps/web/test-results/live-b3-search-2026-06-29/b3-postfix.json`
  - screenshot: `apps/web/test-results/live-b3-search-2026-06-29/network-failure-postfix-mobile.png`
- status: `verified`
- owner: `Codex + User`

### WB-017
- id: `WB-017`
- date: `2026-06-29`
- area: `B3`
- severity: `P1`
- title: Marketplace search has no debounced discovery update
- build: current local production build
- environment: in-app Chromium, Windows, real configured Supabase
- preconditions:
  - direct-load `/` with the three approved businesses visible
- steps:
  1. Enter `Man` in the marketplace search input.
  2. Observe the result cards and URL immediately.
  3. Wait `1200 ms` without submitting the form.
- expected:
  - The discovery query updates once after the debounce interval and shows `Manly` without stale cards.
- actual:
  - The input value changes, but the URL and all three result cards remain unchanged after `1200 ms`.
  - Filtering only occurs after clicking `Искать` or submitting the form.
- evidence:
  - live record: `apps/web/test-results/live-b3-search-2026-06-29/b3-before-fix.json`
- root cause:
  - `HomeHeader` used an uncontrolled GET form and had no client-side discovery update or debounce timer.
- fix:
  - Converted the query input to controlled state.
  - Added a `500 ms` debounced `router.replace` that preserves the selected category and resets pagination.
  - Kept explicit form submission as an immediate `router.push` path.
- post-fix live verification:
  - Entering `Man` left the original three cards in place before `300 ms`, then updated the URL to `?q=Man` and rendered only `Manly` after the debounce plus server render.
  - Rapidly entered `L` → `Low` → `Low Fade`; intermediate queries were cancelled and only `Low Fade` remained, with no stale `Manly` card.
  - Category selection preserved the query, clearing the category preserved only the query, and reset restored all three businesses.
  - Empty results persisted across reload; navigation to `Manly` and Back restored `?q=Man`, the input, chip, and single result.
  - Desktop and `390x844` checks showed no console warnings/errors or horizontal overflow.
  - supporting test: `HomeHeader.test.tsx` (`2/2` passed).
  - evidence: `apps/web/test-results/live-b3-search-2026-06-29/b3-postfix.json`
  - screenshot: `apps/web/test-results/live-b3-search-2026-06-29/search-postfix-mobile.png`
- status: `verified`
- owner: `Codex + User`

### WB-016
- id: `WB-016`
- date: `2026-06-27`
- area: `B2`
- severity: `P1`
- title: Public business page omits active services
- build: deployed production `https://kezek.kg` and current local production build before fix
- environment: in-app Chromium, Windows, desktop and mobile viewports
- preconditions:
  - open an approved business that has active bookable services
- steps:
  1. Open `/b/low-fade` directly.
  2. Inspect the business identity, branches, team, promotions, and booking CTA.
  3. Look for the business's active services before entering the booking flow.
- expected:
  - Active services are visible and internally consistent with the booking flow.
  - Inactive services are not presented as bookable.
- actual:
  - The public business page does not query or render services at all.
  - Services only become discoverable later inside the booking flow.
- evidence:
  - live page record: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.json`
  - screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.png`
- root cause:
  - `/b/[slug]/page.tsx` fetched businesses, branches, staff, and promotions but omitted the active `services` query.
  - `BusinessInfo.tsx` consequently had no service data or service section to render.
- fix:
  - Added the active-services REST query with `active=eq.true`.
  - Added a localized public service section with branch, duration, and price/range details.
  - Added the active-service count to the business summary.
- post-fix live verification:
  - Direct-loaded the current production build at `/b/b2-contact-live-20260627` using an isolated REST fixture containing one active and one inactive service.
  - Verified `Безопасная тестовая услуга`, its branch, `45 мин`, and `1 200–1 500 сом` render on mobile.
  - Verified `НЕАКТИВНАЯ тестовая услуга` is absent and the observed request contains `active=eq.true`.
  - Verified three booking CTAs remain present, no horizontal overflow occurs, and the console has no warnings or errors.
  - Re-deleted the safe fixture and verified the same slug still renders `Бизнес не найден` without stack/secret leakage.
  - Rebuilt with the real configured Supabase and directly loaded `/b/low-fade`: three real active services rendered with matching branch, duration, and price ranges; no console warnings/errors or mobile overflow appeared.
  - evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/b2-complete.json`
  - screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/services-postfix-mobile.png`
  - real-Supabase screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/services-postfix-real-supabase-mobile.png`
- status: `verified`
- owner: `Codex + User`

### WB-015
- id: `WB-015`
- date: `2026-06-27`
- area: `A3` (originally detected during B2)
- severity: `P2`
- title: Deployed business page still sends analytics to the old admin API path
- build: deployed production `https://kezek.kg`
- environment: Playwright Chromium, Windows, 390x844 viewport, guest context
- preconditions:
  - open the deployed production business page in a fresh browser context
- steps:
  1. Open `https://kezek.kg/b/low-fade`.
  2. Wait for network idle.
  3. Inspect failed network responses and console errors.
- expected:
  - Frontend analytics request either succeeds or uses the corrected `/admin/api/analytics/track` path from the current source.
- actual:
  - Browser records `POST https://kezek.kg/api/admin/analytics/track` returning `404`.
  - The visible page remains usable, but telemetry is noisy and not persisted.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-playwright/b2-playwright.json`
  - screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-playwright/valid-mobile.png`
- notes:
  - Local source currently sends to `/admin/api/analytics/track`, and `WB-002` verified that fix locally.
  - This finding indicates the deployed production bundle or route behavior is still stale/regressed for the business page surface.
  - A 2026-06-27 release-state probe confirmed the stale path returns `404` and the corrected deployed route exists (the probe reached the route and returned validation status `400` for the intentionally minimal payload).
  - B2 is fully covered on the current local production build; closure of this issue belongs to A3 and requires deployment plus post-deploy live verification.
- status: `open`
- owner: `Codex + User`

### WB-011
- id: `WB-011`
- date: `2026-06-27`
- area: `B1/C5`
- severity: `P1`
- title: WhatsApp sign-in exposes missing server service-role configuration in the public UI
- build: local production build with uncommitted A1-A4/B1 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest, mobile-sized viewport
- preconditions:
  - web application is running from `next build` + `next start`
  - `SUPABASE_SERVICE_ROLE_KEY` is not configured in the runtime environment
- steps:
  1. Open `/auth/sign-in`.
  2. Choose WhatsApp sign-in.
  3. Enter a test phone number.
  4. Submit the form.
- expected:
  - WhatsApp sign-in either starts the OTP flow or fails with a safe, user-friendly service-unavailable message.
  - Public UI does not expose internal runtime variable names or server-side implementation details.
- actual:
  - WhatsApp sign-in shows `SUPABASE_SERVICE_ROLE_KEY is required for server-side operations` in the public error banner.
  - Server log contains `[WhatsAppMobileStart] API error`.
- evidence:
  - screenshot: `apps/web/test-results/live-b1-auth-attempt-2026-06-27/whatsapp-service-role-error.png`
  - server log: `%TEMP%\kezek-b1-auth-2026-06-27\web.stdout.log`
- fix:
  - `POST /api/auth/whatsapp/mobile/start` now detects missing `SUPABASE_SERVICE_ROLE_KEY` before creating the admin Supabase client
  - the route returns `503 service_unavailable` with a safe user-facing message instead of throwing a server configuration error into the public UI
- post-fix verification:
  - targeted test: `src/__tests__/api/auth/whatsapp-mobile-start.test.ts`
  - `next build` completed successfully
  - live post-fix WhatsApp UI shows a safe unavailable message and does not contain `SUPABASE_SERVICE_ROLE_KEY`
  - live console errors: `0`
  - evidence: `apps/web/test-results/live-b1-auth-attempt-2026-06-27-postfix/whatsapp-safe-unavailable.json`
  - screenshot: `apps/web/test-results/live-b1-auth-attempt-2026-06-27-postfix/whatsapp-safe-unavailable.png`
- status: `verified`
- owner: `Codex + User`

### WB-012
- id: `WB-012`
- date: `2026-06-27`
- area: `B1/C3`
- severity: `P1`
- title: Google OAuth callback returns a safe failure screen and does not establish an authenticated session locally
- build: local production build with uncommitted A1-A4/B1 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000` / `http://127.0.0.1:3000`, in-app Chromium, Windows, guest
- preconditions:
  - web application is running from `next build` + `next start`
  - tester starts Google sign-in from the local sign-in page
- steps:
  1. Open `/auth/sign-in`.
  2. Choose Google sign-in.
  3. Complete provider-side authentication.
  4. Return to `/auth/callback?code=...`.
  5. Open `/` and inspect the public header.
- expected:
  - OAuth code exchange succeeds and the local browser receives an authenticated session.
  - `/` renders the authenticated public header variant.
- actual:
  - `/auth/callback?code=...` renders `Не удалось завершить авторизацию`.
  - Returning to `/` still shows the guest header with sign-in links, so B1 authenticated header cannot be verified through Google in this environment.
- evidence:
  - screenshot: `apps/web/test-results/live-b1-auth-attempt-2026-06-27/google-callback-error.png`
  - live browser state after attempt: `/` header still contains guest sign-in links and no dashboard/cabinet links
- notes:
  - Google authentication later succeeded on deployed production `https://kezek.kg` and was used to close the B1 authenticated-header check.
  - This bug remains scoped to the local callback/session exchange environment where `/auth/callback?code=...` did not establish a session.
- status: `open`
- owner: `Codex + User`

### WB-009
- id: `WB-009`
- date: `2026-06-27`
- area: `B1`
- severity: `P1`
- title: Public home cards display normalized rating score as an impossible star rating
- build: local production build with uncommitted A1-A4 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, Chromium/Playwright, Windows, guest, desktop and mobile viewports
- preconditions:
  - web application is running from `next build` + `next start`
  - public marketplace contains approved businesses with `rating_score=50`
- steps:
  1. Open `/` directly in a clean guest browser context.
  2. Inspect visible public marketplace business cards.
  3. Read the rating badge next to the star icon.
- expected:
  - A star-style public rating badge shows a human-readable 0-5 rating, or a clear non-rating score label.
- actual:
  - Cards for `Low Fade`, `Manly`, and `Образ` show `50.0` next to the star icon.
  - The stored `rating_score` is a 0-100 score, so the UI presents an impossible star rating and can mislead users during discovery.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b1-public-home-2026-06-27/b1-live.json`
  - screenshot: `apps/web/test-results/live-b1-public-home-2026-06-27/home-guest.png`
  - runner output: `ratings=Low Fade:50, Manly:50, Образ:50`
- fix:
  - normalized public star-style rating badges to a 0-5 scale while preserving support for already-normalized values
- post-fix verification:
  - `next build` completed successfully
  - targeted tests: `src/__tests__/lib/funnelEventsService.test.ts`, `src/__tests__/lib/funnelEventsHttpService.test.ts`
  - live post-fix runner output: `ratings=Low Fade:2.5, Manly:2.5, Образ:2.5`
  - live browser evidence: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/b1-live.json`
  - screenshot: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/home-guest.png`
- status: `verified`
- owner: `Codex + User`

### WB-010
- id: `WB-010`
- date: `2026-06-27`
- area: `B1`
- severity: `P2`
- title: Public home booking CTA triggers a 500 funnel-events request
- build: local production build with uncommitted A1-A4 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, Chromium/Playwright, Windows, guest
- preconditions:
  - web application is running from `next build` + `next start`
  - public marketplace contains at least one approved business card
- steps:
  1. Open `/` directly in a clean guest browser context.
  2. Click the primary booking CTA on the first business card.
  3. Wait for the booking page to render.
  4. Inspect browser console and failed network requests.
- expected:
  - The booking page opens without failed public analytics/funnel requests.
  - Primary CTA telemetry is saved or degrades safely without browser-visible request failures.
- actual:
  - The booking page opens, but `POST /api/funnel-events` returns `500`.
  - Browser console records a failed fetch resource while testing the public home primary CTA.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b1-public-home-2026-06-27/b1-live.json`
  - screenshot: `apps/web/test-results/live-b1-public-home-2026-06-27/card-book-cta.png`
  - server log: `%TEMP%\kezek-b1-live-2026-06-27\web.stdout.log` contains `[FunnelEventsAPI] API error`
- fix:
  - aligned `saveFunnelEvent` insert payload with the actual `funnel_events` table schema by moving `service_ids` and `services_count` into `metadata`
  - made public funnel tracking safely return success with `{ skipped: true }` when `SUPABASE_SERVICE_ROLE_KEY` is not configured, instead of surfacing a browser-visible 500 for non-critical telemetry
- post-fix verification:
  - `next build` completed successfully
  - targeted tests: `src/__tests__/lib/funnelEventsService.test.ts`, `src/__tests__/lib/funnelEventsHttpService.test.ts`
  - live post-fix `card-book-cta`: status `200`, final URL `/b/low-fade/booking?step=1&day=2026-06-27`, `consoleErrors=0`, `pageErrors=0`
  - live browser evidence: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/b1-live.json`
  - screenshot: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/card-book-cta.png`
- status: `verified`
- owner: `Codex + User`

### WB-001
- id: `WB-001`
- date: `2026-06-23`
- area: `A1`
- severity: `P1`
- title: Hydration mismatch on direct load of `/auth/sign-in`
- build: local dev build, commit `3dfe9f5c`
- environment: Chromium 145, Windows, 1280x720, guest
- preconditions:
  - web application is running locally at `http://localhost:3000`
  - browser has no authenticated Kezek session
- steps:
  1. Open `http://localhost:3000/auth/sign-in` directly in a new browser tab.
  2. Wait for the initial server-rendered page to hydrate.
  3. Inspect the browser console.
- expected:
  - Server-rendered and first client-rendered markup match.
  - The sign-in page hydrates without React replacing the server-rendered tree.
- actual:
  - React reports `Hydration failed because the server rendered HTML didn't match the client`.
  - The mismatch is inside `TelegramLoginWidgetComponent`: the server renders the widget container, while the client renders the localhost Telegram warning.
  - React regenerates the affected tree on the client.
- evidence:
  - console error captured at `2026-06-23T06:12:59.290Z`
  - screenshot: `apps/web/test-results/live-a1-2026-06-23/auth-sign-in.png`
  - final UI remained visible, but the A1 no-hydration-mismatch criterion failed
- fix:
  - resolve the hostname only after mount so the server and initial client render use identical markup
  - do not initialize the Telegram external widget on localhost
- post-fix verification:
  - cold load and direct reload rendered the localhost warning without a hydration error
  - no Telegram widget script was injected on localhost
  - screenshot: `apps/web/test-results/live-a1-postfix-2026-06-23/auth-sign-in-postfix.png`
- status: `verified`
- owner: `Codex + User`

### WB-007
- id: `WB-007`
- date: `2026-06-27`
- area: `A4`
- severity: `P2`
- title: Unknown routes use the default Next.js 404 instead of an understandable Kezek recovery UI
- build: local production build (`next build` + `next start`) with uncommitted A1/A2/A3 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, in-app browser smoke plus Chromium via Playwright, Windows, guest, clean browser context, 1280x720
- preconditions:
  - run `apps/web` from production output via `next start`
  - use a guest browser session
- steps:
  1. Open `http://localhost:3000/__a4_unknown_public__`.
  2. Open unknown scoped routes: `/cabinet/__a4_unknown__`, `/dashboard/__a4_unknown__`, `/staff/__a4_unknown__`, and `/admin/__a4_unknown__`.
  3. Inspect visible text, recovery actions, console, network, and leak indicators.
- expected:
  - Unknown routes show an understandable Kezek-branded not-found state.
  - The page includes explicit recovery actions, such as going home or signing in.
  - No stack traces, local paths, tokens, cookies, or secrets are exposed.
- actual:
  - All tested unknown routes render the default Next.js text `404 / This page could not be found.`
  - There is no explicit visible “home” recovery action; the only home navigation is the header logo link with empty accessible text in the captured DOM.
  - No stack traces, local paths, tokens, cookies, or secrets were observed.
- evidence:
  - screenshots: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/unknown-public.png`, `unknown-cabinet.png`, `unknown-dashboard.png`, `unknown-staff.png`, `unknown-admin.png`
  - browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/a4-live.json`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27\web.stderr.log`
- fix:
  - added a root `app/not-found.tsx` with Kezek-branded copy and explicit `На главную` and `Войти` recovery actions
- post-fix verification:
  - rebuilt `apps/web` with `next build`
  - restarted the production server via `next start`
  - re-opened unknown public, cabinet, dashboard, staff, and admin routes in a clean Chromium context
  - all unknown routes rendered `Страница не найдена`, no default Next.js 404 text, no production error boundary, and no stack/secret leak indicators
  - screenshots: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/unknown-public.png`, `unknown-cabinet.png`, `unknown-dashboard.png`, `unknown-staff.png`, `unknown-admin.png`
  - browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/a4-live.json`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stderr.log`
- status: `verified`
- owner: `Codex + User`

### WB-008
- id: `WB-008`
- date: `2026-06-27`
- area: `A4`
- severity: `P2`
- title: `/map` hides a failed branches request as an empty state and offers no retry action
- build: local production build (`next build` + `next start`) with uncommitted A1/A2/A3 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, Chromium via Playwright, Windows, guest, clean browser context, 1280x720
- preconditions:
  - run `apps/web` from production output via `next start`
  - intercept `GET /api/branches/map` in the browser and return a controlled `500` JSON response
- steps:
  1. Open `http://localhost:3000/map`.
  2. Force `GET /api/branches/map` to return `500`.
  3. Inspect the visible UI, console, network, and available retry/home actions.
- expected:
  - A client request failure is surfaced as an understandable error state.
  - The user gets a retry action or another clear recovery path.
  - The failed request is not silently represented as “no data”.
- actual:
  - The page stays usable and the map renders.
  - The branch list shows only `no data`, which is indistinguishable from a real empty catalog.
  - No retry action is present for the failed branches request.
  - The console logs the controlled `500` resource failure and `[MapPage] Fetch map failed`.
- evidence:
  - screenshot: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/client-map-controlled-failure.png`
  - browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/a4-live.json`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27\web.stderr.log`
- fix:
  - added a dedicated `/map` branches-load failure state instead of replacing failures with the empty-list state
  - added a `Попробовать снова` retry action that re-runs the branches map request
  - kept the existing non-destructive map view usable while the list request is in an error state
- post-fix verification:
  - rebuilt `apps/web` with `next build`
  - restarted the production server via `next start`
  - opened `/map` with a controlled first `GET /api/branches/map` response of `500`
  - verified the page displayed `Не удалось загрузить филиалы. Попробуйте обновить список.` and a `Попробовать снова` button instead of `no data`
  - clicked `Попробовать снова`; the second request was allowed to reach the real API and the page remained usable
  - screenshot: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/client-map-controlled-failure.png`
  - browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/a4-live.json`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stderr.log`
- status: `verified`
- owner: `Codex + User`

### WB-006
- id: `WB-006`
- date: `2026-06-27`
- area: `A3`
- severity: `P2`
- title: Production CSP blocks Yandex Maps logging requests on `/map`
- build: local production build (`next build` + `next start`) with production-like public origin settings and uncommitted A1/A2 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, Chromium via Playwright, Windows, guest, clean browser context, 1280x720
- preconditions:
  - run `apps/web` from production output via `next start`
  - open the browser with a clean profile and no authenticated Kezek session
- steps:
  1. Open `http://localhost:3000/map`.
  2. Wait until the page and map assets settle.
  3. Reload the page directly.
  4. Inspect the browser console and network/resource results.
- expected:
  - Production pages do not emit CSP console errors during normal third-party map initialization.
  - Static assets, chunks, fonts, images, and expected provider resources load without production-only failures.
- actual:
  - `/map` visually renders and all captured static assets return successfully.
  - The browser console reports that `connect-src` blocks Yandex Maps logging calls to `https://log.api-maps.yandex.ru/...`.
  - The blocked request is non-destructive and does not break the visible map, but it is a production CSP integration error.
- evidence:
  - screenshot: `apps/web/test-results/live-a3-prod-smoke-2026-06-27/map.png`
  - browser evidence: `apps/web/test-results/live-a3-prod-smoke-2026-06-27/prod-smoke.json`
  - production server logs: `%TEMP%\kezek-a3-prod-smoke-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a3-prod-smoke-2026-06-27\web.stderr.log`
- fix:
  - added `https://log.api-maps.yandex.ru` to the production CSP `connect-src` allowlist
  - kept the allowlist scoped to the Yandex Maps logging host instead of broadening all Yandex domains
- post-fix verification:
  - rebuilt `apps/web` with `next build`
  - restarted the production server via `next start`
  - re-ran the A3 live smoke in a clean Chromium context
  - `/map` rendered with `consoleErrors=0`, `failingAssets=0`, `failingResponses=0`, `requestFailures=0`, and no page errors
  - screenshot: `apps/web/test-results/live-a3-prod-smoke-2026-06-27-postfix/map.png`
  - browser evidence: `apps/web/test-results/live-a3-prod-smoke-2026-06-27-postfix/prod-smoke.json`
  - production server logs: `%TEMP%\kezek-a3-prod-smoke-2026-06-27-postfix\web.stdout.log`, `%TEMP%\kezek-a3-prod-smoke-2026-06-27-postfix\web.stderr.log`
- status: `verified`
- owner: `Codex + User`

### WB-002
- id: `WB-002`
- date: `2026-06-23`
- area: `A1`
- severity: `P2`
- title: Public entry pages send failing frontend analytics requests
- build: local dev build, commit `3dfe9f5c`
- environment: Chromium 145, Windows, 1280x720, guest
- preconditions:
  - web application is running locally at `http://localhost:3000`
- steps:
  1. Open `/`, `/auth/sign-in`, `/terms`, or `/privacy` directly.
  2. Wait for the page to finish loading.
  3. Inspect the application server request log.
- expected:
  - Frontend metrics and analytics requests either succeed or are disabled cleanly in the local environment.
- actual:
  - `POST /api/metrics/frontend` repeatedly returns `500`.
  - Repeated public navigation eventually rate-limits the same endpoint with `429`.
  - The home-page analytics request `POST /api/admin/analytics/track` returns `404`.
  - Page content remains usable, but telemetry is not recorded successfully and generates noisy failures.
- evidence:
  - server request log in `%TEMP%\kezek-a1-live\web.stdout.log`
  - examples: `POST /api/metrics/frontend 500`, `POST /api/admin/analytics/track 404`
  - screenshots: `apps/web/test-results/live-a1-2026-06-23/`
- fix:
  - corrected the analytics route from `/api/admin/analytics/track` to `/admin/api/analytics/track`
  - disabled analytics and performance-metric delivery on localhost, where service-role persistence is intentionally unavailable
- post-fix verification:
  - repeated direct loads, reloads, and history navigation produced no requests to either failing telemetry URL
  - `%TEMP%\kezek-a1-postfix\web.stdout.log` contains no frontend metrics or analytics failures
- status: `verified`
- owner: `Codex + User`

### WB-003
- id: `WB-003`
- date: `2026-06-23`
- area: `A1`
- severity: `P2`
- title: Legal pages overflow horizontally on a mobile viewport
- build: local dev build, commit `3dfe9f5c`
- environment: Chromium 145, Windows, 390x844 viewport, guest
- preconditions:
  - web application is running locally at `http://localhost:3000`
- steps:
  1. Set the browser viewport to 390x844.
  2. Open `/terms` or `/privacy` directly.
  3. Compare `document.documentElement.scrollWidth` with `clientWidth`.
- expected:
  - Legal content fits the viewport without horizontal page scrolling.
- actual:
  - `/terms`: `scrollWidth=392`, `clientWidth=375`.
  - `/privacy`: `scrollWidth=447`, `clientWidth=375`.
  - `/` and `/auth/sign-in` do not exhibit horizontal overflow at the same viewport.
- evidence:
  - live browser DOM measurements at 390x844
  - the unbroken H1 text expands its scroll width beyond the available content width
  - screenshots: `apps/web/test-results/live-a1-2026-06-23/terms-mobile-390.png` and `privacy-mobile-390.png`
- fix:
  - reduced legal-card padding on mobile
  - added safe wrapping and responsive sizing to long legal headings
  - added minimum-width constraints to the legal content containers
- post-fix verification:
  - `/terms`: `scrollWidth=375`, `clientWidth=375`
  - `/privacy`: `scrollWidth=390`, `clientWidth=390`
  - screenshots: `apps/web/test-results/live-a1-postfix-2026-06-23/terms-mobile-postfix.png` and `privacy-mobile-postfix.png`
- status: `verified`
- owner: `Codex + User`

### WB-004
- id: `WB-004`
- date: `2026-06-23`
- area: `A2`
- severity: `P1`
- title: Invalid auth callback routes can hang on an authorization spinner instead of failing explicitly
- build: local dev build with uncommitted A1 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest, 1280x720
- preconditions:
  - web application is running locally with the normal `.env.local`
  - browser has no authenticated Kezek session
- steps:
  1. Open `http://localhost:3000/auth/callback?code=invalid-a2-code` directly.
  2. Wait 8 seconds.
  3. Open `http://localhost:3000/auth/callback-yandex?code=invalid-a2-code&state=a2` directly.
  4. Wait 8 seconds.
  5. Inspect the browser UI, console, and application request log.
- expected:
  - Invalid, expired, or malformed callback input fails explicitly and safely.
  - The user is returned to a sign-in/retry state or sees a clear non-sensitive error.
  - Server/API failures do not leave the browser on an indefinite authorization state.
- actual:
  - `/auth/callback?code=invalid-a2-code` remains on `Авторизация…` after 8 seconds.
  - `/auth/callback-yandex?code=invalid-a2-code&state=a2` remains on `Авторизация через Яндекс…` after 8 seconds.
  - The Yandex callback page triggers `GET /api/auth/yandex/callback?...` which returns `500`, while the UI still stays on the spinner.
  - No clear recovery action or safe error message is shown in the browser.
- evidence:
  - screenshots: `apps/web/test-results/live-a2-2026-06-23/auth-callback-invalid-long.png`, `apps/web/test-results/live-a2-2026-06-23/yandex-callback-invalid-long.png`
  - browser evidence: `apps/web/test-results/live-a2-2026-06-23/callback-invalid-long.json`
  - request log: `%TEMP%\kezek-a2-live\web.stdout.log`
- fix:
  - invalid Supabase OAuth callback codes now switch the callback page to an explicit authorization failure state instead of continuing to poll or redirect as success
  - the failure state includes a safe recovery link back to sign-in
  - Yandex token/profile exchange failures now return a redirect to `/auth/sign-in?error=yandex_exchange_failed` instead of surfacing as API `500`
- post-fix verification:
  - `/auth/callback?code=invalid-a2-code` rendered `Не удалось завершить авторизацию` with `Вернуться ко входу` and no authorization spinner
  - `/auth/callback-yandex?code=invalid-a2-code&state=a2` redirected to `/auth/sign-in?error=yandex_exchange_failed`
  - `GET /api/auth/yandex/callback?code=invalid-a2-code&redirect=%2F` returned `307` to the sign-in error URL instead of `500`
  - screenshots: `apps/web/test-results/live-a2-postfix-2026-06-23/valid-auth-callback-invalid-final.png`, `apps/web/test-results/live-a2-postfix-2026-06-23/valid-yandex-callback-invalid-final.png`
  - browser evidence: `apps/web/test-results/live-a2-postfix-2026-06-23/valid-final.json`
  - request log: `%TEMP%\kezek-a2-postfix-final-valid\web.stdout.log`
- status: `verified`
- owner: `Codex + User`

### WB-005
- id: `WB-005`
- date: `2026-06-23`
- area: `A2`
- severity: `P1`
- title: Invalid Supabase runtime configuration is not surfaced consistently as an explicit safe failure
- build: local dev build with uncommitted A1 fixes based on commit `3dfe9f5c`
- environment: controlled invalid-env local run at `http://localhost:3000`, in-app Chromium, Windows, guest, 1280x720
- preconditions:
  - start the web app with `NEXT_PUBLIC_SUPABASE_URL` set to a non-URL value
  - use dummy Supabase keys and a non-URL `NEXT_PUBLIC_SITE_ORIGIN`
  - do not modify `.env.local`
- steps:
  1. Open `http://localhost:3000/`.
  2. Inspect the visible UI and browser console.
  3. Open `http://localhost:3000/auth/sign-in`.
  4. Inspect the visible UI and browser console.
- expected:
  - Missing or invalid runtime configuration fails explicitly and safely.
  - Public entry routes show a clear non-sensitive configuration error or the app fails startup before serving a blank shell.
  - Stack traces and local build paths are not part of user-facing production-style failure surfaces.
- actual:
  - `/` renders a blank page body while the browser console contains Server Component and middleware errors for the invalid Supabase URL.
  - `/auth/sign-in` renders the app error boundary with `Что-то пошло не так`, but also includes development stack details and local `.next`/filesystem paths.
  - The failure is explicit in some places but not consistently safe or user-visible across public entry routes.
- evidence:
  - screenshots: `apps/web/test-results/live-a2-2026-06-23/invalid-env-home.png`, `apps/web/test-results/live-a2-2026-06-23/invalid-env-sign-in.png`
  - browser evidence: `apps/web/test-results/live-a2-2026-06-23/invalid-env-browser.json`
  - request log: `%TEMP%\kezek-a2-invalid-env-2\web.stderr.log`
- fix:
  - guarded `AuthStatusServer` and middleware against invalid Supabase runtime configuration
  - made the browser Supabase client use an inert HTTPS placeholder when public config is invalid so public pages can render instead of throwing during module import
  - made the home page fall back to a safe empty/catalog-unavailable state when marketplace data cannot be loaded
  - removed development stack details from the default app error boundary UI
- post-fix verification:
  - controlled invalid-env `/` rendered the public home page with `Сервис временно недоступен`, `Найдите свой сервис`, no blank body, and no visible stack details
  - controlled invalid-env `/auth/sign-in` rendered the sign-in page with `Сервис временно недоступен`, no error boundary, and no visible stack details
  - screenshots: `apps/web/test-results/live-a2-postfix-2026-06-23/invalid-env-home-final.png`, `apps/web/test-results/live-a2-postfix-2026-06-23/invalid-env-sign-in-final.png`
  - browser evidence: `apps/web/test-results/live-a2-postfix-2026-06-23/invalid-env-final.json`
  - request/error log: `%TEMP%\kezek-a2-postfix-invalid-env\web.stderr.log`
- status: `verified`
- owner: `Codex + User`
