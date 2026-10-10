# ADR-024 — Coach opens as a drawer over the Dashboard

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-011, US-011, US-012, ADR-022, ADR-023

### Context

ADR-023 defines deliberate local chat, but does not define its presentation or how the person leaves the conversation. Coach needs to remain tied to the latest ended session while keeping the Dashboard as the underlying place in the app.

### Why now

The Coach interaction is being built. Its window treatment, navigation to the evidence, suggested questions, and dismissal behavior need one consistent contract across Dashboard and companion entry points.

### Options

1. Open Coach as a separate full-page route. This gives the conversation the whole window but hides the Dashboard context and requires a separate return path.
2. Open Coach as a floating dialog. This preserves a return path but obscures much of the Dashboard and gives the conversation a small bounded surface.
3. Open Coach as a full-height drawer from the right over a dimmed, blurred, inert Dashboard. This keeps the current app context while giving the conversation a stable reading and writing area.

### Decision

Choose option 3. Coach is a full-height drawer anchored to the right edge of the app window. The Dashboard remains behind it, dimmed and blurred, and does not respond to input until the drawer closes. Use the existing Twofold design tokens for the drawer, controls, text, and overlay.

The drawer header shows the mascot, **Twofold Coach**, a **Local record** indicator, an **Ask Judge** action that opens the latest ended session's Review, and a close control. Below it, show a **Working on** strip with that session's saved intention. Render saved chat messages as conversation bubbles. Suggested question chips sit above the composer; clicking a chip fills the draft only. The person must press **Send** to request generation, as required by ADR-023.

The close control, Escape, and clicking the backdrop all dismiss the drawer and return to the Dashboard. None sends a message. Dismissing the drawer does not remove saved exchanges. If no ended session exists, show the Coach empty state and omit session-specific actions and the working-on strip.

### Why this option

Anchoring the drawer on the right preserves the Dashboard as the main surface on the left while keeping the conversation close at hand. The full-height panel gives saved exchanges and the composer room without letting background controls compete with a sensitive conversation. Explicit close and Ask Judge actions make the two destinations clear. Question chips can help someone start without taking the choice to send away from them.

### Overrides

- **Prior ADRs:** refines ADR-023's Coach screen presentation. ADR-023's explicit Send, bounded local conversation, local model, and grounded reply rules remain. ADR-022 still controls when the companion opens Coach.
- **Owning docs:** updates `docs/prd.md` US-011 and screen flow; updates `docs/design.md` Coach route, drawer, and visual states. `docs/system-design.md` remains owned by Bennett Payoyo and is unchanged.
- **Out of scope:** no new Dashboard interaction while Coach is open, no model call from a suggested question chip, and no change to the session record or coach context.

### Consequences

- **Easier:** the conversation remains connected to the Dashboard and latest ended-session record, and the person can move to Review directly.
- **Harder or owed:** the drawer must manage focus, keyboard dismissal, backdrop dismissal, and inert background behavior accessibly.
- **Follow-up:** implement the drawer, local-record header, intention strip, saved message bubbles, draft-only suggested questions, and explicit dismissal paths.
