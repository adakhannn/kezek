# UI Definition Of Done

**Status:** active  
**Created:** 2026-04-01  
**Purpose:** define what must be true before a UI task in Kezek is considered complete.

This applies to:

- screen redesigns
- shared component work
- layout and navigation work
- UX refinements that change interaction behavior

---

## A UI Task Is Done Only When

### 1. The Visual Problem Is Actually Solved

- The new UI is clearer, more consistent, or more usable than the previous state.
- The change is not only cosmetic if the original issue was behavioral or structural.
- The screen now follows the current UI foundation instead of introducing another exception.

### 2. Shared Patterns Were Respected

- Existing primitives and patterns were reused where appropriate.
- If the task introduced a repeated pattern, it was extracted into a shared primitive or section pattern.
- The implementation reduces future UI drift rather than increasing it.

### 3. Core States Are Covered

At minimum, where applicable:

- loading
- empty
- error
- success
- retry
- disabled
- destructive confirmation
- offline or delayed-sync state on mobile or async workflows

### 4. Accessibility Was Not Treated As Optional

- Focus behavior is visible and usable on web.
- Important feedback is accessible.
- Color is not the only carrier of meaning.
- Contrast remains acceptable for critical content.
- Dialogs and alerts follow accessible behavior expectations.

### 5. Localization Was Considered

- User-facing strings are localized where the surrounding area is localized.
- Long RU, KY, and EN strings do not break layout in obvious ways.
- Dates, times, numbers, and labels use the project's formatting approach.

### 6. Responsive And Platform Behavior Were Checked

- The screen works on supported mobile widths if it exists on web.
- Mobile UI remains touch-friendly.
- Web and mobile keep the same semantic logic even if the layout differs.
- The change does not make one platform look finished and the other neglected.

### 7. Verification Was Performed

At minimum:

- relevant typecheck passed
- relevant tests passed, or inability to run them was explicitly recorded
- visual regression or screenshot tests were updated when the change affects covered UI

### 8. Documentation And Tracking Were Updated

- If the work belongs to the redesign roadmap, its status was updated.
- If the change introduced a new reusable rule, the related UI documentation was updated.
- The next teammate can understand what changed and why.

---

## Minimum Review Questions

Before marking a UI task done, ask:

1. Is this screen genuinely more understandable now?
2. Did we improve the system, not just this one file?
3. Are loading, error, empty, and success states handled?
4. Would this still look correct in another language or on a smaller screen?
5. Did we leave behind a reusable pattern or another exception?

If any answer is "no", the task is not done yet.

---

## Anti-Patterns That Are Not Done

The following do **not** count as complete UI work:

- only changing colors without fixing interaction confusion
- improving the happy path but ignoring error and empty states
- redesigning a screen by hardcoding styles that should be shared
- adding a nice desktop layout while leaving mobile broken
- shipping a new UI without updating roadmap or acceptance criteria
- replacing one inconsistent pattern with another inconsistent pattern

---

## Practical Rule

UI work is complete when the user experience is:

- clearer
- more consistent
- more resilient
- easier to maintain

If one of those is missing, the work is still in progress.
