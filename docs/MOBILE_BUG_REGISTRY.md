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
  2. On `Главная`, enter text into search (`home-search-input`) and switch tabs (`Кабинет` -> `Главная`).
  3. Press hardware Back once from root `Главная`.
- expected:
  - Either stay in-app with deterministic back path (as product policy), or explicitly confirmed Android-default app-exit behavior.
- actual:
  - App exits to launcher (`com.google.android.apps.nexuslauncher`) on first Back press from root `Главная`.
- evidence:
  - [b2_home_back.xml](/C:/projects/kezek/apps/mobile/b2_home_back.xml)
  - [b2_after_back.xml](/C:/projects/kezek/apps/mobile/b2_after_back.xml)
- status: `verified`
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
  - switched to `Кабинет`, then pressed hardware Back once -> returned to `Главная` inside `kg.kezek.app`.
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
  2. Tap `Продолжить с Google`.
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
- status: `verified`
- owner: `Codex + User`

Live note (2026-06-01):
- C2 cancel path: passed (`c2_google_cancel.xml` returned to sign-in with Google CTA visible).
- C2 retry/idempotency: passed (repeated tap reopens auth flow).
- C2 happy-path/session establishment not finalized in unattended run due real Google credential requirement on `accounts.google.com` form.
- Final live completion (2026-06-01):
  - user completed real Google auth manually;
  - app returned to authenticated `Main` (`Главная`, `home-search-input` visible) in [c2_return_app.xml](/C:/projects/kezek/apps/mobile/c2_return_app.xml).

Resolution note (2026-06-09):
- This was Chrome's one-time First Run Experience on a fresh emulator, not an application defect.
- The app cannot and should not accept Chrome onboarding on behalf of the user.
- After browser initialization, Google cancel, retry, callback, session establishment, and the real happy path all passed.

### MB-007
- id: `MB-007`
- date: `2026-06-01`
- area: `C3`
- severity: `P1`
- title: Telegram sign-in live verification is degraded on emulator (browser handoff only, no native Telegram return path)
- build: Android debug (`kg.kezek.app`), live `C3` session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Open sign-in screen and tap `����� ����� Telegram`.
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
- status: `verified`
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
- timeout-expired state: PASS (`���� ������������� �����` observed after extended wait in pending state).
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

Resolution note (2026-06-09):
- Mobile auth converts the server `https://t.me/...` URL to `tg://resolve?...` and prefers an installed Telegram app.
- If Telegram is absent, it safely falls back to the web URL.
- Prior live verification confirmed native handoff to `org.telegram.messenger.web`.
- Pending, cancel, retry, timeout, callback foregrounding, polling approval, exchange, and session restoration are covered by live or automated verification.
- Completing confirmation with a real Telegram account is an external provider/account action, not an open mobile defect.

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
  - `�����` action should be clearly discoverable in primary account surfaces (Cabinet/header/menu) without deep hunt.
- actual:
  - logout exists only on `Profile` screen; users may not find it quickly and report missing logout.
- evidence:
  - [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx)
  - [ProfileScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/profile/ProfileScreenSections.tsx)
  - test pass: `ProfileScreen.test.tsx`, `CabinetScreen.test.tsx`
- status: `verified`
- owner: `Codex + User`

Note:
- Functional sign-out implementation exists (`supabase.auth.signOut` in profile data hook).
- Issue is primarily discoverability/IA, not auth invalidation logic.

MB-008 update (2026-06-01):
- implementation completed.
- implemented quick logout action in Cabinet footer (`����� �� ��������`) so users can sign out without opening Profile.
- files:
  - [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx)
  - [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx)
  - [cabinetScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/cabinetScreenStyles.ts)
- verification:
  - `src/__tests__/screens/CabinetScreen.test.tsx` PASS (`shows quick sign-out action in cabinet footer`)

MB-008 final verification (2026-06-01):
- live verification completed.
- user confirmed live that quick logout (`����� �� ��������`) works after fix.

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
- Live recheck rendered details correctly for `Low Fade / �������� ������� / Adakhan / 02 ���� 2026 / 14:00 - 14:30`.
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
- Live recheck confirmed both `��������� ������` and `�������� ������������` are visible.
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
  2. Tap `�������� ������������`.
  3. Confirm dialog with `��, ��������`.
- expected:
  - authenticated mobile owner can cancel their booking and details/list update accordingly.
- actual:
  - request goes to `/api/bookings/:id/cancel`.
  - production API returns `403` with `������ ��������` because that route uses web/cookie-manager authorization path, not mobile Bearer ownership auth.
- evidence:
  - [d3_cancel_attempt2_dialog.png](/C:/projects/kezek/apps/mobile/d3_cancel_attempt2_dialog.png)
  - [d3_cancel_attempt2_after_confirm.png](/C:/projects/kezek/apps/mobile/d3_cancel_attempt2_after_confirm.png)
  - [d3_cancel_attempt2_logcat.txt](/C:/projects/kezek/apps/mobile/d3_cancel_attempt2_logcat.txt)
  - [useBookingDetailsData.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/useBookingDetailsData.ts)
  - [mobileBookingsHttpService.ts](/C:/projects/kezek/apps/web/src/lib/mobileBookingsHttpService.ts)
  - [mobileBookingsService.ts](/C:/projects/kezek/apps/web/src/lib/mobileBookingsService.ts)
- status: `verified`
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

MB-012 final verification (2026-06-02, post-deploy live recheck):
- post-deploy live verification completed.
- production mobile cancel endpoint is live and used by the app:
  - `POST https://kezek.kg/api/mobile/bookings/c881a2b7-9115-4ab1-9549-794d27c39927`
- observed result:
  - success toast `������������ ��������`.
  - app returned to Cabinet.
  - Cabinet counters updated to `�����������: 0`, `�������: 2`.
- evidence:
  - [d3_post_deploy_cancel_dialog.png](/C:/projects/kezek/apps/mobile/d3_post_deploy_cancel_dialog.png)
  - [d3_post_deploy_after_cancel_confirm.png](/C:/projects/kezek/apps/mobile/d3_post_deploy_after_cancel_confirm.png)
  - [d3_post_deploy_after_cancel_logcat.txt](/C:/projects/kezek/apps/mobile/d3_post_deploy_after_cancel_logcat.txt)

### MB-013
- id: `MB-013`
- date: `2026-06-02`
- area: `D3`
- severity: `P2`
- title: Offline bookings storage failure is surfaced as a dev error toast after successful cancel refresh
- build: Android dev build (`kg.kezek.app`), post-deploy D3 live recheck
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated mobile session
- steps:
  1. Open details for an upcoming booking.
  2. Cancel the booking successfully.
  3. Observe Cabinet refresh after returning from details.
- expected:
  - Cabinet refresh should stay clean after successful network operation.
  - Offline cache write failures should be handled silently or surfaced in a user-friendly non-blocking way, depending on product policy.
- actual:
  - cancellation succeeds, but a dev-style error toast/log appears:
    - `[offlineBookingsStorage] Failed to save offline bookings {}`
- evidence:
  - [d3_post_deploy_after_cancel_confirm.png](/C:/projects/kezek/apps/mobile/d3_post_deploy_after_cancel_confirm.png)
  - [d3_post_deploy_after_cancel_confirm.xml](/C:/projects/kezek/apps/mobile/d3_post_deploy_after_cancel_confirm.xml)
  - [d3_post_deploy_after_cancel_logcat.txt](/C:/projects/kezek/apps/mobile/d3_post_deploy_after_cancel_logcat.txt)
  - [offlineBookingsStorage.ts](/C:/projects/kezek/apps/mobile/src/lib/offlineBookingsStorage.ts)
- status: `verified`
- owner: `Codex + User`

Note:
- This did not block D3 cancel success, but it is visible in the live dev build and should be cleaned up before treating offline/cache UX as polished.

MB-013 verification (2026-06-02):
- live verification completed.
- fix:
  - `saveOfflineBookings` now treats SecureStore write failures as best-effort debug events instead of `console.error`/dev ErrorBox events.
  - added regression coverage to ensure save failures do not call `console.error`.
- verification:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/lib/offlineBookingsStorage.test.ts src/__tests__/screens/CabinetScreen.test.tsx` -> PASS (`2 suites / 6 tests`).
  - `corepack pnpm -C apps/mobile typecheck` -> PASS.
  - live refresh on Android emulator Cabinet -> no visible `Console Error` / `Failed to save offline bookings` toast.
  - logcat now reports the event as info/debug (`I ReactNativeJS`), not error (`E ReactNativeJS`).
- evidence:
  - [mb013_live_after_refresh.png](/C:/projects/kezek/apps/mobile/mb013_live_after_refresh.png)
  - [mb013_live_after_refresh.xml](/C:/projects/kezek/apps/mobile/mb013_live_after_refresh.xml)
  - [mb013_live_after_refresh_logcat.txt](/C:/projects/kezek/apps/mobile/mb013_live_after_refresh_logcat.txt)

### MB-014
- id: `MB-014`
- date: `2026-06-02`
- area: `D4`
- severity: `P2`
- title: Invalid booking slug deep link can show stale previous business flow
- build: Android dev build (`kg.kezek.app`), live D4 session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated mobile session
- steps:
  1. Open a valid booking slug deep link, for example `kezek://booking/low-fade`.
  2. Open an invalid booking slug deep link, for example `kezek://booking/__missing_live_d4_slug__`.
- expected:
  - invalid slug renders a graceful not-found/empty state.
  - previous business data is cleared and not shown as if the invalid link were valid.
- actual:
  - before fix, invalid slug could continue showing `Low Fade` Step 1 content from the previous valid booking flow.
- evidence:
  - [d4_valid_slug.png](/C:/projects/kezek/apps/mobile/d4_valid_slug.png)
  - [d4_invalid_slug.png](/C:/projects/kezek/apps/mobile/d4_invalid_slug.png)
  - [d4_postfix_invalid_slug.png](/C:/projects/kezek/apps/mobile/d4_postfix_invalid_slug.png)
  - [useBookingScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingFlow/useBookingScreenData.ts)
  - [useBookingStep1Business.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep1Business.ts)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-02):
- Booking flow now resets stale context when the active business slug differs from the incoming deep-link slug.
- Step 1 only exposes loaded business data when its slug matches the current route slug.
- Live recheck:
  - `kezek://booking/low-fade` -> `Low Fade` Step 1.
  - `kezek://booking/__missing_live_d4_slug__` -> `Бизнес не найден`.
- Targeted checks pass:
  - `BookingScreen.test.tsx`
  - `BookingStep1Branch.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`

### MB-015
- id: `MB-015`
- date: `2026-06-02`
- area: `D4`
- severity: `P2`
- title: Invalid booking detail deep link can show stale previous booking details
- build: Android dev build (`kg.kezek.app`), live D4 session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated mobile session
- steps:
  1. Open a valid details deep link, for example `kezek://booking-detail/c881a2b7-9115-4ab1-9549-794d27c39927`.
  2. Open an invalid details deep link, for example `kezek://booking-detail/00000000-0000-0000-0000-000000000000`.
- expected:
  - invalid id renders a graceful not-found/empty state.
  - previous booking details are not displayed for the invalid id.
- actual:
  - before fix, invalid id could keep showing the previously opened booking details.
- evidence:
  - [d4_valid_booking_detail.png](/C:/projects/kezek/apps/mobile/d4_valid_booking_detail.png)
  - [d4_invalid_booking_detail.png](/C:/projects/kezek/apps/mobile/d4_invalid_booking_detail.png)
  - [d4_postfix_invalid_booking_detail.png](/C:/projects/kezek/apps/mobile/d4_postfix_invalid_booking_detail.png)
  - [useBookingDetailsData.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/useBookingDetailsData.ts)
  - [BookingDetailsScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/BookingDetailsScreen.test.tsx)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-02):
- Booking details hook now returns details only when the loaded booking id matches the current route id.
- Added regression coverage for invalid deep-linked booking id.
- Live recheck:
  - valid booking detail id -> details screen.
  - invalid booking detail id -> `Бронирование не найдено`.
- Targeted checks pass:
  - `BookingDetailsScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`

### MB-016
- id: `MB-016`
- date: `2026-06-02`
- area: `E1`
- severity: `P1`
- title: Cabinet bookings network failure without offline cache is not shown as an explicit error state
- build: Android dev build (`kg.kezek.app`) + targeted screen tests
- environment: Cabinet bookings data flow (`apps/mobile/src/screens/cabinet/useCabinetScreenData.ts`)
- steps:
  1. Open Cabinet with an authenticated user.
  2. Make `/mobile/bookings` fail while no offline bookings cache is available.
  3. Observe the bookings area.
- expected:
  - Cabinet keeps profile/navigation available.
  - bookings area clearly shows that records could not be loaded.
  - user has a retry action.
- actual:
  - before fix, the flow exposed no dedicated `bookingsQuery.isError` state to the UI.
  - this could make a no-cache network failure look too close to an empty/sync-pending cabinet instead of an actionable error.
- evidence:
  - [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx)
  - [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx)
  - [useCabinetScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/useCabinetScreenData.ts)
  - [CabinetScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/CabinetScreen.test.tsx)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-02):
- Cabinet data hook now exposes `hasBookingsError` when network loading fails and no cached booking data is available.
- Cabinet UI now renders:
  - error data mode label (`Ошибка`),
  - error banner (`Не удалось загрузить записи`),
  - empty/error block with `Повторить` retry action.
- Live E1 verification passed for normal Cabinet flow:
  - authenticated Cabinet shell,
  - upcoming empty state,
  - history booking cards,
  - card tap opening booking details.
- Targeted checks pass:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/CabinetScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
- evidence:
  - [e1_cabinet_current.png](/C:/projects/kezek/apps/mobile/e1_cabinet_current.png)
  - [e1_scrolled.xml](/C:/projects/kezek/apps/mobile/e1_scrolled.xml)
  - [e1_history_cards.png](/C:/projects/kezek/apps/mobile/e1_history_cards.png)
  - [e1_history_card_action_details.png](/C:/projects/kezek/apps/mobile/e1_history_card_action_details.png)

### MB-017
- id: `MB-017`
- date: `2026-06-02`
- area: `E2`
- severity: `P1`
- title: Profile screen fails to load because mobile selects non-existent `profiles.email` column
- build: Android dev build (`kg.kezek.app`), live E2 session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated mobile session
- steps:
  1. Open Cabinet.
  2. Tap `Профиль`.
  3. Observe profile loading result.
- expected:
  - Profile form loads current user profile data and auth email.
- actual:
  - before fix, profile screen showed `Не удалось загрузить профиль`.
  - mobile query selected `email` from `public.profiles`, but schema does not include that column; email belongs to auth user data.
- evidence:
  - [e2_profile_current.png](/C:/projects/kezek/apps/mobile/e2_profile_current.png)
  - [e2_profile_load_error_logcat.txt](/C:/projects/kezek/apps/mobile/e2_profile_load_error_logcat.txt)
  - [useProfileScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/profile/useProfileScreenData.ts)
  - [types.ts](/C:/projects/kezek/apps/mobile/src/screens/profile/types.ts)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-02):
- Removed `email` from `profiles` select and profile DTO type.
- Profile email is rendered from authenticated user data instead.
- Live recheck shows profile form loaded successfully after schema fix.
- Targeted checks pass:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/ProfileScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
- evidence:
  - [e2_profile_after_schema_fix.png](/C:/projects/kezek/apps/mobile/e2_profile_after_schema_fix.png)
  - [e2_profile_after_reload.png](/C:/projects/kezek/apps/mobile/e2_profile_after_reload.png)

### MB-018
- id: `MB-018`
- date: `2026-06-02`
- area: `E2`
- severity: `P2`
- title: Profile screen labels are mojibake instead of readable Russian text
- build: mobile source-level + live E2 session
- environment: [ProfileScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/profile/ProfileScreenSections.tsx)
- steps:
  1. Open Profile screen.
  2. Review form labels, section titles, helper text and actions.
- expected:
  - Russian UI labels render cleanly and match product language.
- actual:
  - before fix, labels were stored as mojibake strings such as `РџСЂРѕС„РёР»СЊ`.
- evidence:
  - [ProfileScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/profile/ProfileScreenSections.tsx)
  - [ProfileScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/ProfileScreen.test.tsx)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-02):
- Replaced profile screen mojibake strings with readable Russian labels/actions.
- Added regression coverage for localized labels and profile values.
- Live recheck confirms clean labels:
  - `Профиль`
  - `Личная информация`
  - `Имя`
  - `Телефон`
  - `Уведомления`
  - `Сохранить`
- evidence:
  - [e2_profile_after_schema_fix.png](/C:/projects/kezek/apps/mobile/e2_profile_after_schema_fix.png)

### MB-019
- id: `MB-019`
- date: `2026-06-03`
- area: `F1`
- severity: `P1`
- title: Staff screen can show non-staff empty state when staff query fails
- build: mobile source-level + targeted F1 test suite
- environment: [StaffScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/StaffScreen.tsx), [useStaffScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/staff/useStaffScreenData.ts)
- steps:
  1. Open Staff screen for an authenticated user.
  2. Make the staff lookup query fail because of network/server/RLS error.
  3. Observe the screen state.
- expected:
  - Staff screen shows an explicit load error with retry.
  - It must not tell the user they are not a staff member when the app simply failed to load staff status.
- actual:
  - before fix, `staffInfo` was falsy on query error and the screen could render `Вы не являетесь сотрудником`.
- evidence:
  - [StaffScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/StaffScreen.tsx)
  - [useStaffScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/staff/useStaffScreenData.ts)
  - [StaffScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/StaffScreen.test.tsx)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-03):
- Staff data hook now exposes `loadError` from staff/bookings queries.
- Staff screen now renders `Не удалось загрузить рабочую зону` with `Повторить` on query failure.
- Refresh now resets `refreshing` in `finally`, so failed refresh cannot leave the UI stuck.
- Targeted checks pass:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/StaffScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
- Live role-gating check:
  - current authenticated account does not expose Staff tab; visible tabs are `Главная`, `Кабинет`, `Бизнес`.
- evidence:
  - [f1_live_tabs_current_user.png](/C:/projects/kezek/apps/mobile/f1_live_tabs_current_user.png)
  - [f1_live_tabs_current_user.xml](/C:/projects/kezek/apps/mobile/f1_live_tabs_current_user.xml)


### MB-020
- id: `MB-020`
- date: `2026-06-03`
- area: `F1`
- severity: `P1`
- title: Staff dashboard action buttons are obscured by bottom tab bar
- build: Android dev build (`kg.kezek.app`), live F1 staff-role session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated staff account `telegram_634038083@telegram.local`
- steps:
  1. Log in as a staff user.
  2. Open the `Работа` tab.
  3. Scroll/review the staff dashboard key action buttons.
  4. Try tapping `Статистика`.
- expected:
  - `Моя смена` and `Статистика` are fully visible and tappable.
  - Bottom tab bar does not overlap key staff actions.
- actual:
  - before fix, `Статистика` was placed under the bottom tab bar.
  - UI bounds showed `Статистика` at `[70,2827][1370,3050]`, while bottom tabs started around `[0,2819][1440,3078]`.
  - Taps could miss the intended action or hit the wrong area.
- evidence:
  - [f1_staff_dashboard_live.png](/C:/projects/kezek/apps/mobile/f1_staff_dashboard_live.png)
  - [f1_staff_actions_revealed.xml](/C:/projects/kezek/apps/mobile/f1_staff_actions_revealed.xml)
  - [StaffScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/staff/StaffScreenSections.tsx)
  - [staffScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/staff/staffScreenStyles.ts)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-03):
- Moved staff key actions above the upcoming bookings section.
- Added explicit ScrollView content bottom padding to keep lower content clear of the bottom tab bar.
- Rebuilt and installed fresh Android dev APK from the short `C:\kz` build mirror because `C:\projects\kezek` still hits Windows CMake path-limit errors.
- Live recheck confirmed action bounds are now above the tab bar:
  - `Моя смена`: `[70,1761][1370,2033]`
  - `Статистика`: `[70,2033][1370,2256]`
  - bottom tab bar starts around `[32,2861]...`
- Live navigation passed:
  - `Моя смена` opens `ShiftQuick`.
  - `Статистика` opens `Смены и статистика`.
- Targeted checks pass:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/StaffScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
- evidence:
  - [f1_staff_dashboard_after_reinstall.png](/C:/projects/kezek/apps/mobile/f1_staff_dashboard_after_reinstall.png)
  - [f1_staff_dashboard_after_reinstall.xml](/C:/projects/kezek/apps/mobile/f1_staff_dashboard_after_reinstall.xml)
  - [f1_staff_action_shiftquick_final.png](/C:/projects/kezek/apps/mobile/f1_staff_action_shiftquick_final.png)
  - [f1_staff_action_shifts_final.png](/C:/projects/kezek/apps/mobile/f1_staff_action_shifts_final.png)


### MB-021
- id: `MB-021`
- date: `2026-06-03`
- area: `F2`
- severity: `P0`
- title: Mobile staff shift workspace cannot load because staff finance API rejects Bearer auth
- build: Android dev build (`kg.kezek.app`), live F2 staff-role session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated staff account `telegram_634038083@telegram.local`, production API `https://kezek.kg`
- steps:
  1. Log in as a staff user in the mobile app.
  2. Open `Работа`.
  3. Tap `Моя смена`.
  4. Observe network/logcat for `GET /api/staff/finance`.
- expected:
  - Mobile Bearer session authenticates the staff user.
  - Shift workspace loads today finance/shift data.
- actual:
  - Production API returns `401 UNAUTHORIZED` with `{ ok: false, error: 'auth', message: 'UNAUTHORIZED' }`.
  - Shift workspace falls back to cache and then shows load error when no cache exists.
- evidence:
  - logcat output captured during F2 live session for `/api/staff/finance`.
  - [staffFinanceRouteService.ts](/C:/projects/kezek/apps/web/src/lib/staffFinanceRouteService.ts)
  - [staffShiftOpenHttpService.ts](/C:/projects/kezek/apps/web/src/lib/staffShiftOpenHttpService.ts)
  - [staffShiftCloseHttpService.ts](/C:/projects/kezek/apps/web/src/lib/staffShiftCloseHttpService.ts)
  - [staffShiftItemsRouteService.ts](/C:/projects/kezek/apps/web/src/lib/staffShiftItemsRouteService.ts)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-03):
- Added request-aware staff context via `getStaffContextForRequest(req, scope)` / `resolveStaffContextForRequest(req, scope)`.
- Staff finance and shift endpoints now preserve web cookie auth and also accept mobile Bearer auth for self-staff mode.
- Targeted API tests pass for staff finance/open/close/items.
- Post-deploy live production verification passed: `/api/staff/finance`, `/api/staff/shift/open`, `/api/staff/shift/items`, and `/api/staff/shift/close` all returned success from the Android staff session.
- evidence:
  - [f2_post_deploy_finance_success.png](/C:/projects/kezek/apps/mobile/f2_post_deploy_finance_success.png)
  - [f2_open_shift_after_toast_dismiss.png](/C:/projects/kezek/apps/mobile/f2_open_shift_after_toast_dismiss.png)
  - [f2_after_close_shift_wait.png](/C:/projects/kezek/apps/mobile/f2_after_close_shift_wait.png)


### MB-022
- id: `MB-022`
- date: `2026-06-03`
- area: `F2`
- severity: `P1`
- title: ShiftQuick screen contains mojibake/question-mark Russian UI strings
- build: mobile source-level F2 audit
- environment: [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx), [useShiftQuickScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/useShiftQuickScreenData.ts)
- steps:
  1. Review ShiftQuick visible strings and toast messages.
  2. Render load-error/non-staff states in tests.
- expected:
  - Russian labels and messages are readable.
- actual:
  - Some strings were stored as question marks or mojibake, including non-staff/load-error/cancel/add-client messages.
- evidence:
  - [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx)
  - [ShiftQuickScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/ShiftQuickScreen.test.tsx)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-03):
- Replaced corrupted ShiftQuick visible strings with readable Russian text.
- Added regression coverage for idle, active add-client, load-error and non-staff states.
- Targeted mobile ShiftQuick tests and mobile typecheck pass.


### MB-023
- id: `MB-023`
- date: `2026-06-03`
- area: `F2`
- severity: `P1`
- title: ShiftQuick manual client items cannot be edited after creation
- build: Android dev build (`kg.kezek.app`), live F2 staff-role session after production deploy
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated staff account `telegram_634038083@telegram.local`, production API `https://kezek.kg`
- steps:
  1. Open Staff tab -> My shift as a staff user.
  2. Open a shift.
  3. Add a manual client/item (example: `F2Client`, `TestCut`, amount `500`, consumables `100`).
  4. Wait until `/api/staff/shift/items` returns success and the item appears in the clients list.
  5. Tap the client card and the manual-source chip.
- expected:
  - Existing manual shift client/item can be edited, or there is a visible edit action if editing is part of F2 acceptance.
  - User can correct client name/service/amount/consumables without closing/recreating the shift.
- actual:
  - Client card is static; tapping it does not open edit mode.
  - No visible edit or remove action is exposed for the created manual item.
  - Source audit shows item rendering in `ShiftQuickSections.tsx` without an item-level edit action.
- evidence:
  - [f2_client_list_after_add.png](/C:/projects/kezek/apps/mobile/f2_client_list_after_add.png)
  - [f2_after_tap_client_card.png](/C:/projects/kezek/apps/mobile/f2_after_tap_client_card.png)
  - [ShiftQuickSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/ShiftQuickSections.tsx)
- status: `verified`
- owner: `Codex + User`


Resolution note (2026-06-04):
- Added an edit action for manual ShiftQuick client items while the shift is open.
- Reused the existing add-client form for edit mode and saves updated items through `/api/staff/shift/items`.
- Booking-linked items remain read-only to avoid breaking booking integrity.
- Added regression coverage for editing a manual item and preserving its id in the save payload.
- Live verification on Android emulator confirmed:
  - Staff tab -> My shift opens an active shift workspace.
  - Manual item appears with the new `Редактировать` action.
  - Edit mode reuses the form with `Редактирование клиента` and `Сохранить изменения`.
  - Saved edit updates the card text from `MB23LiveeTestCuts500h100` to `MB23LiveeTestCuts500h100Z`.
  - logcat shows successful `/api/staff/shift/items` followed by `/api/staff/finance`.
  - Test shift was closed after verification; logcat shows successful `/api/staff/shift/close`.
- Live evidence:
  - [mb023_current.png](/C:/projects/kezek/apps/mobile/mb023_current.png)
  - [mb023_edit_form2.png](/C:/projects/kezek/apps/mobile/mb023_edit_form2.png)
  - [mb023_edit_form_prefilled.png](/C:/projects/kezek/apps/mobile/mb023_edit_form_prefilled.png)
  - [mb023_after_back_hide_keyboard.png](/C:/projects/kezek/apps/mobile/mb023_after_back_hide_keyboard.png)
  - [mb023_after_close_wait.png](/C:/projects/kezek/apps/mobile/mb023_after_close_wait.png)
- Targeted checks pass:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/ShiftQuickScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`


### MB-024
- id: `MB-024`
- date: `2026-06-06`
- area: `F2`
- severity: `P0`
- title: Failed ShiftQuick offline retry clears unsent operations
- build: Android dev build (`kg.kezek.app`), live F2 offline/reconnect session
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated staff account, production API `https://kezek.kg`
- steps:
  1. Open a staff shift while online.
  2. Disable Wi-Fi and mobile data in the Android emulator.
  3. Add a manual client item.
  4. Allow the automatic queue processor to retry while the device is still offline.
- expected:
  - Failed operations remain persisted in the offline queue.
  - Queue count and retry UI remain visible until a successful server response.
- actual before fix:
  - `addItem` was stored, immediately retried, failed, and then the whole queue was cleared unconditionally.
  - The offline banner disappeared and the client item was lost.
  - Expected offline failure was logged as an error and surfaced as a dev error toast.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Queue processing now retains failed operations and removes only operations confirmed by the server.
- Added an in-flight ref guard so queue processing cannot overlap.
- Expected offline request failures are logged as debug events instead of app-level errors.
- Added regression coverage for failed add persistence followed by successful manual retry.
- Live verification:
  - Offline `F2OfflineFix / RetryCut / 800 / 120` add produced `1 операций в очереди`.
  - A retry while offline kept the operation queued.
  - After reconnect and pull-to-refresh, `/api/staff/shift/items` and `/api/staff/finance` returned success.
  - Queue banner disappeared, metrics became turnover `800`, master `480`, salon `440`, clients `1`.
  - Synced client card rendered with the expected values.
  - Test shift cleanup succeeded through `/api/staff/shift/close`.
- evidence:
  - [f2_fix_queue_banner.png](/C:/projects/kezek/apps/mobile/f2_fix_queue_banner.png)
  - [f2_fix_after_reconnect.png](/C:/projects/kezek/apps/mobile/f2_fix_after_reconnect.png)
  - [f2_fix_synced_client.png](/C:/projects/kezek/apps/mobile/f2_fix_synced_client.png)
  - [f2_fix_shift_closed_final.png](/C:/projects/kezek/apps/mobile/f2_fix_shift_closed_final.png)
- targeted checks:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/ShiftQuickScreen.test.tsx` -> PASS (`7/7`)
  - `corepack pnpm -C apps/mobile typecheck` -> PASS


### MB-025
- id: `MB-025`
- date: `2026-06-06`
- area: `F3`
- severity: `P1`
- title: Shift history endpoint rejects authenticated mobile staff Bearer session
- build: Android dev build (`kg.kezek.app`), production API `https://kezek.kg`
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`), authenticated staff session
- steps:
  1. Open Staff workspace.
  2. Open `Статистика`.
  3. Wait for `/api/dashboard/staff/{staffId}/finance/stats?period=day&date=2026-06-06`.
- expected:
  - The authenticated staff member can load their own shift history and statistics.
- actual before fix:
  - The endpoint returns `401 auth / Требуется авторизация`.
  - The route uses manager/cookie-oriented context and does not accept the mobile Bearer session.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Added a request-aware Bearer path for self-staff access while preserving the existing manager cookie path.
- Bearer staff may request only their own staff id; cross-staff access returns `403`.
- Route/service tests pass (`6/6`) and web typecheck passes.
- Post-deploy live verification confirmed production success for day, month, and year requests from the Android staff session.
- evidence:
  - [f3_stats_open.png](/C:/projects/kezek/apps/mobile/f3_stats_open.png)
  - [f3_initial_logcat.txt](/C:/projects/kezek/apps/mobile/f3_initial_logcat.txt)
  - [staffFinanceStatsHttpService.ts](/C:/projects/kezek/apps/web/src/lib/staffFinanceStatsHttpService.ts)
  - [staffFinanceStatsHttpService.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/staffFinanceStatsHttpService.test.ts)
  - [f3_day_contrast.png](/C:/projects/kezek/apps/mobile/f3_day_contrast.png)
  - [f3_year_logcat.txt](/C:/projects/kezek/apps/mobile/f3_year_logcat.txt)


### MB-026
- id: `MB-026`
- date: `2026-06-06`
- area: `F3`
- severity: `P1`
- title: Shift history API failure is presented as an empty state without retry
- build: Android dev build (`kg.kezek.app`)
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Open Staff workspace.
  2. Open `Статистика` while the stats API returns an error.
- expected:
  - The screen distinguishes request failure from a successful empty period.
  - A visible retry action lets the user repeat the request.
- actual before fix:
  - The screen showed `Нет данных` / `Не удалось загрузить статистику смен`.
  - There was no retry action.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Added a dedicated `Не удалось загрузить историю смен` state with a full-width `Повторить` action.
- A successful response with no shifts continues to render the separate `Нет смен` state.
- Live Android verification confirmed that retry sends a new production request and the error UI remains stable after repeated `401` responses.
- Mobile ShiftsScreen tests pass (`5/5`).
- evidence:
  - [f3_error_retry_after_tap.png](/C:/projects/kezek/apps/mobile/f3_error_retry_after_tap.png)
  - [f3_retry_logcat.txt](/C:/projects/kezek/apps/mobile/f3_retry_logcat.txt)
  - [ShiftsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftsScreen.tsx)
  - [ShiftsScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/ShiftsScreen.test.tsx)


### MB-027
- id: `MB-027`
- date: `2026-06-06`
- area: `F3`
- severity: `P1`
- title: Shift history ignores successful API response because the client reads the wrong response envelope
- build: Android dev build (`kg.kezek.app`), post-deploy production API
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Open Staff workspace -> `Статистика`.
  2. Retry after deploying `MB-025`.
- expected:
  - Successful `{ ok, data: { stats } }` response renders shift history.
- actual before fix:
  - Production returned success, but the query returned `undefined`.
  - React Query reported `Query data cannot be undefined` because the client read `response.stats` instead of `response.data.stats`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Updated the mobile query to consume the standard API response envelope.
- Updated tests to model the production response contract.
- Live retry rendered real day statistics immediately.
- evidence:
  - [f3_postdeploy_day_logcat.txt](/C:/projects/kezek/apps/mobile/f3_postdeploy_day_logcat.txt)
  - [f3_day_contrast.png](/C:/projects/kezek/apps/mobile/f3_day_contrast.png)
  - [useShiftsScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/shifts/useShiftsScreenData.ts)


### MB-028
- id: `MB-028`
- date: `2026-06-06`
- area: `F3`
- severity: `P1`
- title: Month and year shift filters send an invalid daily date format
- build: Android dev build (`kg.kezek.app`), production API
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Open shift statistics.
  2. Select `Месяц` or `Год`.
- expected:
  - Month sends `YYYY-MM`; year sends `YYYY`.
- actual before fix:
  - Both filters sent `YYYY-MM-DD`.
  - Month returned `400 validation` with `Ожидается YYYY-MM`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Added period-specific query date formatting.
- Added regression assertions for exact month/year endpoint formats.
- Live production checks passed for `period=month&date=2026-06` and `period=year&date=2026`.
- evidence:
  - [f3_month_logcat_full.txt](/C:/projects/kezek/apps/mobile/f3_month_logcat_full.txt)
  - [f3_month_fixed.png](/C:/projects/kezek/apps/mobile/f3_month_fixed.png)
  - [f3_year_logcat.txt](/C:/projects/kezek/apps/mobile/f3_year_logcat.txt)


### MB-029
- id: `MB-029`
- date: `2026-06-06`
- area: `F3`
- severity: `P1`
- title: Shift history values are visually hidden by light-theme text colors on dark cards
- build: Android dev build (`kg.kezek.app`)
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Open a successful shift history response.
  2. Inspect turnover, additional totals, and shift cards.
- expected:
  - All totals and item text have readable contrast against dark semantic cards.
- actual before fix:
  - Values existed in the accessibility tree but several used `#111827` on `#111827` cards.
  - Turnover and additional totals were visually absent.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Replaced legacy light-screen hardcoded colors with existing semantic surface, text, border, accent, and status tokens.
- Live verification confirmed readable day/month/year totals and expanded shift items.
- evidence:
  - [f3_postfix_day.png](/C:/projects/kezek/apps/mobile/f3_postfix_day.png)
  - [f3_day_contrast.png](/C:/projects/kezek/apps/mobile/f3_day_contrast.png)
  - [f3_year_item_expanded.png](/C:/projects/kezek/apps/mobile/f3_year_item_expanded.png)
  - [shiftsScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/shifts/shiftsScreenStyles.ts)


### MB-030
- id: `MB-030`
- date: `2026-06-06`
- area: `F4`
- severity: `P1`
- title: Business percentage includes consumables and makes displayed percentages exceed 100%
- build: Android dev build (`kg.kezek.app`), production shift stats
- environment: `Pixel 7 Pro GApis35` (`emulator-5554`)
- steps:
  1. Open shift statistics for a period with consumables.
  2. Compare employee and business percentages.
- expected:
  - Percentages describe the base revenue split and total 100%.
  - Consumables remain visible as a separate business reimbursement.
- actual before fix:
  - Day displayed `60.0% + 55.0% = 115%`.
  - Month displayed `60.0% + 56.9% = 116.9%`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Percentages now use base revenue shares and explicitly say `от выручки`.
- Business percentage excludes consumables while the business amount continues to include them.
- Legacy deployed response envelopes are handled until the explicit base-share contract is deployed.
- Live day/month/year verification shows `60.0% / 40.0%`.


### MB-031
- id: `MB-031`
- date: `2026-06-06`
- area: `F4`
- severity: `P1`
- title: Shift history cannot reliably distinguish base employee share from guaranteed payout
- build: mobile shift history and staff finance stats API
- environment: source-level and automated finance audit
- steps:
  1. Load a shift where guaranteed payout exceeds the base employee percentage share.
  2. Inspect the mobile shift card.
- expected:
  - Card shows final guaranteed payout, base percentage share, hours, and business remainder.
- actual before fix:
  - API exposed only final `master_share`.
  - UI compared `guaranteed_amount > master_share`, which is false once `master_share` already equals the guarantee.
  - The displayed `Базовая` value incorrectly reused the final share.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Stats API now returns `base_master_share` and `base_salon_share` per shift and aggregate base-share totals.
- Mobile guarantee detection compares guarantee against `base_master_share`.
- Regression test verifies guarantee `500`, base share `60`, one hour, and final business share `0`.

Post-deploy verification (2026-06-08):
- Production API returned aggregate base shares and explicit per-shift base shares for all checked month (`3/3`) and year (`10/10`) shifts.
- The current production fixture had zero guarantee-dominant shifts; the deployed contract was verified live and the guarantee presentation branch remains verified by regression test.


### MB-032
- id: `MB-032`
- date: `2026-06-06`
- area: `F4`
- severity: `P1`
- title: Independent share rounding can create or lose one som
- build: shared finance domain and shift calculation consumers
- environment: source-level finance-domain audit
- steps:
  1. Calculate a turnover of `1` with a `50/50` split.
- expected:
  - Employee and business revenue shares sum exactly to turnover.
- actual before fix:
  - Both independently rounded to `1`, producing `2` from a turnover of `1`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-06):
- Employee share remains the primary rounded value.
- Business share receives the exact turnover remainder plus consumables.
- Synchronized the shared finance domain, stats service, ShiftQuick, and automatic close-shift cron.
- Regression coverage verifies `1 @ 50/50 -> 1/0` and full revenue conservation.

Post-deploy verification (2026-06-08):
- Production month (`3` shifts) and year (`10` shifts) responses contained explicit base shares with zero conservation mismatches.
- The exact odd-turnover edge remains covered by the deployed `1 @ 50/50 -> 1/0` regression test.


### MB-033
- id: `MB-033`
- date: `2026-06-08`
- area: `G2`
- severity: `P1`
- title: Home search sends a production API request for every typed character
- build: Expo dev (`apps/mobile`)
- environment: Android emulator, production API
- steps:
  1. Open Home.
  2. Type `Low` into the search field without pausing.
  3. Inspect mobile API requests.
- expected:
  - Input updates immediately while the network request waits briefly for typing to settle.
- actual before fix:
  - Separate requests were observed for intermediate search values such as `L` and the final `Low`.
  - Fast typing could consume public API rate-limit capacity unnecessarily.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Added a `300ms` search debounce while preserving immediate controlled-input updates.
- Query keys and request parameters now use the settled search value.
- Regression coverage verifies that rapid `S -> Sa -> Salon` input sends only the final search request.


### MB-034
- id: `MB-034`
- date: `2026-06-08`
- area: `G3`
- severity: `P2`
- title: Mobile Home has no nearby/location fallback for discovery
- build: Expo dev (`apps/mobile`)
- environment: source audit and Android emulator
- steps:
  1. Open Home.
  2. Look for a nearby/location discovery affordance or fallback when location is unavailable.
- expected:
  - The screen should either support nearby discovery or clearly explain the fallback path.
- actual before fix:
  - Mobile Home only showed search, categories, and business cards.
  - There was no location-related UI and no explanation that nearby discovery is unavailable in mobile.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Added a dedicated `Ближайшие филиалы` fallback block on Home.
- The block avoids requesting unavailable native location permissions and directs the user to choose from the regular discovery list.
- Regression coverage verifies that the fallback renders.

Follow-up note (2026-06-17):
- `LG-007` scope was expanded from fallback-only to real nearby discovery.
- Mobile Home now uses `expo-location`, requests foreground location permission, calls `/api/branches/nearby`, and renders distance-ranked nearby branch rows with booking navigation.
- Automated coverage verifies entry, permission-granted loading, permission-denied fallback states, current-position timeout, and last-known fallback.
- Physical-device live verification completed on Android device `8231be4e2ca4`: foreground location permission opened, real coordinates were used, `/api/branches/nearby` succeeded, distance-ranked branches rendered, and tapping a nearby branch opened booking.




### MB-063
- id: `MB-063`
- date: `2026-06-17`
- area: `G3`
- severity: `P2`
- title: Nearby location lookup can remain busy when emulator GPS does not return a current fix
- build: Android debug build (`apps/mobile`), Metro on `8081`
- environment: Android emulator `emulator-5554`, `expo-location` foreground permission flow
- steps:
  1. Install rebuilt debug APK with `expo-location`.
  2. Open Home and tap `����� �����`.
  3. Allow foreground location permission.
  4. Use an emulator session where `getCurrentPositionAsync()` does not return a current fix quickly, even after `adb emu geo fix`.
- expected:
  - Nearby flow should either use a known coordinate, load nearby branches, or leave busy state with a clear retry/fallback message.
- actual before fix:
  - The card could remain in the busy `���� �����...`/location-request state while waiting for current GPS.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-17):
- Added an 8-second current-location timeout and fallback to `Location.getLastKnownPositionAsync()`.
- If no current or last-known position is available, Home now exits busy state and shows the explicit unavailable-location fallback with retry CTA.
- Added regression coverage for current GPS failure falling back to last-known coordinates.
- Evidence: `apps/mobile/lg007_after_tap.png`, `apps/mobile/lg007_after_allow_30s.png`, `apps/mobile/lg007_final_nearby.png`.
- Verification: `corepack pnpm -C apps/mobile test --runInBand src/__tests__/screens/HomeScreen.test.tsx` (`13/13`) and `corepack pnpm -C apps/mobile typecheck`.

Physical verification note (2026-06-17):
- Rebuilt ARM64 debug APK and installed on Android device `8231be4e2ca4`.
- PASS: real GPS permission/coordinate flow completed and `/api/branches/nearby?lat=40.524387&lon=72.7981101&limit=5&radiusKm=20` returned success.
- PASS: nearby UI rendered ranked results (`Manly` `1.4 ��`, `�����` `2.1 ��`, `Low Fade`) and nearby branch tap opened booking step 1 with `Manly �����������`.
- Evidence: `apps/mobile/lg007_physical_permission.xml`, `apps/mobile/lg007_physical_after_allow.png`, `apps/mobile/lg007_physical_after_allow.xml`, `apps/mobile/lg007_physical_branch_tap.xml`.
### MB-035
- id: `MB-035`
- date: `2026-06-08`
- area: `H1`
- severity: `P1`
- title: Owner dashboard query failure is shown as a non-owner state
- build: Expo dev (`apps/mobile`)
- environment: dashboard data hook and screen-state audit
- steps:
  1. Open the owner dashboard.
  2. Make the owner or business query fail.
- expected:
  - Dashboard shows a load error with retry.
- actual before fix:
  - Failed owner lookup produced `isOwner: false`.
  - The screen incorrectly told the user they were not a business owner.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Owner lookup now throws Supabase query errors instead of silently treating them as `false`.
- Dashboard exposes a dedicated `Не удалось загрузить кабинет бизнеса` state with retry.
- Refresh cleanup now uses `finally`, preventing a stuck refreshing state.


### MB-036
- id: `MB-036`
- date: `2026-06-08`
- area: `H1`
- severity: `P1`
- title: Owner business management button does nothing
- build: Expo dev (`apps/mobile`)
- environment: dashboard widget source audit
- steps:
  1. Open the owner dashboard with at least one business.
  2. Tap `Управление`.
- expected:
  - A real management destination opens.
- actual before fix:
  - The handler only evaluated `void navigation`; no navigation or external action occurred.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Replaced the dead action with `Открыть веб-кабинет`.
- The action opens the existing `https://kezek.kg/select-business` owner flow.
- Added a browser-open failure alert and targeted regression coverage.


### MB-037
- id: `MB-037`
- date: `2026-06-08`
- area: `C6`
- severity: `P0`
- title: Network failure prevents logout and account switching
- build: Expo dev (`apps/mobile`)
- environment: Android emulator with unavailable Supabase network
- steps:
  1. Sign in to the mobile app.
  2. Lose network access to Supabase.
  3. Tap `Выйти из аккаунта`.
- expected:
  - Local session is cleared and the app returns to Sign-in, allowing another account to be used.
- actual before fix:
  - `supabase.auth.signOut()` failed before removing the persisted local session.
  - Dev build displayed `TypeError: Network request failed` and kept the previous account active.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Added shared `signOutSafely()` for Cabinet and Profile.
- Normal online logout still revokes the remote session.
- If remote logout fails or hangs, the helper removes the persisted local session and emits Supabase `SIGNED_OUT`.
- Added a recovery logout action to the Cabinet `Пользователь не найден` state, where the normal footer action is unavailable.
- Regression coverage verifies normal logout, rejected network request, returned auth error, timeout fallback, and missing-user recovery UI.

Live verification (2026-06-08):
- Android emulator network proxy was disabled to reproduce the unavailable Supabase path.
- Remote sign-out timed out; the local fallback logged `Remote sign-out failed; clearing local session`.
- Root navigation received `SIGNED_OUT` and returned to the Sign-in screen within the expected timeout.


### MB-038
- id: `MB-038`
- date: `2026-06-08`
- area: `H1`
- severity: `P1`
- title: Owner web-cabinet action opens without authentication
- build: Expo dev (`apps/mobile`)
- environment: Android emulator, authenticated owner account
- steps:
  1. Open the owner `Бизнес` tab.
  2. Tap `Открыть веб-кабинет`.
- expected:
  - Browser receives the current authenticated session and opens the owner's business workspace.
- actual before fix:
  - Mobile opened `/select-business` directly.
  - The browser had no Supabase web session and rendered `HTTP 401`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- The mobile action now reads the current Supabase session and opens the existing web auth callback.
- Access and refresh tokens are passed in the URL fragment, so they are not sent in the initial HTTP request.
- The callback persists the browser session and redirects to `/select-business`.
- Targeted dashboard tests and mobile typecheck pass.

Live verification (2026-06-08):
- Verified on the Android emulator with an authenticated owner account.
- Browser opened the authorized business selector with `Образ`, `Low Fade`, and `Manly`.
- The previous `HTTP 401` state no longer appeared.


### MB-039
- id: `MB-039`
- date: `2026-06-08`
- area: `H2`
- severity: `P1`
- title: Non-staff users can open root shift routes through deep links
- build: Expo dev (`apps/mobile`)
- environment: Android emulator, authenticated owner-only account
- steps:
  1. Sign in as an owner who is not an active staff member.
  2. Open `kezek://staff/shift-quick` or `kezek://staff/shifts`.
- expected:
  - Staff-only routes reject the role and return to a permitted screen.
- actual before fix:
  - Both root routes were registered for every authenticated user.
  - The protected screen opened and only later rendered a non-staff empty state.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Added a shared `StaffRouteGuard` around both root shift screens.
- The guard waits for role resolution, renders no protected content while pending, and redirects non-staff users to `Main/Home`.
- Role loading now includes the initial user lookup, preventing a premature redirect while the session user is still resolving.
- Added deterministic tab tests for client-only, owner-only, staff-only, and combined roles.

Live verification (2026-06-08):
- Reproduced the unauthorized route on an owner-only account before the fix.
- Post-fix direct attempts to both shift routes returned to `Главная`.
- The owner dashboard remained accessible through `kezek://dashboard`, while `kezek://staff` did not expose the absent staff tab.


### MB-040
- id: `MB-040`
- date: `2026-06-08`
- area: `I1`
- severity: `P1`
- title: Cabinet Russian labels break into clipped narrow columns on mobile widths
- build: Expo dev (`apps/mobile`)
- environment: Android emulator at approximately `360dp` and `411dp`
- steps:
  1. Open the authenticated Cabinet screen.
  2. Use a narrow mobile width with a normal Russian account label and statistics.
- expected:
  - Header, email, overview copy, and metric labels preserve readable word wrapping.
- actual before fix:
  - At `360dp`, the title and email were forced into narrow columns beside the Profile action.
  - Metric labels such as `Предстоящие` and `История` wrapped into broken fragments.
  - At `411dp`, the three-column metric row still clipped `Предстоящие`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Added width-aware Cabinet composition using semantic typography without shrinking text.
- The header and overview metadata stack at `380dp` and below.
- Metrics switch to a `2 + 1` grid at `420dp` and below.
- Long account labels are limited to two lines with middle ellipsis as a final guardrail.

Live verification (2026-06-08):
- Verified corrected Cabinet hierarchy at approximately `360dp`.
- Restarted the activity and verified the standard approximately `411dp` layout separately.
- Russian metric labels and the owner email render without character-level wrapping or clipping.


### MB-041
- id: `MB-041`
- date: `2026-06-08`
- area: `I2`
- severity: `P1`
- title: Bright and disabled CTA colors do not preserve readable contrast
- build: Expo dev (`apps/mobile`)
- environment: semantic theme/Button audit and Android emulator
- steps:
  1. Inspect WhatsApp, Telegram, danger, and disabled CTA states.
  2. Compare text/background pairs using WCAG relative luminance.
- expected:
  - Normal CTA labels meet at least `4.5:1`.
  - Disabled controls remain visibly disabled while keeping labels recognizable.
- actual before fix:
  - White on WhatsApp green measured `1.98:1`.
  - White on danger red measured `3.76:1`.
  - Telegram blue on its tinted surface measured `4.47:1`.
  - Global disabled opacity `0.5` made several labels nearly disappear.
  - Tertiary text on cards measured `3.67:1`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Added dedicated dark text tokens for WhatsApp and danger CTA surfaces.
- Brightened Telegram CTA text while preserving the brand hue.
- Raised tertiary text contrast and increased disabled opacity from `0.5` to `0.7`.
- Cabinet status badges now use dark inverse text on bright semantic status colors.
- Added `themeContrast.test.ts` to prevent semantic contrast regressions.

Live verification (2026-06-08):
- Primary gradient CTA remained clear on Home.
- Disabled booking CTA remained recognizable and visually inactive.
- Danger action in the booking cancellation dialog rendered clearly with dark text.
- Exact auth-brand contrast pairs were verified by the automated contrast contract and existing auth screen suites.


### MB-042
- id: `MB-042`
- date: `2026-06-08`
- area: `I3`
- severity: `P1`
- title: Shared UI primitives expose inconsistent loading, error, and feedback behavior
- build: Expo dev (`apps/mobile`)
- environment: component contract audit, Jest, Android emulator
- steps:
  1. Show a second Toast while the first Toast is still visible.
  2. Render an Input with an error or readonly state and inspect its accessibility state.
  3. Compare OfflineBanner with other feedback banners.
  4. Render the global ErrorDisplay in the dark application theme.
- expected:
  - A replacement Toast receives a full display duration.
  - Loading and invalid states are consistently announced and block unsafe interaction.
  - Feedback banners share the same layout, actions, and accessibility behavior.
  - Global error surfaces use semantic application theme tokens.
- actual before fix:
  - Toast did not restart its timer when its message changed while already visible.
  - Input error state was visual only and was not exposed as invalid.
  - MotionPressable could overwrite its merged disabled accessibility state through prop ordering.
  - OfflineBanner duplicated the feedback layout and lacked the common announcement behavior.
  - ErrorDisplay used hardcoded light-theme colors.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Toast now restarts its animation and timeout when message or type changes.
- Input merges caller accessibility state with readonly/invalid state and announces errors.
- MotionPressable preserves the computed disabled state.
- OfflineBanner now composes FeedbackBanner and keeps a consistent retry action.
- FeedbackBanner close actions have explicit accessibility labels and hints.
- Card forwards native semantic properties such as `testID` and `accessibilityLabel`.
- ErrorDisplay now uses semantic dark-theme colors.
- Added UI primitive behavior tests and extended theme/encoding smoke coverage.

Verification (2026-06-08):
- PASS: cold-start Home, discovery cards, Cabinet, and Profile primitives checked on Android emulator.
- PASS: component behavior contract tests (`6/6`).
- PASS: full mobile test suite (`28/28` suites, `129/129` tests).
- PASS: mobile typecheck and `git diff --check`.
- Network-toggle limitation: the API 35 emulator retained a virtual validated network in airplane mode, so the offline transition was covered by automated component and network tests rather than claimed as a live transition.


### MB-043
- id: `MB-043`
- date: `2026-06-08`
- area: `I4`
- severity: `P1`
- title: Dark mobile screens render unreadable dark system status-bar icons
- build: Expo development build (`apps/mobile`)
- environment: clean Android API 35 AVD at approximately `360dp` and `412dp`
- steps:
  1. Open the Sign-in or Home screen with the dark application shell.
  2. Inspect Android status-bar icons and compare them with the page background.
- expected:
  - System status/navigation content remains readable and matches the dark application theme.
- actual before fix:
  - `app.json` forced `userInterfaceStyle: light`.
  - runtime StatusBar used `style="auto"`.
  - Android rendered dark clock/network/battery icons over the dark header background.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-08):
- Runtime StatusBar now explicitly uses light content and the semantic page background.
- Native appearance is configured as dark.
- Splash and Android adaptive-icon backgrounds now match the dark application shell.
- Phone placeholders were changed to a neutral format so visual baselines contain no personal-looking number.
- Added clean `360dp`, `412dp`, and WhatsApp-entry visual baselines plus artifact/CTA-order tests.

Live verification (2026-06-08):
- Auth shell renders fully on both target widths with no clipped text or CTA.
- Google, Telegram, and WhatsApp hierarchy matches the established auth design contract.
- Light system icons are visible after the runtime fix.
- WhatsApp entry remains readable and contains no account or real phone data.
- Full mobile suite passes (`30/30` suites, `135/135` tests); typecheck and `git diff --check` pass.


### MB-044
- id: `MB-044`
- date: `2026-06-09`
- area: `J1`
- severity: `P0`
- title: Critical API failures can leak technical messages or be falsely reported as queued
- build: Expo development build (`apps/mobile`)
- environment: source audit, Jest, Android `emulator-5554`
- steps:
  1. Make profile, booking, auth, or shift API calls fail with messages such as `Network request failed`, `HTTP 500`, or an internal English exception.
  2. While offline, make a shift action fail and also make SecureStore reject the offline-queue write.
- expected:
  - Users receive understandable, action-oriented Russian messages.
  - A critical action is only reported as queued after durable local persistence succeeds.
- actual before fix:
  - Shared `getErrorMessage()` returned raw `error.message`.
  - Multiple critical mutations displayed server/SDK text directly.
  - `addToOfflineQueue()` logged and swallowed SecureStore failures, allowing the mutation to return `{ queued: true }` even though the action was lost.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-09):
- Added centralized safe mapping for network, timeout, authorization, permission, not-found, validation, conflict, rate-limit, and server failures.
- Preserved safe localized server validation messages while hiding technical implementation details.
- Applied action-specific fallbacks to profile, booking, OTP, Telegram, WhatsApp, and shift flows.
- Global ErrorDisplay now hides technical runtime messages outside explicit environment-configuration errors.
- Offline shift queue persistence now throws on storage failure; the form remains open and shows an understandable error instead of a false success.

Live verification (2026-06-09):
- Disabled emulator connectivity and triggered a real Home search request.
- UI showed `Нет подключения к интернету` with retry/recovery guidance and no raw exception.
- Re-enabled connectivity and confirmed `kezek.kg` was reachable again.

Automated verification (2026-06-09):
- Error mapping contract covers major HTTP/network categories and safe localized messages.
- Shift regression test proves failed SecureStore persistence does not create or announce a queued operation.
- Full mobile suite and TypeScript typecheck pass.


### MB-045
- id: `MB-045`
- date: `2026-06-09`
- area: `J2`
- severity: `P1`
- title: Permanent failures are retried and repeated actions can bypass idempotency safeguards
- build: Expo development build (`apps/mobile`)
- environment: source audit, Jest, Android `emulator-5554`
- steps:
  1. Return a permanent `400`, `403`, `404`, `422`, or domain validation error from a query.
  2. Start a WhatsApp send/verify request, lose the response, and retry the same logical action.
  3. Queue identical shift actions or several consecutive full item snapshots while offline.
- expected:
  - Only transient failures are retried.
  - Retrying the same logical action reuses its idempotency identity.
  - Offline replay does not contain redundant operations that can duplicate effects.
- actual before fix:
  - Global query policy retried every failure except unauthorized errors.
  - WhatsApp generated a new idempotency key for every retry.
  - Shift offline storage appended duplicate actions and obsolete consecutive item snapshots.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-09):
- Added a centralized retry classifier for network, timeout, `408`, `425`, `429`, and `5xx` failures with a two-retry limit.
- Permanent client and domain errors now fail immediately.
- WhatsApp send and verify flows retain the same idempotency key while their logical input remains unchanged.
- Shift offline queue now removes exact adjacent duplicates and retains only the latest consecutive full item snapshot without crossing open/close boundaries.

Live verification (2026-06-09):
- With emulator connectivity disabled, a fresh Home search reached the expected user-visible error state.
- After restoring connectivity, a retry loaded `Low Fade` results and removed the error state.
- Emulator was left online with airplane mode disabled.

Automated verification (2026-06-09):
- Added retry-policy, stable-idempotency, WhatsApp retry, and shift-queue compaction regressions.
- PASS: full mobile suite (`34/34` suites, `162/162` tests).
- PASS: TypeScript typecheck and `git diff --check`.


### MB-046
- id: `MB-046`
- date: `2026-06-09`
- area: `J3`
- severity: `P1`
- title: Foreground return does not notify React Query, leaving booking availability stale
- build: Expo development build (`apps/mobile`)
- environment: source audit, Jest, Android `emulator-5554`
- steps:
  1. Open a query-backed screen, especially booking time selection.
  2. Send the app to background while external changes can make cached data stale.
  3. Return to the app.
- expected:
  - The active app state is propagated to the query cache.
  - Stale active queries, especially free booking slots, refresh after foreground.
  - Auth and in-memory booking state remain intact.
- actual before fix:
  - `AppState` synchronized the auth session but was not connected to TanStack Query's focus manager.
  - Global `refetchOnWindowFocus` was disabled.
  - Booking slot data inherited the global five-minute stale window and could remain outdated after an interrupted flow.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-09):
- Added a central React Native AppState-to-TanStack Query focus bridge.
- Enabled stale-query refresh on foreground while retaining the global five-minute freshness window.
- Booking slot queries now use `staleTime: 0` and refresh whenever the app returns active.
- Added regressions for lifecycle subscription cleanup, actual stale-query refetch, and auth session sync on resume.

Live verification (2026-06-09):
- Home search input `j3state` survived launcher background and app reopen.
- Low Fade booking remained on step `2/6` after interruption.
- The selected service remained active and the Next action stayed enabled.
- The authenticated session remained available after each foreground transition.

Automated verification (2026-06-09):
- Targeted lifecycle/navigation suites pass (`3/3` suites, `18/18` tests).
- Full mobile suite passes (`35/35` suites, `166/166` tests).
- TypeScript typecheck and `git diff --check` pass.


### MB-047
- id: `MB-047`
- date: `2026-06-09`
- area: `K1`
- severity: `P1`
- title: Compact critical actions have touch targets below the practical 44dp minimum
- build: Expo development build (`apps/mobile`)
- environment: source audit, UIAutomator bounds, Android `emulator-5554`
- steps:
  1. Open booking step `2/6` and inspect the close action and progress-step controls.
  2. Open Home, enter search text, and inspect the clear action, recent-place chips, and category filters.
  3. Review compact filters and icon actions used by booking, feedback, and shift screens.
- expected:
  - Critical actions have a practical touch target of at least `44x44dp`.
  - Compact icon controls remain visually balanced and have meaningful accessibility labels.
- actual before fix:
  - Booking close was approximately `40dp`.
  - Booking progress dots exposed a clickable area near their `12-16dp` visual size.
  - Home search clear was approximately `28dp`.
  - Recent-place and multiple filter/chip controls were approximately `32-36dp` high.
  - Several compact icon controls did not expose action-specific labels.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-09):
- Added shared `MIN_TOUCH_TARGET = 44`.
- Applied it to booking close/progress, feedback close, search clear, Home chips/actions, booking branch/staff/time controls, and shift period filters.
- Added explicit labels for booking close and search clear.
- Added a regression contract covering the shared minimum and all critical compact-action source paths.

Live verification (2026-06-09):
- Booking close and progress controls measured at least `44dp`.
- Booking CTA controls remained larger than `44dp`.
- Home clear measured `44x44dp`.
- Recent-place and category chips measured at least `44dp` high.

Automated verification (2026-06-09):
- Targeted suites pass (`5/5` suites, `36/36` tests).
- Full mobile suite passes (`36/36` suites, `176/176` tests).
- TypeScript typecheck and `git diff --check` pass.


### MB-048
- id: `MB-048`
- date: `2026-06-09`
- area: `K2`
- severity: `P1`
- title: Auth and shared status surfaces expose incomplete screen-reader announcements
- build: Expo development build (`apps/mobile`)
- environment: rendered React Native tests, Android `emulator-5554`, UIAutomator semantic tree
- steps:
  1. Start Google, Telegram, or WhatsApp authentication and inspect changing status/error semantics.
  2. Inspect shared loading and empty-state components with accessibility tooling.
  3. Open Cabinet and inspect tabs and booking actions in the Android semantic tree.
- expected:
  - Dynamic auth states are announced with appropriate polite or assertive priority.
  - Errors expose alert semantics.
  - Loading, inputs, tabs, and actionable controls have meaningful localized labels and states.
  - Grouped empty-state content does not hide its nested action.
- actual before fix:
  - Google auth state changes had no dedicated live region.
  - Telegram and WhatsApp failures lacked consistent alert semantics.
  - WhatsApp OTP input relied on its placeholder instead of an explicit label.
  - Shared loading state exposed no progress or busy semantics.
  - Cabinet tabs and booking hints contained English accessibility copy.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-09):
- Added polite/assertive Google auth announcements and alert semantics for auth failures.
- Added an explicit WhatsApp OTP label.
- Added progressbar/busy/live-region semantics to the shared loading component.
- Grouped empty-state summary content separately so actions remain focusable.
- Localized Cabinet tab labels and booking action hints.

Live verification (2026-06-09):
- Android UIAutomator exposed focusable `Профиль`, `Предстоящие записи`, and `История записей` nodes.
- The active `Предстоящие записи` tab exposed its selected state.
- Auth transitions and their live-region priority were exercised in rendered flow tests while preserving the active authenticated emulator session.

Automated verification (2026-06-09):
- Targeted accessibility suites pass (`4/4` suites, `32/32` tests).
- Full mobile suite passes (`36/36` suites, `181/181` tests).
- TypeScript typecheck and `git diff --check` pass.


### MB-049
- id: `MB-049`
- date: `2026-06-09`
- area: `K3`
- severity: `P2`
- title: Form screens lack consistent keyboard avoidance and focus progression
- build: Expo development build (`apps/mobile`)
- environment: Android `emulator-5554`, source audit, rendered React Native tests
- steps:
  1. Focus Home search, Profile fields, WhatsApp/verify code fields, or the Shift add-client form.
  2. Keep the software keyboard open and attempt to move between fields, scroll to lower inputs, or press a form action.
  3. Inspect Android keyboard resize configuration and ScrollView keyboard interaction props.
- expected:
  - Focus moves predictably through multi-field forms.
  - Active inputs and actions remain reachable above the keyboard.
  - The first action tap is not consumed only to dismiss the keyboard.
  - Dragging a form or search screen can dismiss the keyboard.
- actual before fix:
  - Shared `Input` did not forward refs, preventing reliable focus chaining.
  - Long form screens had no keyboard-aware container.
  - Form ScrollViews did not preserve taps or define drag dismissal.
  - Android keyboard resize behavior was implicit rather than configured.
  - Search and OTP inputs did not consistently expose useful IME submit actions.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-09):
- Added native ref forwarding to the shared `Input`.
- Added Android `resize` keyboard layout mode.
- Added keyboard-aware scrolling, keyboard insets, tap persistence, and drag dismissal to form screens.
- Added next/done focus chains for Profile and Shift client forms.
- Added IME submit handling for Home search and auth code/phone inputs.
- Added automatic scroll-to-active-field behavior to the long Shift client form.

Live verification (2026-06-09):
- Home search stayed above the open IME and clear worked on the first tap.
- Home drag dismissed the keyboard.
- Profile IME Next transferred native focus from `Имя` to `Телефон`.
- The focused phone field remained inside the resized visible app viewport.

Automated verification (2026-06-09):
- Keyboard UX contract passes (`1/1` suite, `7/7` tests).
- Related targeted suites pass (`6/6` suites, `38/38` tests).
- Full mobile suite passes (`37/37` suites, `188/188` tests).
- TypeScript typecheck and `git diff --check` pass.


### MB-050
- id: `MB-050`
- date: `2026-06-09`
- area: `L1`
- severity: `P1`
- title: Booking entry delays first meaningful paint with duplicate and unnecessary initial queries
- build: Expo development build (`apps/mobile`)
- environment: Android `emulator-5554`, UIAutomator, `dumpsys gfxinfo`, source audit
- steps:
  1. Open an uncached business from Home.
  2. Observe the booking loading surface and inspect the initialization queries.
  3. Compare the parent Booking loader with the Step 1 business/branch loader.
- expected:
  - Booking immediately paints recognizable business and flow context.
  - Step 1 blocks only on data required to select a branch.
  - The same business/branch data is not fetched twice.
- actual before fix:
  - Booking initialization waited for business, branches, services, staff, and promotions.
  - Services and staff were later fetched again for their branch-specific steps.
  - Step 1 launched another independent business/branch query.
  - The transition swapped a generic full-screen loader for the full Step 1 layout.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-09):
- Reduced the first booking query to business and active branches only.
- Moved promotions to a non-blocking background query.
- Passed prepared data directly into Step 1 to prevent the duplicate query.
- Added route preview data and a recognizable booking loading shell.
- Added source-level perceived-performance contracts for the critical query path.

Live verification (2026-06-09):
- An uncached `Manly` flow displayed the business name, `Шаг 1 из 6`, and loading status while network access was disabled.
- Restoring network completed the same screen with branch controls and the next action.
- No blank or frozen booking surface was observed.
- Dev frame sample improved from `14/75` to `8/51` janky frames after critical-path reduction.

Environment note:
- `am start` cold/warm values describe Expo Dev Launcher rather than production FMP.
- The current dev client uses React Native Legacy Architecture on a 1440x3120 emulator; release-build frame profiling remains required for a final production jank budget.

Automated verification (2026-06-09):
- Targeted performance/navigation suites pass (`5/5` suites, `23/23` tests).
- Full mobile suite passes (`38/38` suites, `192/192` tests).
- TypeScript typecheck and `git diff --check` pass.

### MB-051
- id: `MB-051`
- date: `2026-06-09`
- area: `L1`
- severity: `P1`
- title: Release Booking transition still exceeds the provisional jank budget
- build: local standalone Android release (`Hermes`, embedded JS bundle, non-debuggable)
- environment: Android `emulator-5554`, Pixel 7 Pro image, `1440x3120 @ 560dpi`, 60Hz
- steps:
  1. Force-stop and start the standalone release app.
  2. Wait for Home to settle.
  3. Reset `dumpsys gfxinfo kg.kezek.app`.
  4. Open the `Low Fade` booking flow from Home.
  5. Collect frame statistics after Step 1 renders.
- expected:
  - Critical transitions stay visually stable with a low janky-frame ratio.
  - Release performance materially improves over the development client.
- actual:
  - cold startup is fast: median `512ms`, average `522ms`, range `498-571ms`;
  - first release Booking sample: `8/71` janky frames (`11.27%`), p95 `46ms`, p99 `53ms`;
  - three fresh-process Booking repeats: `9/49` (`18.37%`), `11/50` (`22.00%`), and `9/52` (`17.31%`);
  - p95 remained `53-61ms` in fresh-process repeats;
  - no blank screen, crash, or frozen transition was observed.
- status: `verified`
- owner: `Codex + User`

Notes:
- The emulator renders at `1440x3120`, which can amplify GPU cost, so a representative physical Android device remains the closure gate.
- Startup/FMP is accepted; this bug is limited to transition smoothness.
- The release build exposed two Windows/monorepo build issues that were fixed:
  - Metro now keeps `apps/mobile` as its project root while watching the workspace, with a workspace entry bridge and explicit Babel dependencies;
  - pnpm virtual-store directory names are shortened to avoid CMake object-path failures.

Physical-device update (2026-06-10):
- Device: Xiaomi Mi A3, Android 11, `arm64-v8a`, `720x1560 @ 320dpi`.
- Corrected standalone release starts without Metro and remains foregrounded.
- Five cold starts: `836ms`, `335ms`, `396ms`, `401ms`, `431ms`; median `401ms`, average `479.8ms`.
- Five warm resumes: `142ms`, `112ms`, `105ms`, `103ms`, `95ms`; median `105ms`, average `111.4ms`.
- Cold-start frame sample: `5/35` janky frames (`14.29%`), median `6ms`, p90 `36ms`; the long frames are confined to process initialization.
- Authenticated warm-process Home -> Booking samples:
  - `26/191` (`13.61%`), p95 `24ms`, p99 `46ms`;
  - `3/38` (`7.89%`), p95 `29ms`, p99 `38ms`;
  - `5/35` (`14.29%`), p95 `25ms`, p99 `36ms`;
  - `7/38` (`18.42%`), p95 `21ms`, p99 `32ms`;
  - `5/36` (`13.89%`), p95 `25ms`, p99 `38ms`.
- Three validated fresh-process Home -> Booking samples:
  - `12/70` (`17.14%`), p95 `28ms`, p99 `53ms`;
  - `9/67` (`13.43%`), p95 `24ms`, p99 `57ms`;
  - `14/69` (`20.29%`), p95 `29ms`, p99 `53ms`.
- All validated transitions reached `Шаг 1 из 6` without a blank screen, crash, or frozen surface.
- Physical-device p95 materially improves over the emulator (`24-29ms` vs `53-61ms`), but fresh-process median jank remains `17.14%`; `MB-051` stays open for transition optimization.

Resolution note (2026-06-10):
- Added atomic initial booking-context hydration so business, branches, and the single-branch selection are committed in one state update instead of three consecutive updates.
- Deferred the non-critical promotions query with `InteractionManager.runAfterInteractions`.
- Disabled the native stack animation for the heavy Home -> Booking transition after a measured `fade` experiment reduced the jank ratio but worsened the long-frame tail.
- Preserved the recognizable loading shell and all Booking Step 1 behavior.

Post-fix physical verification (2026-06-10):
- Device and build remained unchanged: Xiaomi Mi A3, Android 11, standalone ARM64 Hermes release.
- Five validated fresh-process Home -> Booking samples:
  - `5/80` (`6.25%`), p95 `46ms`, p99 `73ms`;
  - `5/68` (`7.35%`), p95 `46ms`, p99 `89ms`;
  - `5/64` (`7.81%`), p95 `34ms`, p99 `121ms`;
  - `5/68` (`7.35%`), p95 `40ms`, p99 `81ms`;
  - `5/69` (`7.25%`), p95 `32ms`, p99 `101ms`.
- Median jank improved from `17.14%` to `7.35%` (`57.1%` relative reduction); average is `7.20%`.
- All five transitions reached `Шаг 1 из 6`; no blank screen, crash, frozen surface, or navigation regression occurred.
- The provisional transition budget is met, so `MB-051` is closed as `verified`.

Automated verification (2026-06-10):
- Targeted Booking/performance suites pass (`3/3` suites, `12/12` tests).
- Full mobile suite passes (`38/38` suites, `193/193` tests).
- TypeScript typecheck and `git diff --check` pass.

### MB-052
- id: `MB-052`
- date: `2026-06-10`
- area: `L1`
- severity: `P0`
- title: Release APK crashes on ARM64 because Expo native library is packaged only for x86_64
- build: local standalone Android release (`Hermes`, embedded JS bundle, non-debuggable)
- environment: Xiaomi Mi A3, Android 11, `arm64-v8a`
- steps:
  1. Install the release APK on an ARM64 physical Android device.
  2. Start `kg.kezek.app/.MainActivity`.
  3. Observe process state and `logcat`.
- expected:
  - App stays foregrounded and renders the first screen without Metro.
- actual before fix:
  - Activity was displayed and immediately force-finished.
  - `logcat` reported `SoLoaderDSONotFoundError: couldn't find DSO to load: libexpo-modules-core.so`.
  - JS initialization then failed with `TypeError: Cannot read property 'EventEmitter' of undefined`.
  - APK inspection showed `libexpo-modules-core.so` only under `lib/x86_64`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-10):
- Restored the generated Android architecture list to `armeabi-v7a,arm64-v8a,x86,x86_64`.
- Rebuilt the physical-device release explicitly with `-PreactNativeArchitectures=arm64-v8a` and Android Studio JBR 21.
- Verified the corrected APK contains `libexpo-modules-core.so`, `libhermes.so`, and `libreactnative.so` under `lib/arm64-v8a`.
- Reinstalled the APK and confirmed the process remains alive, `MainActivity` stays resumed, Sign-in renders, and crash log is clean.

### MB-053
- id: `MB-053`
- date: `2026-06-10`
- area: `L3`
- severity: `P2`
- title: Home business feed renders an unpaginated list without virtualization
- build: standalone Android release (`apps/mobile`, Hermes, embedded bundle)
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro profile, `x86_64`, `1440x3120 @ 560dpi`
- steps:
  1. Return a large business collection from `/api/mobile/businesses`.
  2. Open Home and scroll through the complete business feed.
  3. Inspect network requests, native View count, memory, and frame statistics.
- expected:
  - businesses load incrementally;
  - only a bounded visible window is mounted;
  - reaching the end requests the next page once and stops after the final page;
  - long lists do not crash, freeze, duplicate rows, or grow memory without a bound.
- actual before fix:
  - Home used a root `ScrollView` and rendered all businesses with `businesses.map(...)`;
  - the API always applied `.limit(50)` and exposed no page or cursor controls;
  - lists beyond the first 50 businesses were inaccessible, while every returned card was mounted at once.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-10):
- Replaced the Home business feed with a top-level `FlatList` and kept existing page sections in `ListHeaderComponent`.
- Added bounded rendering batches, clipping, a balanced five-screen window, memoized business cards, and lighter list-card elevation.
- Added `useInfiniteQuery` page loading with id deduplication and repeated-page protection for compatibility with an older unpaginated server.
- Added bounded `page`/`limit` parsing to the mobile businesses API and Supabase range pagination.

Live verification (2026-06-10):
- A temporary release-only fixture exposed `200` realistic business cards in pages of `20`.
- The app requested pages `1-11`; pages `1-10` supplied all `200` rows and page `11` stopped the sequence.
- UIAutomator reached the final visible rows (`Load 198-200`).
- No duplicate request loop, crash, ANR, OOM, blank list, or stuck loading footer occurred.
- Stress memory remained bounded at approximately `129.0-144.2 MB` PSS with one Activity and zero WebViews.
- Emulator jank under aggressive command-driven swipes remained `26-29%`; this is recorded as an AVD limitation rather than hidden as a pass-quality production frame metric.

Supplemental emulator live verification (`LG-010`, 2026-06-19):
- Rebuilt a standalone `x86_64` release and installed it on Pixel 7 Pro API 35 (`emulator-5554`, `1440x3120 @ 560dpi`).
- A controlled local API fixture served `200` rows in pages of `20`; Home fetched pages `1-10`, displayed `Load 198-200`, requested empty page `11`, and stopped pagination.
- The UIAutomator tree remained bounded at `92` nodes near the start and `104` nodes at the final rows, confirming that all `200` cards were not mounted together.
- PSS moved from `111472 KB` before the heavy scroll to `152898 KB` after all rows were accumulated; Android reported `1` Activity and `0` WebViews.
- Frame timeline reported `1064` rendered frames, `9` modern janky frames (`0.85%`), with p50/p90/p95/p99 of `20/23/24/29 ms`.
- No crash, ANR, OOM, duplicate-page loop, blank list, or stuck loading state occurred.
- The emulator rerun is accepted as supplemental evidence; the preferred low/mid-range physical-device smoothness gate was subsequently closed below.

Physical-device live verification (`LG-010`, 2026-06-19):
- Installed a controlled ARM64 release on Xiaomi Mi A3 (`8231be4e2ca4`), Android 11, `720x1560 @ 320dpi`, with `adb reverse` access to the 200-row fixture.
- Home fetched pages `1-10`, displayed `Load 198-200`, requested empty page `11`, and stopped without duplicates or a stuck loading footer.
- The active UI tree stayed bounded at `97` nodes near the first cards and `95` nodes at the final rows.
- PSS moved from `141928 KB` to `153935 KB` during the full load and returned to `142448 KB` after a repeat 20+20 swipe cycle, showing cache reclamation instead of a sustained upward slope.
- First-pass frame stats: `2832` frames, `97` janky (`3.43%`), p50/p90/p95/p99 `6/11/14/20 ms`.
- Repeat-pass frame stats: `2862` frames, `76` janky (`2.66%`), p50/p90/p95/p99 `6/12/14/20 ms`.
- No crash, ANR, OOM, process death, blank list, duplicate-page loop, or stuck pagination state occurred.
- Conclusion: PASS; `LG-010` is closed for the current Android baseline.

Automated verification (2026-06-10):
- Mobile Home tests cover `FlatList` usage and page-2 loading.
- Web service/HTTP tests cover pagination range and request delegation.
- Mobile and web typechecks pass.
- `git diff --check` passes.

### MB-054
- id: `MB-054`
- date: `2026-06-11`
- area: `M1`
- severity: `P0`
- title: Auth callback secrets can appear in development logs
- build: mobile source audit + standalone Android release (`Hermes`, embedded bundle)
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro API 35, `x86_64`
- steps:
  1. Open an auth callback containing OAuth `code`, access token, or refresh token values.
  2. Inspect development logger call sites and shared sanitization behavior.
  3. Inspect app-process logs and visible UI during callback handling.
- expected:
  - auth credentials never appear in plain text in application logs, debug output, or visible error surfaces;
  - callback URL structure may be logged only after sensitive values and fragments are removed.
- actual before fix:
  - root navigation passed the raw callback URL into debug and warning logs;
  - key-based sanitization did not redact secrets embedded inside arbitrary URL/error strings;
  - custom-scheme URL masking did not classify the OAuth `code` parameter as sensitive.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-11):
- Routed every root auth-callback URL log through `maskUrl`.
- Added centralized free-form string redaction for bearer credentials, JWTs, token assignments, OAuth codes, nonces, OTPs, and API keys.
- Updated custom-scheme URL masking to drop fragments and redact sensitive query parameters.
- Added regression coverage for debug and production logger behavior.

Live verification (2026-06-11):
- Rebuilt and installed the standalone x86_64 release.
- Cold-started `kg.kezek.app` with a `kezek://auth/callback` intent containing unique query, access-token, and refresh-token sentinels.
- App-process `logcat`, the UIAutomator hierarchy, and the visible Sign-in screen contained none of the sentinels or raw auth values.
- The app remained resumed and displayed no debug/error overlay.

Provider live verification (`LG-009`, 2026-06-18):
- Rebuilt a clean ARM64 release APK for the physical Mi A3 after the previously cached APK was missing `arm64-v8a/libexpo-modules-core.so` and crashed before UI.
- Installed on Android device `8231be4e2ca4` and completed Google account auth, native Telegram bot confirmation, and WhatsApp auth/session restoration.
- Collected app-process `logcat` and UIAutomator dumps for each provider completion.
- Local scans found no JWT-like values, OAuth codes, access/refresh/id tokens, callback fragments, OTPs, UUID session keys, or token-bearing key assignments.
- No visible UI state exposed codes, tokens, or auth callback values.

Automated verification (2026-06-11):
- Log safety and root callback suites pass (`2/2` suites, `14/14` tests).
- Mobile and web TypeScript typechecks pass.
- `git diff --check` passes.

### MB-055
- id: `MB-055`
- date: `2026-06-11`
- area: `M2`
- severity: `P1`
- title: Logout leaves sensitive auth-flow and user cache data in SecureStore
- build: standalone Android release (`Hermes`, embedded bundle)
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro API 35, `x86_64`
- steps:
  1. Authenticate and populate session/offline state.
  2. Inspect SecureStore metadata before logout.
  3. Sign out through the native Profile screen.
  4. Inspect SecureStore and restart the application.
- expected:
  - session tokens are stored only in encrypted platform storage;
  - logout clears session tokens, pending auth state, personal offline data, and user-scoped memory caches;
  - restarting after logout cannot restore the previous session.
- actual before fix:
  - Supabase tokens were correctly stored through SecureStore;
  - network fallback depended directly on private Supabase `_removeSession`;
  - Google/Telegram/WhatsApp pending state, booking cache, shift cache/queue, and React Query data were not cleared by logout.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-11):
- Extracted the chunked Supabase SecureStore adapter into a dedicated module with removal regression coverage.
- Added public `signOut({ scope: 'local' })` fallback, retaining private removal only for compatibility with older clients.
- Centralized transient auth storage keys.
- Added logout cleanup for pending auth flows, user booking cache, shift offline state, and React Query memory.

Live verification (2026-06-11):
- The release app restored a valid authenticated session after a complete emulator restart.
- Before logout, `SecureStore.xml` contained encrypted Supabase session chunks and shift cache entries; no plain JWT was detected.
- Native logout returned to Sign-in and reduced `SecureStore.xml` to an empty map.
- Force-stop and relaunch stayed on Sign-in, proving the previous session was not restored.

Automated verification (2026-06-11):
- M2 storage/logout core suites pass (`4/4` suites, `13/13` tests).
- Expanded auth/storage regression pack passes (`6/6` suites, `30/30` tests).
- Mobile TypeScript typecheck passes.
- `git diff --check` passes.

### MB-056
- id: `MB-056`
- date: `2026-06-12`
- area: `N1`
- severity: `P1`
- title: Full mobile Jest gate does not exit after all tests pass
- build: mobile automated test infrastructure
- environment: Windows, Jest `29.7.0`, React Query `5.84.2`
- steps:
  1. Run `corepack pnpm -C apps/mobile test:runInBand`.
  2. Wait for all mobile suites and assertions to complete.
  3. Observe the Jest process after the summary.
- expected:
  - all tests pass and the process exits immediately with code `0`;
  - automated CI/release gates do not require an external timeout.
- actual before fix:
  - all `40` suites and `203` tests passed;
  - Jest reported an asynchronous operation that was not stopped and remained alive until the command timeout;
  - `useConfirmBooking.test.tsx` created a standalone QueryClient with the default five-minute garbage-collection timer.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-12):
- Replaced the standalone QueryClient setup with the shared `createTestQueryClient()` helper.
- The helper disables retries and uses infinite test GC time, preventing a real timer from keeping Jest alive.

Post-fix verification (2026-06-12):
- Targeted screen/navigation package passes (`16/16` suites, `89/89` tests).
- Text/theme/UI smoke package passes (`7/7` suites, `42/42` tests).
- Full mobile suite passes and exits normally (`40/40` suites, `203/203` tests).
- Mobile typecheck, UTF-8 validation across `173` source files, and `git diff --check` pass.

### MB-057
- id: `MB-057`
- date: `2026-06-12`
- area: `N2` / `D3`
- severity: `P1`
- title: Cancelling a newly created booking returns to an empty confirmation step
- build: standalone Android release (`Hermes`, embedded bundle)
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro API 35, `x86_64`
- steps:
  1. Complete the six-step booking flow and create a booking.
  2. Open the newly created booking details.
  3. Cancel the booking and confirm the destructive action.
- expected:
  - the cancellation succeeds and the app returns to the Cabinet bookings surface;
  - the completed booking flow is not exposed again after its context has been reset.
- actual before fix:
  - the cancellation succeeded on the server;
  - `BookingDetailsScreen` called `navigation.goBack()`;
  - the previous route was `BookingStep6Confirm`, whose booking context had already been reset after creation;
  - the user saw step `6/6` with empty summary values and an active booking button.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-12):
- Replaced the delayed `goBack()` with a root navigation reset to `Main -> Cabinet -> CabinetMain`.
- Added a screen regression test that performs cancellation and asserts the exact Cabinet reset route.

Live post-fix verification (2026-06-12):
- Rebuilt and installed the standalone x86_64 release while preserving the authenticated session.
- Repeated branch, service, staff, date, time, confirmation, creation, details, and cancellation steps.
- Cancellation returned directly to the synchronized Cabinet screen.
- No empty booking confirmation screen remained in the active stack.

Automated verification (2026-06-12):
- `BookingDetailsScreen` suite passes (`1/1` suite, `5/5` tests).
- Mobile TypeScript typecheck passes.

### MB-058
- id: `MB-058`
- date: `2026-06-15`
- area: `N3` / `E1`
- severity: `P2`
- title: Cabinet hero switches to two columns too early on a 412dp device
- build: standalone Android release (`Hermes`, embedded bundle)
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro API 35, `1080x2400 @ 420dpi`
- steps:
  1. Authenticate with an account whose label is a long Telegram email.
  2. Open Cabinet on a 390–412dp wide profile.
  3. Inspect the hero title, account label, and Profile action.
- expected:
  - the account label receives enough horizontal space to remain readable;
  - the Profile action does not force an awkward mid-identifier line break.
- actual before fix:
  - Cabinet used its side-by-side hero layout for every width above `380dp`;
  - at approximately `412dp`, the Profile button consumed nearly half of the row;
  - `telegram_634038083@telegram.local` broke into `telegram` and `_634038083@telegram.local`.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-15):
- Added an explicit Cabinet stacked-header breakpoint through `420dp`.
- The Profile action now becomes full-width on 360–412dp mobile profiles.
- Widths above `420dp` retain the existing side-by-side presentation.

Live post-fix verification (2026-06-15):
- Rebuilt and installed the standalone x86_64 release.
- At 412dp, the complete Telegram label renders on one line above the full-width Profile action.
- At 360dp, the existing stacked layout remains unchanged and no horizontal text overflow is present.
- Home, staff workspace, shift workspace, and Cabinet were visually checked at both target profiles.

Expanded device-matrix verification (`LG-011`, 2026-06-19):
- Physical Xiaomi Mi A3 (`8231be4e2ca4`), Android 11, provided a real `360dp`-wide authenticated Home/Cabinet pass with zero UIAutomator bounds outside the viewport.
- Pixel 7 Pro API 35 covered a compact `320dp` Sign-in profile and a tablet-like `640dp` Sign-in profile; both displayed all provider actions with zero viewport overflow.
- A landscape rotation request was exercised against the declared portrait-only app contract. MainActivity remained resumed, Sign-in remained complete and readable in portrait, and no crash, ANR, OOM, or blank surface occurred.
- No new layout bug was found. `LG-011` is closed for the current Android release scope; iOS coverage remains deferred until iOS becomes a release target.

Automated verification (2026-06-15):
- Cabinet suite passes (`1/1` suite, `8/8` tests).
- Breakpoint regression verifies stacked behavior at `360dp` and `412dp`, and side-by-side behavior from `421dp`.
- Mobile TypeScript typecheck passes.

### MB-059
- id: `MB-059`
- date: `2026-06-16`
- area: `E3` / `J1`
- severity: `P1`
- title: Profile screen can remain indefinitely on loading state during DNS/network failure
- build: Android app (`kg.kezek.app`), current emulator install
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro API 35
- steps:
  1. Use an authenticated app session.
  2. Put the emulator into the observed DNS-broken state where IP connectivity works but hostname resolution fails.
  3. Open `kezek://cabinet/profile`.
  4. Wait at least 35 seconds.
- expected:
  - Profile loading should fail into a user-visible error state such as `Не удалось загрузить профиль`;
  - the user should have a visible retry action;
  - the E3 notification preferences test should be able to continue once connectivity is restored.
- actual:
  - `Profile` route opened successfully;
  - the screen stayed on `Загружаем данные...` for more than 35 seconds;
  - no `Не удалось загрузить профиль` or `Повторить` action appeared;
  - `LG-001` live verification could not reach notification toggles.
- evidence:
  - `apps/mobile/lg001_profile_loading_dns_blocker.png`
  - `apps/mobile/lg001_profile_loading_dns_blocker.xml`
  - logcat showed `TypeError: Network request failed`;
  - emulator network check showed `ping 8.8.8.8` passed while `ping google.com` failed.
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-16):
- Added a Profile-specific timeout wrapper around `supabase.auth.getUser()` and the `profiles` select query.
- Hanging Profile reads now reject with a timeout error instead of keeping the screen in an indefinite loading state.
- Added a regression test for a never-resolving `getUser()` request; Profile renders `Не удалось загрузить профиль` and `Повторить`.

Verification (2026-06-16):
- PASS: `corepack pnpm -C apps/mobile test --runInBand src/__tests__/screens/ProfileScreen.test.tsx` (`9/9` tests).
- PASS: `corepack pnpm -C apps/mobile typecheck`.
- PASS: release APK rebuilt with Android Studio JBR 21 and installed on `emulator-5554`.
- PASS: after emulator DNS recovery, `kezek://cabinet/profile` opened Profile and loaded data normally instead of staying indefinitely on loading.
- evidence:
  - `apps/mobile/lg001_direct_after_install_profile.png`
  - `apps/mobile/lg001_direct_after_install_profile.xml`
### MB-060
- id: `MB-060`
- date: `2026-06-16`
- area: `E3`
- severity: `P1`
- title: Notification preference toggles do not persist after save and relaunch
- build: Android release APK (`kg.kezek.app`)
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro API 35, authenticated Profile screen
- steps:
  1. Open `kezek://cabinet/profile` in an authenticated session.
  2. Toggle both notification preferences off.
  3. Tap `���������`.
  4. Force-stop the app and open `kezek://cabinet/profile` again.
- expected:
  - `Email �����������` and `WhatsApp �����������` remain off after reload/relaunch;
  - restoring them to on should also persist after another force-stop/relaunch.
- actual before fix:
  - UI showed both switches off before save;
  - after force-stop/relaunch, both switches returned to on, so `LG-001` could not be accepted.
- evidence before fix:
  - `apps/mobile/lg001_precise_after_save.png`
  - `apps/mobile/lg001_precise_after_save.xml`
  - `apps/mobile/lg001_final_after_precise_save_force_stop_relaunch.png`
  - `apps/mobile/lg001_final_after_precise_save_force_stop_relaunch.xml`
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-16):
- Profile updates now write directly to the authenticated user's `profiles` row through Supabase `upsert`, including `notify_email` and `notify_whatsapp`.
- Profile metadata is still updated through `supabase.auth.updateUser()` for the display name.
- Added regression coverage proving disabled notification preferences are sent to profile storage.

Verification (2026-06-16):
- PASS: `corepack pnpm -C apps/mobile test --runInBand src/__tests__/screens/ProfileScreen.test.tsx` (`9/9` tests).
- PASS: `corepack pnpm -C apps/mobile typecheck`.
- PASS: release APK rebuilt and installed on `emulator-5554`.
- PASS: toggled both switches `true -> false`, saved, force-stopped, relaunched, and both remained `false`.
- PASS: restored both switches `false -> true`, saved, force-stopped, relaunched, and both remained `true`.
- evidence after fix:
  - `apps/mobile/lg001_direct_toggles_off_before_save.png`
  - `apps/mobile/lg001_direct_toggles_off_before_save.xml`
  - `apps/mobile/lg001_direct_after_save_force_stop_relaunch.png`
  - `apps/mobile/lg001_direct_after_save_force_stop_relaunch.xml`
  - `apps/mobile/lg001_restore_true_after_relaunch.png`
  - `apps/mobile/lg001_restore_true_after_relaunch.xml`

### MB-061
- id: `MB-061`
- date: `2026-06-17`
- area: `A2`
- severity: `P1`
- title: Malformed API URL release build crashes before ErrorBoundary can show config guidance
- build: Android x86_64 release APK (`kg.kezek.app`) with controlled malformed config
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro API 35
- steps:
  1. Build a release APK with `EXPO_PUBLIC_API_URL=ht!tp://bad` and `EXPO_PUBLIC_APP_ENV=staging`.
  2. Install the APK on the emulator.
  3. Clear app data and launch `kg.kezek.app`.
- expected:
  - invalid runtime config should fail fast into a user-visible app error surface;
  - the message should identify the invalid API URL config and mention `EXPO_PUBLIC_API_URL` / valid `http(s)` URL requirements;
  - the app process should not crash before React registers the root component.
- actual before fix:
  - `getMobileApiUrl()` was called at module import time by `src/lib/api.ts` and `src/screens/auth/WhatsAppScreen.tsx`;
  - the malformed config threw before `AppRegistry.registerComponent` completed;
  - logcat showed `Invalid API URL config`, then `main has not been registered`, followed by `FATAL EXCEPTION`.
- evidence before fix:
  - `apps/mobile/lg005_bad_api_url_launch.png`
  - `apps/mobile/lg005_bad_api_url_logcat.txt`
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-17):
- Removed module-scope API URL resolution from the mobile shared API client.
- `apiRequest()` now resolves the mobile API URL lazily at request time.
- Removed module-scope API URL resolution from `WhatsAppScreen`; it now resolves inside the component tree so `ErrorBoundary` can catch config failures.
- Added regression coverage proving the API client module can be imported even when `EXPO_PUBLIC_API_URL` is malformed.

Verification (2026-06-17):
- PASS: `corepack pnpm -C apps/mobile test --runInBand src/__tests__/lib/apiUrl.test.ts src/__tests__/screens/auth/WhatsAppScreen.test.tsx` (`10/10` tests).
- PASS: `corepack pnpm -C apps/mobile typecheck`.
- PASS: rebuilt malformed x86_64 release APK with `EXPO_PUBLIC_API_URL=ht!tp://bad`.
- PASS: installed malformed APK now renders ErrorBoundary content with `Invalid API URL config`, `EXPO_PUBLIC_API_URL`, and `valid http(s) URL`.
- PASS: logcat no longer shows the previous `FATAL EXCEPTION` / `main has not been registered` startup crash after the fix.
- PASS: rebuilt and reinstalled valid x86_64 release APK; emulator returned to normal Sign-in screen.
- evidence after fix:
  - `apps/mobile/lg005_bad_api_url_fixed_launch.png`
  - `apps/mobile/lg005_bad_api_url_fixed_launch.xml`
  - `apps/mobile/lg005_bad_api_url_fixed_logcat.txt`
  - `apps/mobile/lg005_valid_after_restore.png`
  - `apps/mobile/lg005_valid_after_restore.xml`

### MB-062
- id: `MB-062`
- date: `2026-06-17`
- area: `A4` / `J2`
- severity: `P1`
- title: Home list does not auto-retry after true network reconnect
- build: Android x86_64 release APK (`kg.kezek.app`)
- environment: Android Emulator `emulator-5554`, Pixel 7 Pro API 35, authenticated Home screen
- steps:
  1. Disable emulator networking with `adb shell svc wifi disable` and `adb shell svc data disable`.
  2. Force-stop and relaunch `kg.kezek.app`.
  3. Observe Home offline/error state.
  4. Re-enable networking with `adb shell svc wifi enable` and `adb shell svc data enable`.
  5. Wait on Home without manual pull-to-refresh.
- expected:
  - Home should retry the business list automatically after the network status returns online, matching the offline banner copy.
- actual before fix:
  - Home correctly stayed crash-free and showed a user-visible offline/error state.
  - After networking was restored, the business list remained in `�� ������� ��������� ������` until manual pull-to-refresh.
- evidence before fix:
  - `apps/mobile/lg006_auth_session_start_svc_offline.png`
  - `apps/mobile/lg006_auth_session_start_svc_offline.xml`
  - `apps/mobile/lg006_auth_session_recovered_online.png`
  - `apps/mobile/lg006_auth_session_recovered_online.xml`
  - `apps/mobile/lg006_home_recovered_pull_refresh.png`
  - `apps/mobile/lg006_home_recovered_pull_refresh.xml`
- status: `fixed`
- owner: `Codex + User`

Resolution note (2026-06-17):
- Added an online-transition retry in `useHomeScreenData()`.
- When Home previously observed an offline/network-error state and `useNetworkStatus()` reports online again, the businesses query is refetched automatically.
- Normal pull-to-refresh remains available as a manual recovery path.

Verification (2026-06-17):
- PASS: `corepack pnpm -C apps/mobile test --runInBand src/__tests__/screens/HomeScreen.test.tsx` (`10/10` tests).
- PASS: `corepack pnpm -C apps/mobile typecheck`.
- NOTE: post-fix live verification requires rebuilding/reinstalling the Android APK; the live evidence above was captured on the pre-fix installed build.

### MB-064
- id: `MB-064`
- date: `2026-06-17`
- area: `G3`
- severity: `P2`
- title: Mobile discovery lacks the interactive branch map available on web
- build: Android debug/dev-client (`apps/mobile`) and web source parity audit
- environment: physical Android device `8231be4e2ca4`, mobile Home, web `/map` implementation audit
- steps:
  1. Open mobile Home after the `LG-007` nearby discovery implementation.
  2. Compare it with web `/map` (`apps/web/src/app/map/MapPageClient.tsx`).
  3. Look for a map entry point, branch markers, category filtering on a map, nearest search on a map, marker/list selection, and booking links from map items.
- expected:
  - Mobile should expose a map-based branch discovery experience equivalent in intent to web `/map`, or the catalog should explicitly state that mobile supports only nearby-list discovery.
- actual before fix:
  - Mobile Home has `��������� �������` as a list card only.
  - There is no mobile `Map` screen, no map tab/CTA, no branch markers, no user-location marker, no map/list selection behavior, and no mobile equivalent of `/api/branches/map` rendering.
  - Web has Yandex Maps with `/api/branches/map`, category filter, nearest search, user marker, branch placemarks, list selection, and booking links.
- evidence:
  - [MapPageClient.tsx](/C:/projects/kezek/apps/web/src/app/map/MapPageClient.tsx)
  - [branchesMapService.ts](/C:/projects/kezek/apps/web/src/lib/branchesMapService.ts)
  - [MapScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/MapScreen.tsx)
  - [mapNavigation.ts](/C:/projects/kezek/apps/mobile/src/screens/map/mapNavigation.ts)
  - [DiscoverySections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/DiscoverySections.tsx)
  - [useNearbyBranches.ts](/C:/projects/kezek/apps/mobile/src/screens/home/useNearbyBranches.ts)
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-17):
- Added `react-native-webview` and a dedicated mobile `Map` root screen that embeds the web `/map?mobile=1` experience to preserve Yandex Maps parity.
- Added `kezek://map` linking and a Home CTA (`������� ����� ��������`) from the nearby discovery block.
- Added booking-link interception in the WebView via navigation guards plus an injected JavaScript bridge, so `/b/{slug}/booking` and localized booking links open the native `Booking` flow instead of staying inside the embedded web page.
- Kept the existing native nearby-list implementation; the map is now an additional parity entry point rather than a replacement.

Verification (2026-06-17):
- PASS: `corepack pnpm -C apps/mobile test --runInBand src/__tests__/screens/MapScreen.test.tsx src/__tests__/navigation/MapLinking.test.ts src/__tests__/screens/HomeScreen.test.tsx` (`23/23` tests).
- PASS: `corepack pnpm -C apps/mobile typecheck`.
- PASS: Android ARM64 debug build installed on USB device `8231be4e2ca4`.
- PASS: `kezek://map` opened the native `Map` screen with embedded web map, category filter, nearest CTA, branch list, and visible map markers.
- PASS after fix: tapping `����������` from the embedded map opened the native booking screen at `��� 1 �� 6 / ������`.
- Evidence:
  - `apps/mobile/mb064_usb_map.png`
  - `apps/mobile/mb064_usb_map.xml`
  - `apps/mobile/mb064_usb_booking_intercept_fixed.png`
  - `apps/mobile/mb064_usb_booking_intercept_fixed.xml`
- Regression caught during live QA:
  - `apps/mobile/mb064_usb_booking_final.png` showed the web booking page inside the map WebView before the injected bridge fix.

### MB-065
- id: `MB-065`
- date: `2026-06-18`
- area: `K2`
- severity: `P2`
- title: WhatsApp phone validation is announced twice to screen readers
- build: Android dev-client (`apps/mobile`)
- environment: Android Emulator `emulator-5554`, TalkBack enabled, unauthenticated WhatsApp auth flow
- steps:
  1. Enable Android Accessibility Suite/TalkBack.
  2. Open `WhatsApp` auth.
  3. Press `��������� ���` with an empty phone field.
- expected:
  - Phone validation should be announced once, near the invalid phone input or via the existing assertive toast.
- actual before fix:
  - `������� ����������` appeared twice in the accessibility tree: once as the field error and once as the generic screen-level error block.
  - This could make TalkBack repeat the same validation message unnecessarily.
- evidence before fix:
  - `apps/mobile/lg008_whatsapp_validation.png`
  - `apps/mobile/lg008_whatsapp_validation.xml`
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-18):
- Local phone and OTP validation errors now stay attached to their respective fields and assertive toast announcement instead of also populating the generic screen-level error block.
- Network, provider, expired-attempt, and sign-in failures still use the generic alert block.

Verification (2026-06-18):
- PASS: `corepack pnpm -C apps/mobile test --runInBand src/__tests__/screens/auth/WhatsAppScreen.test.tsx` (`6/6` tests).
- PASS: `corepack pnpm -C apps/mobile typecheck`.
- LIMIT: post-fix live re-open was interrupted by TalkBack focus staying inside Expo Dev Launcher after restart; the regression is covered by the new rendered test and the pre-fix live evidence.
### MB-066
- id: `MB-066`
- date: `2026-06-18`
- area: `K2`
- severity: `P2`
- title: Home and owner tab accessibility labels include glyphs or mojibake under TalkBack
- build: Android dev-client (`apps/mobile`)
- environment: Android Emulator `emulator-5554`, TalkBack enabled, authenticated owner session
- steps:
  1. Enable Android Accessibility Suite/TalkBack.
  2. Open Home as an authenticated owner.
  3. Inspect/focus recent-place chips, business cards, and bottom tabs.
  4. Switch to Business and Cabinet tabs.
- expected:
  - Focusable controls should expose readable Russian labels without decorative icon glyphs or mojibake.
- actual before fix:
  - Recent place chip exposed `, Low Fade`.
  - Business cards and bottom tabs could include decorative icon glyphs or mojibake-derived labels in accessibility output.
  - `BookingActivitySections.tsx` and `MainNavigator.tsx` contained mojibake strings in user-facing Russian copy.
- evidence before fix:
  - `apps/mobile/lg008_owner_start.xml`
  - `apps/mobile/lg008_owner_after_fix_wait.xml`
- status: `verified`
- owner: `Codex + User`

Resolution note (2026-06-18):
- Restored readable Russian labels in `MainNavigator` and `BookingActivitySections`.
- Added explicit `tabBarAccessibilityLabel` values for Home, Cabinet, Business, and Staff tabs.
- Hid decorative icon wrappers from accessibility in tab icons, buttons, rating badges, and Home discovery icons.
- Added explicit Home labels for recent-place chips, category chips, business cards, and booking cards.

Verification (2026-06-18):
- PASS: `corepack pnpm -C apps/mobile test --runInBand src/__tests__/screens/HomeScreen.test.tsx src/__tests__/navigation/MainNavigator.test.tsx` (`19/19` tests).
- PASS: `corepack pnpm -C apps/mobile typecheck`.
- PASS live: `apps/mobile/lg008_owner_final_wait.xml` exposes readable labels such as `Недавнее место: Low Fade`, `Low Fade. Категории: barbershop. Рейтинг: 50.0`, `Главная вкладка`, `Кабинет`, and `Бизнес`.
- PASS live: `apps/mobile/lg008_owner_business.xml` exposes `Образ`, `Открыть веб-кабинет`, and readable bottom tabs without mojibake.
- PASS live: `apps/mobile/lg008_owner_cabinet.xml` exposes `Профиль`, `Предстоящие записи`, `История записей`, and readable bottom tabs without mojibake.
