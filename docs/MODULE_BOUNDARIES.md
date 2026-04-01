# Module Boundaries

**Purpose:** define where logic should live across `packages/core-domain`, `packages/shared-client`, `apps/web`, and `apps/mobile`.

## Core Rule

Place code by responsibility, not by convenience.

- business rules belong in shared domain modules
- cross-client helpers and DTOs belong in shared client modules
- app-specific orchestration belongs in app code
- platform and transport details stay at the edge

## `packages/core-domain`

Use `core-domain` for:

- pure business rules
- use-cases
- state transition logic
- calculation rules
- domain validation that does not depend on HTTP, React, or Supabase
- repository and service ports

Do not put these here:

- `fetch`
- Supabase client calls
- `Request` / `Response`
- React hooks
- Next.js or Expo dependencies

Good candidates:

- booking rules
- shift and finance calculations
- role/business invariants when they are not transport-specific

## `packages/shared-client`

Use `shared-client` for:

- DTOs shared by web and mobile
- formatters
- client-safe validation helpers
- i18n helpers
- safe logging helpers
- lightweight API helpers that are not tied to a single app shell

Do not put these here:

- app routing
- Next.js server code
- React Native-only UI code
- business rules better suited for `core-domain`

## `apps/web`

Use `apps/web` for:

- Next.js pages, layouts, route handlers, and server wiring
- auth and request context integration
- repository implementations
- HTTP parsing and response mapping
- feature composition for web UI

Keep web files focused:

- routes should stay thin
- services should coordinate, not become giant logic containers
- pages should render and compose, not own deep orchestration

## `apps/mobile`

Use `apps/mobile` for:

- React Native screens and navigation
- session and deep-link wiring
- mobile-only UI and interaction logic
- mobile composition around shared DTOs and services

Keep mobile files focused:

- screens should mostly compose sections and hooks
- session/auth recovery logic should live in dedicated infrastructure modules
- shared business decisions should not be duplicated locally when they can be extracted

## Placement Heuristics

Ask these questions before adding code:

1. Can this run without React, Next.js, Expo, or Supabase?
   If yes, it is a candidate for `core-domain`.

2. Is this needed by both web and mobile, but still client-facing?
   If yes, it is a candidate for `shared-client`.

3. Does this depend on request objects, cookies, database clients, or app routing?
   If yes, it belongs in app-layer infrastructure.

4. Is this mainly rendering logic?
   If yes, it belongs in the app UI layer.

## Large File Rules

Any file should be reviewed for decomposition when it shows several of these signs:

- owns rendering and data fetching
- owns rendering and navigation
- owns orchestration and persistence
- owns orchestration and business decisions
- mixes platform wiring with reusable logic
- becomes hard to test without mounting the full feature

## First Focus Areas

Apply these rules first to:

- finance flows
- auth and redirect flows
- messaging and webhook flows
- role and current-business selection logic
