# ADR-022 — Companion destination follows the foreground app

- **Date:** 2026-10-10
- **Status:** Accepted
- **Related:** F-014, US-011, US-012, BR-001, ADR-011, ADR-016, ADR-020

### Context

The desktop companion is both a route to Coach and a shortcut to session controls. A tap opens Coach when the Dashboard window is foreground or when the Windows desktop itself is foreground, as identified by Explorer's `Program Manager` window. Every other foreground app or view routes to session controls, so the pet does not pull focus into Coach during unrelated work. The shared Idle/Running popover already provides the current session controls and local log for that context.

### Why now

ADR-020 made every pet tap open session controls. The product now needs the companion to serve Coach when the person is on the Dashboard or Windows desktop, while keeping taps from another foreground app focused on session controls and quiet status.

### Options

1. Keep the ADR-020 behavior and always open session controls. This is consistent, but does not provide the in-app Coach shortcut.
2. Always open Coach. This gives a direct Coach route, but distracts from another foreground app and ignores the current session controls.
3. Route by foreground context: open Coach when the Dashboard or Windows desktop is foreground; open the shared session popover for every other foreground app or view. This uses the user's current context to choose the destination.

### Decision

Choose option 3. Tapping the companion while the Dashboard is foreground or the Windows desktop is foreground (`Program Manager`) opens Coach for the latest ended session; if no ended session is available, Coach shows its empty state. Tapping it with every other foreground app or view opens the existing shared 320×420 Idle/Running session popover beside the companion. The popover keeps its existing blur-dismissal behavior and quiet Running content. Dragging remains a move, never a tap action.

### Why this option

The foreground app is a clear signal of what the person is doing. Coach belongs when the Dashboard or Windows desktop is foreground. Session controls belong beside the pet for every other foreground app or view, so the tap remains useful without bringing a coaching prompt into that work.

### Overrides

- **Prior ADRs:** Supersedes ADR-020 only on the companion tap destination. The shared session popover, its size, blur dismissal, and quiet Running behavior remain for taps made while another app or view is foreground. ADR-011's drag-versus-tap threshold and invariant companion appearance remain. ADR-016's separate companion window remains.
- **Owning docs:** Updates `docs/prd.md` F-014, US-012, app flow and screen inventory; updates `docs/design.md` Companion destination. `docs/system-design.md` remains owned by Bennett Payoyo and is not changed here.
- **Out of scope:** No change to Coach generation, session capture, session controls, or extension behavior.

### Consequences

- A pet tap from the Dashboard or Windows desktop (`Program Manager`) opens Coach for the latest ended session. Every other foreground app or view opens the current Idle/Running controls and local log.
- Coach does not open when another application or Twofold view is foreground.
- Coach remains tied to an ended session record, and Running content remains quiet in the session popover.
