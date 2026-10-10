# ADR-027: Coach response and request boundaries

- **Date:** 2026-10-10
- **Status:** Accepted
- **Related:** US-011, ADR-023, ADR-026

### Context

The coach can invent session details in response to a greeting and confuse an unanswered finish question with absent activity. The time question has an answer computable from visits. A coach request waiting for model readiness was not tracked by file deletion until after the wait.

### Why now

The observed conversation contained unsupported action tokens and a failed time answer. Deleting the file during startup could leave a request using a closed database.

### Options

1. Generate every reply and reject unsupported output afterward. This leaves simple record questions dependent on generation and does not fix request ownership.
2. Answer greetings and the time-summary question directly, constrain remaining generation, and track the complete serialized request before readiness.

### Decision

Choose option 2. Greetings have a fixed reply. The time-summary question uses computed app, away, and unrecorded durations. Show the longest twenty apps and aggregate the rest. Other questions use the existing local model with bounded evidence and recent conversation. Recent label-time totals cover thirty ended sessions; outcome counts cover the local file. Reject unsupported numeric claims, research references, URLs, milliseconds, and action tokens. An unanswered finish question means completion is unknown.

Track the request before waiting for readiness. Bound readiness to thirty seconds, clear its timeout, check deletion after waits and generation, and obtain the current database and record after readiness. Deletion waits for tracked requests before removing the file.

### Why this option

Simple summaries preserve the computed record without model arithmetic. Tracking readiness prevents late work from reopening or writing a deleted file. Remaining generation retains the existing local runtime.

### Overrides

Extends ADR-023 response selection and request ownership and ADR-026 time summaries. Updates the Coach section in system-design.md and US-011 in prd.md. No stored schema, harness order, or runtime model changes.

### Consequences

The fixed time question is reproducible from the record. Free-form answers still require model evaluation and cannot be guaranteed flawless. Earlier saved replies remain unchanged. Semantic embeddings and corpus retrieval are not implemented by this change.
