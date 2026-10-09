# Documentation Index — Ledger

**Maintained by:** Alexandre Andrei Nevero
**Last updated:** 2026-10-10
**FMD version:** 6.1.0

## 0. Source-of-truth map (one fact, one home)

Each concern has one owner. Other docs link to it. They do not restate it.

There is no decision ledger in this set. Precedence is:

1. The newest Accepted ADR for that concern, until the owning doc is updated.
2. The owning document in the table below.
3. Older ADRs.

| Concern | Canonical owner | Note |
|---------|-----------------|------|
| Vision, problem, who it is for, metrics, population exclusions | [idea.md](../idea.md) | The seed brief |
| What we build. Features, stories, rules, screens, flow | [prd.md](prd.md) | Filled from the product template and saved under this name |
| How it is built | [system-design.md](system-design.md) | Owned by Bennett Payoyo. Shell and runtime chosen in ADR-003 |
| Stored shape | [data-model.md](data-model.md) | SQLite types are an assumption |
| Routes, components, visual states | [design.md](design.md) | In-app routes, not HTTP |
| Why a choice was made | [ADRs](adr/) | ADR-001 silence. ADR-002 harness order. ADR-003 Electron and node-llama-cpp. ADR-004 three OSes and frontends. ADR-005 System One then the small model, superseded in part by ADR-011. ADR-006 the template Vite build. ADR-007 Windows first. ADR-008 awareness. ADR-011 coach, System One judge, companion. ADR-012 MEANT's loop on this machine: block, cycle, saved lists, presets, the question, switches, day and month |
| Which docs were deferred | [context.md](../context.md) | Tests, pitch, security, and the build plan wait on a reason written there |

## 0.5 Active semantic overlays

No ledger, so no overlay rows. A later decision updates the owning doc in the same change.

| Concern | Base owner | Active decision | Affected IDs/sections | Consolidate by |
|---------|------------|-----------------|------------------------|----------------|

## 1. Document suite (what exists, what's stale)

| Document | File | Status | Last updated |
|----------|------|--------|--------------|
| PRD | [prd.md](prd.md) | draft | 2026-10-09 |
| Design | [design.md](design.md) | draft | 2026-10-09 |
| System Design | [system-design.md](system-design.md) | draft | 2026-10-09 |
| Data Model | [data-model.md](data-model.md) | draft | 2026-10-09 |

## 2. Deferred

Not generated, on purpose, from the override in [`context.md`](../context.md). `tests.md`, `pitch.md`, `release.md`, `onboarding.md`, `security.md`, `operations.md`, `ledger.md`, `changes.md`, `methods.md`, `build.md`, and the phase plan.

## References

- [`idea.md`](../idea.md)
- [`context.md`](../context.md)
