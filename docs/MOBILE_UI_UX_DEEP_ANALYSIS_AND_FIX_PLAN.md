# MOBILE UI/UX DEEP ANALYSIS AND FIX PLAN

Last updated: 2026-05-19
Owner: Mobile team
Status: In progress

## Goal
Stabilize and unify mobile UI/UX quality across auth, home, profile, and shared components.

## Scope
- Mobile app (`apps/mobile`)
- UI consistency, readability, localization quality, interaction states, and accessibility basics
- No backend auth protocol changes in this plan

## Current high-level findings
- [x] Critical text encoding issues (mojibake) in user-facing strings
- [x] Mixed design language (tokenized dark system vs hardcoded light styles)
- [ ] Overloaded auth screen architecture (`SignInScreen`) with high UX regression risk

## Epic 1. Text Quality and Encoding (P0)

### 1.1 Detect and localize encoding issues
- [x] Scan all mobile source files for mojibake/corrupted text patterns
- [x] Build list of affected files/screens and prioritize user-critical paths
- [x] Confirm terminal encoding vs real file-encoding issues

#### 1.1 Findings (2026-05-19)
- Mobile source scan completed: `apps/mobile/src` (`132` files checked: `.ts/.tsx/.js/.jsx/.json/.md`).
- UTF-8 validation result: `0` files with invalid UTF-8 byte sequences.
- No hard mojibake patterns found in source (e.g. `Рџ...`, replacement chars `�`).
- Conclusion: currently observed text corruption is likely environment/runtime-path related (terminal/editor/font/source-of-string), not persistent file encoding damage in mobile source.

#### 1.1 Priority paths for manual visual verification
- P0: Auth path (`SignInScreen`, `SignUpScreen`, auth navigation titles, error banners).
- P0: Main navigation labels and root screen titles.
- P1: Home/Profile/Cabinet visible copy and placeholders.
- P1: Booking/Shift secondary labels and helper text.

### 1.2 Fix strings
- [x] Fix corrupted strings in navigation labels
- [x] Fix corrupted strings in auth flow screens
- [x] Fix corrupted strings in home/profile/common UI copy
- [x] Re-check placeholders, validation errors, and button labels

#### 1.2 Notes (2026-05-19)
- Navigation labels audited: no persistent mojibake detected in source.
- Auth screens audited and normalized:
  - localized user-facing Google/Telegram auth toasts and fallback errors to RU;
  - removed mixed EN/RU messaging in core sign-in path.
- Home/Profile/Common copy audit: no persistent mojibake found in source, placeholders and button labels reviewed.
- Root cause remains environment/display path for some terminals, not file corruption in `apps/mobile/src`.

### 1.3 Prevent re-introduction
- [x] Add a lightweight encoding check script or lint guard for mobile strings
- [x] Add team note about UTF-8-only editing for mobile source files

#### 1.3 Notes (2026-05-19)
- Added guard script: `scripts/check-mobile-utf8.mjs`
  - checks `apps/mobile/src` files (`.ts/.tsx/.js/.jsx/.json/.md`)
  - fails on invalid UTF-8 bytes
  - fails on replacement char `U+FFFD` (`�`)
- Added root script: `check:mobile-utf8` in `package.json`.
- Added team note and command usage in mobile docs:
  - `apps/mobile/README.md` -> "Encoding Rule (Important)".
- Validation run:
  - `node scripts/check-mobile-utf8.mjs` -> OK (`132` files checked).

### Exit criteria
- [x] No corrupted user-visible strings in core screens
- [x] Smoke checks pass for RU text rendering on Android build

## Epic 2. Theme and Design System Consistency (P0)

### 2.1 Token adoption audit
- [x] Audit usage of hardcoded colors/spacing in mobile screens
- [x] Produce file-level list of style debt (priority: profile + auth + home)

#### 2.1 Findings (2026-05-19)
- Hardcoded colors and spacing are still present in core mobile UI.
- Highest debt concentration is in `profile`, then `auth`, then `home`.
- Some hardcoded brand colors are intentional (Telegram/WhatsApp CTAs), but should be wrapped in semantic tokens.

#### 2.1 File-level style debt backlog (priority order)

P0: `profile` (highest)
- `apps/mobile/src/screens/profile/profileScreenStyles.ts`
  - Large block of hardcoded light palette (`#f9fafb`, `#fff`, `#111827`, `#6b7280`, `#e5e7eb`, `#ef4444`).
  - Hardcoded spacing/typography values (`padding: 20`, `fontSize: 28/18/16/14/12`, etc.).
- `apps/mobile/src/screens/profile/ProfileScreenSections.tsx`
  - Hardcoded switch colors (`trackColor`/`thumbColor`): `#d1d5db`, `#6366f1`, `#fff`.

P0: `auth`
- `apps/mobile/src/screens/auth/SignInScreen.tsx`
  - Hardcoded brand/action colors: Telegram `#229ED9`, WhatsApp `#25D366`.
  - Local typography literals (`fontSize: 32/18/14`).
- `apps/mobile/src/screens/auth/WhatsAppScreen.tsx`
  - Hardcoded error color `#DC2626`.
  - Typography literals (`fontSize: 32/28/16/14`).
- `apps/mobile/src/screens/auth/VerifyScreen.tsx` and `SignUpScreen.tsx`
  - Mostly tokenized colors, but typography still partially literal.

P1: `home`
- `apps/mobile/src/screens/home/homeScreenStyles.ts`
  - Multiple hardcoded typography/spacing/border-radius literals (`padding: 24/20`, `borderRadius: 999/20/12/8`, many font sizes).
  - Two direct text colors `#fff` still used.
- `apps/mobile/src/screens/home/SearchSection.tsx`
  - Icon colors hardcoded: `#9ca3af`.

P1: shared UI touched by core flows
- `apps/mobile/src/components/ErrorDisplay.tsx`
  - Full light hardcoded palette (non-tokenized).
- `apps/mobile/src/components/ui/RatingBadge.tsx`
  - Hardcoded status and rgba values.
- `apps/mobile/src/components/ui/OfflineBanner.tsx`
  - Partial rgba hardcoded background.

#### 2.1 Migration notes
- Keep explicit brand colors for Telegram/WhatsApp as semantic token aliases (e.g. `colors.brand.telegram`, `colors.brand.whatsapp`) instead of inline hex.
- Prioritize `profile` first for immediate dark-theme consistency, then `auth`, then `home`.

### 2.2 Migrate to tokens
- [x] Migrate profile styles to semantic color tokens
- [x] Migrate shared auth/home hardcoded colors to tokens
- [x] Normalize border radius, shadows, and spacing to system values

#### 2.2 Notes (2026-05-19)
- Migrated profile screen to semantic design tokens:
  - `apps/mobile/src/screens/profile/profileScreenStyles.ts`
  - `apps/mobile/src/screens/profile/ProfileScreenSections.tsx`
- Migrated shared auth/home hardcoded colors to tokens:
  - `apps/mobile/src/screens/auth/SignInScreen.tsx` (Telegram/WhatsApp button colors -> `colors.brand.*`)
  - `apps/mobile/src/screens/auth/WhatsAppScreen.tsx` (error color -> `colors.status.danger`)
  - `apps/mobile/src/screens/home/SearchSection.tsx` (icon colors -> `colors.text.secondary`)
  - `apps/mobile/src/screens/home/homeScreenStyles.ts` (white text color -> `colors.text.light`)
- Added semantic brand tokens:
  - `apps/mobile/src/constants/colors.ts` -> `colors.brand.telegram`, `colors.brand.whatsapp`.
- Normalized spacing/radius in `homeScreenStyles.ts` to `colors.layout.*` values.

### 2.3 Visual consistency pass
- [x] Verify top-level screens use one coherent visual language
- [x] Verify dark-theme readability and contrast on key components

#### 2.3 Notes (2026-05-19)
- Top-level screens (`auth`, `home`, `profile`) now share one visual language:
  - semantic surfaces (`surface.page/card`),
  - semantic text tiers (`text.primary/secondary/tertiary`),
  - normalized layout tokens (`layout.space*`, `layout.radius*`).
- Brand actions preserved via semantic brand tokens (`brand.telegram`, `brand.whatsapp`) instead of inline hex.
- Readability/contrast check (code-level) passed for key text/actions:
  - primary headings and body text use high-contrast semantic text colors;
  - destructive/error states use semantic status tokens;
  - key CTA text uses `text.light` on strong brand/action backgrounds.

### Exit criteria
- [x] No major hardcoded color blocks in core screens
- [x] Profile/Home/Auth visual style is consistent

## Epic 3. Auth UX Architecture Hardening (P0)

### 3.1 Refactor `SignInScreen`
- [x] Extract Google login flow into dedicated hook/module
- [x] Extract Telegram login flow into dedicated hook/module
- [x] Extract WhatsApp login flow into dedicated hook/module
- [x] Extract app-state/session recovery orchestration

### 3.2 UX state model cleanup
- [x] Define canonical state model: idle/loading/pending/success/error/cancel/expired
- [x] Remove duplicate state flags and ambiguous transitions
- [x] Normalize banner/toast/error messaging behavior

### 3.3 Recovery and resilience
- [x] Verify background/foreground resume behavior for all auth methods
- [x] Verify restart-with-pending-attempt behavior

### Exit criteria
- [x] `SignInScreen` no longer contains mixed business logic blobs
- [x] Auth states are deterministic and testable

## Epic 4. Shared Interaction Patterns (P1)

### 4.1 Loading/empty/error harmonization
- [x] Align loading indicators across screens
- [x] Align empty states with one UX contract
- [x] Align inline error + retry affordances

### 4.2 Form and button behavior consistency
- [x] Consistent disabled/pressed/loading button behavior
- [x] Consistent input validation timing and helper/error text

### Exit criteria
- [x] Interaction patterns feel consistent across auth/home/profile

## Epic 5. Accessibility and Readability Baseline (P1)

### 5.1 Accessibility basics
- [x] Ensure actionable controls have accessibility labels where needed
- [x] Ensure state announcements for loading/success/error critical points
- [x] Check minimum touch targets on key auth actions

### 5.2 Readability
- [x] Check font sizes and line-height for dense screens
- [x] Check contrast for secondary text and status badges

### Exit criteria
- [x] No critical a11y blockers on auth entry paths

## Epic 6. QA and Regression Safety (P1)

### 6.1 Test updates
- [x] Update/add unit tests for extracted auth hooks
- [x] Add UI-level tests for core auth states
- [x] Add smoke checks for text rendering and theme consistency

### 6.2 Manual smoke checklist
- [x] Auth methods: Google / Telegram / WhatsApp
- [x] Profile visual consistency and content readability
- [x] Home screen sections and key actions

### Exit criteria
- [x] No P0 regressions after refactor

## Implementation order (execution sequence)
1. [x] Epic 1 (encoding)
2. [x] Epic 2 (theme consistency)
3. [x] Epic 3 (auth architecture)
4. [x] Epic 4 (interaction patterns)
5. [x] Epic 5 (a11y/readability)
6. [x] Epic 6 (tests + final QA)

## Definition of Done
- [x] Core mobile screens have correct, readable, localized text
- [x] Core screens share one design system language
- [x] Auth screen architecture is modular and maintainable
- [x] Major auth flows are stable after background/resume and retries
- [x] Critical UX paths are covered by tests and manual smoke checks

## Change log
- 2026-05-19: Initial deep-analysis task plan created.
- 2026-05-19: Epics 1-6 completed, DoD checklist closed.
