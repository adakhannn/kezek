# UI/UX Redesign Roadmap

**Status:** active  
**Created:** 2026-04-01  
**Purpose:** provide a practical execution roadmap for full UI/UX redesign and unification across `web`, `mobile`, `dashboard`, `staff`, and `admin`.

## Goal

Turn Kezek from a collection of individually improved screens into a consistent product system with:

- shared visual language
- predictable interaction patterns
- strong accessibility and localization support
- aligned web and mobile experience
- maintainable UI architecture

## How To Use

Rules:

1. Work top-down by phase.
2. Prefer finishing foundations before mass screen redesign.
3. Mark task status as work progresses.
4. For each completed task, record the main files touched and verification performed.
5. Avoid redesigning isolated screens without first checking whether the needed primitive or pattern should be extracted for reuse.

## Legend

- Priority: `critical`, `high`, `medium`, `low`
- Status: `todo`, `next`, `active`, `done`, `blocked`

---

## Phase 1. Foundations

### UI-1 Create design foundation document

- Priority: `critical`
- Status: `done`

Tasks:

- define visual direction for the product
- define tone: trustworthy, modern, operational, premium but not decorative
- define density rules for public screens vs workspace screens
- define base radius, shadow, border, focus, spacing, and motion principles

Done when:

- one short source-of-truth document exists for visual rules
- new UI work no longer depends on ad hoc style decisions

Suggested output:

- `docs/UI_SYSTEM_FOUNDATION.md`

Progress:

- created [UI_SYSTEM_FOUNDATION.md](/C:/projects/kezek/docs/UI_SYSTEM_FOUNDATION.md)
- defined product character, visual direction, density rules, shape, color, spacing, focus, motion, and web/mobile alignment principles
- established the short source of truth needed before token and primitive work

### UI-2 Introduce semantic design tokens for web

- Priority: `critical`
- Status: `done`

Tasks:

- define semantic colors for background, surface, border, text, muted, accent, success, warning, danger
- define spacing scale
- define radii scale
- define shadow scale
- define focus ring tokens
- define container widths and responsive spacing

Done when:

- top-level web styling is driven by semantic tokens instead of scattered raw values
- screen work can reference tokens instead of inventing styles

Primary targets:

- `apps/web/src/app/globals.css`

Progress:

- rewrote [globals.css](/C:/projects/kezek/apps/web/src/app/globals.css) around semantic tokens for surfaces, text, borders, accent, status, focus, radius, spacing, shadow, container, and motion
- aligned light and dark modes around stable semantic meanings instead of only raw colors
- updated global background, typography baseline, selection styling, and focus ring behavior to use the token layer

### UI-3 Introduce semantic design tokens for mobile

- Priority: `critical`
- Status: `done`

Tasks:

- convert mobile palette into semantic UI tokens
- align web/mobile token meaning, not only raw color values
- add explicit tokens for surface, border, overlay, status, text hierarchy

Done when:

- mobile components consume semantic tokens
- mobile and web share the same design vocabulary

Primary targets:

- `apps/mobile/src/constants/colors.ts`

Progress:

- expanded [colors.ts](/C:/projects/kezek/apps/mobile/src/constants/colors.ts) into a semantic token map covering brand, surface, text, border, status, feedback, interaction, layout, and motion
- preserved legacy aliases so the current mobile code keeps working during the redesign wave
- aligned mobile token meaning with the same semantic model introduced on web

### UI-4 Define typography system

- Priority: `high`
- Status: `done`

Tasks:

- define display, page title, section title, body, caption, label, numeric emphasis styles
- align text hierarchy between public and workspace screens
- ensure long localized strings fit without breaking layout quality

Done when:

- typography is consistent across major screen groups
- pages no longer visually drift by local text sizing decisions

Progress:

- typography principles, hierarchy guidance, and screen-specific usage rules were documented in [UI_SYSTEM_FOUNDATION.md](/C:/projects/kezek/docs/UI_SYSTEM_FOUNDATION.md)
- the foundation now defines display, page title, section title, body, caption, and label responsibilities for future UI work
- this gives future redesign tasks a fixed hierarchy baseline instead of screen-by-screen typography choices
- completion is still pending at implementation level because major screen groups have not yet been normalized to the same type scale and hierarchy
- introduced shared typography utilities and scale tokens in [globals.css](/C:/projects/kezek/apps/web/src/app/globals.css)
- added semantic mobile typography constants in [typography.ts](/C:/projects/kezek/apps/mobile/src/constants/typography.ts)
- applied the new hierarchy to key public and workspace entry points in [HomeClientComponents.tsx](/C:/projects/kezek/apps/web/src/app/_components/HomeClientComponents.tsx), [DashboardHomeHero.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardHomeHero.tsx), [HomeScreenHeader.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/HomeScreenHeader.tsx), and [homeScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/home/homeScreenStyles.ts)
- extended the same typography system into workspace summary cards in [DashboardMetricsGrid.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardMetricsGrid.tsx), [DashboardOnboardingNotice.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardOnboardingNotice.tsx), [DashboardQuickActionsCard.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardQuickActionsCard.tsx), and [DashboardRatingCard.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardRatingCard.tsx)
- normalized cabinet booking hierarchy in [BookingCard.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/components/BookingCard.tsx) so service titles, metadata, timelines, promo blocks, review text, and action labels all consume the shared type scale
- rolled the same type hierarchy through the staff workspace detail view in [StaffDetailPageClient.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/StaffDetailPageClient.tsx), covering hero, rating, section headers, review states, and operational notes
- aligned public booking and business flows in [BookingFormClient.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/booking/BookingFormClient.tsx), [BookingHeader.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingHeader.tsx), [BookingSteps.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingSteps.tsx), [BookingFormSections.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingFormSections.tsx), and [BusinessInfo.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/BusinessInfo.tsx)
- normalized the mobile cabinet type scale in [cabinetScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/cabinetScreenStyles.ts) so headers, tabs, booking cards, offline feedback, and empty states use the same display/page-title/section/body/caption/label vocabulary as the rest of the app
- verified with `pnpm -C apps/web typecheck` and `pnpm -C apps/mobile typecheck`

### UI-5 Define motion and transition rules

- Priority: `medium`
- Status: `done`

Tasks:

- define transitions for hover, press, focus, open/close, loading, success
- keep motion subtle and meaningful
- ensure motion does not compete with usability on workspace screens

Done when:

- repeated animation patterns are documented and reused
- motion feels deliberate rather than incidental

Progress:

- motion principles, intended use cases, and anti-patterns were documented in [UI_SYSTEM_FOUNDATION.md](/C:/projects/kezek/docs/UI_SYSTEM_FOUNDATION.md)
- the foundation now fixes expected motion behavior for button press, toasts, modals, transitions, and step progression
- this gives later implementation work a shared motion baseline instead of ad hoc animation choices
- introduced reusable web motion tokens and classes in [globals.css](/C:/projects/kezek/apps/web/src/app/globals.css), including standard/emphasized easing, press/lift/toast distances, and reduced-motion handling
- rolled those motion patterns into shared web primitives in [Button.tsx](/C:/projects/kezek/apps/web/src/components/ui/Button.tsx), [Card.tsx](/C:/projects/kezek/apps/web/src/components/ui/Card.tsx), [Input.tsx](/C:/projects/kezek/apps/web/src/components/ui/Input.tsx), and [Toast.tsx](/C:/projects/kezek/apps/web/src/components/ui/Toast.tsx)
- fixed the web toast lifecycle so close animations actually complete before unmount, turning toast motion into a deliberate reusable pattern instead of a nominal transition
- introduced shared mobile motion constants in [motion.ts](/C:/projects/kezek/apps/mobile/src/constants/motion.ts) and a reusable press interaction primitive in [MotionPressable.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/MotionPressable.tsx)
- applied the same mobile motion system to [Button.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Button.tsx), [Toast.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Toast.tsx), and key cabinet touch targets in [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx)
- verified with `pnpm -C apps/web typecheck` and `pnpm -C apps/mobile typecheck`

---

## Phase 2. Core UI System

### UI-6 Rebuild web primitives

- Priority: `critical`
- Status: `done`

Tasks:

- normalize `Button`, `Input`, `Card`, `Toast`
- add sizes, variants, icon slots, loading states, destructive states
- remove one-off visual behavior where reusable variants should exist

Done when:

- shared web primitives cover the majority of screen needs
- new screens can be composed mostly from stable primitives

Primary targets:

- `apps/web/src/components/ui/Button.tsx`
- `apps/web/src/components/ui/Input.tsx`
- `apps/web/src/components/ui/Card.tsx`
- `apps/web/src/components/ui/Toast.tsx`

Progress:

- rebuilt [Button.tsx](/C:/projects/kezek/apps/web/src/components/ui/Button.tsx) with stronger variants, size handling, icon slots, and semantic token usage
- rebuilt [Input.tsx](/C:/projects/kezek/apps/web/src/components/ui/Input.tsx) around token-driven border, surface, text, helper, and error states
- rebuilt [Card.tsx](/C:/projects/kezek/apps/web/src/components/ui/Card.tsx) with clearer surface variants and hover behavior
- rebuilt [Toast.tsx](/C:/projects/kezek/apps/web/src/components/ui/Toast.tsx) around semantic status feedback styling
- added reusable style helpers so link/button-like and card-like screen elements can consume the same primitive API instead of forking one-off styling
- propagated the rebuilt primitives through key public and cabinet flows in [ClientCabinet.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/ClientCabinet.tsx), [ProfileForm.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/components/ProfileForm.tsx), [BranchSelector.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BranchSelector.tsx), [AuthChoiceModal.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/AuthChoiceModal.tsx), [GuestBookingModal.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/GuestBookingModal.tsx), [BookingFormSections.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingFormSections.tsx), [BookingSteps.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingSteps.tsx), and [BusinessInfo.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/BusinessInfo.tsx)
- validated that the majority of newly redesigned web screens can now be composed from stable `Button`, `Input`, `Card`, and `Toast` primitives rather than local raw styles
- verified with `pnpm -C apps/web typecheck`

### UI-7 Add missing web primitives and patterns

- Priority: `high`
- Status: `done`

Tasks:

- create `Badge`
- create `Tabs`
- create `EmptyState`
- create `AlertBanner`
- create `Skeleton`
- create `SectionHeader`
- create `PageHeader`
- create `StatusChip`
- normalize modal/dialog pattern

Done when:

- repeated UI patterns are reusable instead of reimplemented per screen

Progress:

- added shared web primitives in [Badge.tsx](/C:/projects/kezek/apps/web/src/components/ui/Badge.tsx), [StatusChip.tsx](/C:/projects/kezek/apps/web/src/components/ui/StatusChip.tsx), [Tabs.tsx](/C:/projects/kezek/apps/web/src/components/ui/Tabs.tsx), [EmptyState.tsx](/C:/projects/kezek/apps/web/src/components/ui/EmptyState.tsx), [AlertBanner.tsx](/C:/projects/kezek/apps/web/src/components/ui/AlertBanner.tsx), [Skeleton.tsx](/C:/projects/kezek/apps/web/src/components/ui/Skeleton.tsx), [SectionHeader.tsx](/C:/projects/kezek/apps/web/src/components/ui/SectionHeader.tsx), [PageHeader.tsx](/C:/projects/kezek/apps/web/src/components/ui/PageHeader.tsx), and [Dialog.tsx](/C:/projects/kezek/apps/web/src/components/ui/Dialog.tsx)
- normalized modal/dialog behavior by moving booking auth and guest modals onto the shared [Dialog.tsx](/C:/projects/kezek/apps/web/src/components/ui/Dialog.tsx) pattern via [AuthChoiceModal.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/AuthChoiceModal.tsx) and [GuestBookingModal.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/GuestBookingModal.tsx)
- replaced local empty and tab patterns in [ClientCabinet.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/ClientCabinet.tsx) and [BookingEmptyState.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/BookingEmptyState.tsx), so cabinet and booking flow now consume the new shared primitives instead of bespoke screen markup
- introduced shared badge usage into [DashboardHomeHero.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardHomeHero.tsx) to start unifying repeated label/status treatments
- rolled the same shared patterns into admin surfaces via [layout.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/layout.tsx), [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/categories/page.tsx), and [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/businesses/page.tsx), replacing more local page headers, tabs, status badges, and empty states with the new UI layer
- extended the rollout through heavier admin surfaces in [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/page.tsx), [MonitoringClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/monitoring/MonitoringClient.tsx), [PerformanceClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/performance/PerformanceClient.tsx), and [SystemHealthClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/system-health/SystemHealthClient.tsx), replacing more local headers, empty states, alert blocks, status pills, and skeleton placeholders with the shared UI layer
- normalized additional workspace modal and tab patterns in [ConfirmDialog.tsx](/C:/projects/kezek/apps/web/src/components/dashboard/ConfirmDialog.tsx), [BookingsViewSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/BookingsViewSections.tsx), [TransferStaffDialog.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/TransferStaffDialog.tsx), and [SellVisitPackageModal.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/SellVisitPackageModal.tsx)
- moved the admin funnel analytics surface onto the shared page/pattern layer in [FunnelAnalyticsClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/funnel-analytics/FunnelAnalyticsClient.tsx), so it now uses `PageHeader`, `SectionHeader`, `AlertBanner`, and `EmptyState` instead of one-off composition
- migrated the global WhatsApp connection prompt in [WhatsAppConnectPrompt.tsx](/C:/projects/kezek/apps/web/src/app/_components/WhatsAppConnectPrompt.tsx) onto the shared `Dialog`, `Input`, `Button`, and `AlertBanner` primitives so even cross-product notification setup no longer keeps its own ad hoc modal stack
- finished the last remaining workspace tabs migration in [ScheduleSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/schedule/ScheduleSections.tsx), so staff schedule no longer carries a bespoke tab implementation
- verified with `pnpm -C apps/web typecheck`
- the shared web pattern layer now covers repeated badge, tabs, empty, alert, skeleton, section/page header, and dialog needs across public, cabinet, admin, dashboard, and cross-product prompts, so new or redesigned screens can compose from stable primitives instead of reimplementing these patterns locally

### UI-8 Rebuild mobile primitives

- Priority: `critical`
- Status: `done`

Tasks:

- normalize mobile `Button`, `Input`, `Card`, `OfflineBanner`, `EmptyState`, loading pattern
- align mobile primitives to the same design rules as web
- define shared state appearance for loading, error, offline, and destructive actions

Done when:

- mobile screens no longer carry large amounts of local styling for common controls

Primary targets:

- `apps/mobile/src/components/ui/Button.tsx`
- `apps/mobile/src/components/ui/Input.tsx`
- `apps/mobile/src/components/ui/Card.tsx`
- `apps/mobile/src/components/ui/OfflineBanner.tsx`
- `apps/mobile/src/components/ui/EmptyState.tsx`

Progress:

- rebuilt [Button.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Button.tsx) around semantic brand, border, and state tokens
- rebuilt [Card.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Card.tsx) to consume semantic surface and border tokens
- rebuilt [Input.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Input.tsx) around token-driven label, error, helper, and readonly states
- rebuilt [EmptyState.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/EmptyState.tsx), [LoadingSpinner.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/LoadingSpinner.tsx), and [Toast.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Toast.tsx) to align with the new visual system
- expanded the primitive API in [Button.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Button.tsx), [Input.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Input.tsx), [Card.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Card.tsx), [EmptyState.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/EmptyState.tsx), and [OfflineBanner.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/OfflineBanner.tsx) so mobile screens can reuse sizes, icons, outlined/muted surfaces, compact empty states, inline actions, and richer field layouts instead of reaching for local controls
- rolled those stronger primitives into real mobile surfaces:
  [SearchSection.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/SearchSection.tsx),
  [ShiftQuickSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/ShiftQuickSections.tsx),
  [shiftQuickStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/shiftQuickStyles.ts),
  [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx),
  [SignInScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/auth/SignInScreen.tsx),
  [VerifyScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/auth/VerifyScreen.tsx),
  and [WhatsAppScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/auth/WhatsAppScreen.tsx)
- extended the rollout into cabinet, staff, dashboard, navigation-shell, and shift reporting surfaces:
  [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx),
  [StaffScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/staff/StaffScreenSections.tsx),
  [staffScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/staff/staffScreenStyles.ts),
  [DashboardScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/dashboard/DashboardScreenSections.tsx),
  [dashboardScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/dashboard/dashboardScreenStyles.ts),
  [ShiftsScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shifts/ShiftsScreenSections.tsx),
  and [RootNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/RootNavigator.tsx)
- normalized booking-step states and common press interactions across
  [BookingStep1Branch.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep1Branch.tsx),
  [BookingStep2Service.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep2Service.tsx),
  [BookingStep3Staff.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep3Staff.tsx),
  [BookingStep4Date.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep4Date.tsx),
  and [BookingStep5Time.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep5Time.tsx) by replacing local loading, empty, and press feedback patterns with shared `LoadingSpinner`, `EmptyState`, `OfflineBanner`, and `MotionPressable` usage
- removed the remaining screen-level `TouchableOpacity` debt from booking utility and home discovery layers via
  [BookingProgressIndicator.tsx](/C:/projects/kezek/apps/mobile/src/components/BookingProgressIndicator.tsx),
  [BookingCancelButton.tsx](/C:/projects/kezek/apps/mobile/src/components/BookingCancelButton.tsx),
  [BookingActivitySections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/BookingActivitySections.tsx),
  [DiscoverySections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/DiscoverySections.tsx),
  [SearchSection.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/SearchSection.tsx),
  and [homeScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/home/homeScreenStyles.ts)
- the shift quick workspace no longer relies on raw `TextInput` and ad hoc touchable buttons for add-client and shift actions, and auth flows now compose mostly from the shared mobile primitives rather than screen-local button/input implementations
- verified repeatedly with `pnpm -C apps/mobile typecheck`
- mobile screen work now predominantly composes from shared `Button`, `Input`, `Card`, `EmptyState`, `OfflineBanner`, `LoadingSpinner`, and `MotionPressable` primitives rather than screen-local common-control styling

### UI-9 Unify feedback patterns

- Priority: `critical`
- Status: `done`

Tasks:

- standardize toast vs inline error vs alert banner vs empty state
- remove inconsistent local feedback patterns
- replace legacy browser/mobile alerts where reusable UI feedback should be used

Done when:

- users see the same logic for success, warning, error, retry, and destructive confirmation across the product

Progress:

- began the feedback-system pass by standardizing the mobile shared layer instead of leaving confirmation and warning behavior inside per-screen `Alert.alert` calls
- added reusable mobile feedback primitives in [FeedbackBanner.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/FeedbackBanner.tsx), [ConfirmDialog.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/ConfirmDialog.tsx), and [ConfirmContext.tsx](/C:/projects/kezek/apps/mobile/src/contexts/ConfirmContext.tsx)
- expanded the mobile toast system to include warning states and routed the app shell through the new feedback stack via [Toast.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Toast.tsx), [ToastContext.tsx](/C:/projects/kezek/apps/mobile/src/contexts/ToastContext.tsx), and [App.tsx](/C:/projects/kezek/apps/mobile/App.tsx)
- replaced destructive mobile alerts with the shared confirm dialog in [BookingCancelButton.tsx](/C:/projects/kezek/apps/mobile/src/components/BookingCancelButton.tsx), [useBookingStep6Confirm.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep6Confirm.ts), [useProfileScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/profile/useProfileScreenData.ts), [BookingDetailsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/BookingDetailsScreen.tsx), and [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx)
- normalized success, error, queued-offline warning, and blocked-action feedback in the shift workspace through [useShiftQuickScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/useShiftQuickScreenData.ts), [ShiftQuickSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/ShiftQuickSections.tsx), and [shiftQuickStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/shiftQuickStyles.ts)
- started the same cleanup on web by introducing a reusable confirmation surface in [ConfirmDialog.tsx](/C:/projects/kezek/apps/web/src/components/ui/ConfirmDialog.tsx) and replacing scattered browser confirms in [DeleteServiceButton.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/services/DeleteServiceButton.tsx), [DeleteBranchButton.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/branches/DeleteBranchButton.tsx), and [DangerActions.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/DangerActions.tsx)
- those web flows now use the shared dialog + toast/banner combination instead of mixing native `confirm(...)`, inline raw error boxes, and separate success/error logic
- migrated public booking feedback off browser alerts by routing validation and technical failures through shared toast state in [useBookingCreation.ts](/C:/projects/kezek/apps/web/src/app/b/[slug]/hooks/useBookingCreation.ts), [useGuestBooking.ts](/C:/projects/kezek/apps/web/src/app/b/[slug]/hooks/useGuestBooking.ts), and [view.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/view.tsx)
- normalized cabinet destructive feedback in [BookingCard.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/components/BookingCard.tsx), replacing native `confirm(...)` and failure `alert(...)` with the shared [ConfirmDialog.tsx](/C:/projects/kezek/apps/web/src/components/ui/ConfirmDialog.tsx) and [Toast.tsx](/C:/projects/kezek/apps/web/src/components/ui/Toast.tsx) pattern
- cleaned up auth entry feedback in [page.tsx](/C:/projects/kezek/apps/web/src/app/auth/reset-password/page.tsx), [page.tsx](/C:/projects/kezek/apps/web/src/app/auth/update-password/page.tsx), and [VerifyOtpPage.tsx](/C:/projects/kezek/apps/web/src/app/auth/verify-otp/VerifyOtpPage.tsx), so these flows now use the same shared toast logic instead of browser `alert(...)`
- migrated simple dashboard assignment/action editors to shared toast feedback in [ServiceMastersEditor.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/services/[id]/ServiceMastersEditor.tsx), [StaffServicesEditor.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/StaffServicesEditor.tsx), and [ActionButtons.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/ActionButtons.tsx)
- moved additional dashboard operational feedback off native alerts in [BranchAdminsPanel.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/branches/[id]/BranchAdminsPanel.tsx), [Client.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/slots/Client.tsx), [NewFromUser.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/NewFromUser.tsx), and [VisitPackagesListClient.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/visit-packages/VisitPackagesListClient.tsx)
- finished the remaining dashboard destructive confirm in [BranchPromotionsPanel.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/branches/[id]/BranchPromotionsPanel.tsx) and moved the admin destructive actions onto the same shared confirmation model in [RolesClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/RolesClient.tsx), [MembersClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/businesses/[id]/members/MembersClient.tsx), [DeleteBizButton.tsx](/C:/projects/kezek/apps/web/src/components/admin/DeleteBizButton.tsx), [DeleteBranchButton.tsx](/C:/projects/kezek/apps/web/src/components/admin/branches/DeleteBranchButton.tsx), [DeleteCategoryButton.tsx](/C:/projects/kezek/apps/web/src/components/admin/categories/DeleteCategoryButton.tsx), and [UserSecurityActions.tsx](/C:/projects/kezek/apps/web/src/components/admin/users/UserSecurityActions.tsx)
- removed the remaining staff avatar browser alerts in [StaffAvatarUpload.tsx](/C:/projects/kezek/apps/web/src/app/staff/avatar/StaffAvatarUpload.tsx) and migrated that flow to the shared toast pattern
- finished the last real web legacy alert flow in [CreateBookingForm.tsx](/C:/projects/kezek/apps/web/src/app/staff/bookings/CreateBookingForm.tsx), so validation, success, and technical failure now go through the same shared toast layer used in the rest of the redesign wave
- pushed the shared banner/empty-state model into analytics and finance screens via [DashboardAnalyticsSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/analytics/DashboardAnalyticsSections.tsx), [FinancePageSections.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePageSections.tsx), [StaffFinanceStats.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStats.tsx), and [AllStaffFinanceStats.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/finance/components/AllStaffFinanceStats.tsx), replacing local error cards and ad hoc retry links with shared `AlertBanner` / `EmptyState` actions
- normalized several dashboard form-level error boxes onto the shared feedback component in [BranchForm.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/branches/BranchForm.tsx), [ServiceForm.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/services/ServiceForm.tsx), and [VisitPackagePlanForm.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/visit-packages/VisitPackagePlanForm.tsx)
- replaced the remaining staff finance validation summary box in [ClientEditForm.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/ClientEditForm.tsx) with the shared `AlertBanner`, which removes the last obvious raw red error-card pattern from the current dashboard/staff sweep
- moved the admin analytics pages onto the same shared retry/empty-state model in [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/funnel/page.tsx), [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/load/page.tsx), [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/promotions/page.tsx), [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/system/page.tsx), and [AdminAnalyticsOverviewSections.tsx](/C:/projects/kezek/apps/web/src/app/admin/analytics/overview/AdminAnalyticsOverviewSections.tsx), replacing raw red cards and plain no-data placeholders with shared `AlertBanner`, `Button`, and `EmptyState`
- normalized the remaining auth inline-error islands in [SignInPageView.tsx](/C:/projects/kezek/apps/web/src/app/auth/sign-in/SignInPageView.tsx) and [VerifyPage.tsx](/C:/projects/kezek/apps/web/src/app/auth/verify/VerifyPage.tsx), so these screens now match the same banner semantics already used across reset/update/passwordless flows
- finished the auth follow-up cleanup in [page.tsx](/C:/projects/kezek/apps/web/src/app/auth/post-signup/page.tsx) and [page.tsx](/C:/projects/kezek/apps/web/src/app/auth/whatsapp/page.tsx), replacing local success/error boxes with shared `AlertBanner` and aligning submit controls with the shared `Button` / `Input` layer
- started the follow-up admin form cleanup by moving [RolesNewClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/new/RolesNewClient.tsx) off its local red form box and onto the shared `AlertBanner`
- finished the same cleanup pass for admin role and user management in [EditRoleClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/[id]/EditRoleClient.tsx), [RolesClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/RolesClient.tsx), [UsersClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/users/UsersClient.tsx), and [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/users/[id]/page.tsx), so those screens now use shared `AlertBanner` / `EmptyState` instead of local blocked-user and error-card treatments
- extended the shared feedback layer into the remaining diagnostic/admin tail via [health-check page.tsx](/C:/projects/kezek/apps/web/src/app/admin/health-check/page.tsx), [ratings-status page.tsx](/C:/projects/kezek/apps/web/src/app/admin/ratings-status/page.tsx), [PromotionsDebugClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/promotions-debug/PromotionsDebugClient.tsx), [RatingsDebugClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/ratings-debug/RatingsDebugClient.tsx), and the final validation summary in [RatingConfigClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/rating-config/RatingConfigClient.tsx)
- verified with `pnpm -C apps/mobile typecheck`
- verified the web slice with `pnpm -C apps/web typecheck`
- verified via repository search that mobile no longer carries native `Alert.alert(...)` flows and web no longer carries real browser `alert(...)` / `confirm(...)` usage in active UI codepaths
- remaining red/green matches are now intentional status chips, health cards, or danger-zone surfaces rather than inconsistent feedback implementations, so active product feedback now follows the shared toast / banner / empty-state / confirm model across the product

---

## Phase 3. Navigation And Layout

### UI-10 Rework web shell layout

- Priority: `high`
- Status: `done`

Tasks:

- refine global header, role switcher, language switcher, mobile menu, spacing, sticky behavior
- improve consistency between public shell and workspace shell

Done when:

- the top-level app shell feels intentional and cohesive

Primary targets:

- `apps/web/src/app/layout.tsx`

Progress:

- extracted a dedicated shell header in [AppShellHeader.tsx](/C:/projects/kezek/apps/web/src/app/_components/AppShellHeader.tsx) and simplified [layout.tsx](/C:/projects/kezek/apps/web/src/app/layout.tsx) so the root app chrome is no longer a one-off header block embedded directly in the layout
- reworked sticky behavior, shell spacing, and the public app frame in [layout.tsx](/C:/projects/kezek/apps/web/src/app/layout.tsx) to use a more intentional floating header + footer card treatment instead of a thin default top bar
- normalized desktop shell controls in [AuthStatusServer.tsx](/C:/projects/kezek/apps/web/src/app/_components/AuthStatusServer.tsx), [RoleAndBusinessSwitcher.tsx](/C:/projects/kezek/apps/web/src/app/_components/RoleAndBusinessSwitcher.tsx), and [LanguageSwitcher.tsx](/C:/projects/kezek/apps/web/src/app/_components/i18n/LanguageSwitcher.tsx) so account state, role switching, and locale switching now read as one cohesive control cluster
- rebuilt the mobile shell menu in [MobileHeaderMenu.tsx](/C:/projects/kezek/apps/web/src/app/_components/MobileHeaderMenu.tsx) so language, role switching, and account actions follow the same shell vocabulary instead of living in a separate ad hoc dropdown
- aligned shell action buttons and footer framing through [PersonalCabinetButton.tsx](/C:/projects/kezek/apps/web/src/app/_components/PersonalCabinetButton.tsx), [StaffCabinetButton.tsx](/C:/projects/kezek/apps/web/src/app/_components/StaffCabinetButton.tsx), and [Footer.tsx](/C:/projects/kezek/apps/web/src/app/_components/Footer.tsx)
- verified with `pnpm -C apps/web typecheck`

### UI-11 Unify workspace navigation

- Priority: `critical`
- Status: `done`

Tasks:

- redesign dashboard navigation
- redesign staff mobile sidebar/navigation pattern
- define one workspace navigation language across owner/staff areas

Done when:

- dashboard and staff areas feel like one operational workspace

Primary targets:

- `apps/web/src/app/dashboard/ui/DashboardNav.tsx`
- `apps/web/src/app/staff/components/StaffMobileSidebar.tsx`

Progress:

- introduced a shared workspace navigation layer in [WorkspaceNavigation.tsx](/C:/projects/kezek/apps/web/src/app/_components/workspace/WorkspaceNavigation.tsx) so owner and staff areas now use the same sidebar shell, active-state treatment, icon rhythm, mobile drawer behavior, and sticky desktop navigation pattern
- rebuilt [DashboardNav.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/ui/DashboardNav.tsx) on top of the shared `WorkspaceNavList`, so dashboard navigation now follows the same operational navigation language instead of a separate minimal list style
- redesigned the dashboard workspace sidebar in [MobileSidebar.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/MobileSidebar.tsx) around the shared workspace shell, including the same mobile trigger, drawer framing, desktop sticky panel, and navigation semantics used elsewhere
- redesigned the staff workspace sidebar in [StaffMobileSidebar.tsx](/C:/projects/kezek/apps/web/src/app/staff/components/StaffMobileSidebar.tsx) on the same shared shell, aligning staff with dashboard for information hierarchy, spacing, nav grouping, and active-state behavior
- normalized workspace content offset and sidebar alignment in [layout.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/layout.tsx) and [StaffLayoutClient.tsx](/C:/projects/kezek/apps/web/src/app/staff/StaffLayoutClient.tsx), so dashboard and staff now sit under the same shell rhythm on mobile and desktop
- verified with `pnpm -C apps/web typecheck`

### UI-12 Rework mobile navigation chrome

- Priority: `high`
- Status: `done`

Tasks:

- refine bottom tabs, headers, active states, titles, spacing
- improve hierarchy between main tabs and deep booking flow screens

Done when:

- navigation feels lighter, clearer, and visually aligned with the rest of the product

Primary targets:

- `apps/mobile/src/navigation/MainNavigator.tsx`
- `apps/mobile/src/navigation/mainNavigatorConfig.tsx`
- `apps/mobile/src/navigation/RootNavigatorScreens.tsx`

Progress:

- rebuilt the mobile navigation chrome contract in [mainNavigatorConfig.tsx](/C:/projects/kezek/apps/mobile/src/navigation/mainNavigatorConfig.tsx), introducing a lighter floating tab bar, clearer active-state icon treatment, unified header title styling, and separate header modes for main tabs, detail screens, and deep booking-flow screens
- updated [MainNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/MainNavigator.tsx) so the main tabs now use the new tab chrome, clearer top-level titles, and a cleaner distinction between public/home, cabinet, owner, and staff destinations
- updated [RootNavigatorScreens.tsx](/C:/projects/kezek/apps/mobile/src/navigation/RootNavigatorScreens.tsx) so booking steps now read as a dedicated step flow through shared flow-header options and per-step hierarchy instead of feeling like ordinary stack pushes from the main navigation
- aligned the nested cabinet stack in [CabinetNavigator.tsx](/C:/projects/kezek/apps/mobile/src/navigation/CabinetNavigator.tsx) with the same mobile header title system so nested screens stay visually consistent with the reworked chrome
- verified with mobile TypeScript check via the local TypeScript entrypoint (`tsc --noEmit`)

---

## Phase 4. Public Product Experience

### UI-13 Redesign web home page

- Priority: `high`
- Status: `done`

Tasks:

- improve hero, search, category filters, business cards, pagination, visual hierarchy
- increase clarity of why a user should trust and use the platform

Done when:

- the home page feels like a polished marketplace entry point, not only a listing page

Primary targets:

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/_components/HomeClientComponents.tsx`

Progress:

- redesigned the home hero, search/filter section, trust framing, results header, and empty state in [HomeClientComponents.tsx](/C:/projects/kezek/apps/web/src/app/_components/HomeClientComponents.tsx) so the page now opens as a polished marketplace entry point rather than a thin listing shell
- rebuilt [page.tsx](/C:/projects/kezek/apps/web/src/app/page.tsx) around the new marketplace structure: stronger hero metrics, clearer search/filter hierarchy, trust sidebar, improved business cards, and more intentional pagination
- increased trust and conversion clarity by surfacing verified-business framing, visible rating/promotions/contact cues, and direct detail/booking actions in each marketplace card
- verified with `pnpm -C apps/web typecheck`

### UI-14 Redesign business page

- Priority: `high`
- Status: `done`

Tasks:

- improve trust cues, branch clarity, staff visibility, promotions, and conversion path to booking

Done when:

- business pages clearly explain what the user can book and why to proceed

Primary targets:

- `apps/web/src/app/b/[slug]/page.tsx`
- `apps/web/src/app/b/[slug]/BusinessInfo.tsx`

Progress:

- rebuilt the business page shell in [page.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/page.tsx) with a stronger empty/not-found presentation while keeping the current data-loading and metadata flow intact
- redesigned [BusinessInfo.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/BusinessInfo.tsx) into a clearer marketplace-style business page with a stronger hero, trust framing, branch overview, staff visibility, promotions, and a persistent conversion path into booking
- improved conversion clarity by surfacing why the page is trustworthy before asking the user to proceed: ratings, active branches, visible team members, available promotions, and direct booking CTAs are now part of the primary hierarchy
- verified with `pnpm -C apps/web typecheck`

### UI-15 Redesign public booking flow on web

- Priority: `critical`
- Status: `done`

Tasks:

- improve stepper clarity
- improve selection states for branch, service, staff, date, time
- improve summary card and confirmation readability
- reduce friction and ambiguity in multi-step flow

Done when:

- booking flow is visually coherent, predictable, and easy to recover from

Primary targets:

- `apps/web/src/app/b/[slug]/booking/BookingFormClient.tsx`
- `apps/web/src/app/b/[slug]/components/BookingSteps.tsx`
- `apps/web/src/app/b/[slug]/components/BookingFormSections.tsx`
- `apps/web/src/app/b/[slug]/view.tsx`

Progress:

- redesigned the booking flow shell in [view.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/view.tsx) with a clearer introduction, better auth guidance, stronger visual hierarchy, and a more intentional two-column booking workspace
- rebuilt [BookingSteps.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingSteps.tsx) into a clearer progress rail with visible step status, progress feedback, and less ambiguity about where the user is in the flow
- rebuilt [BookingFormSections.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingFormSections.tsx) around stronger step framing, clearer next-action guidance, and more readable navigation between steps
- improved selection and confirmation readability across the flow by redesigning branch, staff, service, time, and summary surfaces in [BranchSelector.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BranchSelector.tsx), [StaffSelector.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/StaffSelector.tsx), [ServiceSelector.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/ServiceSelector.tsx), [SlotPicker.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/SlotPicker.tsx), and [BookingSummary.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingSummary.tsx)
- refreshed the booking-client error boundary in [BookingFormClient.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/booking/BookingFormClient.tsx) so failure states also match the redesigned booking experience
- verified with `pnpm -C apps/web typecheck`

### UI-16 Improve public booking states

- Priority: `high`
- Status: `done`

Tasks:

- redesign loading states
- redesign empty slots state
- redesign network and retry states
- redesign unavailable branch/service/staff states
- improve auth choice and guest booking states

Done when:

- all critical booking edge cases feel handled, not accidental

Progress:

- rebuilt the booking edge-state layer in [BookingEmptyState.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/BookingEmptyState.tsx) so loading, empty, warning, retry, and error states now use one deliberate booking-specific presentation model instead of thin ad hoc banners
- improved unavailable and blocked states across [ServiceSelector.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/ServiceSelector.tsx), [StaffSelector.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/StaffSelector.tsx), and [SlotPicker.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/SlotPicker.tsx), including clearer messaging for missing prerequisites, no services, no staff, no slots, and invalid staff/service combinations
- added clearer loading, network-error, and retry handling for slot loading in [SlotPicker.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/SlotPicker.tsx) and wired retry through [BookingFormSections.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingFormSections.tsx) and [view.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/view.tsx)
- redesigned auth-choice and guest-booking states in [AuthChoiceModal.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/AuthChoiceModal.tsx) and [GuestBookingModal.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/GuestBookingModal.tsx) so users now see slot context, clearer scenario framing, and more trustworthy input guidance before confirming
- verified with `pnpm -C apps/web typecheck`

---

## Phase 5. Customer Cabinet

### UI-17 Redesign customer booking cards on web

- Priority: `high`
- Status: `done`

Tasks:

- improve hierarchy inside booking cards
- improve timeline/status visibility
- improve repeat booking, cancel, review, map actions
- reduce visual overload in dense cards

Done when:

- cabinet bookings are scannable and action-oriented

Primary targets:

- `apps/web/src/app/cabinet/components/BookingCard.tsx`

Progress:

- rebuilt [BookingCard.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/components/BookingCard.tsx) around a clearer top-level summary with stable status chips, denser but more readable booking facts, and a dedicated progress block instead of equally weighted raw sections
- improved scanability by separating service/title context from date, duration, and next-action summary cards, so the customer can understand the booking state without reading the full card line by line
- normalized repeat booking, open, map, review, edit review, and cancel affordances onto the shared [Button.tsx](/C:/projects/kezek/apps/web/src/components/ui/Button.tsx) action language, reducing visual noise and making the primary action more obvious
- kept promo, package, review, and multi-service details as secondary informational surfaces so dense cards stay actionable instead of collapsing into one long wall of content
- verified with local web typecheck

### UI-18 Redesign customer profile and settings flow

- Priority: `medium`
- Status: `done`

Tasks:

- simplify edit/save flows
- improve form clarity and validation feedback
- normalize success states and unsaved states

Done when:

- profile editing feels trustworthy and low-friction

Primary targets:

- `apps/web/src/app/cabinet/components/ProfileForm.tsx`

Progress:

- rebuilt [ProfileForm.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/components/ProfileForm.tsx) around a clearer personal-data section with explicit saved vs unsaved status, stronger field hierarchy, and less ambiguous edit state
- simplified edit/save behavior by tracking an `initialProfile` snapshot, gating submit on dirty state, adding a reset path, and surfacing a sticky save bar instead of a detached one-shot submit button
- improved form trust and validation by normalizing phone validation, trimming submitted phone data, clearing stale errors during edits, and making notification toggles participate in the same low-friction save flow
- normalized success and unsaved feedback with shared inline banners plus one consistent auto-dismissing success-state model, so profile editing no longer depends on scattered local timers and ad hoc messaging
- verified with local web typecheck

### UI-19 Redesign mobile cabinet experience

- Priority: `high`
- Status: `done`

Tasks:

- improve upcoming/history split
- improve offline-aware messaging
- improve booking card layout and detail transitions

Done when:

- mobile cabinet feels like a first-class product surface, not a reduced companion view

Primary targets:

- `apps/mobile/src/screens/CabinetScreen.tsx`
- `apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx`

Progress:

- refreshed [CabinetScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/CabinetScreen.tsx) so loading and empty-user states now read cleanly and hand off into a stronger cabinet surface instead of a thin companion-shell
- rebuilt [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx) around a real mobile-cabinet hierarchy: overview card, visible upcoming/history split with counts, clearer sync/offline messaging, and richer booking cards that preview timeline, staff, location, and the next detail action
- redesigned [cabinetScreenStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/cabinet/cabinetScreenStyles.ts) to support a more intentional first-class mobile surface with stronger spacing rhythm, section framing, stat cards, segmented controls, and booking detail affordances
- improved offline-aware messaging by distinguishing cached vs live data, surfacing the last sync moment, and wiring refresh/retry into the shared [OfflineBanner.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/OfflineBanner.tsx) pattern
- verified with local mobile typecheck

---

## Phase 6. Dashboard And Staff Workspace

### UI-20 Redesign dashboard home as a true command center

- Priority: `critical`
- Status: `done`

Tasks:

- clarify KPI hierarchy
- make quick actions more actionable
- improve onboarding notice behavior
- strengthen operational overview feeling

Done when:

- owners can understand daily state and next actions at a glance

Primary targets:

- `apps/web/src/app/dashboard/components/DashboardHomeClient.tsx`

Progress:

- rebuilt [DashboardHomeClient.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/DashboardHomeClient.tsx) around a stronger command-center layout: hero, primary focus, quick actions, KPI hierarchy, onboarding state, and operational support cards now read in one intentional sequence
- redesigned [dashboardHomeViewModel.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/dashboardHomeViewModel.tsx) so the home screen now derives a real top-priority operational focus instead of treating all metrics and actions as equally important
- upgraded [DashboardQuickActionsCard.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardQuickActionsCard.tsx) into a next-actions panel with an explicit primary focus, clearer action emphasis, and stronger owner-facing decision framing
- reworked [DashboardMetricsGrid.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardMetricsGrid.tsx) so the daily bookings KPI leads the hierarchy and the remaining metrics support it instead of competing visually at the same weight
- improved [DashboardOnboardingNotice.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/components/home/DashboardOnboardingNotice.tsx) so onboarding now behaves like a guided readiness checklist rather than a generic warning block
- verified with local web typecheck

### UI-21 Redesign QuickDesk and dashboard bookings workspace

- Priority: `critical`
- Status: `done`

Tasks:

- improve today vs history/search distinction
- improve booking list density and clarity
- improve quick actions and booking row/card states
- improve operator ergonomics on mobile widths

Done when:

- bookings workspace feels fast, focused, and operationally strong

Primary targets:

- `apps/web/src/app/dashboard/bookings/view.tsx`
- related extracted components under `apps/web/src/app/dashboard/bookings/components`

Progress:

- rebuilt [view.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/view.tsx) into a clearer operator shell with stronger workspace framing, explicit today/history/QuickDesk distinction, and better top-level orientation for owners and admins
- redesigned [BookingFilters.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/BookingFilters.tsx) so the list workspace now has a real control layer: search, status, branch, visible result count, presets, and clearer mode messaging instead of a thin title-only strip
- rebuilt [BookingsList.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/BookingsList.tsx) to improve density and clarity across desktop and mobile widths: stronger row hierarchy, client/service/time grouping, visible branch context, cleaner status chips, and better action ergonomics
- updated [DashboardBookingsListSection.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/DashboardBookingsListSection.tsx) and [useDashboardBookingsListController.ts](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/useDashboardBookingsListController.ts) so the redesigned list workspace can surface real counts and richer booking context
- refreshed [QuickDesk.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/QuickDesk.tsx) into the same operational language as the rest of the workspace, with a stronger left-side action rail, clearer quick-create framing, and easier return paths back to calendar and list
- verified with local web typecheck

### UI-22 Redesign staff detail experience

- Priority: `high`
- Status: `done`

Tasks:

- simplify staff profile hierarchy
- improve review, finance, schedule, and transfer visibility
- reduce perceived complexity of dense detail pages

Done when:

- staff detail pages read as composed sections, not long information walls

Primary targets:

- `apps/web/src/app/dashboard/staff/[id]/StaffDetailPageClient.tsx`

Progress:

- rebuilt [StaffDetailPageClient.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/StaffDetailPageClient.tsx) into a composed workspace structure with clear hierarchy: hero, operational shortcuts, profile/finance, competencies, rating context, reviews, and transfer guidance
- improved visibility of schedule, slots, finance, and transfer actions at the top of the page so operators can jump directly to the right workflow without scanning a long information wall
- reduced perceived complexity by replacing long dense blocks with sectioned cards and summary surfaces (contact, branch/status, finance split, review signals), while preserving existing editing and admin capabilities
- normalized review and rating presentation into clearer section blocks with explicit context and actionable hints instead of one continuous overloaded detail stream
- verified with local web typecheck

### UI-23 Redesign staff finance workspace

- Priority: `high`
- Status: `done`

Tasks:

- improve money hierarchy
- clarify guarantees, percentages, shifts, disputes, filters, and audit information
- reduce cognitive load in financial review flows

Done when:

- finance workspace becomes readable for everyday operational use

Progress:

- redesigned [StaffFinancePageClient.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/finance/StaffFinancePageClient.tsx) into a clearer operator shell with explicit navigation between shift control and analytics, so daily finance work no longer starts from a dense utility header
- rebuilt [StaffFinanceStatsPageClient.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/finance/stats/StaffFinanceStatsPageClient.tsx) as a composed finance-review page with actionable context cards for money, guarantees, and audit visibility
- reworked [StaffFinanceStats.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStats.tsx), [StaffFinanceStatsSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStatsSections.tsx), and [StaffFinanceShiftCard.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceShiftCard.tsx) to strengthen money hierarchy, expose guarantee impact clearly, reduce list-level overload, and make shift review/edit flows easier for everyday operational use
- improved audit readability in [FinanceSettingsAuditLog.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/finance/components/FinanceSettingsAuditLog.tsx) so percentage/hourly-rate changes are visible as a clear timeline instead of a dense raw table block
- verified with local web typecheck

### UI-24 Redesign mobile staff shift workspace

- Priority: `high`
- Status: `done`

Tasks:

- improve shift status card
- improve client add flow
- improve metrics readability
- replace abrupt local alerts with better inline or modal UX where possible
- strengthen offline queue visibility

Done when:

- shift management is fast, readable, and robust on mobile

Primary targets:

- `apps/mobile/src/screens/ShiftQuickScreen.tsx`
- `apps/mobile/src/screens/shiftQuick/ShiftQuickSections.tsx`

Progress:

- redesigned [ShiftQuickSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/ShiftQuickSections.tsx) into a clearer shift workspace with stronger shift-status hierarchy, timeline context, more readable KPI cards, and cleaner client rows for fast scanning during active shifts
- improved client add flow in [ShiftQuickSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/ShiftQuickSections.tsx) by adding clearer form framing, inline validation feedback via shared `FeedbackBanner`, and more predictable action controls for save/cancel
- strengthened offline robustness by exposing queued operation visibility from [useShiftQuickScreenData.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/useShiftQuickScreenData.ts), wiring it through [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx), and surfacing queue/sync state directly in the workspace with retry affordances
- rebuilt [shiftQuickStyles.ts](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/shiftQuickStyles.ts) to align spacing, card rhythm, status chips, and section density with the unified mobile design system
- verified with local mobile typecheck: `apps/mobile/node_modules/.bin/tsc --noEmit`

---

## Phase 7. Admin Experience

### UI-25 Rework admin information architecture

- Priority: `medium`
- Status: `done`

Tasks:

- group admin tools by purpose
- reduce navigation ambiguity
- define consistent list/detail/edit flows

Done when:

- admin tools feel navigable and coherent, not only available

Progress:

- redesigned [AdminNav.tsx](/C:/projects/kezek/apps/web/src/app/admin/_components/AdminNav.tsx) into section-based information architecture (operations, quality/reputation, analytics, diagnostics) with a clearer top-level primary strip and grouped "sections" menu to reduce navigation ambiguity
- introduced reusable flow navigation in [AdminEntityFlowTabs.tsx](/C:/projects/kezek/apps/web/src/app/admin/_components/AdminEntityFlowTabs.tsx) to standardize list/detail/edit movement patterns across admin entities
- rolled consistent flow-tabs through key admin entity surfaces:
  [businesses/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/businesses/page.tsx),
  [businesses/new/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/businesses/new/page.tsx),
  [businesses/[id]/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/businesses/[id]/page.tsx),
  [categories/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/categories/page.tsx),
  [categories/new/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/categories/new/page.tsx),
  [categories/[id]/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/categories/[id]/page.tsx),
  [users/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/users/page.tsx),
  [users/[id]/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/users/[id]/page.tsx),
  [roles/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/page.tsx),
  [roles/new/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/new/page.tsx),
  and [roles/[id]/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/[id]/page.tsx)
- verified with local web typecheck: `apps/web/node_modules/.bin/tsc --noEmit`

### UI-26 Standardize admin tables and forms

- Priority: `medium`
- Status: `done`

Tasks:

- unify table density, filters, action placement, bulk behavior, pagination, and form sections
- normalize destructive action presentation

Done when:

- admin CRUD surfaces share common interaction patterns

Progress:

- introduced shared admin CRUD primitives in [AdminDataTable.tsx](/C:/projects/kezek/apps/web/src/app/admin/_components/AdminDataTable.tsx), [AdminFilterBar.tsx](/C:/projects/kezek/apps/web/src/app/admin/_components/AdminFilterBar.tsx), [AdminPagination.tsx](/C:/projects/kezek/apps/web/src/app/admin/_components/AdminPagination.tsx), [AdminFormSection.tsx](/C:/projects/kezek/apps/web/src/app/admin/_components/AdminFormSection.tsx), and [AdminDangerZone.tsx](/C:/projects/kezek/apps/web/src/app/admin/_components/AdminDangerZone.tsx) to normalize density, filter framing, table action placement, pagination, form section rhythm, and danger-zone presentation
- rebuilt [UsersClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/users/UsersClient.tsx) around the shared CRUD layer: unified filter bar, dense table layout, consistent row actions, explicit per-page pagination, and page-level bulk selection behavior
- rebuilt [RolesClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/RolesClient.tsx) onto the same CRUD language with unified filters, dense table rows, standardized action placement, consistent pagination, and bulk delete flow for non-system roles
- standardized admin form section composition in [RolesNewClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/new/RolesNewClient.tsx) and [EditRoleClient.tsx](/C:/projects/kezek/apps/web/src/app/admin/roles/[id]/EditRoleClient.tsx) so role create/edit screens follow one sectioned form model instead of local layout variants
- normalized destructive presentation in [DeleteBizButton.tsx](/C:/projects/kezek/apps/web/src/components/admin/DeleteBizButton.tsx), [DeleteCategoryButton.tsx](/C:/projects/kezek/apps/web/src/components/admin/categories/DeleteCategoryButton.tsx), and [DeleteBranchButton.tsx](/C:/projects/kezek/apps/web/src/components/admin/branches/DeleteBranchButton.tsx), and aligned business detail danger framing via [businesses/[id]/page.tsx](/C:/projects/kezek/apps/web/src/app/admin/businesses/[id]/page.tsx)
- verified with local web typecheck: `apps/web/node_modules/.bin/tsc --noEmit`

---

## Phase 8. Accessibility, Quality, And Consistency

### UI-27 Run full accessibility hardening pass

- Priority: `critical`
- Status: `done`

Tasks:

- audit public booking
- audit cabinet
- audit dashboard
- audit staff
- audit mobile equivalents where applicable
- validate keyboard, focus, semantics, contrast, dialogs, dynamic feedback

Done when:

- critical flows meet the project accessibility checklist and major known gaps are closed

Reference:

- `A11Y_AUDIT.md`

Progress:

- created [A11Y_AUDIT.md](/C:/projects/kezek/docs/A11Y_AUDIT.md) as the source-of-truth audit snapshot for public booking, cabinet, dashboard, staff, and mobile equivalents
- hardened shared web dialog accessibility in [Dialog.tsx](/C:/projects/kezek/apps/web/src/components/ui/Dialog.tsx) with focus trap, focus restore, initial focus on open, and unique ARIA ids
- improved booking-flow semantics and keyboard/screen-reader clarity across [BookingDateCalendar.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingDateCalendar.tsx), [BookingSteps.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingSteps.tsx), [BranchSelector.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BranchSelector.tsx), [ServiceSelector.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/ServiceSelector.tsx), and [SlotPicker.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/SlotPicker.tsx)
- tightened workspace a11y details in [BookingsViewSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/BookingsViewSections.tsx), [StaffDetailPageClient.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/staff/[id]/StaffDetailPageClient.tsx), and [BookingFormClient.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/booking/BookingFormClient.tsx)
- aligned mobile accessibility behavior through shared primitives and key screens in [MotionPressable.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/MotionPressable.tsx), [Button.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Button.tsx), [Input.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Input.tsx), [ConfirmDialog.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/ConfirmDialog.tsx), [Toast.tsx](/C:/projects/kezek/apps/mobile/src/components/ui/Toast.tsx), [CabinetScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/cabinet/CabinetScreenSections.tsx), and [ShiftQuickSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/shiftQuick/ShiftQuickSections.tsx)

### UI-28 Remove legacy UI debt

- Priority: `high`
- Status: `done`

Tasks:

- remove hardcoded or inconsistent visual patterns
- replace duplicated ad hoc styles with primitives
- remove stale feedback patterns and uneven state handling

Done when:

- the main UI no longer visually fragments by screen owner or implementation age

Progress:

- removed hardcoded gray/indigo dark-mode utility patterns from the dashboard day-calendar workspace in [BookingsViewSections.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/BookingsViewSections.tsx), replacing them with semantic surface/border/text/focus token usage
- normalized the public booking calendar visual layer in [BookingDateCalendar.tsx](/C:/projects/kezek/apps/web/src/app/b/[slug]/components/BookingDateCalendar.tsx) to token-driven styles and shared accent semantics instead of local raw color utilities
- replaced ad hoc action-button styling in [QuickDesk.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/QuickDesk.tsx) with shared `Button` primitives for create and navigation actions, reducing one-off CTA behavior in the operator workspace
- replaced local pagination button styling in [BookingsList.tsx](/C:/projects/kezek/apps/web/src/app/dashboard/bookings/components/BookingsList.tsx) with the shared `Button` primitive so booking list controls follow the same interaction language as the rest of workspace UI
- removed legacy hardcoded success/info/review color blocks in [BookingCard.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/components/BookingCard.tsx) by moving to semantic token surfaces and shared `Badge` status vocabulary
- this reduces visual drift between public, cabinet, and workspace screens and moves repeated interaction/status states onto one consistent token + primitive layer
- verified with local web typecheck: `apps/web/node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json`

### UI-29 Clean UI-facing encoding and comment debt

- Priority: `medium`
- Status: `done`

Tasks:

- clean visibly broken legacy encoding in active UI docs and high-value source comments
- reduce noisy comments that harm readability in active UI files

Done when:

- active UI code and docs are readable and safe to maintain

Progress:

- cleaned severe UI-facing mojibake and comment debt in [BookingCard.tsx](/C:/projects/kezek/apps/web/src/app/cabinet/components/BookingCard.tsx), including status/timeline/review/cancel/map fallback labels and noisy broken comments
- fully rewrote [CategoryForm.tsx](/C:/projects/kezek/apps/web/src/components/admin/categories/CategoryForm.tsx) in clean UTF-8 with readable labels, helper text, and maintainable slug/transliteration comments
- cleaned high-value admin detail surface [page.tsx](/C:/projects/kezek/apps/web/src/app/admin/users/[id]/page.tsx) by removing broken legacy comments, normalizing fallback text, and replacing corrupted separators
- fixed broken metadata encoding in [layout.tsx](/C:/projects/kezek/apps/web/src/app/layout.tsx) so top-level app title/description are readable and stable
- validated targeted files with a mojibake scan; local typecheck in this session was blocked because `pnpm` is unavailable in the current shell environment

---

## Phase 9. Verification And Release Discipline

### UI-30 Expand visual regression coverage

- Priority: `high`
- Status: `done`

Tasks:

- extend screenshot coverage beyond the current public pages
- add cabinet, dashboard home, QuickDesk, and key finance/staff views

Done when:

- major UI regressions are caught automatically before release

Primary targets:

- `apps/web/e2e/visual-regressions.spec.ts`

Progress:

- rebuilt [visual-regressions.spec.ts](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) into two suites (public + authenticated workspace) with stable screenshot helpers, role/business fallback navigation, and deterministic capture settings
- kept and stabilized existing public coverage: business page and booking step visual snapshots
- added new workspace screenshot coverage for:
- [cabinet](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `/cabinet`
- [dashboard home](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `/dashboard`
- [dashboard bookings quickdesk](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `/dashboard/bookings` QuickDesk tab
- [dashboard bookings list](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `/dashboard/bookings` list tab
- [staff detail](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `/dashboard/staff/[id]`
- [staff finance](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `/dashboard/staff/[id]/finance`
- [staff finance stats](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `/dashboard/staff/[id]/finance/stats`
- [staff cabinet finance](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `/staff/finance` (staff-auth suite)
- [mobile quickdesk viewport](/C:/projects/kezek/apps/web/e2e/visual-regressions.spec.ts) `390x844` screenshot baseline for operator ergonomics
- added dedicated non-optional CI gate in [.github/workflows/ci.yml](/C:/projects/kezek/.github/workflows/ci.yml) (`e2e_visual_regressions`) that runs `pnpm test:e2e:visual` and fails releases on visual regressions
- added explicit visual suite script in [apps/web/package.json](/C:/projects/kezek/apps/web/package.json): `test:e2e:visual`
### UI-31 Add UI acceptance checklist

- Priority: `medium`
- Status: `done`

Tasks:

- create a short reusable checklist for spacing, hierarchy, responsiveness, loading/error/empty states, focus, localization fit, and offline behavior

Done when:

- every UI task can be reviewed against the same quality bar

Suggested output:

- `docs/UI_ACCEPTANCE_CHECKLIST.md`

Progress:

- created [UI_ACCEPTANCE_CHECKLIST.md](/C:/projects/kezek/docs/UI_ACCEPTANCE_CHECKLIST.md)
- added reusable review criteria for hierarchy, spacing, shared primitives, states, accessibility, responsiveness, localization, offline behavior, and verification
- this gives all later UI tasks a shared review bar

### UI-32 Define UI definition of done

- Priority: `medium`
- Status: `done`

Tasks:

- define what must be complete before a UI task is considered finished
- include testing, accessibility, localization, and state coverage expectations

Done when:

- UI work stops shipping as visually improved but operationally incomplete

Progress:

- created [UI_DEFINITION_OF_DONE.md](/C:/projects/kezek/docs/UI_DEFINITION_OF_DONE.md)
- defined completion requirements for shared pattern usage, state coverage, accessibility, localization, responsiveness, verification, and roadmap/document updates
- this sets the minimum bar for future redesign work

---

## Recommended Execution Order

### Sprint 1

- `UI-1`
- `UI-2`
- `UI-3`
- `UI-4`
- `UI-6`
- `UI-8`
- `UI-9`

### Sprint 2

- `UI-7`
- `UI-10`
- `UI-11`
- `UI-12`
- `UI-13`
- `UI-15`
- `UI-16`

### Sprint 3

- `UI-14`
- `UI-17`
- `UI-19`
- `UI-20`
- `UI-21`
- `UI-24`

### Sprint 4

- `UI-22`
- `UI-23`
- `UI-25`
- `UI-26`
- `UI-27`
- `UI-28`
- `UI-30`

### Sprint 5

- `UI-29`
- `UI-31`
- `UI-32`
- backlog follow-up from earlier phases

---

## Current Recommended Next Task

**Next:** `UI-9 Unify feedback patterns`

Why:

- web and mobile primitive rollouts are now broad enough to serve as the base layer for later redesign work
- the biggest remaining UX inconsistency now sits in feedback behavior: alerts, retry logic, destructive confirmation, and success/error presentation still vary by screen
- standardizing feedback next will let later navigation and screen redesign tasks build on one consistent cross-platform state model



