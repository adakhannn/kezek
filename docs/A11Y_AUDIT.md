# Accessibility Audit (UI-27)

**Status:** active  
**Date:** 2026-04-17  
**Scope:** public booking, cabinet, dashboard, staff, and mobile equivalents

## Summary

This pass focused on critical user journeys and shared primitives:

- public booking flow (`/b/[slug]`)
- web cabinet and booking cards
- dashboard booking workspace
- staff detail workspace
- mobile cabinet and shift quick workspace
- shared web/mobile dialog, button, input, and toast behavior

Major known accessibility gaps for keyboard flow, dialog behavior, semantics, and dynamic feedback were addressed in shared layers and high-traffic screens.

## What Was Hardened

### Web

- `Dialog` now uses:
  - unique `aria-labelledby`/`aria-describedby` ids
  - focus restore to previously focused element
  - focus trap for `Tab` and `Shift+Tab`
  - initial focus on open
- booking step and picker semantics improved:
  - explicit progress semantics (`role="progressbar"`)
  - list semantics for step cards
  - `aria-pressed` and descriptive labels for branch/service/staff/slot selection cards
  - calendar controls now have explicit navigation labels and polite month announcements
- icon-only back navigation in staff detail got an explicit `aria-label`
- dashboard booking calendar controls now have accessible labels for date/filter/export controls
- error fallback reload button in booking flow explicitly uses `type="button"`

### Mobile

- `MotionPressable` now provides default button semantics and disabled accessibility state
- `Button` now supports explicit `accessibilityLabel`/`accessibilityHint` and exposes disabled/busy state
- `Input` now exposes label/hint/invalid/disabled semantics to assistive tech
- `ConfirmDialog` now marks modal semantics and accessible backdrop close action
- `Toast` now exposes live region and role (`alert` for errors, `status` otherwise)
- cabinet tabs and booking cards now expose tab selected state and actionable labels/hints
- shift status block now exposes polite status announcements for dynamic state changes

## Coverage Matrix

- Public booking: **hardened**
- Web cabinet: **hardened**
- Dashboard bookings workspace: **hardened**
- Staff detail workspace: **hardened**
- Mobile cabinet equivalent: **hardened**
- Mobile shift workspace equivalent: **hardened**

## Remaining Follow-Ups (Non-blocking for UI-27)

- Run manual VoiceOver/TalkBack sweep on physical devices for final phrasing polish in RU/KY/EN.
- Add automated a11y checks (axe-based smoke coverage) to reduce regression risk.
- Continue encoding cleanup in legacy files under UI-29, as encoding noise can impact maintainability and future a11y refinements.

## Verification

- `pnpm -C apps/web typecheck`
- `pnpm -C apps/mobile typecheck`
