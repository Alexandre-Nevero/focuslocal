# ADR-010 — Backend work ownership

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owner:** Bennett
- **Related:** US-006, US-008; system-design §9 Harness, IPC contract and Runtime; data-model §2–4

### Context

An awaited native judgment can outlive the Store it read. Deleting the file must not let that result reopen a database or write into a replacement. Ending a session is different: its review still needs pending verdicts. Native model loading can also finish after shutdown begins.

Memory support is not a lifetime history of taps. Repeating one visit must not make memory eligible, but forgetting or changing a key's label must allow those same visits to teach the current label again. Historical verdict labels must remain intact. The old aggregate counts cannot identify their distinct supporting visits.

### Why now

Windows backend lifecycle verification exposed stale writes, repeated-visit eligibility, inability to reteach after reset/forget, deletion retry races, and native resources surviving failed warmup or stop-during-load. The owning contracts need to describe the corrected boundaries before product screens use them.

### Options

1. **Lifetime/history deduplication and unowned asynchronous completion.** Remember that a visit was ever tapped and let pending work acquire whichever Store exists at completion. Small initially, but prevents reteaching and can recreate or contaminate deleted data.
2. **Current ownership.** Bind queued work to a database generation, and bind each visit's learning contribution to the current memory row. Invalidate work on delete/quit; clear contributions on conflict/forget. Await native disposal at quit.
3. **Persist an append-only tap/event ledger and cancellation records.** Reconstruct every learning epoch and job lifetime. More stored history and recovery machinery than this single-user backend needs.

### Decision

Option 2. Delete and quit advance queue generation and clear queued IDs; late results check generation before reacquiring Store or writing. End continues pending judgments. File deletion is exclusive and shares one retried operation. Quit waits for async native disposal, including late loads; failed load/warmup releases acquired resources.

Persist one nullable internal `verdict.memory_vote_id` contribution FK with an index. Repeated same-label taps on a contributing visit count once. A conflict clears that key's contributions and resets support before recording the current vote. Forget deletes memory and releases links, enabling reteaching from the same visits. Migration `003` resets unidentifiable old aggregate support to zero without deleting sessions, visits, memory labels, or historical verdict labels.

### Why this option

Ownership answers whether work or support belongs to the current resource, not whether it ever existed. A generation check prevents stale database access without pretending native inference stops instantly. A current contribution link deduplicates the actual support while permitting reset and reteach; a lifetime flag or permanent history ledger solves the wrong question. Existing transactions, FK deletion behavior, and unique visit verdicts supply the required boundaries.

### Overrides

Refines backend lifetime and learning-contribution semantics in the owning system-design and data-model docs; adds observable acceptance to US-006/US-008. Does not alter BR-001 through BR-006, the precision bar in idea.md, ADR-002's rules → memory → model order, or ADR-009's capture-gap decision. No existing Accepted ADR is edited.

### Consequences

- Historical labels and source attribution remain distinct from current learning support; the contribution FK is not a new public Verdict field.
- Migrated memory needs fresh distinct-visit support. Old counts cannot safely be backfilled.
- Delete/quit discard pending judgments; unjudged retained visits can be queued on a later launch. End alone retains pending work.
- Other IPC calls reject throughout deletion retries; failure releases exclusivity and does not report successful deletion.
- Shutdown may wait for native load/evaluation disposal rather than assuming a timeout immediately frees resources.
- Canonical stored shape lives in data-model; execution contracts live in system-design; product observations live in PRD. This ADR records the trade-off, not a separate rule set or product completion claim.
