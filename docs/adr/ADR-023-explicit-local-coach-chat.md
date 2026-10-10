# ADR-023 — Coach replies only when asked

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-011, US-011, ADR-003, ADR-011, ADR-014, ADR-022

### Context

ADR-014 defines what the coach may know and suggest, but leaves its interaction as a single after-session reply. Twofold already ships one local inference runtime, node-llama-cpp with Qwen3.5-2B, for System One. A separate hosted service or another model would add a network path and duplicate runtime cost. The coach needs a way to discuss the ended session while keeping every statement grounded in the local record.

### Why now

The review and coach are specified, but a one-shot reply does not let a person ask a follow-up. Chat must remain deliberate and bounded so opening a review never starts an unsolicited model call and saved history stays finite.

### Options

1. Keep one generated response per ended session. This is small, but does not let the person ask a follow-up.
2. Add a hosted chat service. This offers a separate conversational path, but sends session context off-device.
3. Add explicit, bounded chat in the Coach screen, using the existing local model runtime and ADR-014's computed record context.

### Decision

Choose option 3. Coach is a chat surface for the latest ended session, also reachable from that session's Review. It uses the already loaded node-llama-cpp / Qwen3.5-2B model with a separately allocated context for each request; it does not load a second model or use a network fallback. The user writes a message and presses **Send** to request each reply. Opening Review, Coach, or the companion never sends a message or generates a prompt on the user's behalf. Coach is absent from the running experience.

Each request receives the ended session's computed figures and the local-history counts and repeat-reach facts allowed by ADR-014, plus a bounded window of recent messages from that session. Store only a bounded recent conversation for each session, keeping the newest complete exchanges when the limit is reached. The reply is saved locally with its user message. The first session uses empty history counts. Chat content and figures stay in the local file.

Apply ADR-014's action and numeric fences to every reply. A numeric claim not present in the computed context or in an allowed corpus claim labeled verified is rejected as a whole; show the existing “The coach could not answer from the record.” response instead. Keep any permitted actionable suggestion as a button. Do not praise or scold the outcome, and do not turn the coach into an unsolicited focus prompt.

### Why this option

The existing local model can answer deliberate follow-ups without creating a second runtime or transmitting session data. A visible Send action gives the person control over when inference runs, while a bounded conversation limits stored content and context size. ADR-014 already defines the record and claim fence, so chat extends that contract instead of making the model an authority on its own.

### Overrides

- **Prior ADRs:** extends ADR-014's after-session coach from one response to explicit conversation. ADR-014 still owns allowed context, suggestions, and numeric validation. ADR-011's no-coach-during-session and no-praise-or-scold rules remain. ADR-003's local runtime remains the only model runtime.
- **Owning docs:** updates `docs/prd.md` US-011 and coach screen inventory; updates `docs/design.md` Coach route and interaction states. Stored `coach_turn` remains the owner in `docs/data-model.md`; implementation applies a bounded-message policy.
- **Out of scope:** no cloud model, unsolicited focus prompt, new coach facts source, or change to companion routing in ADR-022.

### Consequences

- **Easier:** a person can ask a follow-up about the ended block and return to saved replies later.
- **Harder or owed:** Coach must share the local runtime safely with judgment, enforce the message bound, and show clear loading and unavailable states without blocking session review.
- **Follow-up:** wire explicit message submission, saved replies, and the context and numeric fences to the existing local inference service.
