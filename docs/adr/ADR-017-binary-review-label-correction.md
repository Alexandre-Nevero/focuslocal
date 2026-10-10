# ADR-017 — Automatic binary review labels and correction on the label card

- **Date:** 2026-10-10
- **Status:** Accepted
- **Related:** F-003, F-004, F-005, US-003, US-004, US-005, ADR-011, ADR-012

### Context

The review asks the person to classify unclear visits through “Unclear. You decide.” and separate classification controls. The person wants an automatic if/else decision and correction directly on the existing label card.

### Why now

The review should arrive with a label for every captured attention visit and remain correctable when the algorithm is wrong.

### Options

1. Keep the unclear prompt and require a classification tap before a binary label exists.
2. Resolve every captured attention visit to Served or Drift locally, and make its existing label card switch the saved label.

### Decision

Choose option 2. Computed ReviewVisit.shown and shownSource use a saved user correction first, then an accepted binary judgment, then a deterministic local if/else fallback. For the fallback, work-target or intention-token evidence gives Served; otherwise Drift. Its shown source is rule. Pending, missing, raw unclear, and gated model results do not create a third attention category. Away and unrecorded intervals remain separate factual states. Raw verdict and model metadata remain unchanged by display resolution.

Clicking the existing label card switches Served to Drift or Drift to Served through review.tap. The existing Store transaction saves a binary verdict with source user and maintains distinct-visit memory contributions. The derived automatic fallback and a persisted correction are separate paths; no new table or field is required. A correction survives reopening and takes precedence over later automatic results. Enter and Space also switch the focused card.

### Why this option

It provides the requested automatic review while retaining correction where the person notices a mistake. Existing local persistence and memory support already supply the correction path.

### Overrides

- Supersedes ADR-011's user-facing unclear display gate and ADR-012's user-facing judge-off unclear state. Their internal raw verdict behavior remains compatible.
- Updates prd.md US-004, US-005 and flow; design.md review labeling; data-model.md correction/display distinction.
- BR-001 through BR-006, ADR-002 harness order, the raw model confidence gate, and idea.md section 1 remain unchanged. This changes display resolution, not claimed model precision. The quality bar remains only in idea.md section 9.
- system-design.md remains owned by Bennett Payoyo and is not edited here. Existing runtime, native ids, storage ids, and offline review remain unchanged.

### Consequences

- Review attention labels always read Served or Drift, without a required classification interaction.
- A fallback may be wrong; the person can switch it on the existing card and inspect the user source.
- Historical unclear values and confidence remain valid. Evaluation reports must distinguish model evidence from fallback and user corrections.
- Memory still requires matching support from distinct visits; repeated clicks on one visit do not manufacture support.
