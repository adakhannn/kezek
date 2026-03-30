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
- Status: `next`

Tasks:

- Clean up [C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PLAN.md) so statuses and “next step” sections match the current repo state.
- Consolidate duplicated progress notes between the roadmap and [C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md](/C:/projects/kezek/docs/PROJECT_IMPROVEMENT_PROGRESS_2026-03-30.md).
- Leave one clear source for long-term roadmap and one clear source for latest progress.

Done when:

- The roadmap no longer points to already-finished work as active.
- The progress snapshot and roadmap do not contradict each other.
- A new teammate can tell what is done and what is next in under a minute.

### A.2 Fix documentation index consistency

- Priority: `high`
- Status: `todo`

Tasks:

- Align [C:/projects/kezek/docs/README.md](/C:/projects/kezek/docs/README.md), [C:/projects/kezek/DOCUMENTS_OVERVIEW.md](/C:/projects/kezek/DOCUMENTS_OVERVIEW.md), and [C:/projects/kezek/README.md](/C:/projects/kezek/README.md) around the same set of “sources of truth”.
- Remove stale references to documents that are now historical-only.
- Make the cleanup/next-phase document discoverable from the main docs index.

Done when:

- The doc indexes point to the same primary documents.
- Roadmap, progress, and archive roles are clearly separated.

### A.3 Clean legacy encoding and noisy comments in key docs

- Priority: `medium`
- Status: `todo`

Tasks:

- Fix visibly broken encoding in the highest-value docs first.
- Remove low-signal historical appendices from active docs when they hurt readability.
- Preserve history by moving noisy material into archive/progress files instead of deleting useful context.

Done when:

- The main docs read cleanly in UTF-8.
- Active docs are readable without scrolling through obsolete progress dumps.

## Phase B. Choose The Next Architecture Package

### B.1 Audit remaining high-value complexity after route-thinning

- Priority: `high`
- Status: `todo`

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

### B.2 Create the next implementation roadmap

- Priority: `high`
- Status: `todo`

Tasks:

- Create a new focused implementation plan for the selected package.
- Define scope, first candidates, risks, and done criteria.
- Keep it smaller and cleaner than the long-running master roadmap.

Done when:

- The next phase has its own concrete task document.
- We can continue execution without rediscovering context.

## Current Next Task

**Next:** `A.1 Normalize roadmap and progress sources`

Why:

- `Phase 6.1` is effectively complete in code.
- The docs now lag the repo more than the code lags the architecture.
- Cleaning the planning layer first will make the next architecture package easier to choose and execute.
