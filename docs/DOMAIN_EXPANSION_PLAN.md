# Domain Expansion Plan

**Status:** active proposal  
**Created:** 2026-03-31  
**Purpose:** identify what logic should move into shared domain modules next.

## Goal

Increase the value of `packages/core-domain` by moving reusable business logic out of app-specific files and into testable domain modules.

This is not a rewrite-everything plan.
It is a ranked extraction plan.

## Why This Matters

The repository already has a good architectural direction, but too much live complexity still sits in app-layer files.

That creates these risks:

- large UI and service files stay hard to reason about
- the same rules are harder to reuse across web and mobile
- tests attach to orchestration layers instead of the business decisions themselves

## What Belongs In `core-domain`

Move logic into `core-domain` when it is:

- a business invariant
- a status transition rule
- a calculation rule
- a decision policy
- a reusable use-case
- a rule that should behave the same in more than one app surface

Keep logic out of `core-domain` when it depends on:

- Next.js
- React or React Native
- Supabase client details
- HTTP parsing
- cookies, headers, or routing

## Ranked Extraction Candidates

### Batch 1: Highest Value

1. booking and attendance decision follow-ups
2. finance shift calculation rules that are still app-bound
3. role and current-business decision invariants
4. messaging command decision logic that is independent from transport

## Candidate Sources

Start reviewing these areas first:

- `apps/web/src/app/staff/finance`
- `apps/web/src/app/auth/sign-in`
- `apps/web/src/lib/whatsAppWebhookService.ts`
- `apps/web/src/lib`
- `apps/mobile/src/navigation`

## First Concrete Moves

### D1. Finance domain extraction audit

Tasks:

- separate pure finance calculations from view state and persistence
- identify rules that can move below `apps/web`
- define the target module structure inside `packages/core-domain/src/finance`

Done when:

- a first migration list exists
- at least one extracted rule has dedicated domain tests

### D2. Auth and business-selection invariant audit

Tasks:

- review redirect and role-resolution logic
- separate policy decisions from transport and auth-provider details
- define a reusable rule layer for "where should this user land"

Done when:

- app-layer code keeps only auth wiring and navigation
- policy decisions are described and testable independently

### D3. Messaging command decision extraction

Tasks:

- isolate command recognition and decision logic from webhook persistence
- keep transport-specific parsing at the edge
- move reusable command policies into shared modules where justified

Done when:

- webhook orchestration becomes thinner
- command behavior can be tested as pure scenario logic

## Execution Rules

- extract small vertical slices, not giant subsystems
- keep adapters in app code
- add tests at the new domain layer before deleting old logic
- prefer stable public functions over large internal utility clusters

## Success Criteria

This plan is succeeding when:

- more risky business rules are tested without full app bootstrapping
- large app-layer files get smaller
- shared logic reuse becomes clearer
- future contributors can tell what belongs in `core-domain`
