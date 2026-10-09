# ADR-020 — Model label is always Serves or Drifts

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owner:** Bennett
- **Related:** F-004, US-004, US-005, BR-003; ADR-002, ADR-016, ADR-018, ADR-019; system-design §9; prd.md US-004; design.md §7.2

### Context

The review compares a stated intention to the windows used. ADR-018 removed the confidence bar as a display gate so model Serves and Drifts stay visible. Rows could still store and show `unclear` when Decider abstained, when S1 and S2 disagreed, or when the model was missing, which surfaced copy that asked the person to decide.

### Why now

Runtime review showed "Unclear. You decide." with Serves and Drifts buttons. The product position from ADR-018 stands: the system decides; the person corrects a label they recognize as wrong. Abstention must not hand the decision back.

### Options

1. **Keep "Unclear. You decide."** Model `unclear` and failure paths stay stored and shown as unclear; the person picks Serves or Drifts. Pros: honest about abstention. Cons: contradicts "do not hand the decision back"; every abstention becomes homework.
2. **Always store and show Serves or Drifts (this decision).** Before storage, map model `unclear` to the stronger of serves and drifts from the same `decide()` reading when those scores exist. When no reading exists (empty intention, missing judge, timeout before S1, thrown task), store `drifts`. The review shows the decided label with source; a quiet control flips a non-user row via `review.tap`. Pros: one clear label per judged row; correction is edit-when-wrong. Cons: some rows are decided without the model's abstention label.

### Decision

- **Judge / harness:** After S1 `decide()` and optional S2, if the combined result would be `unclear`, replace it with the higher of `probabilities.serves` and `probabilities.drifts` from that S1 result. On failure with no S1 probabilities, store `drifts`. Empty intention and null judge store `drifts` without calling Qwen.
- **Review:** No "Unclear. You decide." and no Serves/Drifts pair for abstention. Decided rows show Serves or Drifts with the existing source line. **Not this** on a non-user row calls `review.tap` with the opposite label.
- **Display:** `shown` remains the stored label. No τ gate (ADR-018).

### Why this option

Option 1 makes abstention the main interaction and trains people to finish the model's job. Option 2 keeps the review a record to read and correct, which matches awareness over accountability and the ADR-018 intent.

### Overrides

- ADR-018: the sentence that a model `unclear` label still shows as unclear, and the review copy "Unclear. You decide." ADR-018's "do not hand the decision back" is unchanged.
- US-004 Given line (stored unclear asks for a tap) and design.md §7.2 (same) are superseded by the owning docs updated in this change.

### Consequences

- New model verdicts are stored as `serves` or `drifts` only; `unclear` may remain on old rows and in eval fixtures but is not written on the harness path.
- US-005 applies to correcting a shown label, not to resolving abstention.
- Coach and eval code may still mention `unclear` for historical records and calibration; the frozen eval contract is unchanged.
