# ADR-016 — The companion and the coach share one collapsible window

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-011, F-014, US-011, US-012, ADR-011, ADR-014

### Context

ADR-011 put the companion in a small always-on-top window and opened the coach in a popup. The first build used two windows: a 112 px companion and the tray popover as its popup. The pet was too large, the popup was shared with the tray, and each window is its own Chromium renderer. The owner asked for a miniature pet and a coach that slides in from the right edge of the desktop, and asked for the pet to be as light as possible.

### Why now

The freeze is 2026-10-10 10:00 Asia/Manila. The companion is in the build, and the docs have to describe the window the demo shows.

### Options considered

1. **Keep a companion window plus a popup window.** Pros: already written. Cons: two renderers, popup state shared with the tray, and the pet and panel can drift apart.
2. **One assistant window that resizes.** Pros: one renderer, one state owner in the main process, the panel always opens beside the pet. Cons: the renderer must switch layout when the native bounds change.
3. **A native helper for the pet.** Pros: a few MB of memory. Cons: platform code per OS, not possible before the freeze.

### Decision

Option 2.

- Collapsed: an 88 × 88 px transparent, frameless, always-on-top window, 16 px from the bottom-right of the primary work area, showing a 72 px mascot. Hover lifts it 4 px over 140 ms. `prefers-reduced-motion` removes the lift.
- Drag versus tap stays as ADR-011: movement past 4 px or a press past 500 ms is a drag and opens nothing. The main process checks the sender and keeps the window inside the display work area.
- Tap expands the same window to a 380 px panel, full work-area height, anchored to the right edge. Blur, Escape, or the close button collapses it back to the saved pet position.
- While a session runs, the panel shows the intention, the clock, End, and "This isn't the work". After the session, it shows the coach for the latest ended session.
- The app header uses the mascot face as a 28–34 px mark beside the wordmark. It replaces the contour mark. The character does not appear on review data, traces, charts, or verdict rows.
- The mascot looks the same for every outcome and every verdict.
- On Linux the app uses software compositing so the transparent window does not paint black. Screens load lazily, so the companion renderer does not parse dashboard or review code.

### Why this option

Option 1 spends a second renderer on a popup and couples the pet to the tray. Option 3 cannot ship before the freeze. Option 2 keeps one window and one state owner.

### Overrides

- **Prior ADRs:** supersedes ADR-011 on the popup and the companion window shape. ADR-011 still holds on drag versus tap, the drift control, silence while a session runs, and the invariant appearance. ADR-014 is unchanged.
- **Doc or plan truth:** design.md §3.2 (mark), §3.6 (the character in app chrome), and the Companion and Coach rows of §4.1. prd.md F-014 and US-012 read "popup" as this panel.
- **Out of scope:** coach generation, the atomic current-visit write for "This isn't the work", and a native helper.

### Consequences

- **Easier:** one renderer for the pet and the coach, and the panel always opens beside the pet.
- **Harder or owed:** the pet's process memory is tens of MB, not 1–5 MB. Do not claim a lower number without a measurement. "This isn't the work" is shown disabled until the main process can label the open visit in one step (US-012 is still owed). The coach panel says the conversation is not connected until the coach from ADR-014 is built. `system-design.md` needs this window recorded by its owner, Bennett Payoyo.
