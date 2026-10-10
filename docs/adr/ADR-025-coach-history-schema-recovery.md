# ADR-025 — Recover Coach history without locking the composer

- **Date:** 2026-10-10
- **Status:** Accepted
- **Related:** US-011, ADR-023, ADR-024

### Context

An existing local database stores `coach_turn.text`. The current conversation API expects the canonical `content` field. History loading fails and the composer was disabled whenever history was unavailable. The desktop companion can also cover the drawer's Send control.

### Why now

The reported installed database exposes this compatibility failure. Coach must accept a draft and use the existing local Qwen runtime without requiring data deletion.

### Options

1. Require a new empty database. This loses the person's local record and conversation.
2. Migrate the legacy column in place, keep the composer editable during history errors, and allow retrying history. This preserves the record and makes recovery observable.

### Decision

Choose option 2. Rename the legacy `text` column to canonical `content` through a versioned, transactional compatibility repair. Recognize the existing Coach table when applying the canonical migration. Preserve all conversation rows. Allow draft editing independently of history readiness and offer history retry. Hide the companion while the main Coach drawer is visible so its controls remain reachable.

### Why this option

The failure is a schema mismatch, not missing conversation data. Preserving that data and separating draft editing from loading restores the intended local conversation flow.

### Overrides

Updates US-011 recovery behavior in `docs/prd.md`, Coach interaction in `docs/design.md`, and migration compatibility in `docs/data-model.md`. ADR-023's explicit Send and local generation and ADR-024's right drawer remain. No harness-order or system-design change.

### Consequences

Existing conversations survive the upgrade. A failed history read does not prevent typing. The companion returns after leaving Coach. New and legacy database paths require migration regression coverage.
