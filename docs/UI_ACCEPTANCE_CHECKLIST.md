# UI Acceptance Checklist

**Status:** active  
**Created:** 2026-04-01  
**Purpose:** provide a short, reusable review checklist for UI work before it is considered ready.

Use this checklist for:

- new screens
- redesigned screens
- major UI refactors
- shared component changes

If an item is not applicable, mark it explicitly as `n/a`.

---

## 1. Visual Hierarchy

- Is there one obvious primary action on the screen or section?
- Is the page title clearly distinct from section titles?
- Are important numbers, statuses, and decisions visually prioritized?
- Is the screen readable without relying on accent color alone?
- Does the layout feel intentional rather than patched with local spacing fixes?

## 2. Spacing And Density

- Does the screen match the intended density tier: public, workspace, or admin?
- Are related controls visually grouped?
- Is spacing consistent with nearby screens and shared patterns?
- Is the interface dense where needed, but still scannable?
- Is there unnecessary empty space or unnecessary crowding?

## 3. Shared Component Usage

- Does the screen use shared primitives where possible?
- Were repeated local styles avoided when a shared pattern should exist?
- If a new pattern was introduced, was it extracted instead of duplicated?
- Are button, card, form, and feedback patterns aligned with the current UI foundation?

## 4. States

- Is there a loading state?
- Is there an empty state?
- Is there an error state?
- Is there a success or confirmation state where relevant?
- Is there a retry path where failure is recoverable?
- Do destructive actions have explicit confirmation?

## 5. Forms And Inputs

- Are labels visible and clear?
- Are required and optional expectations obvious?
- Are validation errors specific and placed close to the problem?
- Are helper texts useful and short?
- Is save, cancel, and unsaved-change behavior clear?

## 6. Accessibility

- Can the main flow be completed with keyboard navigation on web?
- Is focus clearly visible on interactive elements?
- Are contrast levels strong enough for critical text and actions?
- Are alerts, errors, dialogs, and dynamic updates exposed accessibly?
- Is the UI understandable without relying only on color?

## 7. Responsive Behavior

- Does the screen work on the smallest supported mobile width?
- Does it still look balanced on large desktop widths?
- Does content reflow cleanly without clipping or horizontal scroll?
- Are touch targets large enough on mobile?
- Are key actions reachable within 1-2 taps in mobile-heavy flows?

## 8. Localization

- Does the screen handle long RU, EN, and KY text without breaking layout?
- Are labels, buttons, statuses, errors, and empty states localized?
- Do dates, times, and numbers follow the right formatting logic?
- Are truncated strings still understandable?

## 9. Platform Consistency

- Does this screen feel like part of the same Kezek product family?
- Are semantic colors and statuses consistent with web/mobile counterparts?
- Does the screen keep the same interaction logic as similar flows elsewhere?
- If the platform behavior differs, is there a strong reason?

## 10. Operational Quality

- Does the UI help the user act faster, not just look nicer?
- Are the main actions placed where users expect them?
- Are dangerous actions visually distinct from primary actions?
- Is status information easy to scan in busy workflows?
- Would a first-time teammate understand the screen's structure quickly?

## 11. Offline And Network Resilience

- For mobile and async-heavy flows: is offline behavior clear?
- Does the user understand whether data is current, cached, or retrying?
- Is there a graceful network-error path?
- Does the UI preserve context instead of dropping the user out of the flow?

## 12. Verification

- Was typecheck run for the affected app?
- Were relevant tests run?
- Were screenshot or visual regression checks updated if needed?
- Were roadmap status and progress notes updated?

---

## Ready Criteria

A UI task is ready for review when:

- no major checklist item is failing
- all critical states are covered
- the screen follows the current foundation rules
- the implementation improves consistency instead of creating another exception
