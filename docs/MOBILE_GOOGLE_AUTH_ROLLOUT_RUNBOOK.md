# Mobile Google Auth Rollout Runbook

Scope: `apps/mobile` Google OAuth flow  
Feature flag: `EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH`

## 1. Feature Flag Behavior

- `true` (default): mobile Google login uses native redirect `kezek://auth/callback`.
- `false`: mobile Google login uses web callback redirect `https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback`.

## 2. Fast Rollback Procedure

1. Set environment variable:
   - `EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH=false`
2. Trigger mobile build/deploy with updated env.
3. Verify Google sign-in works through web callback fallback.
4. Monitor:
   - `mobile_google_login_failed`
   - `mobile_google_login_success`
5. If stable, keep fallback until root cause is fixed.

## 3. Staged Rollout Plan

1. Internal:
   - Enable flag only in internal build.
   - Validate happy-path, cancel, retry, background/foreground.
2. Staging:
   - Enable in staging environment.
   - Run smoke checks on Android/iOS test devices.
3. Percentage production:
   - Release native-flow build to a limited audience cohort.
   - Watch success rate and failed growth for at least 24 hours.
4. 100% production:
   - Keep alerts active.
   - Keep rollback instructions ready.

## 4. On-call Checklist

When alert triggers for failed growth or success-rate drop:

1. Confirm alert window in health-check payload (`googleMobileAuth` section).
2. Check recent app version and whether feature flag changed.
3. Validate OAuth redirect configuration in Google/Supabase.
4. If impact is high:
   - rollback with `EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH=false`
   - publish fallback build
5. Open incident ticket with:
   - start time
   - affected platform(s)
   - metrics before/after rollback

## 5. Verification Commands (Local CI equivalent)

- `npm --prefix apps/mobile test -- --runInBand src/__tests__/screens/auth/SignInScreen.test.tsx`
- `npm --prefix apps/mobile test -- --runInBand src/__tests__/navigation/useRootNavigationSession.test.ts`
- `npm --prefix apps/web test -- --runInBand src/__tests__/lib/healthCheckAlertsCronService.test.ts`

