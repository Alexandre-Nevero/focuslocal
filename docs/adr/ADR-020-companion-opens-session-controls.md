# ADR-020 — The companion opens session controls

- **Date:** 2026-10-10
- **Status:** Accepted
- **Related:** F-001, F-004, F-011, F-014, US-001, US-011, US-012, ADR-016, ADR-018, ADR-019

### Context

The companion is a shortcut on the desktop, while the existing Idle and Running screens already provide session controls and the local session log. Earlier decisions assigned an idle pet tap to Coach, but that makes the pet a coach launcher and leaves its primary session-control role unclear. ADR-016 placed the pet and coach in one resizable assistant window, but reusing the existing shared session popover preserves the established Idle/Running flow, including Start routing into Declare.

### Why now

The pet click destination is being specified alongside the functional popup states and extension session parity. The destination must be consistent while a session runs and while idle, and must not send the user to Coach based only on session state.

### Options

1. Keep opening Coach when idle and show running controls while active. This preserves ADR-011's original split behavior, but makes the same pet tap mean different things and routes away from session controls.
2. Replace the pet with an expanded assistant window that embeds Idle or Running. This uses one renderer, but Start navigates away from Assistant and can unmount the pet experience.
3. Keep the pet collapsed in its separate always-on-top window and open the existing shared 320×420 session popover beside it on every tap. This reuses the Idle/Running screens and their existing routing without changing the pet window.

### Decision

Choose option 3. Tapping the pet opens the existing shared 320×420 session popover beside it, using the Idle or Running screen according to local session state. The pet remains collapsed in its separate always-on-top window. The popover includes the controls and local session log already provided by those screens; blur dismisses it. While running, it retains BR-001: intention and clock are visible without live verdicts, warnings, predictions, or progress measures. A pet tap never opens Coach, including when no session is running. Coach remains available from the ended session's Review. This reuses the existing popup and route behavior and adds no IPC action.

### Why this option

It makes the pet a reliable entry to the current session and reuses the already specified popup behavior. The separate popup also preserves the existing Start-to-Declare route. Keeping Coach in Review ties its conversation to the ended session record and avoids making pet behavior depend on whether a session happens to be active.

### Overrides

- **Prior ADRs:** Supersedes ADR-011 only on the pet tap destination and supersedes ADR-016's single resizable pet/coach window. The pet remains a separate always-on-top window and opens the existing shared session popover. ADR-011's drag-versus-tap threshold, running silence, and invariant appearance remain. ADR-018 and ADR-019 remain unchanged.
- **Owning docs:** Updates `docs/design.md` Companion and Coach entries and `docs/prd.md` F-014, US-012, and screen inventory. `system-design.md` remains owned by Bennett Payoyo and is not changed here.
- **Out of scope:** No change to session capture, review labels, coach generation, extension behavior, or mini-window behavior.

### Consequences

- The companion remains collapsed while its tap opens the shared session popover at its nearby position; blur dismisses that popover.
- Idle and running pet taps have the same purpose while reusing their respective session screens and existing route behavior.
- The coach is opened from an ended session's Review, never from the pet.
