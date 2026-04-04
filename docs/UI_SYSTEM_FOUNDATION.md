# UI System Foundation

**Status:** active  
**Created:** 2026-04-01  
**Purpose:** define the compact visual and interaction foundation for all future UI work in Kezek.

## Why This Exists

Kezek already has many strong UI improvements, but they are still spread across public pages, dashboard flows, staff tools, admin tools, and mobile screens.

This document is the short source of truth for:

- visual direction
- interaction tone
- density rules
- primitive styling decisions
- shared polish rules across web and mobile

Use this before redesigning screens or creating new components.

---

## Product Character

Kezek should feel:

- trustworthy
- modern
- operational
- premium, but not decorative
- fast and clear under daily workload

Kezek should not feel:

- playful or gamified
- luxury-beauty branding first, usability second
- over-animated
- crowded with status noise
- visually generic like a default admin template

## Core Design Principle

Kezek is a service operations platform, not a marketing microsite.

That means:

- public screens should create confidence and momentum
- workspace screens should optimize scanning and action speed
- admin screens should prioritize clarity and control
- mobile screens should preserve confidence while reducing friction and visual weight

---

## Experience Tone

### Public experience

Use a more expressive visual layer for:

- home
- business pages
- booking flow
- booking confirmation

Desired feeling:

- inviting
- lightweight
- polished
- conversion-friendly

### Workspace experience

Use a more restrained visual layer for:

- dashboard
- QuickDesk
- staff tools
- finance pages
- operations-heavy lists and forms

Desired feeling:

- calm
- dense but readable
- efficient
- predictable

### Admin experience

Use the most restrained visual layer for:

- entity management
- diagnostics
- monitoring
- system analytics

Desired feeling:

- controlled
- auditable
- structured
- low-drama

---

## Visual Direction

### Brand expression

The visual signature of Kezek is:

- clean light surfaces on web public areas
- dark, richer surfaces on mobile where already established
- indigo-to-pink accent gradient used selectively
- rounded but not soft-toy geometry
- subtle glass or tinted accent surfaces only where they improve hierarchy

### Accent policy

The gradient accent is a brand tool, not a default fill for everything.

Use it for:

- primary CTA on public screens
- hero emphasis
- selected KPI or highlight blocks
- key conversion moments

Do not use it for:

- every button
- every card header
- operational rows in data-heavy screens
- repeated decorative framing

### Surface policy

Prefer a clear 3-layer surface model:

1. page background
2. elevated content surface
3. emphasized surface for key focus blocks

Do not create many visually similar near-white or near-dark layers without hierarchy meaning.

---

## Density Rules

### Public screens

Density: `comfortable`

Rules:

- larger spacing
- stronger sectional separation
- fewer simultaneous actions
- more breathing room around CTAs
- card layouts can be more expressive

Use for:

- landing/home
- business profiles
- booking summary and confirmation

### Workspace screens

Density: `compact-readable`

Rules:

- tighter vertical rhythm than public pages
- actions grouped by task
- minimal decorative space
- dense information blocks allowed only with strong hierarchy
- tables/cards should optimize scan speed first

Use for:

- dashboard
- staff workspaces
- finance
- booking operations

### Admin screens

Density: `compact-structured`

Rules:

- strongest grid discipline
- minimal visual ornament
- clear separation of filters, table, actions, detail panels
- destructive actions isolated visually

---

## Typography Principles

Typography should communicate hierarchy before color does.

Rules:

- use weight and spacing before adding more color
- keep headings short and operational
- reserve large display text for public hero moments and major dashboard summary moments
- use smaller but strong section titles in workspace screens
- numeric values must be highly legible and visually stable

Hierarchy guidance:

- display: only for hero or major headline moments
- page title: one strong page anchor
- section title: repeated operational grouping
- body: default explanatory copy
- caption: metadata, timestamps, helper context
- label: inputs, filters, badges, tabs

Avoid:

- too many heading sizes in one page
- low-contrast helper text for important information
- using color alone to create hierarchy

---

## Shape And Geometry

### Radius

Kezek should feel rounded, but not pill-heavy.

Default guidance:

- cards: medium-large radius
- inputs/buttons: medium radius
- badges/chips: rounded, but compact
- modals/drawers: medium-large radius

Interpretation:

- public cards can be slightly softer
- workspace controls should stay more disciplined

### Borders

Borders should communicate structure, not decoration.

Rules:

- use soft but visible borders on cards and controls
- increase contrast for dense workspace areas
- reduce border noise where spacing already creates separation

### Shadows

Shadows should communicate elevation, not spectacle.

Rules:

- low shadow by default
- medium shadow for active cards, modals, floating controls
- stronger shadow only for overlays and special emphasis blocks

Avoid:

- stacking heavy borders and heavy shadows together
- using shadow as the only separator in dense tables/lists

---

## Color Principles

Color should be semantic first, expressive second.

The system must always distinguish:

- background
- surface
- elevated surface
- accent
- text primary
- text secondary
- text muted
- success
- warning
- danger
- info
- disabled

Rules:

- semantic meaning must stay stable across web and mobile
- accent colors are not substitutes for semantic status colors
- status colors must be readable in both light and dark contexts
- neutral surfaces must do most of the structural work

---

## Spacing Principles

Spacing is one of the main tools for making dense screens readable.

Rules:

- keep a small set of spacing steps
- reuse the same spacing relationships for repeated patterns
- page sections should breathe more than cards
- card internals should be tighter than page layout
- input groups should stay visually grouped with minimal ambiguity

Use spacing to show:

- page structure
- section grouping
- control grouping
- primary vs secondary content

Do not rely on random margins to fix composition problems.

---

## Focus And Accessibility

Keyboard and focus behavior are part of the visual system.

Rules:

- every interactive control must have a visible focus state
- focus ring must be consistent across components
- error, warning, and success feedback must not rely on color alone
- contrast must remain strong in dense operational screens
- dialog, toast, and form feedback patterns must remain accessible by default

Priority:

- clear focus
- readable contrast
- predictable keyboard progression
- clear inline errors

---

## Motion Principles

Motion must support comprehension, not decoration.

Use motion for:

- button press feedback
- tab/view changes
- modal open/close
- toast entry/exit
- skeleton-to-content transition
- step progression in booking flow

Rules:

- keep durations short
- use subtle easing
- avoid large positional movement in dense workspace UI
- preserve responsiveness over theatrical transitions

Avoid:

- constant floating animations
- decorative motion loops
- transitions that slow down frequent operator actions

---

## Component Behavior Rules

### Buttons

- primary button: reserved for the main action in a section
- secondary button: supportive action
- outline/ghost: low-emphasis action
- danger button: destructive action only

Rules:

- do not place multiple competing primary buttons in one small area
- destructive actions should never visually match primary conversion actions

### Cards

- cards should group one coherent unit of meaning
- cards need a strong internal hierarchy: title, metadata, actions
- dense cards must still expose the primary action clearly

### Forms

- labels must stay visible
- helper text must be calm and short
- validation must be inline and specific
- save and cancel behavior must be obvious

### Feedback

- use toast for short global confirmations
- use inline error for field or section-specific problems
- use banners for blocking or contextual page-level issues
- use modal confirmation only for destructive or irreversible actions

---

## Screen-Specific Rules

### Home and public discovery

- lead with trust and clarity
- make search and category filtering obvious
- keep business cards visually attractive but readable
- drive naturally toward booking

### Booking flow

- one dominant next action per step
- selected state must be unmistakable
- summary should reduce anxiety, not add more data
- errors and unavailable states must preserve context

### Customer cabinet

- emphasize upcoming bookings
- keep history separate and lower-emphasis
- actions like repeat, cancel, review, and map should be obvious but not noisy

### QuickDesk and operations screens

- optimize for scan speed
- prioritize status, time, person, service, and action visibility
- reduce ornamental accents
- action clustering must reflect actual operator behavior

### Finance screens

- numbers need stronger hierarchy than descriptive text
- money, deductions, guarantees, and totals must never compete equally
- filters and timeframe selection should stay compact and clear

### Admin screens

- prefer structure over personality
- maintain strong filter-result-detail separation
- make dangerous actions explicit and isolated

---

## Web And Mobile Alignment Rules

Web and mobile do not need to look identical.

They do need to share:

- the same semantic color logic
- the same hierarchy logic
- the same status meanings
- the same feedback patterns
- the same brand accent policy

Allowed differences:

- mobile may use darker baseline surfaces if that area is already established
- mobile may compress spacing and reduce simultaneous action count
- navigation patterns can differ by platform

Not allowed:

- status color meaning changing by platform
- one platform feeling premium while the other feels unfinished
- completely different interaction logic for the same task without a strong platform reason

---

## Implementation Rules

Before redesigning a screen:

1. check if the need belongs in a primitive or shared pattern first
2. update tokens or shared components before copying styles locally
3. confirm whether the screen is public, workspace, or admin density
4. verify loading, empty, error, success, and mobile states

When a design decision repeats twice, extract it.

When a design decision only works on one screen, question it.

---

## Definition Of Success

This foundation is working when:

- new UI tasks start from shared rules instead of ad hoc styling
- web and mobile feel like one product family
- public and workspace surfaces feel different by intent, not by inconsistency
- component work becomes easier because primitives carry more of the visual burden
- redesign discussions become faster because baseline rules are already fixed

---

## Immediate Follow-Up

After this document, the next implementation priorities are:

1. semantic design tokens for web
2. semantic design tokens for mobile
3. rebuild shared primitives
4. unify feedback and navigation patterns
