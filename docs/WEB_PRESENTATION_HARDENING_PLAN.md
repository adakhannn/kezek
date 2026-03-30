# Web Presentation Hardening Plan

**Status:** completed  
**Created:** 2026-03-30  
**Purpose:** reduce the next biggest maintainability hotspots in `apps/web` after the API thin-route wave and the mobile hardening wave.

## Why This Package Is Next

The next highest-value complexity cluster has shifted back to `apps/web`, but now in page and presentation modules rather than route handlers.

The biggest remaining live hotspots include:

- [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx)
- [view.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/view.tsx)
- [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/overview/page.tsx)
- [AllStaffFinanceStats.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/finance/components/AllStaffFinanceStats.tsx)
- [Client.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx)

This package has:

- high cleanup value
- medium implementation risk
- strong user-facing leverage
- a clear first candidate with existing tests

## Scope

In scope:

- decompose large web page and client components
- move heavy page-local orchestration and derived state into focused hooks or child sections
- keep top-level pages readable as composition instead of monoliths
- preserve or improve smoke and behavior coverage where practical

Out of scope:

- another route architecture wave
- large domain rewrites
- lint-hardening unless a presentation task is blocked by it

## Ranked Candidates

### 1. Finance workspace decomposition

- Priority: `critical`
- Files:
  - [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx)
  - adjacent finance workspace components and hooks

Why first:

- the largest active React presentation file in the repo
- still owns a lot of UI state, debounced save flow, derived shift math, and tab composition
- already has behavior tests, which makes the refactor safer

### 2. Dashboard bookings page cleanup

- Priority: `high`
- Files:
  - [view.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/view.tsx)

### 3. Analytics/admin page cleanup

- Priority: `high`
- Files:
  - [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/overview/page.tsx)
  - [page.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/analytics/page.tsx)

### W.3 Decompose analytics/admin pages

- Priority: `high`
- Status: `done`
- Files:
  - [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/overview/page.tsx)
  - [page.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/analytics/page.tsx)

Tasks:

- split analytics pages into page composition, data-loading hooks, and presentation sections
- reduce large inline KPI/filter/trend blocks in admin and dashboard analytics screens
- preserve existing behavior while making page files materially smaller and easier to scan

Done when:

- top-level analytics pages read as composition instead of mixed fetch/state/render modules
- filters, KPI sections, and trends are no longer defined inline in the same page files
- the package remains green under `pnpm -C apps/web typecheck`

Progress:

- extracted admin analytics page-local types into [types.ts](/C:/projects/kezek/apps/web/src/app/admin/analytics/overview/types.ts)
- moved admin analytics fetch/persist/derived-state orchestration into [useAdminAnalyticsOverviewData.ts](/C:/projects/kezek/apps/web/src/app/admin/analytics/overview/useAdminAnalyticsOverviewData.ts)
- moved admin analytics loading, error, filters, KPI, and trends presentation into [AdminAnalyticsOverviewSections.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/overview/AdminAnalyticsOverviewSections.tsx)
- reduced [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/overview/page.tsx) to a `54` line composition root
- extracted dashboard analytics page-local types into [types.ts](/C:/projects/kezek/apps/web/src/app/dashboard/analytics/types.ts)
- moved dashboard analytics fetch and derived-state orchestration into [useDashboardAnalyticsPageData.ts](/C:/projects/kezek/apps/web/src/app/dashboard/analytics/useDashboardAnalyticsPageData.ts)
- moved dashboard analytics header, filters, KPI, trends, and load heatmap presentation into [DashboardAnalyticsSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/analytics/DashboardAnalyticsSections.tsx)
- reduced [page.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/analytics/page.tsx) to a `64` line composition root
- verified with `pnpm -C apps/web typecheck`

### W.4 Decompose all-staff finance stats

- Priority: `high`
- Status: `done`
- File:
  - [AllStaffFinanceStats.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/finance/components/AllStaffFinanceStats.tsx)

Tasks:

- separate finance stats data-loading, auto-refresh behavior, and top-level presentation sections
- move summary cards, filters, and staff table rendering out of the root component
- keep the screen readable as composition instead of one large procedural component

Done when:

- the root component no longer mixes fetch logic, auto-refresh, filters, totals, and table rendering inline
- finance stats behavior remains green under `pnpm -C apps/web typecheck`

Progress:

- extracted finance stats types into [allStaffFinanceStatsTypes.ts](/C:/projects/kezek/apps/web/src/app/dashboard/finance/components/allStaffFinanceStatsTypes.ts)
- moved fetch and auto-refresh orchestration into [useAllStaffFinanceStatsData.ts](/C:/projects/kezek/apps/web/src/app/dashboard/finance/components/useAllStaffFinanceStatsData.ts)
- moved filters, summary cards, and staff list/table presentation into [AllStaffFinanceStatsSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/finance/components/AllStaffFinanceStatsSections.tsx)
- reduced [AllStaffFinanceStats.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/finance/components/AllStaffFinanceStats.tsx) to a composition root over extracted sections
- verified with `pnpm -C apps/web typecheck`

### W.5 Decompose staff schedule client

- Priority: `high`
- Status: `done`
- File:
  - [Client.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx)

Tasks:

- separate schedule day/week presentation and transfers tab from the root screen
- reduce the root file to schedule orchestration plus top-level tab composition
- preserve existing schedule save/apply behavior under typecheck

Done when:

- the root client no longer keeps inline transfers UI and day-card rendering blocks
- week/day schedule presentation is split into focused section files
- the package remains green under `pnpm -C apps/web typecheck`

Progress:

- extracted shared schedule types into [scheduleTypes.ts](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/schedule/scheduleTypes.ts)
- extracted transfers presentation into [TransfersTab.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/schedule/TransfersTab.tsx)
- extracted single-range input, day row, tabs, week sections, and instructions into [ScheduleSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/schedule/ScheduleSections.tsx)
- reduced [Client.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx) from `1019` to `367` lines while keeping save/apply orchestration local
- verified with `pnpm -C apps/web typecheck`

## Phase 1

### W.1 Decompose `FinancePage`

- Priority: `critical`
- Status: `done`

Tasks:

- split the page into top-level composition, local orchestration, and presentation sections
- move debounced save and client-list orchestration behind focused hooks/helpers where possible
- reduce the main component size and scanning cost without changing behavior

Done when:

- the top-level page no longer reads like a single procedural block
- local orchestration and rendering responsibilities are more clearly separated
- existing finance tests still pass

Progress:

- extracted tab/date/session view state into [useFinancePageViewState.ts](/C:/projects/kezek/apps/web/src/app/staff/finance/hooks/useFinancePageViewState.ts)
- wired [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx) to the new hook so the top-level component no longer owns that whole inline state block
- extracted debounced client autosave/flush behavior into [useFinanceClientAutosave.ts](/C:/projects/kezek/apps/web/src/app/staff/finance/hooks/useFinanceClientAutosave.ts)
- rewired [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx) to use the new autosave hook while preserving existing debounce behavior
- extracted top-level page sections into [FinancePageSections.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePageSections.tsx)
- reduced [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx) to a clearer composition of header, tabs, and tab-specific sections
- current top-level [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx) is down to `634` lines and now reads primarily as composition plus screen-specific handlers
- verified with `pnpm -C apps/web typecheck`
- verified with `pnpm -C apps/web test -- --runInBand --forceExit --runTestsByPath src/app/staff/finance/components/__tests__/FinancePage.debounce.test.tsx`

### W.2 Decompose dashboard bookings view

- Priority: `high`
- Status: `done`
- File:
  - [view.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/view.tsx)

Tasks:

- separate filter/query state, booking actions, and tab presentation
- move dashboard booking orchestration into focused hooks/helpers
- make the page read as composition instead of mixed data and UI flow

Done when:

- the main bookings view is materially smaller and easier to scan
- booking actions and filter logic are not interleaved through the whole page
- the existing behavior is preserved by targeted checks

Progress:

- extracted dashboard booking tabs and calendar section into [BookingsViewSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/BookingsViewSections.tsx)
- rewired [view.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/view.tsx) to consume the external tabs/calendar presentation module
- extracted the list-tab screen into [DashboardBookingsListSection.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/DashboardBookingsListSection.tsx)
- moved list filtering, paging, attendance, confirm and cancel orchestration behind [useDashboardBookingsListController.ts](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/useDashboardBookingsListController.ts)
- centralized shared screen types in [bookingsViewTypes.ts](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/bookingsViewTypes.ts)
- reduced [view.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/view.tsx) to a `67` line composition root over extracted calendar, list and desk sections
- verified with `pnpm -C apps/web typecheck`

### W.6 Decompose public booking flow view

- Priority: `high`
- Status: `done`
- File:
  - [view.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/view.tsx)

Tasks:

- separate the public booking flow render tree from page-local orchestration
- move step sections, summary layout, and step action handlers out of the root screen
- keep the booking flow behavior green while shrinking the main file into a clearer composition layer

Done when:

- the root booking view no longer contains the full step 1-5 render tree inline
- booking step presentation is split into focused section files
- the package remains green under `pnpm -C apps/web typecheck`

Progress:

- extracted step 1-5 presentation, step navigation, and summary layout into [BookingFormSections.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingFormSections.tsx)
- rewired [view.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/view.tsx) to use explicit `handleBranchSelect`, `handleDayChange`, `handleStaffSelect`, `handleServiceToggle`, and `handleSlotSelect` handlers instead of keeping the entire render tree inline
- extracted branch/day/staff/service restore and selection synchronization into [useBookingSelectionState.ts](/C:/projects/kezek/apps/web/src/app/b/[slug]/hooks/useBookingSelectionState.ts)
- extracted auth subscription and business-view analytics side effects into [useBookingViewerMeta.ts](/C:/projects/kezek/apps/web/src/app/b/[slug]/hooks/useBookingViewerMeta.ts)
- extracted slots refresh and post-RPC slot filtering into [useBookingSlotsState.ts](/C:/projects/kezek/apps/web/src/app/b/[slug]/hooks/useBookingSlotsState.ts)
- extracted availability and display-derived state into [useBookingFlowDerived.ts](/C:/projects/kezek/apps/web/src/app/b/[slug]/hooks/useBookingFlowDerived.ts)
- reduced [view.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/view.tsx) from `866` to `427` lines while preserving the existing slot, funnel, and booking creation flow
- verified with `pnpm -C apps/web typecheck`
