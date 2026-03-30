# Cleanup And Next Phase Plan

**Status:** working document  
**Created:** 2026-03-30  
**Purpose:** normalize docs/roadmap state after the large `Phase 6.1` completion and define the next architecture package of work.

## How To Use

This file is the working plan for the post-`6.1` cleanup phase.

Rules:

1. Work from items marked `next` or `active`.
2. Update status after each completed task.
3. Keep this document short and operational, not archival.
4. Move historical notes into progress files or archive docs instead of growing this plan indefinitely.

## Legend

- Priority: `high`, `medium`, `low`
- Status: `todo`, `next`, `active`, `done`, `blocked`

## Phase A. Documentation Cleanup

### A.1 Normalize roadmap and progress sources

- Priority: `high`
- Status: `done`

Tasks:

- Clean up [C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md) so statuses and “next step” sections match the current repo state.
- Consolidate duplicated progress notes between the roadmap and [C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md).
- Leave one clear source for long-term roadmap and one clear source for latest progress.

Done when:

- The roadmap no longer points to already-finished work as active.
- The progress snapshot and roadmap do not contradict each other.
- A new teammate can tell what is done and what is next in under a minute.

Result on 2026-03-30:

- [PROJECT_IMPROVEMENT_PLAN.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md) was rewritten into a short normalized master roadmap.
- The roadmap now marks Phases 1 through 6 as complete and points operational work to [CLEANUP_AND_NEXT_PHASE_PLAN.md](/C:/projects/kezek/docs/CLEANUP_AND_NEXT_PHASE_PLAN.md).
- The roadmap and [PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md) now agree that `Phase 6.1` is complete.

### A.2 Fix documentation index consistency

- Priority: `high`
- Status: `done`

Tasks:

- Align [C:/projects/kezek/docs/README.md](/C:/projects/kezek/docs/README.md), [C:/projects/kezek/DOCUMENTS_OVERVIEW.md](/C:/projects/kezek/DOCUMENTS_OVERVIEW.md), and [C:/projects/kezek/README.md](/C:/projects/kezek/README.md) around the same set of “sources of truth”.
- Remove stale references to documents that are now historical-only.
- Make the cleanup/next-phase document discoverable from the main docs index.

Done when:

- The doc indexes point to the same primary documents.
- Roadmap, progress, and archive roles are clearly separated.

Result on 2026-03-30:

- [docs/README.md](/C:/projects/kezek/docs/README.md), [DOCUMENTS_OVERVIEW.md](/C:/projects/kezek/DOCUMENTS_OVERVIEW.md), and [README.md](/C:/projects/kezek/README.md) now point to the same planning and documentation sources of truth.
- Archive and historical files are now described as context, not operational guidance.
- The cleanup plan is visible from both the root README and the docs index.

### A.3 Clean legacy encoding and noisy comments in key docs

- Priority: `medium`
- Status: `done`

Tasks:

- Fix visibly broken encoding in the highest-value docs first.
- Remove low-signal historical appendices from active docs when they hurt readability.
- Preserve history by moving noisy material into archive/progress files instead of deleting useful context.

Done when:

- The main docs read cleanly in UTF-8.
- Active docs are readable without scrolling through obsolete progress dumps.

Result on 2026-03-30:

- The highest-value index and planning docs were rewritten into clean readable UTF-8 text:
  - [README.md](/C:/projects/kezek/README.md)
  - [docs/README.md](/C:/projects/kezek/docs/README.md)
  - [DOCUMENTS_OVERVIEW.md](/C:/projects/kezek/DOCUMENTS_OVERVIEW.md)
  - [PROJECT_IMPROVEMENT_PLAN.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md)

## Phase B. Choose The Next Architecture Package

### B.1 Audit remaining high-value complexity after route-thinning

- Priority: `high`
- Status: `done`

Tasks:

- Re-scan `apps/web`, `apps/mobile`, and shared packages for the next biggest maintainability hotspots.
- Group findings by theme instead of by file count.
- Compare “cleanup value”, “risk”, and “user-facing leverage” before choosing the next package.

Candidate themes:

- docs consistency and developer experience
- auth/context simplification follow-up
- service/domain boundary cleanup
- mobile architecture hardening after the earlier stabilization wave
- encoding/comment debt in core docs and selected source files

Done when:

- We have a short ranked list of the next 2-3 architecture packages.
- The chosen next package has a clear reason for being first.

Result on 2026-03-30:

- The highest-value remaining package is `mobile architecture hardening`.
- Ranked package candidates:
  1. mobile architecture hardening after the earlier stabilization wave
  2. web presentation and finance/dashboard decomposition follow-up
  3. service typing and lint hardening in `apps/web/src/lib`
- The chosen first package is mobile hardening because the largest remaining live complexity is concentrated in mobile screens such as [ShiftQuickScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftQuickScreen.tsx) and [ShiftsScreen.tsx](/C:/projects/kezek/apps/mobile/src/screens/ShiftsScreen.tsx).

### B.2 Create the next implementation roadmap

- Priority: `high`
- Status: `done`

Tasks:

- Create a new focused implementation plan for the selected package.
- Define scope, first candidates, risks, and done criteria.
- Keep it smaller and cleaner than the long-running master roadmap.

Done when:

- The next phase has its own concrete task document.
- We can continue execution without rediscovering context.

Result on 2026-03-30:

- The next package now has a dedicated focused roadmap:
  [MOBILE_ARCHITECTURE_HARDENING_PLAN.md](/C:/projects/kezek/docs/MOBILE_ARCHITECTURE_HARDENING_PLAN.md)
- The first execution task is `M.1 Decompose ShiftQuickScreen`.

## Current Next Task

**Next:** `W.1 Decompose FinancePage`

Why:

- The current mobile wave is now complete.
- The next highest-value package is web presentation cleanup, starting from the finance workspace.
- The cleanup plan and the new web roadmap point to the same next implementation step.
