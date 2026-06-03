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
- status: `open`
- owner: `Codex + User`

Live note (2026-06-01):
- C2 cancel path: passed (`c2_google_cancel.xml` returned to sign-in with Google CTA visible).
- C2 retry/idempotency: passed (repeated tap reopens auth flow).
- C2 happy-path/session establishment not finalized in unattended run due real Google credential requirement on `accounts.google.com` form.
- Final live completion (2026-06-01):
  - user completed real Google auth manually;
  - app returned to authenticated `Main` (`Главная`, `home-search-input` visible) in [c2_return_app.xml](/C:/projects/kezek/apps/mobile/c2_return_app.xml).

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
- status: `open`
- owner: `Codex + User`

Note:
- Functional sign-out implementation exists (`supabase.auth.signOut` in profile data hook).
- Issue is primarily discoverability/IA, not auth invalidation logic.

MB-008 update (2026-06-01):
- status: fixed.
- implemented quick logout action in Cabinet footer (`����� �� ��������`) so users can sign out without opening Profile.
- files:
  - [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx)
  - [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx)
  - [cabinetScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/cabinetScreenStyles.ts)
- verification:
  - `src/__tests__/screens/CabinetScreen.test.tsx` PASS (`shows quick sign-out action in cabinet footer`)

MB-008 final verification (2026-06-01):
- status: verified.
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

MB-012 final verification (2026-06-02, post-deploy live recheck):
- status: `verified`.
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
- status: `open`
- owner: `Codex + User`

Note:
- This did not block D3 cancel success, but it is visible in the live dev build and should be cleaned up before treating offline/cache UX as polished.

MB-013 verification (2026-06-02):
- status: `verified`.
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
- status: `fixed-pending-deploy`
- owner: `Codex + User`

Resolution note (2026-06-03):
- Added request-aware staff context via `getStaffContextForRequest(req, scope)` / `resolveStaffContextForRequest(req, scope)`.
- Staff finance and shift endpoints now preserve web cookie auth and also accept mobile Bearer auth for self-staff mode.
- Targeted API tests pass for staff finance/open/close/items.
- Live production verification is pending deploy.


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
