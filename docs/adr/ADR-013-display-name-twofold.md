# ADR-013 — The product is called Twofold

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** design.md §3.1, ADR-008

### Context

The docs and the code call the product Ledger. `design.md` already set the public wordmark: `twofold` in the mark, Twofold in prose, window titles, tooltips, and screen-reader names. It left the rename as a proposal, and it said not to change paths, storage, or IPC to match a mockup. ADR-008 said the working name stays Ledger.

### Why now

The owner decided the name. Teammates are writing UI copy from these docs. Two names in the same sentence will ship on the demo machine.

### Options considered

1. **Keep Ledger everywhere.** Pros: no rename. Cons: the design file already drew the wordmark the other way.
2. **Rename the repository, the database, IPC, and the native-host id.** Pros: one string. Cons: a migration of stored files and a host id during the freeze, for a label.
3. **Twofold is the name a person sees. Ledger stays the name in code, storage, IPC, the native-host id, and the daily screen.**

### Decision

Option 3.

- Window titles, the tray, tooltips, empty states, and the README say Twofold.
- The wordmark is the split lowercase `twofold` in [`design.md`](../design.md) §3.3.
- `ledger` stays in package name, file paths, SQLite file name, IPC channels, `com.focuslocal.ledger`, and environment variables.
- The daily screen may still be labeled Ledger. In that screen the word means the day's record, not the product. [`design.md`](../design.md) already says so.

### Why this option

The wordmark is already specified. Renaming the file the app writes would throw away sessions for a label. The daily screen's name and the product's name are different jobs.

### Overrides

- **Prior ADRs:** supersedes ADR-008's sentence that the working name stays Ledger, for the public name only. ADR-008 still holds on the finish answer and on silence during a session.
- **Doc or plan truth:** idea.md title, prd.md title and opening, README title, system-design.md title, data-model.md title, docs/index.md title, AGENTS.md opening, design.md § status paragraph.
- **Out of scope:** does not rename identifiers, directories, the database, or the native host.

### Consequences

- **Easier:** one name on screen.
- **Harder or owed:** visible strings that still say Ledger, outside the daily screen, get changed when that screen is touched. This commit does not rename code.
- **Follow-up:** none.
