# Testing Guide

This document describes the practical testing baseline for Kezek.

## Test Layers

The repository uses several layers of verification:

- static checks
- unit and integration tests
- targeted smoke tests for mobile
- Playwright E2E for web
- SQL scenario tests when database access is available

## Fast Local Baseline

### Web

```bash
pnpm -C apps/web lint
pnpm -C apps/web typecheck
pnpm -C apps/web test
```

When you changed route logic, services, validation, repositories, or domain-adjacent behavior:

```bash
pnpm -C apps/web test:coverage
```

### Mobile

```bash
pnpm -C apps/mobile typecheck
pnpm -C apps/mobile test
```

## Web Test Scope

Use web unit and integration tests for:

- service logic
- HTTP services
- repositories
- validation helpers
- route-to-service mapping
- domain-adjacent helpers

Coverage source of truth:

- `apps/web/jest.config.js`
- current threshold: `60%`

## Mobile Test Scope

Use the mobile suite as a smoke baseline for:

- sign-in and auth callback flows
- navigation/session setup
- booking-step navigation
- cabinet and staff screens

If you add a new screen with meaningful logic, add a corresponding test.

## E2E

Run web E2E for critical flows:

- booking
- auth
- finance workspace
- shifts
- admin features when affected

```bash
pnpm -C apps/web test:e2e
```

Use E2E when a change crosses multiple layers and unit tests alone would miss the regression.

## SQL Tests

SQL tests are useful for:

- RPC behavior
- constraints
- critical database scenarios

Repository helper:

```bash
pnpm test:sql
```

CI can run SQL tests when the required database secret is available.

## What To Test First

Prioritize tests around:

- auth and redirect decisions
- current business selection
- booking status transitions
- finance and shift calculations
- messaging and webhook command behavior

## Definition Of Done

A change is not complete just because it compiles.

The minimum expectation is:

- the right local checks were run
- risky logic has coverage at the right layer
- docs still match the current workflow
