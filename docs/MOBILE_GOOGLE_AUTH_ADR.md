# ADR: Mobile Google Auth Without Web Callback

Date: 2026-04-25  
Status: accepted  
Scope: `apps/mobile`

## 1. Problem

Current mobile Google sign-in depends on a web callback:

- `redirectTo = https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback`
- Session restore in app relies on domain callback + deep link handoff.

This creates operational coupling to web infrastructure (domain, callback route, web deploy health), while the use case is mobile authentication.

## 2. Decision

Choose **Supabase native mobile OAuth flow without mandatory web callback**.

Target flow:

1. App calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true, redirectTo: <native redirect> } })`.
2. App opens `data.url` with `WebBrowser.openAuthSessionAsync(...)`.
3. OAuth callback returns directly into app deep link.
4. App finalizes session from callback payload (`code` via `exchangeCodeForSession` or direct token payload).

## 3. Final Redirect URI

Primary redirect URI for mobile flow:

- `kezek://auth/callback`

This URI is backed by Expo app scheme in `apps/mobile/app.json`:

- `"scheme": "kezek"`

## 4. Platform Scope

Supported target:

- Android native builds (dev/prod)
- iOS native builds (dev/prod)

Development caveat:

- **Expo Go is out of primary support scope** for this flow because custom app scheme deep links are not consistently representative of standalone/dev-client behavior.
- For Expo Go testing, temporary fallback behavior may still be used, but it is not the production contract.

## 5. Why This Option

Pros:

- Removes hard dependency on web callback endpoint for mobile Google login.
- Fewer moving parts in auth path (mobile -> Google -> mobile).
- Lower failure surface tied to web deploy/domain routing.

Trade-offs:

- Requires strict OAuth redirect configuration discipline in Google/Supabase for mobile credentials.
- Requires explicit testing on native builds (not only Expo Go).

## 6. Rejected Option

`expo-auth-session` + custom manual exchange layer as primary integration was not selected for MVP because:

- Existing codebase already uses Supabase auth primitives and callback processing.
- Supabase-native path minimizes integration surface and migration risk for the first rollout.

`expo-auth-session` may still be introduced later if additional provider-specific behavior is needed.

## 7. Consequences

Implementation work (next epics) must:

- update mobile sign-in to native redirect as the default path;
- keep callback/session handling idempotent;
- add feature flag and rollback path;
- validate behavior on Android/iOS native builds before production rollout.
