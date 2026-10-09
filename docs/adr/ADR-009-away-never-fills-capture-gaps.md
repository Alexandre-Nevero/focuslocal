# ADR-009 — Away never fills capture gaps

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owner:** Bennett
- **Related:** US-002, US-010, system-design §9 Capture loop, #19

### Context

Idle is reported as seconds since the last input. The poller backdates an away visit to that input. After a sleep gap closes the previous visit at its last observed tick, the same backdating can recreate the entire missing interval as away. An isolated regression reproduced this: a 60-second sleep gap disappeared from the visit intervals.

### Why now

Windows backend verification needs to distinguish observed idle time from time during which the poller did not run. Counting sleep as away would contradict US-010 and hide the gap in review.

### Options

1. **Always backdate to the last input.** Simple, but fills sleep and capture-failure gaps with a classification the app did not observe.
2. **Backdate only when a visit is open.** Preserve ordinary idle detection; when there is no observed visit to close, start away at the current tick.
3. **Add separate suspend/resume state.** More platform event handling; does not address capture-failure gaps on its own.

### Decision

Option 2. Idle backdating requires an open visit. A new away visit after a gap starts at the current tick. No new state, IPC, or stored fields.

### Why this option

The open visit already distinguishes continuous observation from a gap. One shared guard covers sleep and capture failure without platform-specific machinery.

### Overrides

Clarifies system-design §9 capture step 1 when steps 4 or 5 have closed the visit. Does not change ADR-002's harness order or BR-001 through BR-006. No Accepted ADR is edited.

### Consequences

- Normal idle still reclassifies time since the last input as away, clamped to the session/previous visit boundary.
- Missing time remains unrecorded even if the next tick reports idle or locked.
- The regression failed before the guard and passed after it. A built Electron smoke with synthetic idle and a 60-second clock jump returned two away visits and 61,458 ms unrecorded through `review.get`; no native window titles were captured.
- This synthetic check does not prove physical Windows idle or suspend behavior. The hands-off and sleep checks in #19 remain open for the machine owner.
