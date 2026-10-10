# ADR-026 — Grounded Coach time summaries

- **Date:** 2026-10-10
- **Status:** Accepted
- **Related:** F-011, US-011, ADR-014, ADR-023

### Context

Coach receives code-computed facts about the ended session and local history before the local language model writes a reply. The current record exposes individual visits and aggregate time by shown label, but it does not give Coach a compact summary of how recorded time was distributed across apps. Window titles remain local and must not be repeated in Coach replies. The implementation uses the existing Qwen3.5-2B runtime; there is no semantic embedding or vector retrieval path in the build.

### Why now

Coach needs evidence that is useful for a question about where a block's recorded time went, while keeping the prompt bounded and the answer tied to observable data. The system design should describe the actual retrieval method rather than imply that embeddings are already implemented.

### Options

1. **Keep visit-level evidence only.** It avoids a new summary, but leaves the model to interpret repeated visits and durations from a longer list.
2. **Compute per-app duration summaries from recorded visit intervals and provide those figures as structured prompt evidence.** This is deterministic, bounded, and uses the existing local model.
3. **Add semantic embeddings and vector retrieval now.** This could retrieve related history flexibly, but requires selecting and evaluating a compatible local embedding model and adds a new runtime path without evidence that it improves Coach answers.

### Decision

Choose option 2. Compute each app's duration by summing its recorded visit intervals for the ended session, and include the result in Coach's evidence record. Do not assign unrecorded gaps to an app. Continue using the existing local Qwen3.5-2B model for generation. Semantic embeddings and vector retrieval are deferred until a dedicated compatible embedding model has been evaluated on-device and shown useful for this task.

### Why this option

The summary makes repeated recorded use easier to discuss without asking a small language model to perform arithmetic over raw visits. It adds no network path or second model runtime and keeps each duration traceable to the local record. Embedding retrieval would add a separate model and retrieval behavior before a demonstrated need or compatible model evaluation.

### Overrides

Updates the Coach evidence description in `docs/system-design.md` and the observable acceptance criteria in US-011 of `docs/prd.md`. Extends ADR-014's code-computed local evidence. Does not change the runtime selected by ADR-003, Coach's local-only behavior, or any harness order in ADR-002.

### Consequences

Coach can receive per-app recorded durations alongside existing session and history facts. Capture gaps remain unassigned and cannot inflate app time. The Qwen3.5-2B runtime remains the sole model runtime. Any future semantic retrieval requires a dedicated local model evaluation and a new decision documenting its value and constraints.
