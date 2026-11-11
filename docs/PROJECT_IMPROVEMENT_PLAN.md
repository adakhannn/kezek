# Project Improvement Plan

> Статус: исторический план или снимок анализа; классификация уточнена 30 октября 2026. Результаты, отметки выполнения и команды ниже относятся к исходной волне и не являются текущим поручением или подтверждением готовности продукта. Текущий приоритет: [PROJECT_STATUS.md](PROJECT_STATUS.md); навигация: [индекс документации](README.md).

**Status at original snapshot:** historical architecture roadmap; retained for wave context
**Created:** 2026-03-21  
**Last normalized:** 2026-03-30  
**Purpose:** long-term technical improvement roadmap for the `main` branch.

Current operational priority as of2026-10-14: [WEB_GLOBAL_READINESS_PLAN.md](./WEB_GLOBAL_READINESS_PLAN.md) and [WEB_GLOBAL_READINESS_STATE.json](./WEB_GLOBAL_READINESS_STATE.json). Completed phases and green-test statements below describe the March wave, not current release readiness. The October saved full Jest/lint baseline is not green; use the current verification plan for next work.

## How To Read This File

This file is the high-level roadmap.

- Use this file to understand what major phases exist and which ones are complete.
- Use [PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md](PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md) for the latest execution snapshot.
- Use [CLEANUP_AND_NEXT_PHASE_PLAN.md](CLEANUP_AND_NEXT_PHASE_PLAN.md) for the current working task list after Phase 6.1.

## Source Of Truth Split

- Long-term roadmap: [PROJECT_IMPROVEMENT_PLAN.md](PROJECT_IMPROVEMENT_PLAN.md)
- Latest delivered progress: [PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md](PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md)
- Current working cleanup and phase selection plan: [CLEANUP_AND_NEXT_PHASE_PLAN.md](CLEANUP_AND_NEXT_PHASE_PLAN.md)

## Phase Summary

### Phase 1. Mobile Stabilization

- Status: `done`
- Result:
  - `apps/mobile` passes typecheck
  - mobile smoke tests pass
  - `HomeScreen` was decomposed
  - `RootNavigator` was decomposed

### Phase 2. Web API Pattern Alignment

- Status: `done`
- Result:
  - the route pattern `route = transport + validation + auth/context` was standardized
  - overloaded API handlers were moved toward service and domain layers
  - `core-domain` usage became more consistent across booking flows

### Phase 3. Documentation And Rule Alignment

- Status: `done`
- Result:
  - documentation entry points were clarified
  - test and coverage expectations were normalized

### Phase 4. Web Test Stabilization

- Status: `done`
- Result:
  - the red web suite was stabilized
  - full `apps/web` coverage runs became green again

### Phase 5. Coverage And Internal Architecture Follow-Up

- Status: `done`
- Result:
  - meaningful service and helper coverage was added
  - auth and business-context internals were simplified

### Phase 6. API Thin-Route Migration

- Status: `done`
- Result:
  - `apps/web/src/app/api` was normalized around thin routes
  - HTTP-level request parsing, auth/context wiring, and response mapping now live in dedicated `*HttpService.ts` modules
  - business orchestration was pushed down into lower service and domain layers

For the final Phase 6.1 delivery snapshot, see:
[PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md](PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md)

## Current State

Completed and stable:

- mobile stabilization baseline
- web API route-thinning wave
- green `apps/web` test and coverage baseline
- normalized service and HTTP-layer testing around the web API

Current active planning area:

- post-Phase 6.1 cleanup of roadmap and documentation
- selection of the next architecture package

## Current Next Step

The current execution plan has moved out of this master roadmap and into:
[CLEANUP_AND_NEXT_PHASE_PLAN.md](CLEANUP_AND_NEXT_PHASE_PLAN.md)

That file is now the operational checklist for:

1. documentation cleanup
2. roadmap normalization
3. choosing the next architecture package
4. creating the next focused implementation plan
