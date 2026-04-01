# Project Documentation

This document is the high-level technical map of Kezek.

## Product Shape

Kezek is a salon operations platform with:

- public booking
- customer cabinet
- business dashboard
- staff workspace
- admin tools
- web and mobile clients

## Tech Stack

### Web

- Next.js 16
- React 19
- TypeScript

### Mobile

- Expo 54
- React Native 0.81
- React 19
- TypeScript

### Backend And Integrations

- Supabase Auth
- Supabase Postgres
- Resend
- optional messaging and OAuth integrations such as WhatsApp, Telegram, and Yandex

## Repository Structure

### Applications

- `apps/web`
- `apps/mobile`

### Shared Packages

- `packages/core-domain`
- `packages/shared-client`

### Supporting Areas

- `docs`
- `supabase`
- `scripts`

## Architectural Direction

The current engineering direction is:

- thin route handlers in the web API
- explicit HTTP-layer services where request parsing and response mapping belong
- business orchestration below the route layer
- domain rules extracted into shared packages when reuse and stability justify it

## Layer Responsibilities

### `packages/core-domain`

Use for:

- business rules
- use-cases
- status transitions
- finance and booking calculations
- ports for repositories and external services

Do not use for:

- HTTP logic
- Supabase client calls
- React hooks
- framework wiring

### `packages/shared-client`

Use for:

- DTOs
- formatters
- client-safe validators
- shared logging helpers
- shared client-facing utilities

### `apps/web`

Use for:

- pages and layouts
- route handlers
- auth and request context
- repository implementations
- feature composition

### `apps/mobile`

Use for:

- screens
- navigation
- session restoration
- mobile-only composition and UX

## Web API Pattern

Preferred web API shape:

1. transport entrypoint
2. auth and context
3. validation
4. delegation to service or domain logic
5. response mapping

Routes should stay thin.

## Main Complexity Hotspots

The current improvement backlog is focused on:

- large web UI orchestration files
- large service orchestration files
- domain extraction follow-up
- documentation normalization
- CI trustworthiness

See:

- [docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md)
- [docs/DOMAIN_EXPANSION_PLAN.md](/C:/projects/kezek/docs/DOMAIN_EXPANSION_PLAN.md)
- [docs/MODULE_BOUNDARIES.md](/C:/projects/kezek/docs/MODULE_BOUNDARIES.md)

## Testing And Quality

Main verification layers:

- lint
- typecheck
- unit and integration tests
- mobile smoke tests
- web E2E
- SQL tests where available

For exact testing workflow, use:
[TESTING_GUIDE.md](/C:/projects/kezek/TESTING_GUIDE.md)

## Documentation Map

Start from:

- [README.md](/C:/projects/kezek/README.md)
- [docs/README.md](/C:/projects/kezek/docs/README.md)

For process:

- [CONTRIBUTING.md](/C:/projects/kezek/CONTRIBUTING.md)

For current roadmap and working tasks:

- [docs/PROJECT_IMPROVEMENT_PLAN.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md)
- [docs/CLEANUP_AND_NEXT_PHASE_PLAN.md](/C:/projects/kezek/docs/CLEANUP_AND_NEXT_PHASE_PLAN.md)
- [docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md)
