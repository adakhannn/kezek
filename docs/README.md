# Kezek Docs Index

This file is the main documentation index for the project.

If you are unsure which document is current, start here.

## Current WEB Priority

**30 октября 2026: широкий автономный ручной прогон закрыт, `kezek` PAUSED.**
Начало для следующего агента: [WEB_AGENT_HANDOFF.md](WEB_AGENT_HANDOFF.md).
Там указаны источники истины, незавершённый F022, блокеры и условия новой задачи.
Принято 28/316, осталось 288; NOT_READY. Старые команды запуска ниже и в архивах не действуют.

As of 2026-10-18, the measurable closure queue is [WEB_CLOSURE_PLAN.md](./WEB_CLOSURE_PLAN.md): 316 obligations assigned once to eight phases, with conditional milestones, actual ledger counts, 50 unfinished defect chains and explicit blockers. Its [JSON](./WEB_CLOSURE_PLAN.json) is checked by `node scripts/web-closure-plan.mjs --json`. Planning does not authorize live tests or resume automation.

As of 2026-10-14, the operational priority is stabilizing the existing WEB product for a verified closed-pilot candidate, not starting another broad architecture or redesign wave.

- [WEB_GLOBAL_READINESS_PLAN.md](./WEB_GLOBAL_READINESS_PLAN.md): overall analysis, scope, ordered work packages and completion criteria.
- [WEB_GLOBAL_READINESS_STATE.json](./WEB_GLOBAL_READINESS_STATE.json): current-candidate status for all82 catalogue areas and33 planned work packages. Historical targeted results remain separate.
- [WEB_LIVE_TESTING_AREAS_CATALOG.md](./WEB_LIVE_TESTING_AREAS_CATALOG.md): detailed scenarios; old area statuses are not current release approval.
- [WEB_BUG_REGISTRY.md](./WEB_BUG_REGISTRY.md): defect evidence, including open and pending historical follow-ups.

The March architecture plans below describe their own delivered waves; their green baseline statements do not certify the October product candidate. Creating this plan does not resume a scheduled run, modify the application or authorize deployment.

## Sources Of Truth

Use one primary document per topic:

1. Onboarding and local setup
   - [GETTING_STARTED.md](/C:/projects/kezek/GETTING_STARTED.md)
   - [ONBOARDING.md](/C:/projects/kezek/docs/ONBOARDING.md)

2. Architecture and technical structure
   - [PROJECT_DOCUMENTATION.md](/C:/projects/kezek/PROJECT_DOCUMENTATION.md)
   - [HOWTO_NEW_API_ENDPOINT.md](/C:/projects/kezek/apps/web/src/lib/HOWTO_NEW_API_ENDPOINT.md)

3. Product and feature reference
   - [SYSTEM_FEATURES_DOCUMENTATION.md](/C:/projects/kezek/SYSTEM_FEATURES_DOCUMENTATION.md)
   - feature-specific docs under [docs](/C:/projects/kezek/docs)

4. Engineering process and testing
   - [CONTRIBUTING.md](/C:/projects/kezek/CONTRIBUTING.md)
   - [TESTING_GUIDE.md](/C:/projects/kezek/TESTING_GUIDE.md)
   - [API_TESTING.md](/C:/projects/kezek/API_TESTING.md)
   - [E2E_TESTING.md](/C:/projects/kezek/E2E_TESTING.md)
   - repo maintenance checks in [package.json](/C:/projects/kezek/package.json), including `check:docs-links` and `check:hotspots`

5. Improvement planning
   - [WEB_GLOBAL_READINESS_PLAN.md](./WEB_GLOBAL_READINESS_PLAN.md) — current WEB execution priority
   - [PROJECT_IMPROVEMENT_PLAN.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md)
   - [PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md)
   - [CLEANUP_AND_NEXT_PHASE_PLAN.md](/C:/projects/kezek/docs/CLEANUP_AND_NEXT_PHASE_PLAN.md)
   - [MOBILE_ARCHITECTURE_HARDENING_PLAN.md](/C:/projects/kezek/docs/MOBILE_ARCHITECTURE_HARDENING_PLAN.md)
   - [WEB_PRESENTATION_HARDENING_PLAN.md](/C:/projects/kezek/docs/WEB_PRESENTATION_HARDENING_PLAN.md)
   - [PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md)
   - [DOMAIN_EXPANSION_PLAN.md](/C:/projects/kezek/docs/DOMAIN_EXPANSION_PLAN.md)

## Quick Navigation

### Start Here

- [GETTING_STARTED.md](/C:/projects/kezek/GETTING_STARTED.md): install, env, run commands
- [ONBOARDING.md](/C:/projects/kezek/docs/ONBOARDING.md): onboarding checklist
- [apps/mobile/README.md](/C:/projects/kezek/apps/mobile/README.md): mobile setup and checks

### Architecture

- [PROJECT_DOCUMENTATION.md](/C:/projects/kezek/PROJECT_DOCUMENTATION.md): overall technical architecture
- [API_DOCUMENTATION.md](/C:/projects/kezek/API_DOCUMENTATION.md): API map and contracts
- [HOWTO_NEW_API_ENDPOINT.md](/C:/projects/kezek/apps/web/src/lib/HOWTO_NEW_API_ENDPOINT.md): route pattern for new web API handlers

### Product

- [SYSTEM_FEATURES_DOCUMENTATION.md](/C:/projects/kezek/SYSTEM_FEATURES_DOCUMENTATION.md): product behavior and business rules
- [SUBSCRIPTIONS_AND_PACKAGES_FEATURE.md](/C:/projects/kezek/docs/SUBSCRIPTIONS_AND_PACKAGES_FEATURE.md): subscriptions and visit packages
- [GLOSSARY.md](/C:/projects/kezek/docs/GLOSSARY.md): product terminology

### Process

- [CONTRIBUTING.md](/C:/projects/kezek/CONTRIBUTING.md): contribution and PR rules
- [TESTING_GUIDE.md](/C:/projects/kezek/TESTING_GUIDE.md): testing workflow
- [MANUAL_TESTING_TRACKER.md](/C:/projects/kezek/docs/MANUAL_TESTING_TRACKER.md): short living checklist for the current manual product run
- [API_TESTING.md](/C:/projects/kezek/API_TESTING.md): API route testing
- [E2E_TESTING.md](/C:/projects/kezek/E2E_TESTING.md): end-to-end testing

### Planning

- [WEB_GLOBAL_READINESS_PLAN.md](./WEB_GLOBAL_READINESS_PLAN.md): current overall WEB verification and pilot-readiness plan
- [WEB_GLOBAL_READINESS_STATE.json](./WEB_GLOBAL_READINESS_STATE.json): living work-package and release-area decisions
- [PROJECT_IMPROVEMENT_PLAN.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md): long-term roadmap
- [PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md): latest delivered progress snapshot
- [CLEANUP_AND_NEXT_PHASE_PLAN.md](/C:/projects/kezek/docs/CLEANUP_AND_NEXT_PHASE_PLAN.md): current working cleanup and next-phase plan
- [MOBILE_ARCHITECTURE_HARDENING_PLAN.md](/C:/projects/kezek/docs/MOBILE_ARCHITECTURE_HARDENING_PLAN.md): completed mobile hardening wave
- [WEB_PRESENTATION_HARDENING_PLAN.md](/C:/projects/kezek/docs/WEB_PRESENTATION_HARDENING_PLAN.md): next focused implementation plan
- [PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md): review-driven execution backlog
- [DOMAIN_EXPANSION_PLAN.md](/C:/projects/kezek/docs/DOMAIN_EXPANSION_PLAN.md): next domain extraction roadmap

## Archive And Historical Context

These documents are useful as history, not as the primary source of truth:

- [DOCUMENTS_OVERVIEW.md](/C:/projects/kezek/DOCUMENTS_OVERVIEW.md)
- [PROJECT_REVIEW.md](/C:/projects/kezek/PROJECT_REVIEW.md)
- [FUTURE_IMPROVEMENTS_TASKS.md](/C:/projects/kezek/FUTURE_IMPROVEMENTS_TASKS.md): historical consolidated backlog before the current review-driven backlog
- [EVOLUTION_TECH_PLAN.md](/C:/projects/kezek/EVOLUTION_TECH_PLAN.md)
- archive docs under [docs/archive](/C:/projects/kezek/docs/archive)
