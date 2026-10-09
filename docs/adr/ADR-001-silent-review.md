# ADR-001 — The session stays silent

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-004, F-010, idea.md §7

### Context

MEANT, the prior project, tried a live drift signal and then removed it (that repo's ADR-0057, 2026-09-15). A wrong flag during work had no way for the person to correct it. On 2026-10-09 a four-window probe of Apple's on-device model got two windows wrong for a stated intention. A live interruption would put that error on top of the work.

Three shapes were on the table for this rebuild. A silent review after the session. A live guard that steps in when it is confident. A billing record aimed at invoices.

### Why now

The hackathon demo and the first build slice both change with this choice. Building started the same day the choice was made.

### Options considered

1. **Ledger.** Stay quiet while the session runs. At the end, show the intention beside the windows and ask whether the work finished. Pros: matches the prior decision to drop the live signal, and a false model call cannot interrupt the block. Cons: the payoff is after the session, and a glance can look like a time tracker.
2. **Guard.** When the harness is confident the window is drift, ask the person to go back or to mark it as work. Pros: a five-minute demo can show the intervention, and the local latency is visible. Cons: it reverses ADR-0057's reason, and nobody has measured precision on this model.
3. **Proof of work.** Turn the same capture into a per-client record someone could bill from. Pros: the privacy claim is easy to say, because client screens are often under an NDA. Cons: it is the furthest shape from the validated problem, and it pulls toward an hours headline, which F-013 rejects.

### Decision

Ship Ledger. The session UI shows the intention and the clock. It does not show a verdict. The review is where a label appears, and an unclear visit is a question, not a verdict.

### Why this option

The problem in idea.md §1 is the end of the block, not the middle of it. The probe is too weak to justify interrupting someone. Guard remains a later product if F-008 clears the bar in idea.md §9 and a correction path exists. That condition is already on the F-010 row.

### Overrides

- **Prior ADRs:** none in this repository. The prior project's ADR-0057 is history, not an id here.
- **Doc or plan truth:** none. idea.md §7 F-010 already records the rejection.
- **Out of scope:** does not change F-003. Visits are still judged during the session so the review is ready. Judging and showing are different.

### Consequences

- **Easier:** a wrong model call stays in the review, where the person can tap it.
- **Harder or owed:** the demo has to make a quiet review legible in five minutes. The unclear row is the moment that does that.
- **Follow-up:** prd.md states the running screen and the review as separate stories.
