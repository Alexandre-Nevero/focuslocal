# ADR-019 — Extension session controls share the desktop record

- **Date:** 2026-10-10
- **Status:** Accepted
- **Related:** F-001, F-004, F-005, US-001, US-004, US-005, BR-001–BR-006, ADR-002, ADR-017, ADR-018

### Context

The browser extension can read local session status and summaries, but desktop-only session controls leave a user who opened the extension with no direct way to start or maintain the same record. The extension must share the desktop's session and review behavior while keeping the local database and judgment rules authoritative.

### Why now

The extension popup is gaining a full local summary. Adding controls requires a clear contract for starting, editing, answering, correcting labels, and opening desktop screens, so those actions cannot silently fork session behavior or memory semantics.

### Options

1. Keep the extension read-only and send every session change to a desktop screen.
2. Let the extension invoke a narrow set of native-host actions that use the same session record and canonical behavior as the desktop.

### Decision

Choose option 2. The extension uses the local native host for `summary`, `updateIntention`, `answer`, `tap`, and `open` actions. `start` launches the desktop with a `--ledger-start` payload; the popup confirms the session appears in the local running summary before reporting success. The matching technical wire details belong in `docs/system-design.md`, owned by Bennett Payoyo.

- **Start:** From idle, the extension accepts an intention plus per-session work and distraction targets and invokes the desktop's canonical start behavior through `--ledger-start` with a base64 JSON payload. Empty intention remains allowed. This creates one session row and starts the normal capture path; the popup confirms success only after local summary shows it running. Saved-list editing is not part of this contract.
- **Edit intention:** Save updates the intention on the same running or ended session row. Cancel discards the draft. Empty text is valid. The edit preserves session identity, timestamps, visits, stored verdicts, user corrections, and finish outcome. It does not rerun model judgment or add a memory vote. Any unresolved display fallback uses the saved intention.
- **Finish answer:** Yes and Not yet can replace a saved answer; clearing the answer stores `unanswered`.
- **Correct a label:** Only ended attention visits can be corrected in the extension. The action calls the same correction logic as `review.tap`, preserving user source and distinct-visit memory contribution rules. Away, unrecorded, and running visits have no correction action.
- **Open a screen:** `idle`, `declare`, `running`, `history`, `review/{id}`, and `privacy` launch their matching desktop routes.

While a session runs, the popup's resting view shows only intention and elapsed clock. An explicit edit interaction opens its editor but never reveals live labels, warnings, predictions, or a progress measure. The latest ended session may show its local summary, label controls, and editable finish answer. Desktop screens refresh within one second after an extension write, using local database change detection; file deletion remains guarded against late updates. No network service is involved.

### Why this option

One session identity and one correction path keep extension edits consistent with the desktop record, while narrow actions avoid duplicating capture, judgment, and memory behavior in the extension.

### Overrides

- Updates `docs/prd.md` US-001, US-004, US-005 and extension screen states, and `docs/design.md` extension behavior.
- Supersedes ADR-018 only for extension start, intention, answer, correction, and route behavior. It does not change BR-001 through BR-006, the harness order in ADR-002, or any other accepted ADR. User corrections continue to follow ADR-017 and memory support continues to follow BR-004.
- Adds native-host actions and desktop launch routes plus local refresh after external writes. `docs/system-design.md` must record the matching wire contract through Bennett Payoyo; it is not edited here.

### Consequences

- Start, intention edits, finish answers, and label corrections must operate on the existing local store through canonical behavior.
- An intention edit changes the sentence used by unresolved local fallback, but does not reclassify stored judgments or teach memory.
- The extension can reach Idle, Declare, Running, History, Review, and Privacy without an account or network service.
- Desktop windows observe native-host changes through local database change detection and refresh within one second; deletion cannot be undone by a stale notification.
