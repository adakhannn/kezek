# Mobile Google Auth Epic 2 Configuration

Date: 2026-04-25  
Scope: Google Cloud Console + Supabase Auth + `apps/mobile` env consistency

## 1. Canonical Values From Project

Source: `apps/mobile/app.json`

- App scheme: `kezek`
- Native callback redirect: `kezek://auth/callback`
- Android package: `kg.kezek.app`
- iOS bundle identifier: `kg.kezek.app`
- Domain used in app links / web fallback: `https://kezek.kg`

Current mobile Google auth implementation still references:

- `https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback`

Target for decoupling:

- primary redirect should be `kezek://auth/callback`

## 2. Google Cloud Console Setup (Manual)

Create/verify separate OAuth credentials:

1. Android OAuth client
- Package name: `kg.kezek.app`
- SHA-1: use values from section 4.

2. iOS OAuth client
- Bundle ID: `kg.kezek.app`

3. Web client (if still needed for legacy fallback only)
- Authorized redirect URI includes Supabase callback endpoint for your project.

Important:
- Do not reuse random old clients across environments.
- Keep explicit mapping: `dev/staging/prod` if you separate projects.

## 3. Supabase Auth Setup (Manual)

In Supabase Dashboard -> Authentication -> Providers -> Google:

1. Enable Google provider.
2. Set Google client ID/secret from the intended environment.
3. Confirm allowed redirect behavior for mobile deep link flow:
- `kezek://auth/callback` must be accepted in the mobile OAuth cycle.
4. Keep legacy web callback only as fallback during rollout:
- `https://kezek.kg/auth/callback-mobile` (temporary, optional).

## 4. SHA-1 Values (How To Obtain)

### Android debug SHA-1 (local)

Windows (PowerShell):

```powershell
keytool -list -v -alias androiddebugkey -keystore "$env:USERPROFILE\.android\debug.keystore" -storepass android -keypass android
```

### Android release SHA-1

Use one of:

1. Google Play Console -> App Integrity -> App signing certificate.
2. Keystore used by EAS/CI release signing (if self-managed).

You usually need **both** debug and release SHA-1 configured in Google clients for full coverage.

## 5. Mobile Env Consistency (Checked)

Expected variables in `apps/mobile/.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=https://kezek.kg
EXPO_PUBLIC_MOBILE_GOOGLE_NATIVE_AUTH=true
```

Verified in code:

- `apps/mobile/src/lib/supabase.ts` uses:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - fallback to `Constants.expoConfig.extra`
- `apps/mobile/src/navigation/useRootNavigationSession.ts` uses:
  - `EXPO_PUBLIC_API_URL`
  - fallback to `Constants.expoConfig.extra.apiUrl`

Recommendation:

- Keep `EXPO_PUBLIC_*` as primary source for all environments.
- Treat `app.json` `extra.*` values as fallback only during migration.

## 6. Verification Checklist

- [x] Android OAuth client exists and uses package `kg.kezek.app` + correct SHA-1.
- [x] iOS OAuth client exists and uses bundle `kg.kezek.app`.
- [x] Supabase Google provider configured with matching credentials.
- [x] Mobile env has all three required `EXPO_PUBLIC_*` vars.
- [ ] OAuth callback returns to `kezek://auth/callback` in native build.
