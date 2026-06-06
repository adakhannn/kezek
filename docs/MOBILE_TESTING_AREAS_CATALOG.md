# MOBILE TESTING AREAS CATALOG

Last updated: 2026-06-03  
Owner: QA flow (User + Codex)  
Status: Active baseline

## Progress snapshot (2026-06-03)
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
- [x] D3 Booking confirmation and details (100% live verified after deployed cancel recheck)
- [x] D4 Deep-linked booking screens (100% live verified after stale-state fix; `MB-014`, `MB-015`)
- [x] E1 Cabinet home and bookings list (live + targeted tests; `MB-016`)
- [x] E2 Profile data and edits (live + targeted tests; `MB-017`, `MB-018`)
- [x] F1 Staff screen baseline (100% live staff-role check + targeted tests; `MB-019`, `MB-020`)

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
- post-deploy live cancel recheck passed:
  - confirmation dialog opened from details.
  - `POST https://kezek.kg/api/mobile/bookings/:id` succeeded with mobile Bearer session.
  - app returned to Cabinet.
  - success toast `Бронирование отменено` was visible.
  - Cabinet counters updated to `Предстоящие: 0`, `История: 2`.
- residual bug observed during this successful path:
  - `MB-013` (`offlineBookingsStorage` dev error toast after list refresh) -> verified fixed on 2026-06-02.
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
  - `apps/mobile/d3_post_deploy_cancel_dialog.png`
  - `apps/mobile/d3_post_deploy_after_cancel_confirm.png`
  - `apps/mobile/d3_post_deploy_after_cancel_logcat.txt`
- bugs found:
  - `MB-009`
  - `MB-010`
  - `MB-011`
  - `MB-012`
  - `MB-013`

### D4. Deep-linked booking screens (`P2`)
- direct open by booking slug/id
- graceful handling for invalid ids
- status: `verified`
- live result (2026-06-02):
  - PASS: `kezek://booking/low-fade` opens booking Step 1 with `Low Fade`.
  - PASS: invalid booking slug opens graceful empty state `Бизнес не найден`.
  - PASS: `kezek://booking-detail/c881a2b7-9115-4ab1-9549-794d27c39927` opens booking details.
  - PASS: invalid booking id opens graceful empty state `Бронирование не найдено`.
- automated checks:
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/BookingScreen.test.tsx src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/screens/BookingStep1Branch.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
- evidence:
  - `apps/mobile/d4_postfix_valid_slug.png`
  - `apps/mobile/d4_postfix_invalid_slug.png`
  - `apps/mobile/d4_postfix_valid_booking_detail.png`
  - `apps/mobile/d4_postfix_invalid_booking_detail.png`
- bugs found and verified:
  - `MB-014`
  - `MB-015`

---

## E. Cabinet and profile

### E1. Cabinet home and bookings list (`P1`)
- list loading/empty/error states
- card readability and action buttons
- status: `verified`
- live result (2026-06-02):
  - PASS: Cabinet opens for authenticated user and shows profile label.
  - PASS: upcoming empty state renders when there are no upcoming bookings.
  - PASS: history tab renders booking cards with service, business, status, date/time, staff and address.
  - PASS: tapping a history booking card opens booking details.
- automated checks:
  - PASS: loading/root render smoke.
  - PASS: empty upcoming list state.
  - PASS: API envelope booking list render.
  - PASS: network error with no offline cache renders explicit retry/error state.
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/CabinetScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
- evidence:
  - `apps/mobile/e1_cabinet_current.png`
  - `apps/mobile/e1_scrolled.xml`
  - `apps/mobile/e1_history_cards.png`
  - `apps/mobile/e1_history_card_action_details.png`
- bugs found and verified:
  - `MB-016`

### E2. Profile data and edits (`P1`)
- profile form updates
- validation and server error handling
- persistence after app restart
- status: `verified`
- live result (2026-06-02):
  - PASS: Profile opens from Cabinet after schema fix.
  - PASS: localized labels render cleanly (`???????`, `?????? ??????????`, `???`, `???????`, `???????????`).
  - PASS: current profile values render (`Anonymized`, phone, auth email).
  - PASS: saving current values succeeds without breaking the screen.
  - PASS: profile values persist after JS reload/reopen.
- automated checks:
  - PASS: profile root and localized data render.
  - PASS: update payload is sent with trimmed values.
  - PASS: empty name validation blocks save.
  - PASS: invalid phone validation blocks save.
  - PASS: server update error is surfaced via toast.
  - PASS: profile load error state renders retry UI.
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/ProfileScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
- evidence:
  - `apps/mobile/e2_profile_current.png`
  - `apps/mobile/e2_profile_after_schema_fix.png`
  - `apps/mobile/e2_profile_save_same_values.png`
  - `apps/mobile/e2_profile_after_reload.png`
- bugs found and verified:
  - `MB-017`
  - `MB-018`

### E3. Preferences and notifications (`P2`)
- toggle behavior
- save/reload consistency

---

## F. Staff and shifts domain

### F1. Staff screen baseline (`P1`)
- staff dashboard rendering
- availability and key actions
- status: `verified`
- live result (2026-06-03):
  - PASS: authenticated staff account exposes the `Работа` tab after login.
  - PASS: staff dashboard renders with real staff context: `Adakhan`, `Low Fade Юго-Восток`, `Low Fade`.
  - PASS: upcoming bookings empty state renders clearly when there are no upcoming staff bookings.
  - PASS: action buttons are visible above the bottom tab bar after layout fix.
  - PASS: `Моя смена` opens `ShiftQuick`.
  - PASS: `Статистика` opens `Shifts` / `Смены и статистика`.
  - Note: `ShiftQuick` and `Shifts` currently show their own load/error states for shift data; those are covered by F2/F3, not F1 baseline.
- automated checks:
  - PASS: non-staff empty state renders.
  - PASS: staff dashboard renders staff name, branch, business and upcoming booking card.
  - PASS: key actions navigate to `ShiftQuick` and `Shifts`.
  - PASS: staff query error renders explicit retry/error state instead of misleading non-staff state.
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/StaffScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
- evidence:
  - `apps/mobile/f1_staff_role_tabs.png`
  - `apps/mobile/f1_staff_dashboard_after_reinstall.png`
  - `apps/mobile/f1_staff_dashboard_after_reinstall.xml`
  - `apps/mobile/f1_staff_action_shiftquick_final.png`
  - `apps/mobile/f1_staff_action_shiftquick_final.xml`
  - `apps/mobile/f1_staff_action_shifts_final.png`
  - `apps/mobile/f1_staff_action_shifts_final.xml`
- bugs found and verified:
  - `MB-019`
  - `MB-020`

### F2. Shift quick workspace (`P0`)
- open/close shift
- add/edit shift clients/items
- offline queue visibility and sync/retry behavior
- status: `verified`
- live result (2026-06-03, post-deploy):
  - PASS: `GET /api/staff/finance` succeeds on production with the mobile Bearer staff session.
  - PASS: staff user can open Staff tab -> My shift; ShiftQuick renders active/closed shift states with readable Russian text.
  - PASS: open shift flow works; `POST /api/staff/shift/open` returns success and the UI switches to active shift state.
  - PASS: manual client/item add works; `POST /api/staff/shift/items` returns success and persisted metrics show turnover `500`, master `300`, salon `300`, clients `1`.
  - PASS: close shift flow works; confirmation dialog appears, `POST /api/staff/shift/close` returns success, and the UI switches to closed shift state while preserving the client item.
  - PASS: manual shift client/item cards expose edit while the shift is open.
  - PASS: edit mode reuses the client form, validates required fields, saves through `/api/staff/shift/items`, and refreshes the visible card.
  - PASS: test shift cleanup works after edit verification; `POST /api/staff/shift/close` returns success.
  - PASS: offline add persists an `addItem` operation and displays `1 операций в очереди`.
  - PASS: a failed retry while still offline retains the operation instead of clearing it.
  - PASS: reconnect plus pull-to-refresh sends `/api/staff/shift/items`, clears the queue after success, refreshes finance data, and renders the synced client.
- earlier live blocker (2026-06-03):
  - BEFORE FIX: production `GET /api/staff/finance` returned `401 UNAUTHORIZED` for the mobile Bearer session and blocked F2 live verification.
  - AFTER DEPLOY: verified fixed in production via logcat success for `/api/staff/finance`, `/api/staff/shift/open`, `/api/staff/shift/items`, and `/api/staff/shift/close`.
- automated checks:
  - PASS: web staff finance/open/close/items targeted API tests.
  - PASS: mobile ShiftQuick idle state, open action, active add-client flow, load-error state, non-staff state.
  - PASS: `corepack pnpm -C apps/mobile typecheck`.
  - PASS: `corepack pnpm -C apps/web typecheck`.
- commands:
  - `corepack pnpm -C apps/web test -- --runInBand src/__tests__/api/staff/finance.test.ts src/__tests__/api/staff/shift/open.test.ts src/__tests__/api/staff/shift/close.test.ts src/__tests__/api/staff/shift/items.test.ts src/__tests__/lib/staffFinanceRouteService.test.ts src/__tests__/lib/staffShiftOpenHttpService.test.ts src/__tests__/lib/staffShiftCloseHttpService.test.ts src/__tests__/lib/staffShiftItemsRouteService.test.ts`
  - `corepack pnpm -C apps/mobile test -- --runInBand src/__tests__/screens/ShiftQuickScreen.test.tsx`
  - `corepack pnpm -C apps/mobile typecheck`
  - `corepack pnpm -C apps/web typecheck`
- evidence:
  - `apps/mobile/f2_post_deploy_finance_success.png`
  - `apps/mobile/f2_open_shift_after_toast_dismiss.png`
  - `apps/mobile/f2_add_client_filled.png`
  - `apps/mobile/f2_after_add_client.png`
  - `apps/mobile/f2_client_list_after_add.png`
  - `apps/mobile/f2_after_close_shift_wait.png`
  - `apps/mobile/mb023_current.png`
  - `apps/mobile/mb023_edit_form2.png`
  - `apps/mobile/mb023_edit_form_prefilled.png`
  - `apps/mobile/mb023_after_back_hide_keyboard.png`
  - `apps/mobile/mb023_after_close_wait.png`
  - `apps/mobile/f2_fix_queue_banner.png`
  - `apps/mobile/f2_fix_after_reconnect.png`
  - `apps/mobile/f2_fix_synced_client.png`
  - `apps/mobile/f2_fix_shift_closed_final.png`
- bugs found:
  - `MB-021`
  - `MB-022`
  - `MB-023`
  - `MB-024`

### F3. Shift history screen (`P1`)
- period filters
- totals and item integrity
- empty/error states
- status: `partial-pass-pending-deploy`
- live verification (2026-06-06):
  - PASS: authenticated staff can open `Смены и статистика`.
  - PASS: production API failure is rendered as a dedicated error state with a visible `Повторить` action.
  - PASS: tapping `Повторить` sends a new request and keeps the screen stable when the request fails again.
  - BLOCKED: production happy-path checks for day/month/year periods, real totals/items, and a successful empty period are blocked by the deployed endpoint returning `401` for mobile Bearer auth.
- automated verification:
  - PASS: `День`, `Месяц`, and `Год` select the expected API period.
  - PASS: totals, staff/business shares, client count, shift card, expanded client/service, and consumables remain consistent with the API response.
  - PASS: successful empty response renders `Нет смен`.
  - PASS: failed response renders the dedicated retry state.
  - PASS: mobile ShiftsScreen tests (`5/5`).
  - PASS: web finance stats route/service tests (`6/6`).
- evidence:
  - `apps/mobile/f3_stats_open.png`
  - `apps/mobile/f3_initial_logcat.txt`
  - `apps/mobile/f3_error_retry_after_tap.png`
  - `apps/mobile/f3_retry_logcat.txt`
- bugs found:
  - `MB-025`
  - `MB-026`
- completion requirement:
  - deploy `MB-025`, then repeat live day/month/year, totals/item expansion, and successful empty-period checks.

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
