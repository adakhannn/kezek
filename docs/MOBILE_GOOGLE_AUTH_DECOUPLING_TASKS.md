# Mobile Google Auth Decoupling Tasks

Goal: remove dependency of mobile Google sign-in on web callback (`https://kezek.kg/auth/callback-mobile`) and use native mobile flow with stable app return.

## Context (Current State)

- Mobile app uses `supabase.auth.signInWithOAuth(...)`.
- Historically `redirectTo` pointed to web callback.
- Session is restored in app after deep-link return.
- This works, but mobile auth should not depend on web infra health.

## Epic 1. Target Flow Decision

- [x] Select target OAuth approach for mobile.
- [x] Define final mobile redirect URI.
- [x] Confirm platform scope (Android/iOS, Expo Go vs native builds).
- [x] Record ADR and trade-offs.

Result:

- [x] Decision: Supabase native mobile OAuth flow is primary.
- [x] Redirect URI: `kezek://auth/callback`.
- [x] Scope: Android/iOS native builds (dev/prod); Expo Go is not primary runtime.
- [x] ADR: [MOBILE_GOOGLE_AUTH_ADR.md](/C:/projects/kezek/docs/MOBILE_GOOGLE_AUTH_ADR.md)

## Epic 2. Google + Supabase Configuration

- [x] Create/verify dedicated OAuth clients for Android/iOS.
- [x] Configure redirect URIs in Google Cloud Console.
- [x] Configure provider + redirects in Supabase Auth.
- [x] Verify mobile env consistency:
  - [x] `EXPO_PUBLIC_SUPABASE_URL`
  - [x] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - [x] `EXPO_PUBLIC_API_URL`
- [x] Document URI / Bundle ID / Package Name / SHA-1.

Result:

- [x] Config runbook: [MOBILE_GOOGLE_AUTH_EPIC2_CONFIG.md](/C:/projects/kezek/docs/MOBILE_GOOGLE_AUTH_EPIC2_CONFIG.md)
- [x] Canonical values fixed in docs and project.
- [x] Manual dashboard setup completed.

## Epic 3. Mobile Implementation

- [x] Update `handleGoogleSignIn()` in [SignInScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/auth/SignInScreen.tsx):
  - [x] native redirect as primary
  - [x] correct handling for `success/cancel/dismiss/error`
- [x] Simplify session recovery after OAuth.
- [x] Add stable background/foreground recovery.
- [x] Add user-friendly error messages.

Status:

- [x] Implemented in code.
- [x] Smoke unit-level checks passed for SignInScreen.
- [x] Final Android/iOS native build manual e2e confirmed.

## Epic 4. Security & Reliability

- [x] Validate OAuth `state` protection.
- [x] Ensure sensitive data is not logged.
- [x] Verify secure session storage behavior.
- [x] Add idempotent callback/session handling.

Status:

- [x] `state` validation added.
- [x] Callback URL/token logging removed from auth flow logs.
- [x] SecureStore chunked storage confirmed in `supabase.ts`.
- [x] Callback idempotency and in-flight guards added.

## Epic 5. Observability

- [x] Add metrics:
  - [x] `mobile_google_login_started`
  - [x] `mobile_google_login_callback_received`
  - [x] `mobile_google_login_success`
  - [x] `mobile_google_login_failed`
  - [x] `mobile_google_login_cancelled`
- [x] Add structured flow logs (without sensitive data).
- [x] Add alerts for failed growth and success-rate drop.

## Epic 6. Testing

- [x] Unit tests for helper functions (`redirect/session recovery`).
- [x] Integration tests for mobile auth flow:
  - [x] happy-path
  - [x] cancel
  - [x] network retry
  - [x] repeated callback
- [ ] Manual smoke on real devices:
  - [x] Android (production build)
  - [x] iOS (production build if enabled)
- [x] Cold-start deep-link scenario covered.

## Epic 7. Rollout & Rollback

- [x] Add feature flag `mobile_google_native_auth`.
- [ ] Staged rollout:
  - [ ] internal
  - [ ] staging
  - [ ] percentage production
  - [ ] 100%
- [x] Rollback plan to previous web callback flow.
- [x] On-call support runbook: [MOBILE_GOOGLE_AUTH_ROLLOUT_RUNBOOK.md](/C:/projects/kezek/docs/MOBILE_GOOGLE_AUTH_ROLLOUT_RUNBOOK.md)

## Priorities

### P0 (required before full launch)

- [x] Epics 1-4 complete and validated in production-like conditions.
- [x] Core tests: happy-path + cancel + callback recovery.
- [x] Feature flag + rollback readiness.

### P1 (post-launch)

- [ ] Extended observability and alert tuning.
- [ ] Additional race-condition coverage.
- [ ] UX polish for error/help messages.

## Definition of Done

- [x] Mobile Google sign-in works without mandatory web callback.
- [x] Session creation/restoration is stable after OAuth return.
- [x] No token/sensitive data leakage in logs.
- [x] Key negative paths are covered by tests.
- [x] Feature flag, rollout plan, and rollback path are ready.
