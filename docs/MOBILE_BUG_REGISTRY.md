# MOBILE BUG REGISTRY

Last updated: 2026-05-30  
Owner: QA flow (User + Codex)

Use this file to log bugs discovered during mobile test sessions from `docs/MOBILE_TESTING_AREAS_CATALOG.md`.

## Entry format
- `id`: sequential (`MB-001`, `MB-002`, ...)
- `date`: `YYYY-MM-DD`
- `area`: catalog tag (e.g., `A1`, `C2`, `F2`)
- `severity`: `P0` / `P1` / `P2` / `P3`
- `title`: short user-facing summary
- `build`: app run context (e.g., Expo dev, branch)
- `environment`: device/emulator + OS
- `steps`: minimal reproduction
- `expected`: expected behavior
- `actual`: actual behavior
- `evidence`: screenshot/log path
- `status`: `open` / `in_progress` / `fixed` / `verified`
- `owner`: who handles fix

---

## Session entries

### 2026-05-30 - A1 App launch and bootstrapping
- No bugs logged in this session.

### MB-001
- id: `MB-001`
- date: `2026-05-30`
- area: `A2`
- severity: `P1`
- title: Invalid `EXPO_PUBLIC_API_URL` is accepted without validation
- build: Expo dev (`apps/mobile`)
- environment: config/runtime resolver (`src/lib/apiUrl.ts`)
- steps:
  1. Set `EXPO_PUBLIC_API_URL` to malformed value (example: `abc` or `ht!tp://bad`).
  2. Start app and trigger any API/auth flow that uses `getMobileApiUrl()`.
- expected:
  - config validation fails fast with clear error, or resolver falls back safely to known valid URL by policy.
- actual:
  - resolver returns malformed value after trim/normalize with no URL validation.
  - downstream requests fail later at network/auth layer.
- evidence:
  - [apiUrl.ts](/C:/projects/kezek/apps/mobile/src/lib/apiUrl.ts)
  - [apiUrl.test.ts](/C:/projects/kezek/apps/mobile/src/__tests__/lib/apiUrl.test.ts) (no malformed URL case)
- status: `fixed`
- owner: `Codex + User`

Resolution note (2026-05-30):
- Added fail-fast URL validation in [apiUrl.ts](/C:/projects/kezek/apps/mobile/src/lib/apiUrl.ts).
- `resolveMobileApiUrl()` now throws a clear config error when configured URL is not a valid `http(s)` URL.
- Added regression test in [apiUrl.test.ts](/C:/projects/kezek/apps/mobile/src/__tests__/lib/apiUrl.test.ts): malformed `EXPO_PUBLIC_API_URL` now throws.
- Verification:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/lib/apiUrl.test.ts` -> pass (`4/4`).

### MB-002
- id: `MB-002`
- date: `2026-05-30`
- area: `A3`
- severity: `P0`
- title: HTTPS auth callback opens Chrome instead of returning into app
- build: Expo dev (`apps/mobile`), Android emulator
- environment: `Pixel_7_Pro` (`emulator-5554`), Android app package `kg.kezek.app`
- steps:
  1. Trigger URL intent: `https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback`.
  2. Observe resolved activity after launch.
- expected:
  - callback URL should resolve into mobile app auth flow (or deterministically forward back to `kezek://...` with app foregrounded).
- actual:
  - activity resolves to Chrome (`com.android.chrome/...ChromeTabbedActivity`), app does not become foreground target.
- evidence:
  - `adb am start -W` output for CASE3 (Activity=Chrome)
  - `apps/mobile/a3_case3.png`
  - [app.json](/C:/projects/kezek/apps/mobile/app.json)
  - [linking.ts](/C:/projects/kezek/apps/mobile/src/navigation/linking.ts)
- status: `in_progress`
- owner: `Codex + User`

Resolution note (2026-05-30):
- Updated Android intent filters in [app.json](/C:/projects/kezek/apps/mobile/app.json):
  - separated verified HTTPS app-links and custom `kezek://` scheme into different intent filters;
  - kept `autoVerify: true` only for HTTPS hosts (`kezek.kg`, `www.kezek.kg`);
  - kept custom scheme in a dedicated non-verified filter.
- This avoids mixed-scheme verification conflicts that can cause Android to resolve callback URLs to Chrome.
- Validation required after rebuilding/reinstalling Android app (manifest-level change).
- Live retest on 2026-05-30 against currently installed build still resolves HTTPS callback to Chrome.
- Next verification step: rebuild/reinstall Android app and rerun HTTPS callback intent test.
- Current blocker (2026-05-30): local Android rebuild fails in this workspace due Windows native build path issue
  (`expo-modules-core` CMake/Ninja: `manifest 'build.ninja' still dirty after 100 tries`), so manifest fix
  cannot be validated on a newly installed binary yet.
- Additional attempts (2026-05-30):
  - switched Java runtime to Android Studio JBR (OpenJDK 21),
  - rebuilt from short-path junction (`C:\\k`) and with single ABI (`x86_64`) via Gradle.
  - Result: same `expo-modules-core` CMake/Ninja failure (`build.ninja still dirty`).
- Code fix update (2026-05-30, pending retest on deployed web):
  - updated [callback-mobile page](/C:/projects/kezek/apps/web/src/app/auth/callback-mobile/page.tsx) to add
    Android-specific `intent://...#Intent;scheme=kezek;package=kg.kezek.app;end` fallback;
  - kept custom-scheme redirect attempts and added explicit manual CTA button ("Открыть приложение")
    that points to `intent://` on Android (or `kezek://...` otherwise).
  - goal: make callback return deterministic from Chrome when HTTPS callback page is opened first.
- Retest after web deploy (2026-05-31):
  - command: `adb -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d "https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback"`
  - observed activity: `com.android.chrome/org.chromium.chrome.browser.ChromeTabbedActivity`
  - delayed `dumpsys` check (~3s) still shows Chrome as `topResumedActivity`.
  - result: issue persists, status remains `in_progress`.
- Additional fix (2026-05-31, pending deploy + retest):
  - added Android-specific server-side redirect in [web middleware](/C:/projects/kezek/apps/web/src/middleware.ts):
    - intercept `/auth/callback-mobile` requests for Android user-agent;
    - transform `redirect=kezek://...` into `intent://...#Intent;scheme=kezek;package=kg.kezek.app;end`;
    - passthrough auth params (`exchange_code`, `code`, `access_token`, `refresh_token`, `type`) into deep link query.
  - goal: avoid dependency on client-side JS redirect inside Chrome and force deterministic app handoff at HTTP layer.

### MB-003
- id: `MB-003`
- date: `2026-05-30`
- area: `B4`
- severity: `P1`
- title: `navigation/linking.ts` is out of sync with active route graph
- build: mobile app navigation config
- environment: source-level audit (`apps/mobile/src/navigation/*`, screen navigation calls)
- steps:
  1. Review `linking.ts` screen map and compare with route usage (`navigate(...)`) and route types.
  2. Check nested Cabinet routes and auth callback path expectations.
- expected:
  - `linking.ts` should explicitly cover active deep-linkable route structure (including nested subroutes used in app navigation), and comments should match actual mapping behavior.
- actual:
  - `Profile` route is used from Cabinet flow but not mapped in linking subtree.
  - `auth/callback-mobile` is referenced in comments/flow expectations but not represented as explicit linking route mapping.
- evidence:
  - [linking.ts](/C:/projects/kezek/apps/mobile/src/navigation/linking.ts)
  - [types.ts](/C:/projects/kezek/apps/mobile/src/navigation/types.ts)
  - [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx)
- status: `fixed`
- owner: `Codex + User`

Resolution note (2026-05-30):
- Synced route mapping in [linking.ts](/C:/projects/kezek/apps/mobile/src/navigation/linking.ts):
  - added nested `Main -> Cabinet -> CabinetMain/Profile` mapping:
    - `cabinet`
    - `cabinet/profile`
- Replaced misleading callback comment with explicit note that `/auth/callback-mobile`
  is processed by `useRootNavigationSession.handleDeepLinkAuth` side-effect logic, not screen mapping.
- Added regression test:
  - [linking.test.ts](/C:/projects/kezek/apps/mobile/src/__tests__/navigation/linking.test.ts)
- Verification:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/navigation/linking.test.ts` -> pass (`1/1`).

### MB-004
- id: `MB-004`
- date: `2026-05-30`
- area: `C1`
- severity: `P0`
- title: Expo Go shows runtime error screen instead of Sign-in UI (blocks visual QA)
- build: Expo dev (`apps/mobile`, Metro on `8099`)
- environment: Android Emulator `Pixel_7_Pro` (`emulator-5554`)
- steps:
  1. Start Metro (`corepack pnpm -C apps/mobile start -- --port 8099`).
  2. Open `exp://10.0.2.2:8099/--/` in Expo Go.
  3. Attempt visual QA at ~360dp and ~412dp width profiles.
- expected:
  - Sign-in screen renders so readability, spacing, and CTA hierarchy can be validated.
- actual:
  - Expo Go opens `Something went wrong` error surface (`host.exp.exponent` error pager) instead of app Sign-in UI.
- evidence:
  - `apps/mobile/c1_auth_360dp.png`
  - `apps/mobile/c1_auth_412dp.png`
  - `apps/mobile/c1_360.xml`
  - `apps/mobile/c1_412.xml`
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-05-30):
- Root cause was unstable Expo dev runtime session (port conflicts / skipped dev server), not app UI regression.
- After port cleanup and clean Metro start on `8081`, Sign-in screen rendered normally and C1 manual visual checks passed on ~360dp and ~412dp.
