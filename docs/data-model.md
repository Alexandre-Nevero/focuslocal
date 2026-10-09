---
schema_version: 2.1.0
status: draft
last_updated: 2026-10-09
doc: data-model
owns: entities and their relationships · per-field types, nullability and defaults · keys, constraints and indexes · schema migration and rollback
---

# Data Model / Schema — Ledger

> **Purpose:** the local file. Classification policy is not defined here. No `security.md` is in this set. The Class column uses two provisional tags, `internal` and `on-device private`, and does not pretend those tags are a retention policy.

**Engine.** `node:sqlite` (Electron 44 / Node 24). The store is one local file (`ledger.db`).

## 1. Entity Relationships

```mermaid
erDiagram
  SESSION ||--o{ DECLARED_TARGET : "lists"
  SESSION ||--o{ VISIT : "contains"
  VISIT ||--o| VERDICT : "labeled by"
  VERDICT }o--o| MEMORY : "may cite"
  EVAL_CASE ||--o{ EVAL_RUN : "scored by"
  BROWSER_TAB
  SETTING
  SCHEMA_MIGRATION
```

A session may have zero declared targets and zero visits. A visit has zero verdicts until Harness writes one, then exactly one. A verdict cites zero or one memory row. An eval case may have zero runs. Eval cases are not visits.

## 2. Entities & Fields

Class `on-device private` means the field can name a person's document or account. It stays in the local file (BR-005). There is no retention period in this doc.

### Session

**Stored in:** SQLite table `session` · **Written by:** SessionUI, via Store

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `id` | text | no | generated | internal | Primary key. Not reused. |
| `intention` | text | no | `''` | on-device private | The sentence. Empty is a real state (US-001). |
| `started_at` | text | no | — | internal | ISO-8601 start. |
| `ended_at` | text | yes | null | internal | Null while the session runs. |
| `outcome` | text | yes | null | internal | `yes`, `not_yet`, or `unanswered`. Null until the review closes. |

### Declared target

**Stored in:** SQLite table `declared_target` · **Written by:** SessionUI, via Store

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `id` | text | no | generated | internal | Primary key. |
| `session_id` | text | no | — | internal | The session this list belongs to. |
| `target` | text | no | — | on-device private | App name or site, as the person typed it. |
| `role` | text | no | — | internal | `work` or `distraction`. |

### Visit

**Stored in:** SQLite table `visit` · **Written by:** Capture, via Store

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `id` | text | no | generated | internal | Primary key. |
| `session_id` | text | no | — | internal | Parent session. |
| `app_name` | text | no | — | on-device private | Frontmost app. |
| `window_title` | text | yes | null | on-device private | Null when the OS did not provide one. Kept so a past review can render (open question in [`prd.md` §7](prd.md)). |
| `url` | text | yes | null | on-device private | Null when the browser did not provide one. |
| `last_seen_at` | text | no | — | internal | ISO-8601 timestamp of latest tick seen frontmost. |
| `started_at` | text | no | — | internal | ISO-8601. |
| `ended_at` | text | yes | null | internal | Null on the open visit. |
| `kind` | text | no | — | internal | `attention` or `away`. |

### Verdict

**Stored in:** SQLite table `verdict` · **Written by:** Harness, via Store

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `id` | text | no | generated | internal | Primary key. |
| `visit_id` | text | no | — | internal | One current verdict per visit. |
| `memory_id` | text | yes | null | internal | Set when source is `memory`. |
| `source` | text | no | — | internal | `rule`, `memory`, `model`, or `user`. |
| `label` | text | no | — | internal | `serves`, `drifts`, or `unclear`. |
| `reason` | text | yes | null | internal | Short text from the model, or null for a rule. |
| `model_id` | text | yes | null | internal | Set when source is `model`. |
| `model_stage` | text | yes | null | internal | `decide` or `reason` (check `model_stage IN ('decide', 'reason')`). Set when source is `model`. |
| `latency_ms` | integer | yes | null | internal | Set when a model call returned. Not a budget. |
| `confidence` | real | yes | null | internal | S1 confidence when model; null for rule and user. The review does not treat this as a score (BR-006). |

`reason` is easy to fill with a title by accident. Harness must not copy `window_title` or `url` into it. The review already shows those from the visit.

### Memory

**Stored in:** SQLite table `memory` · **Written by:** Harness, via Store

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `id` | text | no | generated | internal | Primary key. |
| `match_key` | text | no | — | on-device private | App name or site. Not a window title, so a document name does not become the key. |
| `label` | text | no | — | internal | `serves` or `drifts`. |
| `tap_count` | integer | no | `0` | internal | How many taps support this key. BR-004 uses it. The row may exist at 1 and still must not be applied. |

### Browser tab

**Stored in:** SQLite table `browser_tab` · **Written by:** NativeHost

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `id` | integer pk | no | — | internal | Check `id = 1`. Single-row state table. |
| `url` | text | yes | null | on-device private | Active tab URL. |
| `title` | text | yes | null | on-device private | Active tab title. |
| `browser` | text | no | — | internal | Browser name (`chrome`, `msedge`, `brave`, etc.). |
| `updated_at` | text | no | — | internal | ISO-8601 timestamp of last relay. |

### Setting

**Stored in:** SQLite table `setting` · **Written by:** Eval / Harness, via Store

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `key` | text pk | no | — | internal | Setting key, e.g. `tau`. |
| `value` | text | no | — | internal | Setting value string. |

### Schema migration

**Stored in:** SQLite table `schema_migration` · **Written by:** Store

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `name` | text pk | no | — | internal | Migration SQL filename. |
| `applied_at` | text | no | — | internal | ISO-8601 timestamp applied. |

### Eval case

**Stored in:** SQLite table `eval_case` · **Written by:** the repo's fixture load, via Eval

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `id` | text | no | generated | internal | Primary key. |
| `fixture` | text | no | — | internal | The window description the case is judged from. Authored fixtures, not captured user visits. |
| `expected_label` | text | no | — | internal | `serves`, `drifts`, or `unclear`. |

Fixture format (`eval/fixtures.json`): `[{id, intention, targets:[{target, role}], app, title, url | null, os:'win' | 'mac' | 'linux', expected}]`.
Mix: 60 cases total, 20 per OS. 15 resolvable by rules; 45 residual, split about evenly between serves and drifts, with ≥ 8 deliberately ambiguous cases expected `unclear`. Includes the four `idea.md` §3 probe windows. Titles are authored, never copied from real user history.

### Eval run

**Stored in:** SQLite table `eval_run` · **Written by:** Eval, via Store

| Field | Type | Null? | Default | Class | Description |
|-------|------|-------|---------|-------|-------------|
| `id` | text | no | generated | internal | Primary key. |
| `run_id` | text | no | — | internal | Identifies the eval execution run batch. |
| `eval_case_id` | text | no | — | internal | The case this attempt scored. |
| `source` | text | no | — | internal | Which harness stage answered. |
| `got_label` | text | no | — | internal | The label that came back. |
| `confidence` | real | yes | null | internal | Confidence score if model evaluated. |
| `model_id` | text | yes | null | internal | Model identifier when model ran. |
| `model_stage` | text | yes | null | internal | `decide` or `reason` if model ran. |
| `ran_at` | text | no | — | internal | ISO-8601. A missing row means US-009 shows "not run". |

No field is stored for a future dashboard. Model-call count is a count of `verdict` where `source = 'model'`.

## 3. Constraints & Indexes

| Entity | Constraint / Index | Type | Why it exists |
|--------|--------------------|------|---------------|
| Session | `pk_session` | primary key | Identity |
| Session | `ck_session_outcome` | check | Null, `yes`, `not_yet`, or `unanswered` |
| Session | `ux_session_one_running` | unique (`(1)`) where `ended_at IS NULL` | Only one session can run at a time |
| Verdict | `ck_verdict_model_stage` | check | `model_stage` is null or in (`decide`, `reason`) |
| Browser tab | `pk_browser_tab` | primary key (`id`) | Identity |
| Browser tab | `ck_browser_tab_id` | check | `id = 1` |
| Setting | `pk_setting` | primary key (`key`) | Identity |
| Schema migration | `pk_schema_migration` | primary key (`name`) | Identity |
| Declared target | `fk_declared_session` | foreign key, on delete cascade | The list dies with the session |
| Declared target | `uq_declared_target` | unique (`session_id`, `target`) | One role per app or site in a session |
| Visit | `fk_visit_session` | foreign key, on delete cascade | Visits die with the session |
| Visit | `ix_visit_session_started` | index (`session_id`, `started_at`) | The review lists a session's visits in order |
| Verdict | `fk_verdict_visit` | foreign key, on delete cascade | The label dies with the visit |
| Verdict | `uq_verdict_visit` | unique (`visit_id`) | One current label. A tap updates the row. It does not insert a second one. |
| Verdict | `fk_verdict_memory` | foreign key, on delete set null | Dropping memory keeps the old verdict and clears the link (US-008) |
| Verdict | `ck_verdict_label` | check | Label is serves, drifts, or unclear (BR-003) |
| Memory | `uq_memory_key` | unique (`match_key`) | One remembered label per app or site |
| Eval run | `fk_run_case` | foreign key, on delete cascade | Runs die with the fixture |

`tap_count` is not the enforcement of BR-004. Harness enforces "do not apply at 1". The column is what a test reads. A unique key stops two memory rows for one site. US-009 reads the latest eval run by scanning that case's rows. The fixture set is small, so it has no index of its own.

## 4. Lifecycle & Migration

`outlives_demo` is true. Engine is `node:sqlite`.

- **Migration mechanism:** ordered SQL files (`src/main/store/migrations/*.sql`) applied by Store at launch in filename order, recorded in `schema_migration(name, applied_at)`.
- **How a change rolls out:** add a column or table, use it, then remove the old shape in a later build. Do not rename a column in one step.
- **Backfill strategy:** one local file, so a backfill is a single pass at launch. There is no fleet to watch.
- **Rollback:** keep a copy of the file next to the new build until the migration has been opened successfully. After a destructive step, rollback is the copy, not the new file.
- **Data deletion path:** US-008 deletes the file (`ledger.db`, `-wal`, `-shm`, and `widget.txt`), or deletes memory rows. The policy for how long titles live is the open question in [`prd.md` §7](prd.md), not a period invented here.

## 5. Doc Integrity Check

- [x] Every entity in §1 has a field table, and every field table is in the diagram. `browser_tab`, `setting`, and `schema_migration` have no relationships.
- [x] Every field has a SQLite type and an explicit nullability.
- [x] `on-device private` is a provisional tag. It does not define a retention rule. `security.md` is absent.
- [x] Every relationship has a foreign key and an on-delete behavior. `memory_id` is nullable and uses set null, matching the optional edge in §1.
- [x] Each index names its query. BR-004 is application-enforced and the column a test would read is named.
- [x] No validation copy from the stories is repeated as a second rule set, and no capacity number is stated.
- [x] Titles are stored because US-004 renders them later, not because they might be useful. `reason` is called out so it does not become a second copy of the title.

## References

- [`system-design.md`](system-design.md)
- [`prd.md`](prd.md)
- [`idea.md`](../idea.md)
