# Contributing To Kezek

Status: current engineering guidance, reviewed 2026-11-01. Maintained by repository maintainers; no individual owner is assigned.

This document describes the default contribution workflow. Start with [the documentation index](docs/README.md) and [current scope](docs/PROJECT_STATUS.md). A command in a guide is not authorization to resume the closed WEB campaign or operate on a remote environment.

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

## Documentation-only changes

From the repository root, run `pnpm check:docs-links` (or its direct equivalent `node scripts/check-doc-links.mjs`) and inspect `git diff --check`. Do not run application tests, builds, browsers, migrations, or old verification emitters solely for prose changes. Preserve immutable campaign evidence and acceptance records. If documentation tooling changes, verify that tooling without starting the product. A Markdown file under `apps/web` or `apps/mobile` remains a documentation-only change.

## Required Checks For Product Changes

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
- current threshold: `60%` for statements, branches, functions, and lines, applied only to the `collectCoverageFrom` allowlist, not to all web source

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

Maintain one primary document per topic, as defined in [docs/README.md](docs/README.md). Include document status and review date; preserve the observation date of historical evidence. Use repository-relative links. Distinguish current implementation, design proposals, test results, and deployed facts.

When adding a current guide, link it from the relevant index and regenerate [the document catalog](docs/DOCUMENTATION_MAP.md) with `node scripts/generate-docs-catalog.mjs --write`. Current guides are discovered automatically; historical evidence is excluded by [docs-lib.mjs](scripts/docs-lib.mjs). State the audience, prerequisites, source of technical claims, and expected outcome. For API examples, identify the route/helper and whether validation was by source inspection or execution; a passing link check verifies neither the behavior nor the product.

Every explicit HTTP method must have one source-reviewed `api-contract` marker in a [thematic API guide](API_DOCUMENTATION.md). After reviewing an API change, regenerate `node scripts/generate-api-catalog.mjs --write`; this updates the export map and the fingerprint of directly linked source files. Do not treat regeneration alone as contract review. Documentation tooling changes also require `node --test scripts/docs-tools.test.mjs`. The AST catalog uses the TypeScript devDependency and does not load application modules.

Main active documents:

- [README.md](README.md)
- [docs/README.md](docs/README.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)
- [TESTING_GUIDE.md](TESTING_GUIDE.md)
- [docs/OPERATIONS.md](docs/OPERATIONS.md)
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

Historical wave plans are catalogued in [docs/archive/README.md](docs/archive/README.md). They do not assign current work. New code-review findings go in [docs/ENGINEERING_FINDINGS.md](docs/ENGINEERING_FINDINGS.md); WEB acceptance facts remain in the campaign ledger, following its handoff.

## Review Checklist

Before sending a PR, ask:

- is the change in the right layer?
- did file size or responsibility get worse?
- are the risky paths tested?
- do docs still match reality?
- did I leave the repo easier to understand than before?
