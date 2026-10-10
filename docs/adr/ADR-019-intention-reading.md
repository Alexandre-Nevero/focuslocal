# ADR-019 — One Qwen reading of the typed intention

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owner:** Bennett
- **Related:** F-003, BR-001, BR-002, BR-003, BR-005, US-001, US-003, US-004, US-011; ADR-002, ADR-003, ADR-016, ADR-017, ADR-018; system-design §4/§9; data-model §2 Session

### Context

A session stores the sentence the person typed in `session.intention`. Decider judges each residual window against that intention ([ADR-016](ADR-016-decider-only-decisions.md), [ADR-018](ADR-018-model-always-answers.md)). The typed sentence is often too wide or vague for a single window title. ADR-016 reserved Qwen3.5-2B for the post-session coach only and kept Qwen out of the verdict path.

### Why now

Decider needs a stable, short task text without putting Qwen on the label, without a second Decider decode, and without per-window model calls. One on-device reading of the typed intention can sit between the person's words and Decider's judgment while the harness order for rules and memory stays unchanged.

### Options

1. **Judge the typed sentence only.** No extra model call. Residual windows are judged against the raw intention, which may not match how the person meant the block.
2. **One on-device Qwen reading of the typed intention (this decision).** Qwen produces one short reading stored on the session; Decider judges that reading for every residual window in the block. Qwen does not label, vote, explain, or replace a Decider decision.
3. **Reject per-window Qwen and reject a second Decider decode.** Keeps Qwen fully out of the review path except the coach, or adds another Decider pass. Per-window Qwen is too slow and too close to a verdict; a second Decider decode duplicates the judge without fixing intention width.

### Decision

1. **`session.intention`** stays the sentence the person typed. **Qwen** writes one short reading into **`session.analyzed_intent`**. **Decider** judges that reading for every residual window in the block (when the reading is available; see timing below).
2. Qwen still does not label, vote, explain, or replace a Decider decision. This is the one exception to ADR-016: the reading is the text Decider judges, not a verdict.
3. **Column `analyzed_intent`:** nullable `TEXT`, no default, no backfill. Class `on-device private`. Written by the Harness, not by `session.start`. Null means unread. Empty intention stays `intention = ''` and never calls Qwen.
4. **Start** returns before any model call. **`prepareIntent`** does not block `session.start`. Rules and memory do not wait and do not call Qwen. Only the model stage may await the one reading. The first residual visit may sit on Judging while Qwen loads.
5. **One flight per session.** A failure is cached for the process lifetime. A restart retries only if the column is still null.
6. After the reading resolves, if **`discardJudgments`** has bumped the capture generation (delete or quit), do not call `getDb()` and do not recreate the database file. End does not bump generation.
7. **Sanitizer** on model output: strip think blocks; take the first non-empty line; drop a leading `Task:`, `Reading:`, or `Intention:`; strip wrapping quotes; strip `http(s)` URLs; reject length under 2; slice to 300. Do not reject app names. Model input is the trimmed sentence sliced to 300. Plain text, not a JSON grammar. **`maxTokens` 80.** Same **30s** abort as the coach. Errors must not contain the sentence.
8. **Review** shows **"Read as:"** under the intention heading only when the stored reading is non-empty and differs from the trimmed typed sentence. Not on Running or Mini. No new IPC event; Review reads the column on `review.get`.
9. **Coach prompt:** when the reading is non-empty, adds **"Read for judging as:"** immediately after the intention line, even if it equals the typed sentence. Post-session coach conversation stays ended-sessions only ([ADR-017](ADR-017-coach-and-companion.md)).
10. **Frozen eval** keeps judging the typed fixture sentence. Eval does not pass a reading callback. Do not publish a new gate number.
11. No network client. No score, rate, streak, or hours headline. Titles and URLs stay on the machine. Do not log the typed sentence.
12. Same Qwen weights as the coach (Qwen3.5-2B). Do not dispose the shared runtime when the reading finishes.

### Why this option

The typed sentence is often too wide for a window title; one short reading gives Decider a stable task without putting Qwen on the label.

### Overrides

- **ADR-016** — lines that say Qwen takes no part in the verdict and is reserved for the post-session coach. ADR-019 adds one exception: one reading of the typed intention, stored on the session, is the text Decider judges. Qwen still does not label, vote, explain, or replace a decision.
- **system-design** — the sentence that the coach does not run during a session, except for this reading. The post-session conversation remains ended-sessions only.
- **BR-001, BR-002, BR-003, and BR-005** are unchanged.

### Consequences

- One extra Qwen load can overlap the block.
- Residual model visits wait. Rules, memory, Start, and End do not.
- Frozen eval is unchanged.
- A late reading after delete or quit must not recreate the database file.
