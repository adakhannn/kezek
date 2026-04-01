# Kezek Mobile App

The mobile app is the Expo / React Native client for:

- sign-in and session recovery
- public booking flows
- customer cabinet
- staff flows
- business-facing mobile scenarios where supported

## Stack

- Expo 54
- React Native 0.81
- React 19
- TypeScript
- React Navigation
- React Query
- Supabase

## Setup

```bash
pnpm install
pnpm -C apps/mobile start
```

Create `apps/mobile/.env.local` with:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=https://kezek.kg
```

## Main Commands

```bash
pnpm -C apps/mobile start
pnpm -C apps/mobile android
pnpm -C apps/mobile ios
pnpm -C apps/mobile web
pnpm -C apps/mobile typecheck
pnpm -C apps/mobile test
pnpm -C apps/mobile test:coverage
```

## Quality Baseline

Minimum local health check after mobile changes:

```bash
pnpm -C apps/mobile typecheck
pnpm -C apps/mobile test
```

Use `typecheck` as the first compile-health gate.
Use `test` as the smoke suite for key screens and navigation flows.

## Structure

- `src/components`: shared UI pieces
- `src/screens`: screen-level UI and flow composition
- `src/navigation`: navigation and session wiring
- `src/hooks`: reusable hooks
- `src/lib`: client infrastructure and helpers
- `src/contexts`: React contexts
- `src/utils`: utility functions
- `src/__tests__`: mobile tests

## Notes

- client-exposed environment variables must use the `EXPO_PUBLIC_` prefix
- auth callback and session restoration logic lives in navigation/session infrastructure
- mobile architecture cleanup is tracked separately from the older stabilization wave

## Related Documentation

- [README.md](/C:/projects/kezek/README.md): repo overview
- [docs/README.md](/C:/projects/kezek/docs/README.md): docs index
- [GETTING_STARTED.md](/C:/projects/kezek/GETTING_STARTED.md): onboarding and setup
- [docs/MOBILE_ARCHITECTURE_HARDENING_PLAN.md](/C:/projects/kezek/docs/MOBILE_ARCHITECTURE_HARDENING_PLAN.md): focused mobile architecture plan
- [docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_REVIEW_ACTION_TASKS_2026-03-30.md): current review-driven improvement backlog
