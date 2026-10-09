# ADR-005 — System One decide, then a small-model reason

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owners:** Bennett
- **Related:** F-003, ADR-002, ADR-003, idea.md §9, research/ledger-stack:research/research-laya.md, research/ledger-stack:research/research-systemone.md

### Context

ADR-002 fixed the order: rules, then memory, then the model on the residual. It did not say how the model stage decides. A free-text answer from a small model can be wrong with confidence, and the review must only assert verdicts that clear the eval's bar.

### Why now

The runtime is chosen (ADR-003). The model stage's shape decides what the eval measures and which columns a verdict stores.

### Options considered

1. **Laya as the classifier.** Cons: 0.362 zero-shot on the task.
2. **Kev.** Cons: no GGUF; cannot run in node-llama-cpp.
3. **GLiNER2.5-Decide.** Cons: 60.2%, and it needs a second runtime.
4. **Jev.** Cons: a cloud API; breaks the no-network rule.
5. **Embedding cosine filter.** Cons: measures topic similarity, not whether the window fits the task.
6. **S1 + S2 on one Qwen instance.** S1 is `LlamaDecisionContext.decide()`: one forward pass, softmax over serves / drifts / unclear, giving a label and a confidence. S2 is a JSON-grammar prompt on the same model returning a label and a short reason. Pros: one runtime, one model in memory, a calibratable confidence, and a constrained label. Cons: two calls per residual visit.
7. **Decider-2B as S1.** Pros: built for this kind of decision. Cons: its logit read must be ported to node-llama-cpp, and it adds 1.30 GB beside Qwen.

### Decision

Use option 6.

- Stored label = S1's choice when S1 and S2 agree and the choice is not `unclear`; otherwise `unclear`.
- Confidence = S1's. Reason = S2's, cut to 140 chars, and dropped if it repeats the title or URL.
- The review shows a model verdict only when its confidence is ≥ τ; τ comes from the eval. Before any eval run, every model verdict shows as unclear.
- Decider-2B (option 7) is not chosen. It gets a prototype trial (map ticket O5) and replaces S1 only if, at each one's τ, it is at least as precise, asserts more fixtures, and loads on all three spike machines.

### Why this option

Options 1–5 are below the bar, cannot run locally, or measure the wrong thing. Option 6 reuses the one model from ADR-003, and the 3-way constrained label plus the τ gate means a bad string or an injected title cannot become an asserted verdict.

### Overrides

- **Prior ADRs:** refines ADR-002's model stage. The order rules → memory → model is unchanged.
- **Doc or plan truth:** none. idea.md §9 still holds the precision bar.
- **Out of scope:** runtime and model file (ADR-003).

### Consequences

- **Easier:** a verdict carries a confidence, so the eval can pick τ instead of hard-coding one.
- **Harder or owed:** verdicts store `model_stage` and `confidence`; the eval needs ≥ 10 asserted cases at τ.
- **Follow-up:** O5 decides Decider-2B; the S1 criteria wording is revisited after the first eval run.
