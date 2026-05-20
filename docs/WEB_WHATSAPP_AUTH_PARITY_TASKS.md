# Web WhatsApp Auth Parity Tasks

## Goal
- Bring WhatsApp login in web to the same secure flow used in mobile.
- Remove legacy session creation path from web auth UX.
- Keep rollout-safe behavior and clear user feedback.

## Current Gaps
- Web screen still uses legacy endpoints:
  - `/api/auth/whatsapp/send-otp`
  - `/api/auth/whatsapp/verify-otp`
  - `/api/auth/whatsapp/create-session`
- New flow endpoints exist but are not used by web UI:
  - `POST /api/auth/whatsapp/mobile/start`
  - `POST /api/auth/whatsapp/mobile/verify`
  - `GET /api/auth/mobile-exchange?code=...`
- User-facing mojibake/encoding issues exist on web WhatsApp auth page.
- No dedicated web smoke path for the new flow.

## Epic 1. Web Flow Migration
- [x] Switch web WhatsApp page to `mobile/start`.
- [x] Switch verification to `mobile/verify`.
- [x] Exchange `exchangeCode` via `mobile-exchange` and set Supabase session in browser.
- [x] Remove reliance on `create-session` in web page flow.

## Epic 2. UX and Error Handling
- [x] Fix corrupted RU text on `auth/whatsapp` page.
- [x] Add specific message for `503 service_unavailable` (feature flag/rollout).
- [x] Keep resend cooldown and OTP step behavior.
- [ ] Add i18n keys for all new RU strings (currently inline fallbacks on page).

## Epic 3. Safety and Consistency
- [x] Reuse one-time `exchangeCode` session flow.
- [x] Keep client flow compatible with backend idempotency and anti-abuse controls.
- [x] Hide/disable WhatsApp entry in sign-in page when feature is off (optional follow-up).

## Epic 4. Tests
- [x] Add web page-level tests for new `/mobile/start -> /mobile/verify -> exchange` flow.
- [x] Add regression test for `503 service_unavailable` UX state.
- [x] Add smoke checklist for web manual validation.

## Manual Smoke (web)
- [ ] Open `/auth/whatsapp`, request code, verify code, confirm redirect with active session.
  - Expected: after verify, user is redirected to `redirect` target and appears authenticated.
- [ ] Retry wrong code then valid code.
  - Expected: wrong code shows inline error; valid code in next attempt succeeds.
- [ ] Validate resend cooldown.
  - Expected: resend disabled for ~60s; counter decrements every second; resend re-enabled at 0.
- [ ] Validate `503` state copy when rollout blocks request.
  - Setup: set `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT=0` (or blocked key path).
  - Expected: `Вход через WhatsApp временно недоступен для вашего профиля. Попробуйте позже.`

## Exit Criteria
- [ ] Web WhatsApp login uses only new mobile-style start/verify/exchange flow.
- [ ] No mojibake in user-visible strings on WhatsApp web auth screen.
- [ ] Legacy `create-session` is not used by web auth page.
- [ ] Basic web smoke passes.

## Change Log
- 2026-05-20: Initial parity plan created.
- 2026-05-20: Epic 1 core migration started and implemented on web page.
