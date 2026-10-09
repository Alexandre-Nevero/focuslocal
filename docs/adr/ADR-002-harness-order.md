# ADR-002 — Rules, then memory, then the model

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-003, F-005, idea.md §4, idea.md §9

### Context

The prior cloud judge was not allowed to read page titles or page text, because the text would have left the machine. It judged hostname and path after the session and missed a 0.80 bar on the verdicts it would have shown (0.733, 44 of 60, that project's ADR-0086). Running locally lets the title stay on the device. It does not make a small model right. The same-day probe marked Slack "#random" as serving a client-deck intention.

The model is also the wrong tool for windows the person already classified. They name work sites and distraction sites at the start of the session. They tap a visit in the review. Those two inputs are deterministic.

### Why now

F-003 is the local-inference claim the hackathon scores. The order decides what "meaningful local inference" means in the demo, and what the eval is allowed to blame on the model.

### Options considered

1. **Model on every window.** Pros: one code path, and every switch is visibly a model call. Cons: the probe already fails on an obvious case, and a declared site does not need a model.
2. **Rules only.** Declared sites and apps, and no model. Pros: deterministic and easy to demo offline. Cons: the residual window, the one they forgot to declare, is the case the prior brief still called real, and a rules-only build does not meet the hackathon's local-inference requirement.
3. **Rules, then memory, then the model on the residual.** An output outside serves / drifts / unclear is stored as unclear. Pros: the model does the job it is needed for, and a bad string cannot become a label. Cons: three sources have to stay visible or the review will look like one oracle.

### Decision

Use option 3. Each verdict stores its source. Memory applies only after the same app or site has been tapped on more than one visit. One tap is a label for that visit, not a rule for the next one.

### Why this option

idea.md §9 names the risk as the residual, not the declared site. Option 1 spends the model where a rule already knows the answer, which hides the model's real error rate. Option 2 fails the event's hard requirement. The 0.80 bar still applies to verdicts the review asserts. Under that bar, those visits are shown as unclear instead.

### Overrides

- **Prior ADRs:** none. ADR-001 still holds. This ADR decides how a verdict is produced, not whether the session displays it.
- **Doc or plan truth:** none. idea.md §7 F-003 and F-005 already state the order and the single-tap limit.
- **Out of scope:** does not choose the model runtime. Bennet owns that.

### Consequences

- **Easier:** the privacy panel can count model calls separately from rule hits. The second session can show a remembered site producing no model call.
- **Harder or owed:** the eval must report precision by source, or a strong rule layer will be mistaken for a strong model.
- **Follow-up:** the data model gives a verdict one source and one label. The review renders both.
