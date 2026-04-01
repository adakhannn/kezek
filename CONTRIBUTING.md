# Contributing To Kezek

This document describes the default contribution workflow for the repository.

## Repository Shape

The repo is a `pnpm` monorepo with:

- `apps/web`: Next.js application and API layer
- `apps/mobile`: Expo / React Native application
- `packages/core-domain`: shared domain logic
- `packages/shared-client`: shared client-safe helpers, DTOs, and formatters

## Default Expectations

Before opening a PR:

- keep changes scoped
- avoid unrelated refactors
- update documentation when behavior or workflow changes
- prefer small testable extractions over large rewrites

## Required Checks

### If you changed `apps/web`

Run:

```bash
pnpm -C apps/web lint
pnpm -C apps/web typecheck
pnpm -C apps/web test
```

Run `test:coverage` when you changed:

- service logic
- route-layer behavior
- validation
- repositories
- domain-adjacent logic

```bash
pnpm -C apps/web test:coverage
```

Coverage source of truth:

- `apps/web/jest.config.js`
- current threshold: `60%` for statements, branches, functions, and lines

Run E2E when you changed critical user flows such as:

- booking
- auth
- finance workspace
- shift flows
- admin flows

```bash
pnpm -C apps/web test:e2e
```

### If you changed `apps/mobile`

Run:

```bash
pnpm -C apps/mobile typecheck
pnpm -C apps/mobile test
```

Use mobile tests as the baseline smoke suite for:

- auth screens
- navigation
- booking steps
- cabinet and staff screens

### If you changed shared packages

Run the relevant consumer checks too.

At minimum:

- `pnpm -C apps/web typecheck`
- `pnpm -C apps/mobile typecheck`

And add or update tests for the shared module when appropriate.

## Architecture Rules

Prefer these boundaries:

- business rules -> `packages/core-domain`
- cross-client DTOs, formatters, and safe helpers -> `packages/shared-client`
- transport, auth wiring, request parsing, persistence adapters, UI composition -> app code

In `apps/web`, routes should stay thin:

- transport
- auth/context
- validation
- delegation to lower services or domain logic

Do not grow route handlers into large orchestration files.

## Documentation Rules

Update docs when you change:

- architecture or module boundaries
- product behavior
- testing workflow
- roadmap or current operational plan

Main active documents:

- [README.md](/C:/projects/kezek/README.md)
- [docs/README.md](/C:/projects/kezek/docs/README.md)
- [PROJECT_DOCUMENTATION.md](/C:/projects/kezek/PROJECT_DOCUMENTATION.md)
- [TESTING_GUIDE.md](/C:/projects/kezek/TESTING_GUIDE.md)
- [docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md)

## Review Checklist

Before sending a PR, ask:

- is the change in the right layer?
- did file size or responsibility get worse?
- are the risky paths tested?
- do docs still match reality?
- did I leave the repo easier to understand than before?
