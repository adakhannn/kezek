# Mobile Architecture Hardening Plan

**Status:** active implementation plan  
**Created:** 2026-03-30  
**Purpose:** reduce the next largest maintainability hotspots after the web API thin-route wave.

## Why This Package Is Next

The next highest-value complexity cluster is in `apps/mobile`.

The audit shows:

- [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx) is still a large screen with auth, cache, offline queue, mutations, and UI in one file.
- [ShiftsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftsScreen.tsx) still mixes data loading and presentation.
- [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx) and [BookingDetailsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/BookingDetailsScreen.tsx) are still large user-facing screens.
- The mobile app already has successful examples of decomposition from the earlier `HomeScreen` and `RootNavigator` work.

This package has:

- high cleanup value
- medium implementation risk
- clear user-facing leverage
- strong precedent from the earlier mobile stabilization wave

## Scope

In scope:

- decompose remaining large mobile screens
- move network, session, offline, and mutation orchestration into hooks or services
- make screens read like composition instead of monoliths
- preserve or improve smoke-test coverage for key flows

Out of scope:

- redesigning the mobile product UX
- large shared-domain rewrites
- new web API architecture work unless the mobile package is blocked on it

## Ranked Candidates

### 1. Shift quick flow hardening

- Priority: `critical`
- Files:
  - [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx)
  - related shift hooks/services to be introduced under `apps/mobile/src/screens/shift/` or `apps/mobile/src/hooks/`

Why first:

- largest remaining mobile screen
- mixes offline queue, cache, staff lookup, shift mutations, and UI state
- likely to produce the biggest maintainability improvement per file touched

### 2. Shift history and stats decomposition

- Priority: `high`
- Files:
  - [ShiftsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftsScreen.tsx)

Why second:

- still directly loads staff data and stats in the screen
- natural follow-up once shift services and hooks exist

### 3. Cabinet and booking detail cleanup

- Priority: `high`
- Files:
  - [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx)
  - [BookingDetailsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/BookingDetailsScreen.tsx)

Why third:

- user-facing complexity remains high
- likely benefits from the same presentation and data-hook pattern

## Implementation Principles

- screen files should mostly compose hooks and UI blocks
- offline or mutation workflows should not live inline in top-level screen bodies
- keep transport logic out of screen render modules
- add tests at the boundary where behavior becomes easier to verify

## Phase 1

### M.1 Decompose `ShiftQuickScreen`

- Priority: `critical`
- Status: `done`

Tasks:

- split the screen into UI sections, data-loading, offline queue handling, and mutations
- move cache and offline queue logic into dedicated mobile hooks or services
- reduce the screen to top-level orchestration and composition

Done when:

- the main screen no longer contains offline queue, cache persistence, and request orchestration inline
- the file is substantially smaller and easier to scan
- the behavior is covered by at least a smoke test for the main happy path

Result on 2026-03-30:

- [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx) now acts as a composition screen instead of holding all screen logic inline.
- Offline queue and cache persistence moved into [offlineStorage.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/offlineStorage.ts).
- Query and mutation orchestration moved into [useShiftQuickScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/useShiftQuickScreenData.ts).
- Presentation and styles moved into [ShiftQuickSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/ShiftQuickSections.tsx) and [shiftQuickStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/shiftQuickStyles.ts).
- Smoke coverage was added in [ShiftQuickScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/ShiftQuickScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.2 Decompose `ShiftsScreen`

- Priority: `high`
- Status: `done`

Tasks:

- move staff lookup and stats loading into hooks
- extract filter controls and stats sections into focused components
- keep the screen file focused on composition

Done when:

- the screen does not directly own all query and rendering logic
- period and date filtering are easier to reason about and test

Result on 2026-03-30:

- [ShiftsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftsScreen.tsx) now acts as a thin composition screen.
- Data loading moved into [useShiftsScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/shifts/useShiftsScreenData.ts).
- Presentation moved into [ShiftsScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shifts/ShiftsScreenSections.tsx).
- Shared screen types and styles now live in [types.ts](/C:/projects/kezek/apps/mobile/src/screens/shifts/types.ts) and [shiftsScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/shifts/shiftsScreenStyles.ts).
- Smoke coverage was added in [ShiftsScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/ShiftsScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/screens/ShiftsScreen.test.tsx src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.3 Audit next mobile screen candidates after shift flows

- Priority: `medium`
- Status: `done`

Tasks:

- reassess `CabinetScreen` and `BookingDetailsScreen` after the shift flow refactor
- choose the next highest-value screen based on complexity and user impact

Done when:

- the next concrete mobile screen candidate is chosen with a clear reason

Result on 2026-03-30:

- [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx) was chosen as the next candidate over [BookingDetailsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/BookingDetailsScreen.tsx) because it mixed user loading, booking fetches, offline fallback, tab state, and presentation in one file.
- [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx) now acts as a thin composition screen.
- Data loading and offline fallback moved into [useCabinetScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/useCabinetScreenData.ts).
- Presentation moved into [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx).
- Shared types and styles now live in [types.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/types.ts) and [cabinetScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/cabinetScreenStyles.ts).
- Smoke coverage was updated in [CabinetScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/CabinetScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/screens/CabinetScreen.test.tsx src/__tests__/screens/ShiftsScreen.test.tsx src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.4 Decompose `BookingDetailsScreen`

- Priority: `medium`
- Status: `done`

Tasks:

- move booking fetch, cancellation flow, and refresh orchestration into a focused hook
- extract status, timing, branch, and actions presentation into small screen sections
- keep the screen file focused on navigation wiring and composition

Done when:

- the screen no longer owns the whole fetch/mutation/render flow inline
- booking details behavior still has smoke coverage for the main render path

Result on 2026-03-30:

- [BookingDetailsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/BookingDetailsScreen.tsx) now acts as a composition screen instead of owning fetch, cancel, linking, and presentation logic inline.
- Data loading and cancellation flow moved into [useBookingDetailsData.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/useBookingDetailsData.ts).
- Presentation moved into [BookingDetailsSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/BookingDetailsSections.tsx).
- Shared screen types and styles now live in [types.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/types.ts) and [bookingDetailsStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingDetails/bookingDetailsStyles.ts).
- Smoke coverage was updated in [BookingDetailsScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/BookingDetailsScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/screens/CabinetScreen.test.tsx src/__tests__/screens/ShiftsScreen.test.tsx src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.5 Re-rank remaining mobile complexity after the screen decomposition wave

- Priority: `medium`
- Status: `done`

Tasks:

- reassess remaining mobile screens and navigation modules after `ShiftQuickScreen`, `ShiftsScreen`, `CabinetScreen`, and `BookingDetailsScreen`
- choose whether the next package should continue in mobile UI, move to shared hooks/services, or return to web presentation cleanup
- capture the next candidate with a short reason and verification target

Done when:

- the next architecture step after the mobile screen wave is explicit
- the cleanup and next-phase docs point to the same next task

Result on 2026-03-30:

- The remaining mobile complexity was rescanned after the current screen decomposition wave.
- The largest remaining screen-level hotspot is now [StaffScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/StaffScreen.tsx), followed by [ProfileScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ProfileScreen.tsx) and then navigation/presentation follow-up in [MainNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/MainNavigator.tsx).
- The next recommended task is to decompose `StaffScreen`, because it still mixes staff lookup, upcoming bookings fetch, refresh orchestration, and screen presentation in one file.

### M.6 Decompose `StaffScreen`

- Priority: `high`
- Status: `done`

Tasks:

- move staff lookup and upcoming booking queries into a dedicated hook
- extract header, branch/business summary, bookings list, and action buttons into focused presentation sections
- keep the screen focused on navigation wiring and composition

Done when:

- the screen no longer owns query orchestration and layout in one file
- smoke coverage remains in place for the main staff happy path

Result on 2026-03-30:

- [StaffScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/StaffScreen.tsx) now acts as a thin composition screen.
- Staff lookup and upcoming booking queries moved into [useStaffScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/staff/useStaffScreenData.ts).
- Presentation moved into [StaffScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/staff/StaffScreenSections.tsx).
- Shared types and styles now live in [types.ts](/C:/projects/kezek/apps/mobile/src/screens/staff/types.ts) and [staffScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/staff/staffScreenStyles.ts).
- Smoke coverage was updated in [StaffScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/StaffScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/screens/StaffScreen.test.tsx src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/screens/CabinetScreen.test.tsx src/__tests__/screens/ShiftsScreen.test.tsx src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.7 Decompose `ProfileScreen`

- Priority: `high`
- Status: `done`

Tasks:

- move user/profile queries and save mutation into a focused hook
- extract the personal info form and notification settings into presentation sections
- add smoke coverage because the screen did not have a dedicated test before

Done when:

- the screen no longer mixes query orchestration, local form sync, and layout in one file
- profile render has at least a smoke test

Result on 2026-03-30:

- [ProfileScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ProfileScreen.tsx) now acts as a composition screen.
- User/profile loading, form state sync, save mutation, and sign-out confirm flow moved into [useProfileScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/profile/useProfileScreenData.ts).
- Presentation moved into [ProfileScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/profile/ProfileScreenSections.tsx).
- Shared types and styles now live in [types.ts](/C:/projects/kezek/apps/mobile/src/screens/profile/types.ts) and [profileScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/profile/profileScreenStyles.ts).
- Smoke coverage was added in [ProfileScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/ProfileScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/screens/ProfileScreen.test.tsx src/__tests__/screens/StaffScreen.test.tsx src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/screens/CabinetScreen.test.tsx src/__tests__/screens/ShiftsScreen.test.tsx src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.8 Re-rank next mobile follow-up after the profile/staff wave

- Priority: `medium`
- Status: `done`

Tasks:

- reassess remaining mobile screens and navigation modules after `StaffScreen` and `ProfileScreen`
- choose between `DashboardScreen`, navigation cleanup, or closing the mobile package and returning to the next cross-app architecture theme
- capture the next candidate with a short reason and verification target

Done when:

- the next step after the current mobile wave is explicit and documented

Result on 2026-03-30:

- After `StaffScreen` and `ProfileScreen`, the remaining mobile screen hotspot was reassessed.
- The next best screen-level candidate was [DashboardScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/DashboardScreen.tsx) because it still mixed owner checks, business loading, refresh orchestration, and presentation in one file.

### M.9 Decompose `DashboardScreen`

- Priority: `medium`
- Status: `done`

Tasks:

- move owner/business queries into a dedicated hook
- extract dashboard business list presentation into sections
- add smoke coverage because the screen did not have a dedicated test before

Done when:

- the screen no longer mixes auth/owner query orchestration and layout in one file
- dashboard render has at least a smoke test

Result on 2026-03-30:

- [DashboardScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/DashboardScreen.tsx) now acts as a composition screen.
- Owner/business loading moved into [useDashboardScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/dashboard/useDashboardScreenData.ts).
- Presentation moved into [DashboardScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/dashboard/DashboardScreenSections.tsx).
- Shared types and styles now live in [types.ts](/C:/projects/kezek/apps/mobile/src/screens/dashboard/types.ts) and [dashboardScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/dashboard/dashboardScreenStyles.ts).
- Smoke coverage was added in [DashboardScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/DashboardScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/screens/DashboardScreen.test.tsx src/__tests__/screens/ProfileScreen.test.tsx src/__tests__/screens/StaffScreen.test.tsx src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/screens/CabinetScreen.test.tsx src/__tests__/screens/ShiftsScreen.test.tsx src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.10 Re-rank the next mobile package after the dashboard/profile/staff wave

- Priority: `medium`
- Status: `done`

Tasks:

- reassess whether the next value is in remaining screen cleanup, navigator cleanup, or closing the mobile package
- identify the next single highest-value candidate from the updated repo state
- keep cleanup and next-phase plans aligned with the same next task

Done when:

- the next mobile or cross-app architecture step is explicit and documented

Result on 2026-03-30:

- After the dashboard/profile/staff wave, the next highest-value remaining screen-level hotspot was [BookingScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/BookingScreen.tsx).
- The reason was that the booking entry screen still mixed business bootstrap queries, promotions loading, analytics, and booking-context wiring in one file.

### M.11 Decompose `BookingScreen`

- Priority: `medium`
- Status: `done`

Tasks:

- move initial business bootstrap and promotions loading into a focused hook
- keep the top-level screen focused on route wiring and step composition
- add or refresh smoke coverage for the booking entry screen

Done when:

- the screen no longer owns the whole business-init flow inline
- the booking entry screen has smoke coverage for the main happy path

Result on 2026-03-30:

- [BookingScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/BookingScreen.tsx) now acts as a thin composition screen.
- Initial business bootstrap, promotions loading, analytics start event, and booking-context hydration moved into [useBookingScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/bookingFlow/useBookingScreenData.ts).
- Smoke coverage was added in [BookingScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/BookingScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/screens/BookingScreen.test.tsx src/__tests__/screens/DashboardScreen.test.tsx src/__tests__/screens/ProfileScreen.test.tsx src/__tests__/screens/StaffScreen.test.tsx src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/screens/CabinetScreen.test.tsx src/__tests__/screens/ShiftsScreen.test.tsx src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.12 Re-rank the remaining mobile follow-up after the booking-entry cleanup

- Priority: `medium`
- Status: `done`

Tasks:

- reassess the remaining mobile surface after the main screen decomposition wave
- decide whether the next highest-value task is `MainNavigator`, `HomeScreen` polish, or closing the mobile package
- keep cleanup and next-phase docs aligned with the same next task

Done when:

- the next mobile step is explicit from the updated repo state

Result on 2026-03-30:

- After the booking-entry cleanup, the remaining highest-value mobile follow-up was [MainNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/MainNavigator.tsx).
- The reason was that the main tab navigator still mixed cabinet stack declaration, shared visual options, and conditional tab composition in one file.

### M.13 Decompose `MainNavigator`

- Priority: `medium`
- Status: `done`

Tasks:

- extract shared tab and cabinet stack screen options into navigation config
- move the nested cabinet stack into its own navigator module
- add a smoke test for the navigation layer

Done when:

- the main navigator reads as top-level tab composition instead of one large config block
- the navigation layer has a smoke test

Result on 2026-03-30:

- [MainNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/MainNavigator.tsx) now acts as a thin top-level tab composition module.
- Shared tab and cabinet stack options moved into [mainNavigatorConfig.tsx](/C:/projects/kezek/apps/mobile/src/navigation/mainNavigatorConfig.tsx).
- The nested cabinet stack moved into [CabinetNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/CabinetNavigator.tsx).
- Smoke coverage was added in [MainNavigator.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/navigation/MainNavigator.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --forceExit --runTestsByPath src/__tests__/navigation/MainNavigator.test.tsx src/__tests__/screens/BookingScreen.test.tsx src/__tests__/screens/DashboardScreen.test.tsx src/__tests__/screens/ProfileScreen.test.tsx src/__tests__/screens/StaffScreen.test.tsx src/__tests__/screens/BookingDetailsScreen.test.tsx src/__tests__/screens/CabinetScreen.test.tsx src/__tests__/screens/ShiftsScreen.test.tsx src/__tests__/screens/ShiftQuickScreen.test.tsx`.

### M.14 Close out the current mobile hardening wave and choose the next package

- Priority: `medium`
- Status: `done`

Tasks:

- assess whether any remaining mobile modules still justify another architecture pass in this wave
- if not, mark the mobile hardening wave as complete
- choose the next package outside mobile and align the cleanup docs with that decision

Done when:

- the current mobile wave is either explicitly closed or extended with one justified next task
- cleanup and next-phase docs point to the same follow-up package

Result on 2026-03-30:

- The mobile hardening wave now covers the remaining main screen and navigator hotspots:
  `ShiftQuickScreen`, `ShiftsScreen`, `CabinetScreen`, `BookingDetailsScreen`, `StaffScreen`, `ProfileScreen`, `DashboardScreen`, `BookingScreen`, and `MainNavigator`.
- The remaining mobile files are no longer dominated by the same monolithic screen pattern that justified this wave.
- The current wave is therefore closed, and the next package moves back to web presentation cleanup.
- The next focused plan is [WEB_PRESENTATION_HARDENING_PLAN.md](/C:/projects/kezek/docs/WEB_PRESENTATION_HARDENING_PLAN.md).

### M.15 Post-wave home presentation split

- Priority: `low`
- Status: `done`

Tasks:

- reduce the remaining large presentational-only home module without reopening the whole mobile architecture wave
- keep `HomeScreen.tsx` and `useHomeScreenData.ts` untouched unless the split reveals a new orchestration problem
- refresh smoke coverage with more stable selectors if needed

Done when:

- the home screen sections no longer live in one large presentation file
- the home screen smoke test still passes after the split

Result on 2026-04-01:

- [HomeScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/HomeScreenSections.tsx) now acts as a thin export layer.
- Presentation was split into [HomeScreenHeader.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/HomeScreenHeader.tsx), [SearchSection.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/SearchSection.tsx), [BookingActivitySections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/BookingActivitySections.tsx), and [DiscoverySections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/DiscoverySections.tsx).
- Stable test selectors were added for the hero title and search input in the home screen presentation layer.
- Smoke coverage was refreshed in [HomeScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/HomeScreen.test.tsx).
- Verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --watchAll=false src/__tests__/screens/HomeScreen.test.tsx`.

### M.16 Booking slot orchestration extraction

- Priority: `low`
- Status: `done`

Tasks:

- extract slot loading, network-error handling, and domain-error mapping from the booking time step into a focused hook
- keep the screen focused on slot selection, progress UI, and navigation
- avoid reopening unrelated booking-step screens in the same pass

Done when:

- `BookingStep5Time.tsx` no longer owns the whole RPC/error-classification flow inline
- the booking time step remains type-safe after the split

Result on 2026-04-01:

- Slot loading and error classification moved into [useBookingStep5Slots.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep5Slots.ts).
- [BookingStep5Time.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep5Time.tsx) now acts more like a rendering and navigation screen for the time-step flow.
- The screen size dropped from `313` to `211` lines.
- Verified with `pnpm -C apps/mobile typecheck`.

### M.17 Booking flow early-step extraction pass

- Priority: `low`
- Status: `done`

Tasks:

- bring the first booking steps closer to the same hook-driven pattern already used in later mobile cleanup work
- extract business/bootstrap, services loading, and staff loading from the screen bodies
- keep the screens focused on selection, progress UI, and navigation

Done when:

- the first booking steps no longer mix query/bootstrap logic inline with the full render tree
- the mobile package still typechecks after the pass

Result on 2026-04-01:

- Business/bootstrap hydration moved from [BookingStep1Branch.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep1Branch.tsx) into [useBookingStep1Business.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep1Business.ts).
- Services loading moved from [BookingStep2Service.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep2Service.tsx) into [useBookingStep2Services.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep2Services.ts).
- Staff loading moved from [BookingStep3Staff.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep3Staff.tsx) into [useBookingStep3Staff.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep3Staff.ts).
- [BookingStep3Staff.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep3Staff.tsx) now measures `223` lines after extraction.
- Verified with `pnpm -C apps/mobile typecheck`.

### M.18 Booking flow final-step extraction pass

- Priority: `low`
- Status: `done`

Tasks:

- finish the remaining booking-step cleanup so date generation and booking confirmation no longer live inline in screen bodies
- keep the last screens focused on selection, summary rendering, and navigation
- avoid reopening unrelated mobile modules while closing the booking-flow follow-up

Done when:

- `BookingStep4Date.tsx` and `BookingStep6Confirm.tsx` follow the same hook-driven structure as the rest of the booking flow
- the mobile package still typechecks after the final pass

Result on 2026-04-01:

- Date-list generation and date-label formatting moved from [BookingStep4Date.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep4Date.tsx) into [useBookingStep4Dates.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep4Dates.ts).
- Booking confirmation derivation, validation, and submit orchestration moved from [BookingStep6Confirm.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep6Confirm.tsx) into [useBookingStep6Confirm.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep6Confirm.ts).
- The full booking step flow now follows a more uniform hook-plus-screen composition pattern.
- Verified with `pnpm -C apps/mobile typecheck`.
