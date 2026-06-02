# MOBILE TESTING AREAS CATALOG

Last updated: 2026-06-02  
Owner: QA flow (User + Codex)  
Status: Active baseline

## Progress snapshot (2026-06-02)
- [x] A1 App launch and bootstrapping
- [x] A2 Environment and config wiring
- [x] A3 Deep links and app scheme (post-fix live verify completed, `MB-002` verified)
- [x] A4 Network/offline baseline
- [x] B1 Root navigation
- [x] B2 Tab and stack navigation (live test completed, bug logged: `MB-005`)
- [x] B3 Header and back actions
- [x] B4 Linking config consistency (fix applied for `MB-003`)
- [x] C1 Sign-in UI/UX
- [x] C2 Google sign-in flow (live rerun completed; see `MB-006` environment caveat)
- [~] C3 Telegram sign-in flow (live partial: start/pending/cancel/retry/timeout passed; native return via installed Telegram app pending, see `MB-007`)
- [x] C4 WhatsApp sign-in entry flow (100% live verified + targeted test suite)
- [x] C5 Session restoration (verified via live dev-build resume checks + session recovery test suite)
- [x] C6 Sign-out and post-logout state (live verified after UX fix)
- [x] D1 Booking entry and branch selection (live + targeted tests)
- [x] D2 Service/staff/date/time steps (100% live verified + targeted tests)
- [~] D3 Booking confirmation and details (confirmation/details live verified; cancel fix ready, pending deployed live recheck)

## Purpose
This document defines all testing areas for the mobile app (`apps/mobile`) so testing is not limited to one feature at a time.

Use it as:
- a master map of what should be tested,
- an execution queue for focused test sessions,
- an index to attach discovered bugs in `docs/MOBILE_BUG_REGISTRY.md`.

## Test execution model
1. User picks area(s) from this catalog.
2. Codex runs manual + technical checks.
3. Codex logs issues into `docs/MOBILE_BUG_REGISTRY.md`.
4. Codex reports pass/fail summary and next-risk areas.

## Priority levels
- `P0`: critical user path or auth/session blocker.
- `P1`: core product workflow used frequently.
- `P2`: secondary workflow, quality and UX stability.
- `P3`: low-risk, cosmetic, or rare scenario.

---

## A. Platform and runtime foundation

### A1. App launch and bootstrapping (`P0`)
- cold start / warm start behavior
- splash-to-first-screen transition
- crash-free startup and recovery after background kill

### A2. Environment and config wiring (`P0`)
- required `EXPO_PUBLIC_*` variables are present
- expected API base URL behavior
- fallback behavior for missing/invalid config

### A3. Deep links and app scheme (`P0`)
- `kezek://` deep links
- auth callback deep links
- links from external browser/app back into mobile app

### A4. Network/offline baseline (`P1`)
- no-network startup
- network loss during active flows
- recovery after reconnect

---

## B. Navigation and route integrity

### B1. Root navigation (`P0`)
- `Auth` vs `Main` route switching
- unauthorized/authorized state transitions

### B2. Tab and stack navigation (`P1`)
- `MainNavigator` tab switching
- nested stack back behavior
- preserving screen state when switching tabs

Live status (2026-06-01):
- tab switching `Главная <-> Кабинет`: verified.
- state preservation on tab switch: verified (`home-search-input` retained `b2state`).
- Android hardware back on root `Home`: exits app to launcher (logged as `MB-005`, expected behavior policy to be confirmed).

### B3. Header and back actions (`P1`)
- header titles correctness
- hardware back button behavior (Android)
- consistent back path in multi-step flows

### B4. Linking config consistency (`P1`)
- route-to-link mapping in `navigation/linking.ts`
- no dead routes after flow changes

---

## C. Authentication and session

### C1. Sign-in UI/UX (`P0`)
- auth screen readability and layout on key widths
- CTA hierarchy and loading behavior
- state cards/messages visibility and spacing

### C2. Google sign-in flow (`P0`)
- happy path login
- cancel path
- callback handling and session establishment
- retry/idempotency behavior

Live status (2026-06-01):
- cancel path: verified (Back from external Google auth returned to sign-in card).
- retry/idempotency: verified (repeat tap reopens auth flow consistently).
- callback/session establishment: verified (manual Google completion returned to app session).
- happy path login: verified (user completed real Google auth; app opened authenticated `Main`).

### C3. Telegram sign-in flow (`P0`)
- start flow and external handoff
- pending status behavior
- return-from-external-app behavior
- timeout/cancel/failure handling

Live status (2026-06-01):
- start flow + external handoff: verified (opens external Telegram auth URL; emulator routed via Chrome surface).
- pending state block: verified (`Ожидаем подтверждение` + `Открыть Telegram снова` + `Отменить вход`).
- cancel and retry: verified (cancel returns to base sign-in state, retry reopens external handoff).
- native return-from-Telegram-app: pending on emulator (Telegram app not installed/configured; degraded browser path only).
- timeout expiration message: verified (`Срок подтверждения истек` after extended wait in pending state).

### C4. WhatsApp sign-in entry flow (`P1`)
- entry point visibility by feature flag
- navigation to WhatsApp auth screen
- send/retry interactions and guardrails

Verification status (2026-06-01):
- feature-flag entry visibility: verified (`authFeatureFlags.test.ts`, `useWhatsAppSignInFlow.test.tsx`).
- navigation from Sign-in to WhatsApp auth route: verified (`useWhatsAppSignInFlow.test.tsx` + `SignInScreen.test.tsx`).
- send/retry guardrails baseline: verified (`WhatsAppScreen.test.tsx` + auth screen integration smoke in `SignInScreen.test.tsx`).
- runtime note: Telegram/Google/WhatsApp auth shell runs on emulator; Compose UI dump intermittently omits text nodes in Dev Client shell, so source-of-truth for C4 assertions is test suite + route-level runtime checks.
- manual live completion: verified on emulator OTP step (`Код отправлен в WhatsApp`, code-entry screen, resend cooldown visible).

### C5. Session restoration (`P0`)
- app resume restores valid session
- pending exchange recovery path
- stale session cleanup behavior

Verification status (2026-06-01):
- app resume restores active auth flow state: verified in live run (`WhatsApp` OTP step persisted across resume/cold relaunch flow under Dev Launcher shell).
- pending exchange recovery path: verified by `useRootNavigationSession.test.ts` and `SignInScreen.test.tsx` integration scenarios.
- stale session cleanup behavior: verified by root-session callback handling tests (invalid/duplicate/expired-like transitions handled, no stale session promotion).
- evidence:
  - [c5_start.xml](/C:/projects/kezek/apps/mobile/c5_start.xml)
  - [c5_resume_warm.xml](/C:/projects/kezek/apps/mobile/c5_resume_warm.xml)
  - [c5_resume_cold.xml](/C:/projects/kezek/apps/mobile/c5_resume_cold.xml)

### C6. Sign-out and post-logout state (`P1`)
- sign-out correctness
- route reset and token/session invalidation

---

## D. Client booking flows

### D1. Booking entry and branch selection (`P1`)
- branch list rendering and selection
- empty/error/loading states

Verification status (2026-06-01):
- live entry and branch-selection path verified from authenticated `Main` flow.
- targeted tests pass for loading/empty/list states and branch selection action:
  - `src/__tests__/screens/BookingStep1Branch.test.tsx`
  - `src/__tests__/screens/BookingScreen.test.tsx`
- evidence:
  - `apps/mobile/d1_main.xml`
  - `apps/mobile/d1_step1_branch.xml`

### D2. Service/staff/date/time steps (`P1`)
- step transitions
- disabled/invalid state handling
- summary consistency between steps

Verification status (2026-06-02):
- live step transitions verified on Android emulator:
  - `Step 1 Branch -> Step 2 Service -> Step 3 Staff -> Step 4 Date -> Step 5 Time -> Step 6 Summary`.
- disabled/enabled guardrails verified:
  - Service `Дальше` is disabled before selecting a service and enabled after selection.
  - Staff `Дальше` is disabled before selecting a staff member and enabled after selection.
  - Date `Дальше` is disabled until the date is explicitly selected; `Сегодня` highlight alone is not treated as selected.
- time step empty state verified against live backend data:
  - `Нет доступного времени`
  - `Попробуйте выбрать другую дату.`
- after adding live slots, time-slot selection and summary consistency were verified manually:
  - selected slot: `13:00`
  - summary shows `Low Fade`, `Взрослая стрижка`, `Adakhan`, `2 июнь`, `13:00`.
- targeted tests passed:
  - `src/__tests__/navigation/BookingNavigation.test.tsx`
  - `src/__tests__/screens/BookingStep1Branch.test.tsx`
  - `src/__tests__/screens/BookingStep6Summary.test.tsx`
- evidence:
  - `apps/mobile/d2_step2_service.png`
  - `apps/mobile/d2_step2_selected2.png`
  - `apps/mobile/d2_step3_staff.png`
  - `apps/mobile/d2_after_user_ready.png`
  - `apps/mobile/d2_step4_selected_live.png`
  - `apps/mobile/d2_step5_time_live.png`
  - `apps/mobile/d2_slots_live_time_refreshed.png`
  - `apps/mobile/d2_slots_live_selected.png`
  - `apps/mobile/d2_slots_live_summary.png`

### D3. Booking confirmation and details (`P1`)
- final confirmation path
- detail screen integrity
- cancellation/repeat actions

Verification status (2026-06-02):
- live final confirmation path initially failed after success toast because mobile read `booking_id` from the wrong response shape; fixed and covered by `src/__tests__/hooks/useConfirmBooking.test.tsx`.
- live details screen initially crashed with `Invalid time value` because mobile did not unwrap `/api/mobile/bookings/:id` response envelopes; fixed for details and cabinet list.
- live detail integrity recheck passed after fix:
  - service: `Взрослая стрижка`
  - business: `Low Fade`
  - staff: `Adakhan`
  - branch: `Low Fade Юго-Восток`
  - date/time: `02 июня 2026`, `14:00 - 14:30`
  - price: `300 - 350 сом`
- repeat action is visible on details screen.
- cancel action was hidden for `confirmed` bookings; fixed and live-rechecked visible.
- cancel confirmation dialog opens correctly, but production API returned `403 Доступ запрещен` for mobile Bearer session when calling legacy `/api/bookings/:id/cancel`.
- implemented mobile-owner cancel endpoint (`POST /api/mobile/bookings/:id`) and switched mobile client to it.
- remaining live step:
  - deploy web API/mobile bundle or point emulator at local web API, then re-run final cancel success and verify booking status/list update.
- targeted verification:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/hooks/useConfirmBooking.test.tsx`
  - `corepack pnpm -C apps/web test -- --runInBand src/__tests__/lib/mobileBookingsService.test.ts src/__tests__/lib/mobileBookingsHttpService.test.ts src/__tests__/api/mobile/bookings.test.ts`
- evidence:
  - `apps/mobile/d3_create_confirm_dialog.png`
  - `apps/mobile/d3_after_create.png`
  - `apps/mobile/d3_details_wait.png`
  - `apps/mobile/d3_retest_after_create_wait.png`
  - `apps/mobile/d3_retest_details_after_unwrap_fix.png`
  - `apps/mobile/d3_retest_actions_cancel_visible.png`
  - `apps/mobile/d3_cancel_attempt2_dialog.png`
  - `apps/mobile/d3_cancel_attempt2_after_confirm.png`
  - `apps/mobile/d3_cancel_attempt2_logcat.txt`
- bugs found:
  - `MB-009`
  - `MB-010`
  - `MB-011`
  - `MB-012`

### D4. Deep-linked booking screens (`P2`)
- direct open by booking slug/id
- graceful handling for invalid ids

---

## E. Cabinet and profile

### E1. Cabinet home and bookings list (`P1`)
- list loading/empty/error states
- card readability and action buttons

### E2. Profile data and edits (`P1`)
- profile form updates
- validation and server error handling
- persistence after app restart

### E3. Preferences and notifications (`P2`)
- toggle behavior
- save/reload consistency

---

## F. Staff and shifts domain

### F1. Staff screen baseline (`P1`)
- staff dashboard rendering
- availability and key actions

### F2. Shift quick workspace (`P0`)
- open/close shift
- add/edit shift clients/items
- offline queue visibility and sync/retry behavior

### F3. Shift history screen (`P1`)
- period filters
- totals and item integrity
- empty/error states

### F4. Shift calculations integrity (`P1`)
- totals, percentages, rates, and rounding correctness
- consistency between UI sections and backend response

---

## G. Home and discovery

### G1. Home feed composition (`P1`)
- top-level sections render correctly
- card interactions and navigation

### G2. Search and filters (`P1`)
- input responsiveness
- clear/reset behavior
- filter chips and state persistence

### G3. Nearby/discovery interactions (`P2`)
- location-related UI handling
- fallback behavior if location unavailable

---

## H. Dashboard and role-specific screens

### H1. Dashboard mobile entry (`P1`)
- role-based widgets
- loading and empty states

### H2. Role-switch and role-guard behavior (`P1`)
- routing rules by role
- no unauthorized screen access

---

## I. UI system and design consistency

### I1. Typography and spacing consistency (`P1`)
- hierarchy correctness on small/large mobile widths
- no clipped text in RU localization

### I2. Color, contrast, and theme readability (`P1`)
- contrast of primary/secondary text
- CTA legibility across all button states

### I3. Component behavior consistency (`P1`)
- `Button`, `Input`, `Toast`, banners, cards
- loading/disabled/error states consistency

### I4. Visual regressions (`P2`)
- compare key screens before/after major UI changes
- preserve auth shell and CTA hierarchy

---

## J. Error handling and resilience

### J1. API error handling (`P0`)
- user-visible errors are understandable
- no silent failures for critical actions

### J2. Retry and fallback logic (`P1`)
- transient network failures
- action retries and safe idempotency

### J3. App state transitions (`P1`)
- foreground/background
- interrupted auth/booking flows

---

## K. Accessibility and usability

### K1. Touch targets and hit areas (`P1`)
- critical actions meet practical tap sizes

### K2. Screen reader/announcements (`P1`)
- live region announcements for auth status
- semantic labels for actionable controls

### K3. Keyboard and input UX (`P2`)
- input focus behavior
- keyboard overlap and scroll-to-input behavior

---

## L. Performance and stability

### L1. Perceived performance (`P1`)
- first meaningful paint of key screens
- no jank during critical transitions

### L2. Memory and long-session stability (`P2`)
- repeated navigation loops
- no obvious memory leak symptoms

### L3. Heavy-list behavior (`P2`)
- smoothness with larger lists
- pagination/virtualization behavior where applicable

---

## M. Security and privacy hygiene

### M1. Sensitive data exposure (`P0`)
- no tokens/secrets in UI logs or visible debug output

### M2. Session/token storage basics (`P1`)
- secure-store usage expectations
- logout clears sensitive state

---

## N. Release readiness gates

### N1. Automated checks (`P0`)
- targeted screen tests pass
- smoke text/theme checks pass

### N2. Manual smoke pack (`P0`)
- auth quick pack
- booking quick pack
- shift quick pack

### N3. Device profile coverage (`P1`)
- at least one narrow width (~360dp)
- at least one default modern profile (~390–412dp)

---

## Suggested execution waves

### Wave 1 (critical, first)
- A1, A3, B1, C1, C2, C3, C5, F2, J1, N1, N2

### Wave 2 (core workflows)
- D1-D3, E1-E2, F1, F3, G1-G2, H1, I1-I3, J2

### Wave 3 (hardening)
- A4, B2-B4, D4, E3, G3, K1-K3, L1-L3, M1-M2, N3

## Notes
- This catalog is intentionally broad and should evolve as features change.
- Every bug found during testing should be logged into `docs/MOBILE_BUG_REGISTRY.md` with area tag (e.g., `C2`, `F2`).

---

## Execution log

### 2026-05-30 - A1 App launch and bootstrapping (`P0`) - ✅ Completed (PASS)
- Scope:
  - cold start / warm start behavior
  - splash-to-first-screen transition
  - crash-free startup and recovery after background kill
- Environment:
  - Android Emulator: `Pixel_7_Pro` (`emulator-5554`)
  - Metro: `apps/mobile` on port `8099`
  - Launch path: Expo deep link `exp://10.0.2.2:8099/--/`
- Result:
  - PASS: cold start launches app without crash.
  - PASS: warm start returns to active app state without crash.
  - PASS: after background kill (`am force-stop`) app relaunches and restores first interactive auth screen.
  - PASS: splash-to-first-screen transition observed; no blocking blank screen state reproduced.
- Evidence artifacts:
  - `apps/mobile/a1_probe.png`
  - `apps/mobile/window_dump.xml` (contains `expo`, `Kezek` markers)
- Bugs found:
  - none in A1 run.

### 2026-05-30 - A2 Environment and config wiring (`P0`) - ✅ Completed (PASS with risk logged)
- Scope:
  - required `EXPO_PUBLIC_*` variables are present
  - expected API base URL behavior
  - fallback behavior for missing/invalid config
- Environment:
  - App config: `apps/mobile/.env.local`, `apps/mobile/app.json`
  - Code paths: `src/lib/apiUrl.ts`, `src/lib/supabase.ts`
  - Validation test: `src/__tests__/lib/apiUrl.test.ts`
- Result:
  - PASS: required vars are present in local environment (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`).
  - PASS: API URL resolver behavior is covered and passing:
    - uses `EXPO_PUBLIC_API_URL` when defined;
    - falls back to prod URL in `NODE_ENV=test` when missing;
    - throws explicit config error in non-prod when missing.
  - PASS: missing Supabase env is explicitly guarded with runtime error and setup guidance (`src/lib/supabase.ts`).
  - RISK: invalid `EXPO_PUBLIC_API_URL` format is not validated (accepted as-is after trim). Logged in bug registry.
- Evidence artifacts:
  - test run: `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/lib/apiUrl.test.ts` (3/3 passed)
- Bugs found:
  - `MB-001` (A2) invalid API URL format lacks validation/fallback.

### 2026-05-30 - A3 Deep links and app scheme (`P0`) - ❌ Completed (FAIL, blocker logged)
- Scope:
  - `kezek://` deep links
  - auth callback deep links
  - links from external browser/app back into mobile app
- Environment:
  - Android Emulator: `Pixel_7_Pro` (`emulator-5554`)
  - commands via `adb shell am start -W -a android.intent.action.VIEW -d <url>`
- Result:
  - PASS: custom scheme deep links route to app (`kg.kezek.app/.MainActivity`):
    - `kezek://auth/callback?code=test-code`
    - `kezek://booking/test-slug`
    - `kezek://callback-mobile?exchange_code=simulated-exchange-123`
  - FAIL (`P0`): HTTPS callback link does not return to app in this runtime profile:
    - `https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback`
    - observed target activity: `com.android.chrome/...ChromeTabbedActivity` (app not foregrounded).
- Evidence artifacts:
  - `apps/mobile/a3_case1.png`
  - `apps/mobile/a3_case2.png`
  - `apps/mobile/a3_case3.png`
  - `apps/mobile/a3_case4.png`
- Bugs found:
  - `MB-002` (A3) HTTPS callback intent resolves to Chrome instead of mobile app.

### 2026-05-30 - A4 Network/offline baseline (`P1`) - ✅ Completed (PASS with environment note)
- Scope:
  - no-network startup
  - network loss during active flows
  - recovery after reconnect
- Environment:
  - Android Emulator: `Pixel_7_Pro` (`emulator-5554`)
  - Two runtimes checked:
    - Expo Go deep link: `exp://10.0.2.2:8099/--/`
    - Native app package: `kg.kezek.app` (`kezek://...`)
- Result:
  - Expo Go runtime:
    - with network disabled, app route opens `host.exp.exponent/.experience.ErrorActivity`;
    - after reconnect, Expo Go stayed on `ErrorActivity` in this run (dev runtime behavior).
  - Native app runtime (`kg.kezek.app`):
    - PASS: no-network startup keeps app launchable (`MainActivity`).
    - PASS: network loss during active flow does not crash or background the app.
    - PASS: recovery after reconnect keeps app stable and routable via deep links.
  - Conclusion:
    - A4 passes for mobile app runtime.
    - Expo Go offline behavior should not be treated as product regression signal.
- Evidence artifacts:
  - `apps/mobile/a4_no_network_startup.png`
  - `apps/mobile/a4_network_loss_active.png`
  - `apps/mobile/a4_recovery_reconnect.png`
  - `apps/mobile/a4_native_no_network_startup.png`
  - `apps/mobile/a4_native_network_loss_active.png`
  - `apps/mobile/a4_native_recovery_reconnect.png`
- Bugs found:
  - none in app runtime for A4.

### 2026-05-30 - B1 Root navigation (`P0`) - ✅ Completed (PASS)
- Scope:
  - `Auth` vs `Main` route switching
  - unauthorized/authorized state transitions
- Environment:
  - Navigation/session logic review:
    - `apps/mobile/src/navigation/RootNavigator.tsx`
    - `apps/mobile/src/navigation/useRootNavigationSession.ts`
  - Automated verification:
    - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/navigation/useRootNavigationSession.test.ts`
- Result:
  - PASS: unauthorized bootstrap keeps `hasSession=false` until auth callback/session restore.
  - PASS: authorized transition path is covered:
    - callback token handling (`access_token`/`refresh_token`);
    - callback `exchange_code` handling via mobile API;
    - callback `code` handling via `exchangeCodeForSession`;
    - cold-start callback session restoration.
  - PASS: dedup logic prevents duplicate callback processing and unstable route flips.
  - PASS: `RootNavigator` switches by session gate (`hasSession ? Main : Auth`).
- Evidence artifacts:
  - [RootNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/RootNavigator.tsx)
  - [useRootNavigationSession.ts](/C:/projects/kezek/apps/mobile/src/navigation/useRootNavigationSession.ts)
  - [useRootNavigationSession.test.ts](/C:/projects/kezek/apps/mobile/src/__tests__/navigation/useRootNavigationSession.test.ts)
- Bugs found:
  - none in B1 run.

### 2026-05-30 - B2 Tab and stack navigation (`P1`) - ⚠️ Partial (manual auth-gated)
- Scope:
  - `MainNavigator` tab switching
  - nested stack back behavior
  - preserving screen state when switching tabs
- Environment:
  - Automated checks:
    - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/navigation/MainNavigator.test.tsx src/__tests__/navigation/BookingNavigation.test.tsx`
  - Runtime observation:
    - native app opened in unauthenticated state (Auth screen), so `Main` tabs were not reachable for interactive manual tab switching.
- Result:
  - PASS (automated): `MainNavigator` tab entries render (`Home`, `Cabinet`, `Dashboard`, `Staff`) under test role conditions.
  - PASS (automated): booking stack step screens render in sequence-oriented tests (`BookingStep1`..`BookingStep6`), covering nested flow surface.
  - NOT EXECUTED (manual): direct tap-based tab switching, hardware back in nested tab stacks, and state-preservation while swapping tabs require active authorized session in runtime.
- Evidence artifacts:
  - [MainNavigator.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/navigation/MainNavigator.test.tsx)
  - [BookingNavigation.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/navigation/BookingNavigation.test.tsx)
  - `apps/mobile/b2_dump.xml` (current runtime at Auth screen)
- Bugs found:
  - none confirmed in B2 run.

### 2026-05-30 - B3 Header and back actions (`P1`) - ✅ Completed (PASS)
- Scope:
  - header titles correctness
  - hardware back button behavior (Android)
  - consistent back path in multi-step flows
- Environment:
  - Navigation config review:
    - `apps/mobile/src/navigation/MainNavigator.tsx`
    - `apps/mobile/src/navigation/CabinetNavigator.tsx`
    - `apps/mobile/src/navigation/RootNavigatorScreens.tsx`
    - `apps/mobile/src/navigation/mainNavigatorConfig.tsx`
  - Automated checks:
    - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/auth/VerifyScreen.test.tsx src/__tests__/screens/auth/WhatsAppScreen.test.tsx src/__tests__/navigation/BookingNavigation.test.tsx`
  - Manual Android smoke:
    - deep link to `kezek://auth/whatsapp`, then hardware `Back` (`KEYCODE_BACK`).
- Result:
  - PASS: header titles are explicitly configured per route for Auth, Main tabs, Cabinet stack, booking steps, shifts screens.
  - PASS: Android hardware back from WhatsApp auth screen returns to auth shell (sign-in surface) without crash.
  - PASS: booking multi-step flow preserves consistent backward path in implementation (`navigation.goBack()` on step screens) and remains covered by navigation step tests.
- Evidence artifacts:
  - [MainNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/MainNavigator.tsx)
  - [CabinetNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/CabinetNavigator.tsx)
  - [RootNavigatorScreens.tsx](/C:/projects/kezek/apps/mobile/src/navigation/RootNavigatorScreens.tsx)
  - `apps/mobile/b3_before_back.xml`
  - `apps/mobile/b3_after_back.xml`
- Bugs found:
  - none in B3 run.

### 2026-05-30 - B4 Linking config consistency (`P1`) - ❌ Completed (FAIL)
- Scope:
  - route-to-link mapping in `navigation/linking.ts`
  - no dead routes after flow changes
- Environment:
  - Files reviewed:
    - `apps/mobile/src/navigation/linking.ts`
    - `apps/mobile/src/navigation/types.ts`
    - `apps/mobile/src/navigation/RootNavigatorScreens.tsx`
    - navigation usages across screens (`navigate(...)` calls)
- Result:
  - FAIL: linking config does not fully mirror active navigation graph.
  - Confirmed gaps:
    - Nested Cabinet route `Profile` is actively used (`navigation.navigate('Profile')`) but has no explicit link mapping in `Main -> Cabinet` subtree.
    - `linking.ts` comment claims support for `https://kezek.kg/auth/callback-mobile`, but no explicit screen mapping exists for callback path (handled only by side-effect logic); this contributes to fragile deep-link behavior.
  - Core mapped routes that do exist: `Auth` screens, `Home`, `Cabinet`, `Dashboard`, `Staff`, `Booking/:slug`, `BookingDetails/:id`, `ShiftQuick`, `Shifts`.
- Evidence artifacts:
  - [linking.ts](/C:/projects/kezek/apps/mobile/src/navigation/linking.ts)
  - [types.ts](/C:/projects/kezek/apps/mobile/src/navigation/types.ts)
  - [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx)
- Bugs found:
  - `MB-003` (B4) linking config drift vs active routes.

### 2026-05-30 - C1 Sign-in UI/UX (`P0`) - ⚠️ Partial (runtime blocker)
- Scope:
  - auth screen readability and layout on key widths
  - CTA hierarchy and loading behavior
  - state cards/messages visibility and spacing
- Environment:
  - Automated checks:
    - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/auth/SignInScreen.test.tsx src/__tests__/screens/uiTextThemeSmoke.test.ts`
  - Manual visual attempt:
    - Android emulator profiles approximating `~360dp` and `~412dp` via `wm density`.
    - Expo Go launch route `exp://10.0.2.2:8099/--/`.
- Result:
  - PASS (automated): auth CTA hierarchy/behavior tests pass; loading/pending states and text-theme smoke pass.
  - BLOCKED (manual visual): Expo Go opens error surface (`Something went wrong`) instead of Sign-in screen in current run, so readability/spacing checks on target widths could not be validated in the intended runtime.
- Evidence artifacts:
  - `apps/mobile/c1_auth_360dp.png`
  - `apps/mobile/c1_auth_412dp.png`
  - `apps/mobile/c1_360.xml`
  - `apps/mobile/c1_412.xml`
- Bugs found:
  - `MB-004` (C1) Expo Go runtime error blocks manual Sign-in visual QA.

### 2026-05-30 - C1 Sign-in UI/UX (`P0`) - ✅ Re-test completed (PASS)
- Re-test trigger:
  - `MB-004` fix verification after Metro restart/port cleanup.
- Runtime fix action:
  - cleared conflicting Metro ports and launched a single clean Expo dev server on `8081`.
- Result:
  - PASS: Sign-in screen renders again in Expo Go (no `Something went wrong` surface).
  - PASS: readability/layout smoke passed on key widths:
    - ~`360dp` profile (`wm density 480`)
    - ~`412dp` profile (`wm density 420`)
  - PASS: CTA hierarchy present (Google, Telegram, WhatsApp) and state block surface remains available by test coverage.
- Evidence artifacts:
  - `apps/mobile/c1_fix_probe.png`
  - `apps/mobile/c1_fix_probe.xml`
  - `apps/mobile/c1_fix_360dp.png`
  - `apps/mobile/c1_fix_360dp.xml`
  - `apps/mobile/c1_fix_412dp.png`
  - `apps/mobile/c1_fix_412dp.xml`

### 2026-05-30 - C2 Google sign-in flow (`P0`) - ✅ Completed (PASS)
- Scope:
  - happy path login
  - cancel path
  - callback handling and session establishment
  - retry/idempotency behavior
- Environment:
  - automated auth/navigation regression:
    - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/auth/SignInScreen.test.tsx src/__tests__/navigation/useRootNavigationSession.test.ts`
- Result:
  - PASS: happy-path OAuth success establishes session.
  - PASS: cancel path handled with expected cancelled flow state/telemetry.
  - PASS: callback handling supports code/tokens and session establishment.
  - PASS: retry and idempotency are covered (pending exchange restore, duplicate callback dedup).
  - Note: this run validates app logic and integration seams via mocks; real-provider live OAuth remains a separate manual environment check.
- Evidence artifacts:
  - [SignInScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/auth/SignInScreen.test.tsx)
  - [useRootNavigationSession.test.ts](/C:/projects/kezek/apps/mobile/src/__tests__/navigation/useRootNavigationSession.test.ts)
- Bugs found:
  - none in C2 run.

### 2026-05-30 - A3 Deep links and app scheme (`P0`) - 🔁 Re-test on current build (FAIL)
- Scope:
  - `kezek://` deep links
  - auth callback deep links
  - links from external browser/app back into mobile app
- Runtime retest (Android emulator, installed `kg.kezek.app`):
  - PASS: `kezek://booking/test-slug` -> `kg.kezek.app/.MainActivity`
  - PASS: `kezek://auth/callback?code=...` -> `kg.kezek.app/.MainActivity`
  - PASS: `kezek://callback-mobile?exchange_code=...` -> `kg.kezek.app/.MainActivity`
  - FAIL: `https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback` -> Chrome (`com.android.chrome/...`)
- Conclusion:
  - A3 remains failing on currently installed app build for HTTPS callback handoff.
  - `MB-002` fix is manifest-level and must be verified on a rebuilt/reinstalled app binary.

### 2026-05-31 - A3 Deep links and app scheme (`P0`) - ✅ Post-fix live verify (PASS)
- Scope:
  - `kezek://` deep links
  - auth callback deep links
  - links from external browser/app back into mobile app
- Environment:
  - Android Emulator `Pixel_7_Pro` (`emulator-5554`)
  - app package: `kg.kezek.app`
  - deployed web callback endpoint with server-side Android redirect
- Validation steps:
  - verified production response for Android user-agent:
    - `https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback`
    - response: `302` with `Location: intent://auth/callback#Intent;scheme=kezek;package=kg.kezek.app;end`
  - checked app-links state:
    - initial: `Selection state -> Disabled: kezek.kg`
    - enabled via:
      - `adb -s emulator-5554 shell cmd package set-app-links-user-selection --user 0 --package kg.kezek.app true kezek.kg`
  - reran deep-link intent test:
    - `adb -s emulator-5554 shell am start -W -a android.intent.action.VIEW -d "https://kezek.kg/auth/callback-mobile?redirect=kezek://auth/callback"`
- Result:
  - PASS: resolved activity switched to `kg.kezek.app/expo.modules.devlauncher.launcher.DevLauncherActivity`
  - PASS: `topResumedActivity` and `ResumedActivity` show `kg.kezek.app/...`
- Conclusion:
  - A3 is now live-verified after fix.
  - `MB-002` can be treated as closed (`verified`) with noted Android app-links selection precondition.

C3 live update (2026-06-01):
- after installing Telegram APK on emulator, external handoff now opens Telegram app activity instead of Chrome.
- remaining item for full closure: complete Telegram in-app auth confirmation and verify callback return into Kezek session.

C3 callback simulation note (2026-06-01):
- return-from-external deep link mechanism verified technically (callback intent brings app to foreground and reaches auth callback handler).
- full success completion still requires valid Telegram-issued exchange code from real bot confirmation flow.

C6 preliminary note (2026-06-01):
- Functional sign-out path exists and is covered by screen tests.
- UX discoverability risk logged as `MB-008` (logout perceived as missing by user in primary flow).

C6 live completion (2026-06-01):
- User-confirmed live result: `Выйти из аккаунта` works in emulator flow.
- Post-logout route reset to Auth confirmed in manual run.
- C6 can be treated as live verified.
