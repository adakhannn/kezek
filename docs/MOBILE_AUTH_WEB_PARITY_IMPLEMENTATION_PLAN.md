# MOBILE AUTH WEB PARITY IMPLEMENTATION PLAN

Last updated: 2026-05-25  
Owner: Mobile team  
Status: Proposed (ready for execution)

## Goal
Bring `apps/mobile` auth entry UI/UX to visual and interaction parity with `apps/web` auth page while preserving the already-hardened mobile auth logic (Google/Telegram/WhatsApp flows, recovery, resilience).

## Why this plan
Current mobile auth is functionally correct but visually simpler than web. It lacks the same brand hierarchy, card composition, and polished rhythm seen on web. We need to close that gap without reintroducing removed flows (email login / registration) and without regressions in auth behavior.

## Source of truth (current state)

### Mobile
- `apps/mobile/src/screens/auth/SignInScreen.tsx`
- `apps/mobile/src/components/ui/Button.tsx`
- `apps/mobile/src/constants/colors.ts`
- `apps/mobile/src/navigation/AuthNavigator.tsx`

### Web reference
- `apps/web/src/app/auth/sign-in/SignInPageView.tsx`

## Design parity scope

In scope:
- Visual parity of auth entry experience (brand, hierarchy, spacing rhythm, CTA composition, state feedback blocks).
- Mobile-appropriate adaptation of web layout patterns.
- Token-first implementation (no ad hoc hardcoded styles in auth screen).
- Tests and regression safety updates.

Out of scope:
- Re-introducing email OTP on mobile sign-in.
- Re-introducing registration screen.
- Backend/API auth protocol changes.

## Gap analysis (web vs mobile)

### 1) Missing auth shell composition
Web has:
- page-level gradient atmosphere
- centered card container with border/shadow/radius
- top brand badge + title/subtitle + helper microcopy

Mobile currently has:
- plain page background + direct button list
- no separate auth card shell
- no brand block matching web hierarchy

Impact:
- reduced perceived quality and weaker visual identity on mobile.

### 2) Incomplete information hierarchy
Web defines clear layers:
1. brand identity
2. short explanation of frictionless auth
3. method grouping and transitions
4. trust/supporting hint

Mobile currently starts from action buttons immediately.

Impact:
- lower clarity for first-time users and less “product-like” first impression.

### 3) CTA composition drift
Web style:
- clear grouping and rhythm for methods
- consistent button sizing/elevation language
- explicit “other/quick methods” framing

Mobile style:
- functionally correct buttons, but less intentional grouping and section semantics.

Impact:
- screen feels utilitarian rather than deliberate.

### 4) Token and primitive mismatch points
Mobile already has semantic tokens but auth screen still underuses them for:
- shell/background layering
- section framing
- microcopy and helper emphasis
- consistent cross-method spacing rhythm

Impact:
- visual inconsistency despite available token system.

## Target UX model (mobile-adapted parity)

### Layout model
- Keep one-column mobile layout.
- Add gradient page background.
- Add centered auth card shell (`surface.card`, subtle border, shadow, large radius).
- Inside card, create sections:
  1. Brand header
  2. Fast auth intro microcopy
  3. Methods block (Google, Telegram, WhatsApp)
  4. Telegram pending/retry/cancel state block
  5. Optional trust footer text

### Visual language
- Reuse web tone: indigo + pink brand core, clean high-contrast text, calm helper text.
- Keep Telegram/WhatsApp brand action colors through semantic tokens only.
- Keep button height and spacing consistent with web perceived density, adapted for mobile touch ergonomics.

### Copy model (RU)
- Headline should communicate direct entry into Kezek.
- Supporting text should state “быстрый вход без пароля”.
- Methods section should be explicitly framed as “быстрые способы входа”.
- No references to registration or email OTP on this screen.

## Technical implementation plan

## Epic A. Auth shell and hierarchy

### A1. Introduce reusable auth shell primitives
Tasks:
- Create `apps/mobile/src/screens/auth/authSignInStyles.ts` (or similarly scoped styles module).
- Introduce card-shell layout styles and section spacing tokens.
- Add optional small `AuthHeroBadge` subcomponent if composition in `SignInScreen` becomes noisy.

Done when:
- `SignInScreen` has explicit page background + centered auth card shell.
- Core styles are extracted and readable (screen logic not polluted by style noise).

### A2. Add brand header block
Tasks:
- Add gradient brand badge/icon block (consistent with web identity).
- Add title/subtitle/helper text hierarchy using semantic typography and colors.
- Ensure long localized text wraps cleanly on small widths.

Done when:
- Auth header reads as the same product family as web.

## Epic B. Methods section parity

### B1. Recompose method list structure
Tasks:
- Add section caption for quick auth methods.
- Ensure consistent vertical rhythm between method buttons.
- Preserve existing `anyBusyAuth` behavior and disabled states.

Done when:
- Method block visually matches web hierarchy and feels intentional.

### B2. Unify CTA visual hierarchy
Tasks:
- Align Google action style with web neutral secondary CTA.
- Keep Telegram as outlined/brand-accent action.
- Keep WhatsApp as prominent brand-solid action.
- Validate text contrast for each state.

Done when:
- Method priorities are instantly readable and consistent with web intent.

## Epic C. State UX quality

### C1. Telegram pending flow presentation
Tasks:
- Wrap pending status and retry/cancel controls in a dedicated state block inside card.
- Improve spacing and separation from base method actions.
- Keep `accessibilityLiveRegion='polite'` for status text.

Done when:
- Pending flow looks integrated, not “appended”.

### C2. Busy/loading consistency
Tasks:
- Verify loading labels and disabled states across all auth methods.
- Ensure no layout jumps when button text switches to loading.

Done when:
- Interaction feels stable and predictable under network latency.

## Epic D. Token and primitive hardening

### D1. Expand semantic tokens only if needed
Tasks:
- Add missing semantic aliases in `colors.ts` for auth shell backgrounds/borders if current palette is insufficient.
- Avoid inline hex in `SignInScreen`.

Done when:
- Auth screen has zero ad hoc color drift.

### D2. Button primitive adjustments (if required)
Tasks:
- If parity needs it, add optional `elevated` or `auth` variant semantics to `Button` (without breaking existing usage).
- Keep backward compatibility for current screens.

Done when:
- Auth buttons achieve parity without hacks/local overrides explosion.

## Epic E. QA, tests, and rollout safety

### E1. Update and extend tests
Tasks:
- Update `SignInScreen` tests for new hierarchy text blocks.
- Keep existing flow tests for Google/Telegram/WhatsApp intact.
- Keep `uiTextThemeSmoke` coverage for updated files.

Done when:
- Auth tests pass with no behavior regressions.

### E2. Manual visual acceptance checklist
Tasks:
- Android emulator: verify 360–412dp widths.
- Verify header readability, card padding, button tap targets.
- Verify Telegram pending block rendering and transitions.
- Verify dark theme contrast and text legibility.

Done when:
- Visual QA checklist passes on primary emulator profile.

## Execution order
1. Epic A (shell + hierarchy)
2. Epic B (methods parity)
3. Epic C (state UX)
4. Epic D (token/primitive hardening)
5. Epic E (tests + acceptance)

## Acceptance criteria (Definition of Done)
- Mobile auth first screen is visually recognizable as the same family as web auth.
- No email-login and no registration affordances on mobile sign-in.
- Google/Telegram/WhatsApp flows remain behaviorally unchanged.
- No accessibility regression in status announcements.
- Target tests pass:
  - `src/__tests__/screens/auth/SignInScreen.test.tsx`
  - `src/__tests__/screens/uiTextThemeSmoke.test.ts`

## Risks and mitigations

Risk: Over-styling may reduce clarity on small screens.  
Mitigation: prioritize legibility and touch ergonomics over decorative fidelity.

Risk: Refactor accidentally touches auth behavior logic.  
Mitigation: keep logic and UI refactor separate commits/steps; run focused auth tests after each epic.

Risk: Token additions create drift in other screens.  
Mitigation: prefer screen-local style composition first; add tokens only when clearly reusable.

## Task checklist (implementation-ready)
- [x] A1 Create auth shell style module and card structure
- [x] A2 Add brand header hierarchy block
- [x] B1 Recompose methods section with explicit quick-auth framing
- [x] B2 Align per-method CTA visual hierarchy
- [x] C1 Improve Telegram pending/retry/cancel visual block
- [x] C2 Validate loading/disabled/no-layout-jump behavior
- [x] D1 Add/adjust semantic auth tokens only where necessary
- [x] D2 Extend Button variant API only if needed
- [x] E1 Update/extend tests for new UI structure
- [x] E2 Run emulator visual acceptance checklist

## Notes
- This plan intentionally keeps auth protocols untouched.
- This plan assumes current mobile auth entry remains “quick auth only”.
- If we later need web-level email auth parity, treat it as a separate product decision and separate technical epic.











## E2 QA notes (2026-05-25)
- Verified auth layout on default width profile (approx 412dp) via screenshot: pps/mobile/kezek_auth_e2_default2.png.
- Verified auth layout on narrow width profile (360dp override) via screenshot: pps/mobile/kezek_auth_e2_360_retry.png.
- Header readability, card padding, CTA tap targets, dark theme contrast are visually acceptable on both widths.
- Telegram external transition was manually triggered (tap -> external auth surface). Pending status accessibility and state behavior are additionally covered by SignInScreen.test.tsx (ui-level pending status test).

