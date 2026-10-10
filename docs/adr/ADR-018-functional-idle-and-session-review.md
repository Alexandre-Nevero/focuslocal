# ADR-018 — Functional popup states and evidence-first session review

- **Date:** 2026-10-10
- **Status:** Accepted
- **Related:** F-001, F-004, US-001, US-004, BR-001, BR-002, BR-006, ADR-008, ADR-012, ADR-017

### Context

The selected warm-paper reference establishes the visual language, while the product needs usable idle and browser-extension popups plus a review built from the local session record. Active sessions must remain quiet. An ended session can show its latest local summary and finish answer. The browser extension reaches the same local database through the native host; this adds popup actions and launch routing to that message contract.

### Why now

The desktop and extension popups and review are being implemented as real surfaces. Without an explicit decision, the reference can be copied as decoration or its sample data and status cues can be mistaken for product behavior. The extension's existing status relay does not cover its full popup behavior.

### Options

1. Keep the extension read-only and status-only, and send users to the desktop app for every action.
2. Use the warm-paper, terracotta, and serif direction for functional popup states, backed by explicit local native-host messages and routes.

### Decision

Choose option 2. The idle popover shows session availability and working Start, History, and Privacy actions. Empty history remains visibly empty. The network status says **Network blocked**. An unavailable local capability is named with its supported recovery action; the UI does not invent records.

While a session is active, the extension popup shows only the exact intention and elapsed clock. It does not show live labels, warning colors, or a breakdown. With no active session, it may show the latest ended session's locally read intention, elapsed host visits, Away and Not recorded intervals, and finish state. “Did you finish?” offers equal-weight Yes and Not yet actions; saving an answer writes to that ended session. History and Open Twofold actions launch the matching local desktop routes (`history`, `review/{id}`, or `idle`) through the native host. Its popup message actions are `summary`, `answer`, and `open`; the existing status and active-tab relay remain distinct. No request uses a network service.

The extension summary omits a blocked-attempt count until a persisted hit record is available to its local read contract. It must not show a placeholder count. The desktop review continues to follow PRD US-013 for recorded reaches, without assigning them host duration.

The ended-session review presents the exact intention with recorded host/window visits and elapsed minutes. Away and Not recorded remain distinct. “Did you finish?” offers equal-weight Yes and Not yet choices below the session evidence, with a skip path and neutral saved state.

### Why this option

It preserves the reference's visual character while keeping the product legible as a private record of what the machine observed. A small explicit native-host contract gives the extension useful actions while keeping active sessions quiet and all review data local.

### Overrides

- Updates `docs/design.md` popup states and review presentation and `docs/prd.md` US-001 and screen inventory.
- Leaves BR-001 through BR-006 and the harness order in ADR-002 unchanged.
- Adds native-host popup request actions and desktop launch routes. `docs/system-design.md` is owned by Bennett Payoyo and must record the matching wire contract through him.
- ADR-008 and ADR-017 continue to govern awareness-first placement and binary review labels.

### Consequences

- The idle surface, extension popup, and review must use actual local state and provide accessible, working controls.
- Empty or unavailable states need explicit copy and a supported next step.
- The extension's summary and answer/open messages become part of its native-host contract. Block-hit counts remain absent until their local capture/read contract exists.
- Reference styling remains available without its sample values, account-like controls, or implied success signals.
