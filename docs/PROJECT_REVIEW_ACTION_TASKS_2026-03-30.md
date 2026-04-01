# Project Review Action Tasks 2026-03-30

**Status:** active working backlog  
**Created:** 2026-03-30  
**Purpose:** convert the current project review into a concrete improvement task list.

## How To Use

- Use this file as an execution backlog after the latest deep review.
- Start from `P0` and `P1` tasks unless a release or incident changes priorities.
- When a task is completed, either mark it `done` here or move the result into a more focused plan document.
- Keep this file action-oriented. Long explanations should live in ADRs, focused plans, or progress snapshots.

## Priority Legend

- `P0`: strong leverage, low ambiguity, should start next
- `P1`: important structural follow-up
- `P2`: valuable, but can wait until core cleanup is underway

## Review Summary

The project already has a strong baseline:

- solid monorepo structure
- modern web and mobile stack
- meaningful route/service/domain separation in `apps/web`
- strong documentation coverage
- healthy typecheck baseline in both `apps/web` and `apps/mobile`

The main improvement needs are:

1. reduce large multi-responsibility files in live product paths
2. strengthen the boundary between app-layer orchestration and reusable domain logic
3. simplify and normalize documentation
4. harden CI quality gates
5. improve developer confidence around complex workflows

## P0 Tasks

### P0.1 Decompose large web UI orchestration files

- Status: `done`
- Priority: `P0`

Targets:

- `apps/web/src/app/staff/finance/components/FinancePage.tsx`
- `apps/web/src/app/auth/sign-in/SignInPage.tsx`

Tasks:

- split view state, data orchestration, and effect-heavy logic into dedicated hooks or presenter modules
- reduce direct business and auth branching inside UI components
- keep page components focused on composition and rendering

Done when:

- each target file becomes meaningfully smaller
- the extracted logic is testable without rendering the full page
- page components are readable top-to-bottom in a few minutes

Progress:

- extracted sign-in redirect policy into [signInRedirectLogic.ts](/C:/projects/kezek/apps/web/src/lib/signInRedirectLogic.ts)
- added focused tests in [signInRedirectLogic.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/signInRedirectLogic.test.ts)
- connected [SignInPage.tsx](/C:/projects/kezek/apps/web/src/app/auth/sign-in/SignInPage.tsx) to the extracted redirect helper
- extracted sign-in submit actions into [useSignInSubmitActions.ts](/C:/projects/kezek/apps/web/src/app/auth/sign-in/useSignInSubmitActions.ts)
- extracted existing-session redirect effect into [useExistingSessionRedirect.ts](/C:/projects/kezek/apps/web/src/app/auth/sign-in/useExistingSessionRedirect.ts)
- extracted sign-in redirect orchestration into [useSignInRedirectDecision.ts](/C:/projects/kezek/apps/web/src/app/auth/sign-in/useSignInRedirectDecision.ts)
- extracted sign-in layout into [SignInPageView.tsx](/C:/projects/kezek/apps/web/src/app/auth/sign-in/SignInPageView.tsx)
- extracted finance local item orchestration into [itemLogic.ts](/C:/projects/kezek/apps/web/src/app/staff/finance/utils/itemLogic.ts)
- connected [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx) to the extracted finance item helpers
- added focused tests in [itemLogic.test.ts](/C:/projects/kezek/apps/web/src/__tests__/app/staff/finance/utils/itemLogic.test.ts)
- moved finance list insert/delete and expanded-index transitions into reusable item helpers
- extracted finance save/delete/add/duplicate orchestration into [useFinanceItemActions.ts](/C:/projects/kezek/apps/web/src/app/staff/finance/hooks/useFinanceItemActions.ts)
- extracted finance server-to-local synchronization into [useFinanceServerSync.ts](/C:/projects/kezek/apps/web/src/app/staff/finance/hooks/useFinanceServerSync.ts)
- extracted finance shift action/loading orchestration into [useFinanceShiftActions.ts](/C:/projects/kezek/apps/web/src/app/staff/finance/hooks/useFinanceShiftActions.ts)
- extracted finance derived page state into [useFinancePageDerivedState.ts](/C:/projects/kezek/apps/web/src/app/staff/finance/hooks/useFinancePageDerivedState.ts)

Result:

- [SignInPage.tsx](/C:/projects/kezek/apps/web/src/app/auth/sign-in/SignInPage.tsx) now acts as a thin container over extracted hooks and view modules.
- [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx) was reduced from the earlier hotspot state to a smaller composition screen backed by reusable finance hooks and item helpers.
- The extracted auth and finance orchestration is now testable without rendering the full page.

### P0.2 Decompose high-complexity service orchestration

- Status: `done`
- Priority: `P0`

Targets:

- `apps/web/src/lib/whatsAppWebhookService.ts`
- selected finance workflow services under `apps/web/src/app/staff/finance`

Tasks:

- split parsing, context resolution, command routing, and outbound messaging into separate helpers
- isolate business decisions from transport and persistence details
- add narrow tests around the extracted units

Done when:

- webhook and finance orchestration no longer depend on one large service file
- message command behavior is testable by scenario
- the main service files act as coordinators, not large containers of logic

Progress:

- extracted WhatsApp text-command routing into [whatsAppCommandRouting.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppCommandRouting.ts)
- connected [whatsAppWebhookService.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppWebhookService.ts) to the extracted command router for cancel, confirm, remind, and help flows
- added focused routing tests in [whatsAppCommandRouting.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppCommandRouting.test.ts)
- extracted WhatsApp outbound reply formatting into [whatsAppWebhookText.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppWebhookText.ts)
- extracted WhatsApp message context resolution into [whatsAppMessageContext.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppMessageContext.ts)
- extracted shared booking action execution into [whatsAppBookingCommandFlow.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppBookingCommandFlow.ts)
- extracted WhatsApp message persistence into [whatsAppMessagePersistence.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppMessagePersistence.ts)
- extracted media/status handling into [whatsAppMediaStatusHandlers.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppMediaStatusHandlers.ts)
- connected [whatsAppWebhookService.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppWebhookService.ts) to the extracted text and context helpers
- connected [whatsAppWebhookService.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppWebhookService.ts) to the extracted booking command flow
- connected [whatsAppWebhookService.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppWebhookService.ts) to the extracted persistence and media/status helpers
- added focused tests in [whatsAppWebhookText.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppWebhookText.test.ts), [whatsAppMessageContext.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppMessageContext.test.ts), [whatsAppBookingCommandFlow.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppBookingCommandFlow.test.ts), [whatsAppMessagePersistence.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppMessagePersistence.test.ts), and [whatsAppMediaStatusHandlers.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppMediaStatusHandlers.test.ts)

Result:

- [whatsAppWebhookService.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppWebhookService.ts) now behaves as a coordinator over focused routing, context, persistence, text, and booking-flow helpers.
- Finance orchestration now has dedicated action and synchronization hooks instead of one large inline service layer.
- The main high-complexity seams identified in the review were extracted and covered with focused tests.

### P0.3 Create a domain-expansion plan for shared business logic

- Status: `done`
- Priority: `P0`

Targets:

- `packages/core-domain`
- `packages/shared-client`
- duplicated or app-bound logic currently living in `apps/web/src/lib` and `apps/mobile/src`

Tasks:

- identify logic that is domain-level rather than app-level
- rank migration candidates by reuse and risk
- define a short list of first moves, such as booking rules, shift rules, finance calculations, or role/business-selection invariants

Done when:

- there is a focused follow-up roadmap for domain extraction
- the team has a shared rule for what belongs in `core-domain`
- at least the first migration batch is chosen explicitly

Result:

- Added [DOMAIN_EXPANSION_PLAN.md](/C:/projects/kezek/docs/DOMAIN_EXPANSION_PLAN.md)
- Rewrote [MODULE_BOUNDARIES.md](/C:/projects/kezek/docs/MODULE_BOUNDARIES.md) into a clean active rule document

### P0.4 Normalize active documentation and remove contradictions

- Status: `done`
- Priority: `P0`

Tasks:

- fix active docs that still contradict the real repo state
- align command, coverage, and process guidance across root and app-level READMEs
- reduce overlap between roadmap, progress, and working-plan documents

Known example:

- `apps/web/README.md` still mentions a coverage threshold that no longer matches `apps/web/jest.config.js`

Done when:

- active docs no longer disagree on quality gates or current next steps
- a new teammate can identify the current source of truth quickly
- stale guidance is archived or removed from active docs

Result:

- Rewrote [apps/web/README.md](/C:/projects/kezek/apps/web/README.md) and aligned the coverage threshold with `apps/web/jest.config.js`
- Added the new review backlog and domain plan to [README.md](/C:/projects/kezek/README.md) and [docs/README.md](/C:/projects/kezek/docs/README.md)

## P1 Tasks

### P1.1 Fix encoding and readability issues in high-value documents

- Status: `done`
- Priority: `P1`

Tasks:

- audit the most frequently used docs first
- normalize UTF-8 and remove visibly broken text
- prefer rewriting active documents over patching them incrementally if readability is already poor

Suggested first batch:

- `PROJECT_DOCUMENTATION.md`
- `CONTRIBUTING.md`
- `TESTING_GUIDE.md`
- `apps/web/README.md`
- `apps/mobile/README.md`

Done when:

- core onboarding and architecture docs render cleanly in standard editors and terminals
- active documents are readable without legacy encoding artifacts

Progress:

- Rewrote [apps/web/README.md](/C:/projects/kezek/apps/web/README.md)
- Rewrote [apps/mobile/README.md](/C:/projects/kezek/apps/mobile/README.md)
- Rewrote [MODULE_BOUNDARIES.md](/C:/projects/kezek/docs/MODULE_BOUNDARIES.md)

Remaining high-value files:

- none from the initial priority batch

### P1.2 Tighten CI quality gates

- Status: `done`
- Priority: `P1`

Tasks:

- review jobs currently marked `continue-on-error: true`
- decide which test classes are mature enough to become blocking
- split unstable suites if needed so only known-flaky segments remain non-blocking

Suggested order:

1. make `mobile_tests` blocking once stable
2. make `api_tests` blocking once mocks and environment assumptions are cleaned up
3. revisit `e2e_tests` after environment reliability improves

Done when:

- the CI signal is trustworthy
- green PRs mean materially more than "lint and typecheck passed"

Progress:

- reviewed the current CI jobs and confirmed that `api_tests`, `e2e_tests`, and `mobile_tests` are still non-blocking
- verified local typecheck health for both `apps/web` and `apps/mobile`
- stabilized the mobile smoke suite by introducing a shared test QueryClient configuration for React Query based screen tests
- verified `pnpm -C apps/mobile test -- --runInBand --watchAll=false` locally: 15 suites and 35 tests passed
- made `mobile_tests` blocking in [ci.yml](/C:/projects/kezek/.github/workflows/ci.yml)
- aligned `mobile_tests` CI execution with the proven local command: `pnpm test -- --runInBand --watchAll=false`
- added stable web CI scripts in [apps/web/package.json](/C:/projects/kezek/apps/web/package.json): `test:ci:core` and `test:ci:extended`
- verified a stable blocking web coverage gate locally via `pnpm -C apps/web test:ci:core`: 23 suites, 238 tests, coverage above the 60% global threshold
- verified a broad `api/lib` sweep locally via `pnpm -C apps/web test:ci:extended`: 292 suites and 1081 tests passed
- split the old web gate into a blocking `web_core_tests` coverage job and a non-blocking extended `api/lib` sweep in [ci.yml](/C:/projects/kezek/.github/workflows/ci.yml)
- fixed the remaining extended web sweep teardown leak by unref-ing module-scope cleanup intervals in [mobileExchangeService.ts](/C:/projects/kezek/apps/web/src/lib/mobileExchangeService.ts) and [rateLimit.ts](/C:/projects/kezek/apps/web/src/lib/rateLimit.ts)
- re-verified the full extended sweep locally after the teardown fix: `pnpm -C apps/web test:ci:extended` passed cleanly with 292 suites and 1081 tests
- made `api_tests` blocking in [ci.yml](/C:/projects/kezek/.github/workflows/ci.yml) now that the extended web sweep completes reliably
- added a deterministic Playwright smoke gate via [smoke-public.spec.ts](/C:/projects/kezek/apps/web/e2e/smoke-public.spec.ts) and [test:e2e:smoke](/C:/projects/kezek/apps/web/package.json)
- added a new blocking `e2e_smoke_tests` job in [ci.yml](/C:/projects/kezek/.github/workflows/ci.yml) while keeping the full seeded E2E suite non-blocking
- verified the smoke browser gate locally via `pnpm -C apps/web test:e2e:smoke`: 3 tests passed
- split the larger Playwright layer into explicit script groups in [apps/web/package.json](/C:/projects/kezek/apps/web/package.json): `test:e2e:http`, `test:e2e:auth-required`, `test:e2e:seed-required`, and `test:e2e:full-seeded`
- aligned [ci.yml](/C:/projects/kezek/.github/workflows/ci.yml) and [apps/web/e2e/README.md](/C:/projects/kezek/apps/web/e2e/README.md) with the new smoke/auth/seeded grouping
- made the smoke and HTTP Playwright scripts deterministic with `--workers=1` in [apps/web/package.json](/C:/projects/kezek/apps/web/package.json)
- re-verified the grouped stable E2E entry points locally: `smoke-public.spec.ts` passed with 3 tests, `whatsapp-webhook.spec.ts` passed with 1 test
- added shared Playwright env helpers in [testEnv.ts](/C:/projects/kezek/apps/web/e2e/testEnv.ts)
- removed placeholder fallback accounts and seeded ids from the grouped `auth-required` and `seed-required` specs so those flows now depend on explicit environment configuration instead of silent defaults
- added suite-level Playwright preflight skips for grouped specs with required env, so missing contracts now surface as explicit skipped suites instead of failing deep inside scenario execution
- extracted shared Playwright auth/bootstrap helpers into [authHelpers.ts](/C:/projects/kezek/apps/web/e2e/authHelpers.ts) and reused them across manager, super-admin, multi-role, and staff login flows

Result:

- CI now has blocking `mobile_tests`, `web_core_tests`, `api_tests`, and `e2e_smoke_tests` gates in [ci.yml](/C:/projects/kezek/.github/workflows/ci.yml).
- Full seeded E2E remains intentionally non-blocking, but it is now clearly separated from the trusted PR-quality gate.
- Green CI now represents a materially stronger signal than the original lint-and-typecheck baseline.

### P1.3 Add focused tests for extracted orchestration and edge-case flows

- Status: `done`
- Priority: `P1`

Tasks:

- add tests around redirect decision logic in auth flows
- add scenario tests for WhatsApp command handling
- add tests for mobile auth callback and session restoration behavior
- cover file-level helpers created during decomposition work

Done when:

- risky orchestration logic is no longer protected only by broad integration tests
- regressions in auth, redirect, and messaging flows are caught closer to the source

Progress:

- added redirect-decision tests in [signInRedirectLogic.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/signInRedirectLogic.test.ts)
- added focused mobile auth/session restoration tests in [useRootNavigationSession.test.ts](/C:/projects/kezek/apps/mobile/src/__tests__/navigation/useRootNavigationSession.test.ts)
- verified the full mobile smoke suite after the new auth/session coverage: 16 suites and 41 tests passed
- added WhatsApp command-routing tests in [whatsAppCommandRouting.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppCommandRouting.test.ts)
- added finance item logic tests in [itemLogic.test.ts](/C:/projects/kezek/apps/web/src/__tests__/app/staff/finance/utils/itemLogic.test.ts)
- added WhatsApp message context tests in [whatsAppMessageContext.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppMessageContext.test.ts)
- added WhatsApp reply text tests in [whatsAppWebhookText.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppWebhookText.test.ts)
- added WhatsApp booking command scenario tests in [whatsAppBookingCommandFlow.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppBookingCommandFlow.test.ts)
- added WhatsApp persistence tests in [whatsAppMessagePersistence.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppMessagePersistence.test.ts)
- added WhatsApp media/status tests in [whatsAppMediaStatusHandlers.test.ts](/C:/projects/kezek/apps/web/src/__tests__/lib/whatsAppMediaStatusHandlers.test.ts)

Result:

- Auth redirect, WhatsApp command handling, finance item logic, and mobile auth/session restoration all have focused tests near the extracted logic.
- The highest-risk orchestration flows from this review are no longer protected only by broad integration coverage.

### P1.4 Define module boundary rules for web and mobile feature code

- Status: `done`
- Priority: `P1`

Tasks:

- document where hooks, services, presenters, repositories, validators, and use-cases should live
- define size and responsibility heuristics for "needs decomposition"
- apply the rule first to finance, auth, and messaging paths

Done when:

- contributors can place new code consistently
- large-file growth becomes easier to catch during review

Result:

- Rewrote [MODULE_BOUNDARIES.md](/C:/projects/kezek/docs/MODULE_BOUNDARIES.md) as the active boundary rule document
- Added explicit placement heuristics and large-file decomposition rules

## P2 Tasks

### P2.1 Continue mobile screen decomposition

- Status: `done`
- Priority: `P2`

Tasks:

- review remaining large screens and screen-data hooks
- keep navigation/session/auth handling stable while moving complex screen logic into smaller pieces
- align with the existing mobile hardening plan

Progress:

- re-audited the current mobile hotspots after the earlier screen and navigator wave
- decomposed [HomeScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/HomeScreenSections.tsx) into focused presentational modules:
  [HomeScreenHeader.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/HomeScreenHeader.tsx),
  [SearchSection.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/SearchSection.tsx),
  [BookingActivitySections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/BookingActivitySections.tsx), and
  [DiscoverySections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/DiscoverySections.tsx)
- reduced [HomeScreenSections.tsx](/C:/projects/kezek/apps/mobile/src/screens/home/HomeScreenSections.tsx) to a thin export layer
- added stable `testID` hooks for the home hero title and search input, then refreshed [HomeScreen.test.tsx](/C:/projects/kezek/apps/mobile/src/__tests__/screens/HomeScreen.test.tsx) to avoid locale/encoding-sensitive selectors
- verified with `pnpm -C apps/mobile typecheck` and `pnpm -C apps/mobile test -- --runInBand --watchAll=false src/__tests__/screens/HomeScreen.test.tsx`
- extracted business/bootstrap hydration from [BookingStep1Branch.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep1Branch.tsx) into [useBookingStep1Business.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep1Business.ts)
- extracted services loading and booking-context hydration from [BookingStep2Service.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep2Service.tsx) into [useBookingStep2Services.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep2Services.ts)
- extracted staff loading and booking-context hydration from [BookingStep3Staff.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep3Staff.tsx) into [useBookingStep3Staff.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep3Staff.ts)
- extracted booking slot loading and error classification from [BookingStep5Time.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep5Time.tsx) into [useBookingStep5Slots.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep5Slots.ts)
- reduced [BookingStep3Staff.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep3Staff.tsx) to `223` lines and [BookingStep5Time.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep5Time.tsx) from `313` to `211` lines while keeping those screens focused on selection and navigation
- re-verified the mobile package with `pnpm -C apps/mobile typecheck` after the booking-step extraction pass
- extracted booking date-list generation and date-label formatting from [BookingStep4Date.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep4Date.tsx) into [useBookingStep4Dates.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep4Dates.ts)
- extracted booking confirmation derivation and submit orchestration from [BookingStep6Confirm.tsx](/C:/projects/kezek/apps/mobile/src/screens/booking/BookingStep6Confirm.tsx) into [useBookingStep6Confirm.ts](/C:/projects/kezek/apps/mobile/src/screens/booking/useBookingStep6Confirm.ts)

Done when:

- the next set of mobile hotspots is reduced
- screen files act mostly as composition layers

Result:

- The remaining booking flow hotspots now follow the same hook-driven pattern as the earlier mobile cleanup wave.
- `BookingStep1` through `BookingStep6` no longer mix the main data/bootstrap seams directly into the full render tree.
- The mobile booking flow is now much more structurally consistent end-to-end.

### P2.2 Improve repo-level DX and maintenance automation

- Status: `done`
- Priority: `P2`

Tasks:

- add lightweight scripts or checks for documentation drift
- consider a simple check for broken markdown links in active docs
- evaluate whether file-size or complexity alerts are worth adding for selected paths

Progress:

- added [scripts/check-doc-links.mjs](/C:/projects/kezek/scripts/check-doc-links.mjs) as a lightweight active-doc markdown link check
- added the repo-level command `pnpm check:docs-links` in [package.json](/C:/projects/kezek/package.json)
- verified the current active-doc set passes the new local link check cleanly
- added [scripts/check-hotspot-sizes.mjs](/C:/projects/kezek/scripts/check-hotspot-sizes.mjs) as a lightweight guard for the main large-file regression hotspots
- added the repo-level command `pnpm check:hotspots` in [package.json](/C:/projects/kezek/package.json)
- verified the current hotspot baseline passes locally for [FinancePage.tsx](/C:/projects/kezek/apps/web/src/app/staff/finance/components/FinancePage.tsx), [whatsAppWebhookService.ts](/C:/projects/kezek/apps/web/src/lib/whatsAppWebhookService.ts), and [SignInPage.tsx](/C:/projects/kezek/apps/web/src/app/auth/sign-in/SignInPage.tsx)
- added both maintenance checks to the blocking `lint_typecheck` CI job in [ci.yml](/C:/projects/kezek/.github/workflows/ci.yml), so doc-link drift and hotspot regressions now fail PR validation automatically

Done when:

- routine maintenance work is cheaper
- obvious documentation and structure drift is caught earlier

Result:

- Active-doc drift and hotspot-size regressions now have dedicated repo scripts and blocking CI checks.
- The repo now has a lightweight maintenance layer instead of relying only on manual review discipline.

### P2.3 Consolidate focused plans and archive older backlog fragments

- Status: `done`
- Priority: `P2`

Tasks:

- review older task documents in root and `docs`
- archive plans that are no longer operational
- keep one master roadmap, one latest progress snapshot, and a small number of active focused plans

Progress:

- aligned [DOCUMENTS_OVERVIEW.md](/C:/projects/kezek/DOCUMENTS_OVERVIEW.md) and [docs/README.md](/C:/projects/kezek/docs/README.md) so the current execution backlog is [PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md)
- explicitly marked [FUTURE_IMPROVEMENTS_TASKS.md](/C:/projects/kezek/FUTURE_IMPROVEMENTS_TASKS.md) as historical context in the active docs indexes
- confirmed older root task stubs still exist only as archive pointers and no longer need to be treated as the primary working backlog
- rewrote the archived root backlog pointers in [TASKS.md](/C:/projects/kezek/TASKS.md), [IMPROVEMENT_TASKS.md](/C:/projects/kezek/IMPROVEMENT_TASKS.md), and [REFACTOR_TASKS.md](/C:/projects/kezek/REFACTOR_TASKS.md) so they point to the current execution backlog first

Done when:

- the backlog surface area is smaller
- planning documents are easier to trust

Result:

- The active planning surface now points to one live execution backlog.
- Older task documents remain available as historical references, but they no longer compete with the current source of truth.

## Suggested Execution Order

1. `P0.1` Decompose large web UI orchestration files
2. `P0.2` Decompose high-complexity service orchestration
3. `P1.1` Fix encoding and readability issues in high-value documents
4. `P1.2` Tighten CI quality gates
5. `P1.3` Add focused tests for extracted orchestration and edge-case flows
6. `P2.3` Consolidate focused plans and archive older backlog fragments

## What To Avoid

- do not start by rewriting the entire repo structure at once
- do not create new plan documents for every small cleanup item
- do not move logic into `core-domain` without a clear ownership rule
- do not make CI stricter before identifying which failures are real and which are environment debt

## Expected Result After This Backlog

If the tasks above are executed well, the project should gain:

- smaller and clearer live application files
- stronger domain boundaries
- more trustworthy documentation
- more meaningful CI results
- easier onboarding and safer future growth
