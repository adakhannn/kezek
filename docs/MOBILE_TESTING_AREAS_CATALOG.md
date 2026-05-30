# MOBILE TESTING AREAS CATALOG

Last updated: 2026-05-30  
Owner: QA flow (User + Codex)  
Status: Active baseline

## Progress snapshot (2026-05-30)
- [x] A1 App launch and bootstrapping
- [x] A2 Environment and config wiring
- [x] A3 Deep links and app scheme (fix applied for `MB-002`, rebuild verification pending)
- [x] A4 Network/offline baseline
- [x] B1 Root navigation
- [ ] B2 Tab and stack navigation (manual auth-gated part pending)
- [x] B3 Header and back actions
- [x] B4 Linking config consistency (fix applied for `MB-003`)
- [x] C1 Sign-in UI/UX
- [x] C2 Google sign-in flow

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

### C3. Telegram sign-in flow (`P0`)
- start flow and external handoff
- pending status behavior
- return-from-external-app behavior
- timeout/cancel/failure handling

### C4. WhatsApp sign-in entry flow (`P1`)
- entry point visibility by feature flag
- navigation to WhatsApp auth screen
- send/retry interactions and guardrails

### C5. Session restoration (`P0`)
- app resume restores valid session
- pending exchange recovery path
- stale session cleanup behavior

### C6. Sign-out and post-logout state (`P1`)
- sign-out correctness
- route reset and token/session invalidation

---

## D. Client booking flows

### D1. Booking entry and branch selection (`P1`)
- branch list rendering and selection
- empty/error/loading states

### D2. Service/staff/date/time steps (`P1`)
- step transitions
- disabled/invalid state handling
- summary consistency between steps

### D3. Booking confirmation and details (`P1`)
- final confirmation path
- detail screen integrity
- cancellation/repeat actions

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
