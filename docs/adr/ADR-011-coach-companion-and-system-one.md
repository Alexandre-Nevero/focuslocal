# ADR-011 — The coach is Qwen, the judge is System One, the companion is the pet

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-003, F-011, F-014, US-011, US-012, ADR-002, ADR-005, ADR-008, idea.md §7, idea.md §8

### Context

MEANT had three different jobs for a model. The judge labeled a visit. The coach talked about a finished session, and was forbidden to praise "yes" or scold "not yet" (that project's ADR-0051) and forbidden to invent a number (its ADR-0079). The companion was a pet on the page: drag it, hover it, tap it. In the browser it recorded "this isn't the work" (its ADR-0058). In the web app the same character opened the coach (its ADR-0069).

This repo kept the judge and dropped the other two. `idea.md` F-011 is Won't. ADR-008 says the coach stays out. `design.md` says no mascot. That was a cut for the hackathon, not a finding that the coach and the pet were the wrong product. Ledger is the same loop as MEANT, on the desktop, with the model on the machine.

The judge that did ship is not "System One" by itself. ADR-005 runs two passes on Qwen3.5-2B: `decide()` (System One), then a JSON-grammar reply, and stores a label only when they agree. The grammar pass is the small model writing a reason. That is the job the coach is for.

### Why now

The freeze is 2026-10-10 10:00 Asia/Manila. Teammates are building from these docs. Leaving F-011 as Won't means the coach will not be in the build. Leaving ADR-005 as the model stage means Qwen's generated text stays inside the per-window label, which is the judge, not the coach.

### Options considered

1. **Leave the cut in place.** The review stays the record and the question. Pros: nothing new before the freeze. Cons: the product MEANT already learned how to speak is missing, and the grammar pass keeps doing a coach's job inside a label.
2. **Bring the coach and the pet back on Groq, as MEANT did.** Pros: that code exists. Cons: a network client on the review path. BR-005 forbids it. The hackathon requires the core to run on the device.
3. **Bring them back on the Qwen already loaded. The judge becomes System One only. The coach is a separate chat on that same model, after the session. The companion is that coach's character, as a pet on the desktop, and it opens the coach when it is not being asked.**

### Decision

Option 3.

**Judge.** Rules, then memory, then System One. The order in ADR-002 does not change. System One is `LlamaDecisionContext.decide()` on Qwen3.5-2B. The stored label is that choice. The stored confidence is that confidence. `reason` is null. `model_stage` is `decide`. The review still shows a model label only when confidence is at or above τ, and τ still comes from the eval. Before an eval run of this judge, every model verdict shows as unclear.

**Coach.** A `LlamaChatSession` on the same loaded model. It runs only after the session has ended. It speaks from figures computed in code for that session: the intention, the outcome, time per label, away, unrecorded time, and the apps. It may use the outcome. It does not praise "yes" or scold "not yet" (BR-002). It does not state a score, a rate, a streak, or an hours headline (BR-006). A reply that contains a number the data block did not contain is not shown. The panel says the coach could not answer from the record. While a session is running, the coach does not speak (BR-001).

**Companion.** A small always-on-top window, transparent, with no frame. The person drags it. A hover moves it slightly. A tap opens the popup. A drag is not a tap: movement past 4 px, or a press held past 500 ms, does not open the popup and does not write a label. The character is the coach. When a session is running, the popup shows the intention, the clock, End, and one control, "This isn't the work". That control writes the open attention visit as source `user`, label `drifts`, through the same path as a review tap. It does not show a verdict. One such tap does not become memory (BR-004). When no session is running, the popup is the coach for the latest ended session. The pet looks the same whatever the outcome and whatever the verdicts were.

**Price.** Not in this build. The loop, the judge, memory, the companion, and the coach all ship with no paywall, so the demo can show them. The later shape, once someone has paid, is freemium: those stay free except the coach, which is a one-time licence, priced in USD, with lower prices by country. Not a subscription. There is no per-person inference cost to bill monthly. No price is set. No one has paid.

**Code.** This commit does not change the app. As of `0320c53`, `electron/ai/judge.ts` still runs the agreement pass from ADR-005, and there is no coach and no pet. The docs are the spec those are built to.

### Why this option

Option 1 keeps a cut that was about time, and it leaves Qwen's prose inside the judge. Option 2 puts window titles on a network, which this product exists to avoid. Option 3 uses the one model ADR-003 already chose, and it puts each MEANT job back on the surface that job had: a label on the visit, a conversation after the session, a pet the person can move.

### Overrides

- **Prior ADRs:** supersedes ADR-005 on the second pass and on the agreement rule. ADR-005 still holds on using `decide()` on Qwen3.5-2B, on τ, and on rejecting a second model. ADR-002's order is unchanged. Supersedes ADR-008's line that the coach stays out. ADR-008 still holds: the finish answer is stored and is not the headline, and there is no live drift signal and no blocking.
- **Doc or plan truth:** idea.md §7 F-011 and the new F-014, idea.md §8. prd.md US-011 and US-012. system-design.md §2, §4, and §9. data-model.md `coach_turn`. design.md on the pet. Bennett Payoyo owns system-design.md and the runtime. This ADR changes the model stage his ADR-005 specified. system-design.md is updated in the same commit so the build spec matches.
- **Out of scope:** does not bring back a live drift signal, blocking, an account, or sync. Does not copy MEANT's coach route, companion overlay, or Groq calls. The pet's sprite may be the tomato from that repo; the README names it if it is used.

### Consequences

- **Easier:** one model file. The judge is one forward pass per leftover window. The coach is where a sentence is allowed.
- **Harder or owed:** re-run `npm run eval` on System One alone before anyone quotes a precision. The agreement-pass numbers in system-design §9 described ADR-005 and are not this judge's result. A `coach_turn` table. A companion window. The privacy panel counts coach turns.
- **Follow-up:** the code change is a later commit. If System One alone cannot assert 10 fixtures at or above 0.80, that result is written down. It does not silently put the grammar pass back inside the judge.
