# ADR-008 — Awareness over accountability

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-004, F-006, F-009, idea.md §1, idea.md §8

### Context

MEANT stated this and then kept a review whose headline question was whether the block was finished. That question is accountability. The statement it was supposed to serve is different. Awareness is the goal. Information is the mechanism. The chain is information, then pattern, then noticing, and the middle step lags. The review is a training loop for noticing. Self-control and accountability are secondary and lose where they conflict. Blocking is the named exception, because a blocked site records the reach and never the duration.

This repo's first pass called the history a ledger and made the finish answer the thing the review is for. That fights the statement.

### Why now

The docs are what the build will follow tonight. Leaving the finish question as the goal would ship an accountability product with an awareness sentence on top.

### Options considered

1. **Keep the finish answer as the goal.** Pros: it is concrete and easy to demo. Cons: it is the conflict §1 says awareness wins.
2. **Drop the finish answer.** Pros: nothing on screen scores the person. Cons: the answer is still information. The loop uses it. Removing it throws away a column that noticing can use, which is the same over-reach MEANT corrected when it stopped forbidding the coach from reasoning about the answer.
3. **Keep the answer, and stop treating it as the goal.** The body of the review is the intention beside the windows. History shows repetition as rows and does not interpret them. A block stays out because it stops the learning.

### Decision

Option 3. The working name of the product stays Ledger, from the direction chosen against a live guard and against billing proof. The review and the history screen are not an account book, and the UI does not call them one.

### Why this option

The chain needs the information, including the answer, and it needs more than one session before a pattern exists. Calling a single answer the product skips the lag and scores the person. Dropping the answer skips the information.

### Overrides

- **Prior ADRs:** softens ADR-001's description of the review. ADR-001 still holds on silence during the session. It does not hold where it made "did you finish" the purpose of the review.
- **Doc or plan truth:** idea.md §1, §6, §7 F-004 and F-006, and §8. prd.md stories US-004 and US-007. Numbered 008 because ADR-006 is the Vite build and ADR-007 is Windows first.
- **Out of scope:** does not bring back a live drift signal, a coach, or blocking.

### Consequences

- **Easier:** a person can answer "not yet" without the product treating that as the result that mattered.
- **Harder or owed:** the demo has to show noticing, which is quieter than a score. History has to make a repetition visible without a sentence that claims a pattern.
- **Follow-up:** none. The owning docs are updated in the same change.
