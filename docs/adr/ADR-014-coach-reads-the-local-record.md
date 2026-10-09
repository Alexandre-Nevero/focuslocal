# ADR-014 — The coach reads the local record

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-011, US-011, ADR-011, ADR-012

### Context

ADR-011 lets the coach speak after a session, from figures for that session only, and forbids a number it was not given. ADR-012 lets it suggest only an action the app can run. It does not receive block hits, earlier sessions, or any research. MEANT's coach was fed the month, and it had a local file of claims. That file is not a book of focus tips. MEANT's ADR-0064 says the claims tell the coach what it may understand. A suggestion it cannot perform is dropped.

The owner asked for the same thing here. The coach is fed the local record, and it helps from that record.

### Why now

The demo ends on the coach offering to block the thing the person just reached for. The current data block cannot see that reach.

### Options considered

1. **Leave the coach on one session and no corpus.** Pros: a smaller prompt. Cons: it cannot say "block this" from evidence, and it has no rule against treating every switch as failure.
2. **Give it a library of focus techniques.** Pros: it sounds helpful on an empty record. Cons: MEANT already refused this. The app cannot perform "try a Pomodoro" as a technique lecture, and a 2B model will invent the numbers.
3. **Feed it this session and the recent local history, plus MEANT's six claims as a local file. Help is a button.**

### Decision

Option 3.

**Data, computed in code, then fenced.** For the session just ended: intention, outcome, each visit's app, shown label, and source, block hits, away, and unrecorded time. For the local file as a whole: how many sessions, how many yes and how many not yet, time per shown label, and any app or site reached for on more than one session. A suggestion does not repeat a window title. The first session has an empty history. The coach then speaks from the block it just saw.

**Help.** A suggestion is a button from the ADR-012 set. The one the record is for: "block this", when a reach is not already on the block list and is not on the work list. The button adds it to the saved block list. A sentence with no button, about a technique the app cannot run, is not shown.

**Corpus.** `electron/ai/coach-corpus.json` is the six MEANT claims, copied as data, not as application code. C9, C11, C12, and C13 are constraints. The coach does not recite them as advice. C21 may be used: not every switch is a failure. C22 is labeled reported. The coach does not state its numbers. A number in a reply must appear in the data block or in a corpus claim whose label is `verified`. Any other number, including C22, is the same failure as ADR-011: the reply is replaced with "The coach could not answer from the record."

**When.** Still only after the session has ended. The running screen and the pet do not speak.

**Demo.** One block is the happy path. Sentence "finish the client pitch deck". The writing preset fills the block list. A doc on the work list is serves, from the list. A blocked app is a reach with no duration. One window on neither list stays unclear until a tap. The review shows the source of each label. The coach names the reach and shows Block. The privacy panel shows the model id and that this build has no network client. If the coach or the blocker is not in the build, that step is cut from the demo. It is not described as if it ran.

### Why this option

Option 1 cannot help. Option 2 is the lecture MEANT's own corpus forbids. Option 3 is the help the app can actually do: change the block list from what the file shows.

### Overrides

- **Prior ADRs:** extends ADR-011's data block from one session to the local file, and adds the corpus. ADR-011 still holds on silence during the session, no praise or scold, and no invented number. ADR-012's button list is unchanged.
- **Doc or plan truth:** idea.md F-011. prd.md US-011 and the demo path. system-design.md Coach. The corpus file.
- **Out of scope:** does not add a neutral label. C21's note about MEANT's ADR-0047 stays in the file as history. It does not add a label here. Does not quote C22. Does not add an account.

### Consequences

- **Easier:** the demo's last beat has something true to say.
- **Harder or owed:** the data block is built in code before the prompt. The corpus file ships with the app. A first session must still get a reply.
- **Follow-up:** the code that builds the block and calls the coach is a later commit. This commit adds the corpus file and the docs.
