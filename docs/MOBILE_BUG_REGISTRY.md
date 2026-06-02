# MOBILE BUG REGISTRY

Last updated: 2026-06-01  
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
- status: `verified`
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
- status: `verified`
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
  - kept custom-scheme redirect attempts and added explicit manual CTA button ("РћС‚РєСЂС‹С‚СЊ РїСЂРёР»РѕР¶РµРЅРёРµ")
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
- Final verification (2026-05-31):
  - production response check (`Android UA`):
    - `https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback` returns `302`
      with `Location: intent://auth/callback#Intent;scheme=kezek;package=kg.kezek.app;end`.
  - emulator link-association state:
    - `cmd package get-app-links --user 0 kg.kezek.app` initially showed `Selection state -> Disabled: kezek.kg`.
    - after enabling (`cmd package set-app-links-user-selection --user 0 --package kg.kezek.app true kezek.kg`)
      state became `Enabled: kezek.kg`.
  - retest command:
    - `adb -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d "https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback"`
  - observed result:
    - `Activity: kg.kezek.app/expo.modules.devlauncher.launcher.DevLauncherActivity`
    - `topResumedActivity` / `ResumedActivity` = `kg.kezek.app/...`
  - result: PASS, MB-002 verified.

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
- status: `verified`
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

### MB-005
- id: `MB-005`
- date: `2026-06-01`
- area: `B2`
- severity: `P1`
- title: Android hardware Back on root `Home` exits to launcher during authenticated tab flow
- build: Android debug (`kg.kezek.app`), live emulator session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Sign in and open authenticated app (`MainNavigator`).
  2. On `Р“Р»Р°РІРЅР°СЏ`, enter text into search (`home-search-input`) and switch tabs (`РљР°Р±РёРЅРµС‚` -> `Р“Р»Р°РІРЅР°СЏ`).
  3. Press hardware Back once from root `Р“Р»Р°РІРЅР°СЏ`.
- expected:
  - Either stay in-app with deterministic back path (as product policy), or explicitly confirmed Android-default app-exit behavior.
- actual:
  - App exits to launcher (`com.google.android.apps.nexuslauncher`) on first Back press from root `Р“Р»Р°РІРЅР°СЏ`.
- evidence:
  - [b2_home_back.xml](/C:/projects/kezek/apps/mobile/b2_home_back.xml)
  - [b2_after_back.xml](/C:/projects/kezek/apps/mobile/b2_after_back.xml)
- status: `fixed`
- owner: `Codex + User`

Live test note (2026-06-01):
- B2 live checks confirmed:
  - tab switching works;
  - state preservation works (`home-search-input` retained `b2state`);
  - only root hardware-Back policy remains open via `MB-005`.

Resolution note (2026-06-01):
- Updated [MainNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/MainNavigator.tsx):
  - set `Tab.Navigator backBehavior="history"` to keep Android back navigation inside tab history before app exit.
- Added regression test in [MainNavigator.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/navigation/MainNavigator.test.tsx)
  to assert `backBehavior: 'history'`.
- Verification:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/navigation/MainNavigator.test.tsx` -> pass (`2/2`).
- Live verify (2026-06-01, emulator-5554):
  - switched to `РљР°Р±РёРЅРµС‚`, then pressed hardware Back once -> returned to `Р“Р»Р°РІРЅР°СЏ` inside `kg.kezek.app`.
  - second hardware Back -> exited to launcher (`com.google.android.apps.nexuslauncher`), expected for root after history consumed.
  - evidence:
    - [mb005_cabinet.xml](/C:/projects/kezek/apps/mobile/mb005_cabinet.xml)
    - [mb005_after_back1.xml](/C:/projects/kezek/apps/mobile/mb005_after_back1.xml)
    - [mb005_after_back2.xml](/C:/projects/kezek/apps/mobile/mb005_after_back2.xml)

### MB-006
- id: `MB-006`
- date: `2026-06-01`
- area: `C2`
- severity: `P1`
- title: First Google sign-in attempt is intercepted by Chrome first-run onboarding in emulator
- build: Android debug (`kg.kezek.app`), live `C2` session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), fresh app state (`pm clear`)
- steps:
  1. Open sign-in screen.
  2. Tap `РџСЂРѕРґРѕР»Р¶РёС‚СЊ СЃ Google`.
  3. Observe first external auth surface.
- expected:
  - direct transition to Google OAuth consent/login (`accounts.google.com`) and predictable callback return path.
- actual:
  - first attempt opens Chrome FRE (`Welcome to Chrome`) with `Add account to device` / `Use without an account`.
  - only after dismissing FRE flow reaches `accounts.google.com`.
- evidence:
  - [c2_google_open1.xml](/C:/projects/kezek/apps/mobile/c2_google_open1.xml)
  - [c2_google_open2.xml](/C:/projects/kezek/apps/mobile/c2_google_open2.xml)
  - [c2_after_chrome_dismiss.xml](/C:/projects/kezek/apps/mobile/c2_after_chrome_dismiss.xml)
  - [c2_google_accounts_loaded.xml](/C:/projects/kezek/apps/mobile/c2_google_accounts_loaded.xml)
- status: `open`
- owner: `Codex + User`

Live note (2026-06-01):
- C2 cancel path: passed (`c2_google_cancel.xml` returned to sign-in with Google CTA visible).
- C2 retry/idempotency: passed (repeated tap reopens auth flow).
- C2 happy-path/session establishment not finalized in unattended run due real Google credential requirement on `accounts.google.com` form.
- Final live completion (2026-06-01):
  - user completed real Google auth manually;
  - app returned to authenticated `Main` (`Р“Р»Р°РІРЅР°СЏ`, `home-search-input` visible) in [c2_return_app.xml](/C:/projects/kezek/apps/mobile/c2_return_app.xml).

### MB-007
- id: `MB-007`
- date: `2026-06-01`
- area: `C3`
- severity: `P1`
- title: Telegram sign-in live verification is degraded on emulator (browser handoff only, no native Telegram return path)
- build: Android debug (`kg.kezek.app`), live `C3` session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Open sign-in screen and tap `Войти через Telegram`.
  2. Observe external auth handoff target.
  3. Return to app and inspect pending/cancel/retry states.
- expected:
  - external handoff should open Telegram app (or equivalent deterministic native path),
  - app should return from native Telegram confirmation path for full end-to-end verification.
- actual:
  - handoff opens Chrome Telegram landing (`t.me/kezek_auth_bot?start=...`) in current emulator setup.
  - pending/cancel/retry states in app work, but native Telegram-app return path is not verifiable in this environment.
- evidence:
  - [c3_signin_ready.xml](/C:/projects/kezek/apps/mobile/c3_signin_ready.xml)
  - [c3_external_handoff.xml](/C:/projects/kezek/apps/mobile/c3_external_handoff.xml)
  - [c3_after_return.xml](/C:/projects/kezek/apps/mobile/c3_after_return.xml)
  - [c3_back_in_app.xml](/C:/projects/kezek/apps/mobile/c3_back_in_app.xml)
  - [c3_after_cancel.xml](/C:/projects/kezek/apps/mobile/c3_after_cancel.xml)
  - [c3_retry_handoff.xml](/C:/projects/kezek/apps/mobile/c3_retry_handoff.xml)
- status: `open`
- owner: `Codex + User`

Live note (2026-06-01):
- C3 checks completed in this emulator:
  - start/handoff: pass (external URL created and opened),
  - pending block: pass,
  - cancel: pass,
  - retry/idempotent restart: pass.
- Remaining:
  - native Telegram app return-path verification,
  - explicit timeout-expired UI state confirmation.

MB-007 update (2026-06-01, live rerun):
- timeout-expired state: PASS (`Срок подтверждения истек` observed after extended wait in pending state).
- remaining open item: native Telegram app return-path verification (requires environment with installed Telegram app).
- additional evidence:
  - [c3_tg_external_now.xml](/C:/projects/kezek/apps/mobile/c3_tg_external_now.xml)
  - [c3_tg_pending_now.xml](/C:/projects/kezek/apps/mobile/c3_tg_pending_now.xml)
  - [c3_tg_after_75s.xml](/C:/projects/kezek/apps/mobile/c3_tg_after_75s.xml)
  - [c3_tg_after_255s.xml](/C:/projects/kezek/apps/mobile/c3_tg_after_255s.xml)

MB-007 update (2026-06-01, Telegram installed):
- external handoff target changed from Chrome to Telegram app activity.
- observed focus: `org.telegram.messenger.web/org.telegram.ui.LaunchActivity`.
- evidence:
  - [c3_after_tg_with_app2.xml](/C:/projects/kezek/apps/mobile/c3_after_tg_with_app2.xml)

MB-007 update (2026-06-01, callback simulation):
- verified technical return path into app via deep link callback from pending state:
  - `kezek://auth/callback?exchange_code=manual-test-123&type=telegram`
- app is foregrounded and callback is handled by session logic.
- with invalid/manual test code, pending state is not completed (expected), log toast/debug text observed:
  - `[RootNavigatorSession] Failed to process auth callback URL {}`
- evidence:
  - [c3_pending_before_callback.xml](/C:/projects/kezek/apps/mobile/c3_pending_before_callback.xml)
  - [c3_after_callback_from_pending.xml](/C:/projects/kezek/apps/mobile/c3_after_callback_from_pending.xml)

### 2026-06-01 - C4 WhatsApp sign-in entry flow
- No bugs logged in this session.
- Verification completed via targeted suites:
  - `src/__tests__/auth/authFeatureFlags.test.ts`
  - `src/__tests__/auth/useWhatsAppSignInFlow.test.tsx`
  - `src/__tests__/screens/auth/WhatsAppScreen.test.tsx`
  - `src/__tests__/screens/auth/SignInScreen.test.tsx` (integration smoke coverage)
C4 live completion note (2026-06-01):
- Manual live step completed on emulator WhatsApp screen.
- Observed OTP stage after send: success toast/code-sent state and resend cooldown timer.
- evidence:
  - [c4_live_otp_step.png](/C:/projects/kezek/apps/mobile/c4_live_otp_step.png)

### 2026-06-01 - C5 Session restoration
- No bugs logged in this session.
- Live checks:
  - resume/cold relaunch behavior captured in dev-build environment.
- Automated verification:
  - `src/__tests__/navigation/useRootNavigationSession.test.ts` (PASS)
  - `src/__tests__/screens/auth/SignInScreen.test.tsx` (PASS)

### MB-008
- id: `MB-008`
- date: `2026-06-01`
- area: `C6`
- severity: `P1`
- title: Sign-out action is hard to discover from primary authenticated flow
- build: Android dev build (`kg.kezek.app`)
- environment: mobile app UX/navigation path (`Cabinet -> Profile`)
- steps:
  1. Open authenticated app on main tabs.
  2. Try to find account logout from obvious top-level actions.
- expected:
  - `Выйти` action should be clearly discoverable in primary account surfaces (Cabinet/header/menu) without deep hunt.
- actual:
  - logout exists only on `Profile` screen; users may not find it quickly and report missing logout.
- evidence:
  - [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx)
  - [ProfileScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/profile/ProfileScreenSections.tsx)
  - test pass: `ProfileScreen.test.tsx`, `CabinetScreen.test.tsx`
- status: `open`
- owner: `Codex + User`

Note:
- Functional sign-out implementation exists (`supabase.auth.signOut` in profile data hook).
- Issue is primarily discoverability/IA, not auth invalidation logic.

MB-008 update (2026-06-01):
- status: fixed.
- implemented quick logout action in Cabinet footer (`Выйти из аккаунта`) so users can sign out without opening Profile.
- files:
  - [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx)
  - [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx)
  - [cabinetScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/cabinetScreenStyles.ts)
- verification:
  - `src/__tests__/screens/CabinetScreen.test.tsx` PASS (`shows quick sign-out action in cabinet footer`)

MB-008 final verification (2026-06-01):
- status: verified.
- user confirmed live that quick logout (`Выйти из аккаунта`) works after fix.

### MB-009
- id: `MB-009`
- date: `2026-06-02`
- area: `D3`
- severity: `P1`
- title: Successful booking confirmation navigates to details with missing booking id
- build: Android dev build (`kg.kezek.app`), live D3 session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), production API response shape
- steps:
  1. Complete booking flow to final summary.
  2. Tap final confirm action.
  3. Observe success toast and destination screen.
- expected:
  - app extracts created `booking_id` and opens the created booking details.
- actual:
  - app shows success toast, then details surface says booking is not found.
  - mobile code expected `booking_id` at top level, but API returns success envelope data (`{ ok: true, data: { booking_id } }`).
- evidence:
  - [d3_create_confirm_dialog.png](/C:/projects/kezek/apps/mobile/d3_create_confirm_dialog.png)
  - [d3_after_create.png](/C:/projects/kezek/apps/mobile/d3_after_create.png)
  - [d3_details_wait.png](/C:/projects/kezek/apps/mobile/d3_details_wait.png)
  - [useConfirmBooking.ts](/C:/projects/kezek/apps/mobile/src/hooks/useConfirmBooking.ts)
  - [useConfirmBooking.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/hooks/useConfirmBooking.test.tsx)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-02):
- Mobile now normalizes quick-hold API envelope before reading `booking_id`.
- Targeted tests pass:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/hooks/useConfirmBooking.test.tsx`

### MB-010
- id: `MB-010`
- date: `2026-06-02`
- area: `D3`
- severity: `P1`
- title: Booking details crashes with `Invalid time value` after opening created booking
- build: Android dev build (`kg.kezek.app`), live D3 session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Create a booking successfully.
  2. Open the created booking details.
  3. Wait for details payload to render.
- expected:
  - details screen renders booking date/time, service, business, staff, branch, price and actions.
- actual:
  - app hits error boundary with `Invalid time value`.
  - mobile details query treated API envelope as direct booking DTO, leaving `start_at` undefined.
- evidence:
  - [d3_retest_after_create_wait.png](/C:/projects/kezek/apps/mobile/d3_retest_after_create_wait.png)
  - [d3_retest_details_after_unwrap_fix.png](/C:/projects/kezek/apps/mobile/d3_retest_details_after_unwrap_fix.png)
  - [useBookingDetailsData.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/useBookingDetailsData.ts)
  - [useCabinetScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/useCabinetScreenData.ts)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-02):
- Mobile now unwraps `/api/mobile/bookings` and `/api/mobile/bookings/:id` success envelopes.
- Live recheck rendered details correctly for `Low Fade / Взрослая стрижка / Adakhan / 02 июня 2026 / 14:00 - 14:30`.
- Targeted tests pass:
  - `BookingDetailsScreen.test.tsx`
  - `CabinetScreen.test.tsx`

### MB-011
- id: `MB-011`
- date: `2026-06-02`
- area: `D3`
- severity: `P1`
- title: Confirmed upcoming booking does not show cancel action
- build: Android dev build (`kg.kezek.app`), live D3 session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Open details for an upcoming booking with status `confirmed`.
  2. Scroll to actions.
- expected:
  - details screen shows both repeat and cancel actions for an upcoming confirmed booking.
- actual:
  - repeat action is visible, but cancel action is hidden because `canCancel` rejected `confirmed`.
- evidence:
  - [d3_retest_details_actions.png](/C:/projects/kezek/apps/mobile/d3_retest_details_actions.png)
  - [d3_retest_actions_cancel_visible.png](/C:/projects/kezek/apps/mobile/d3_retest_actions_cancel_visible.png)
  - [useBookingDetailsData.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/useBookingDetailsData.ts)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-02):
- `canCancel` now allows `hold` and `confirmed`, and rejects only terminal/non-cancellable statuses (`cancelled`, `paid`, `no_show`).
- Live recheck confirmed both `Повторить запись` and `Отменить бронирование` are visible.
- Targeted test added in `BookingDetailsScreen.test.tsx`.

### MB-012
- id: `MB-012`
- date: `2026-06-02`
- area: `D3`
- severity: `P1`
- title: Mobile booking cancellation calls legacy web route and receives 403
- build: Android dev build (`kg.kezek.app`), live D3 session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated mobile Bearer session
- steps:
  1. Open details for an upcoming confirmed booking.
  2. Tap `Отменить бронирование`.
  3. Confirm dialog with `Да, отменить`.
- expected:
  - authenticated mobile owner can cancel their booking and details/list update accordingly.
- actual:
  - request goes to `/api/bookings/:id/cancel`.
  - production API returns `403` with `Доступ запрещен` because that route uses web/cookie-manager authorization path, not mobile Bearer ownership auth.
- evidence:
  - [d3_cancel_attempt2_dialog.png](/C:/projects/kezek/apps/mobile/d3_cancel_attempt2_dialog.png)
  - [d3_cancel_attempt2_after_confirm.png](/C:/projects/kezek/apps/mobile/d3_cancel_attempt2_after_confirm.png)
  - [d3_cancel_attempt2_logcat.txt](/C:/projects/kezek/apps/mobile/d3_cancel_attempt2_logcat.txt)
  - [useBookingDetailsData.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/useBookingDetailsData.ts)
  - [mobileBookingsHttpService.ts](/C:/projects/kezek/apps/web/src/lib/mobileBookingsHttpService.ts)
  - [mobileBookingsService.ts](/C:/projects/kezek/apps/web/src/lib/mobileBookingsService.ts)
- status: `fixed_pending_live_recheck`
- owner: `Codex + User`

Resolution note (2026-06-02):
- Added mobile owner cancellation path:
  - `POST /api/mobile/bookings/:id`
  - validates Bearer mobile auth and updates only rows matching `id + client_id`.
- Mobile details screen now calls `/mobile/bookings/:id` for cancellation.
- Targeted tests pass:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/hooks/useConfirmBooking.test.tsx`
  - `corepack pnpm -C apps/web test -- --runInBand src/__tests__/lib/mobileBookingsService.test.ts src/__tests__/lib/mobileBookingsHttpService.test.ts src/__tests__/api/mobile/bookings.test.ts`
- Remaining:
  - deploy web API/mobile bundle or point emulator at local web API, then rerun live cancel success and mark `verified`.
