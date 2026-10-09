# ADR-012 — MEANT's loop, on this machine

- **Date:** 2026-10-10
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** F-006, F-009, F-011, F-015, F-016, F-017, F-018, US-007, US-011, US-013, US-014, US-015, US-016, US-017, ADR-008, ADR-011, idea.md §1, idea.md §7

### Context

MEANT starts in a popup. The person writes the sentence, picks a cycle, says where the work happens, and says what to block. A saved list sits behind today's chips. A keyword in the sentence can pre-fill the block list. When the time ends, the popup opens and asks whether they finished. A badge marks the change from work to break. Settings can turn the judge, the coach, and the companion off. The coach may only suggest an action the product can perform. History is a day timeline and a month of rows.

Ledger's declare screen asks for the sentence and two lists. The distraction list labels a visit. It does not stop the app. There is no cycle, no saved list, no preset, no block screen, and one history list. F-009 is Won't. idea.md §1 says a blocked site is one the product stops learning about.

The owner asked to adopt that loop. The blocker includes other desktop apps, not only sites.

### Why now

The docs are what the other two teammates build from. Leaving F-009 as Won't means they will not build the screen in the MEANT popup.

### Options considered

1. **Keep F-009 out.** The review only sees time the person actually spent. Cons: the start screen the owner named does not exist, and a distraction list that does not block is a different product from MEANT.
2. **Copy MEANT, including the account, the Groq classifier, the live drift signal, and the monthly donut.** Cons: the account is a network client (F-012, BR-005). MEANT removed the drift signal (its ADR-0057). The donut and the fidelity percentage are a rate (F-013, BR-006).
3. **Adopt the loop on this machine.** Blocking, cycles, saved lists, presets, the question opening itself, the phase mark, the three switches, coach suggestions with a button, a day timeline and a month of rows. The classifier is the local model. No account. No drift signal. No score.

### Decision

Option 3.

**Block.** During a session, a site or app on today's block list is stopped. A site or app on today's work list is never blocked. A host named in the intention is never blocked. That is the Instagram case. A site block replaces the page when the extension is installed, and stores a hit with no duration. A desktop app is hidden, not quit, so unsaved work stays. Quitting is not the default. Ledger's block window shows the intention and "That's still true." The review lists those hits as reaches, not as time on the window. During a break, blocking stays on and the judge does not run. There is no "open it anyway" control. MEANT's block page does not have one.

**Cycle.** Presets are `25 work · 5 break` and `50 work · 10 break`, a count from 1 to 8, and custom. Custom can be timed, until the person stops, or no cycle. A timed length is `count × work + (count − 1) × break`. The session ends after the last work block. The running screen keeps the elapsed clock (BR-001) and a static word, work or break. No dial and no second ticking countdown. The tray tooltip says `work`, `break`, or `?`. It sets no color. It is not an OS notification.

**Ask.** When a timed session ends on its own, the popup comes forward and asks whether they finished. If they pressed End in the popup, it is already asking, and it does not open a second time. The tray shows `?` until they answer or dismiss. Dismiss stores unanswered.

**Saved lists.** A Sites screen holds the work list and the block list across days. The popup starts from those lists. Edits in the popup apply to this session only, unless the person saves them back.

**Presets.** Four presets, in this order: writing, research, study, admin. The lists and the keywords are the ones in MEANT's `extension/blocklists.js` as of 2026-10-10. They are a provided file. The person does not edit them in the app. Whole-word match, first preset in that order wins. If no keyword matches, the local model may answer only `writing`, `research`, `study`, `admin`, or `none`. It may not name a site. The block chips become (saved block list ∪ preset block) − preset allow − work chips − hosts named in the intention. The first manual chip edit freezes that fill. Start does not wait. A late answer is dropped.

**Coach suggestions.** A suggestion is shown only with a button the app can run: start a block, add to the block list, add to the work list, open a review, open Sites. Any other suggestion is dropped. The reply about the record can still show. This is MEANT's I5. The coach still does not praise or scold (ADR-011).

**History.** The day view is that day's sessions in time order, using the same trace as a review. The month view is the rows History already has, grouped by day. No donut, no fidelity percentage, no hours headline (BR-006). MEANT's ADR-0068 allowed those quantities. This ADR does not.

**Switches.** Settings can turn the judge, the coach, and the companion off, separately. Default is on. Judge off stores residual visits as unclear and does not call the model. Coach off hides the coach. Companion off hides the pet. Blocking, capture, and the review stay on.

**Code.** This commit does not change the app. The docs are the spec.

### Why this option

Option 1 ignores the popup the owner is holding. Option 2 imports the half of MEANT this product was started to leave behind, and a dashboard figure BR-006 already forbids. Option 3 is the loop, running where the window titles already stay.

### Overrides

- **Prior ADRs:** supersedes the sentence in ADR-008's context that blocking stays out because the product stops learning. The review now shows the reach. ADR-008 still holds on the finish answer, the silence during a session, and no live drift signal. Extends ADR-011's coach: suggestions need a button.
- **Doc or plan truth:** idea.md §1 and §7. prd.md F-009 and the new stories. system-design.md. data-model.md. design.md screens.
- **Out of scope:** an account, sign-in, pairing, and "disconnect this device" (F-012). The live drift signal (F-010). A generated task plan, which MEANT cut. Reading page text. Groq. Killing a blocked app. A productivity donut or a fidelity percentage.

### Consequences

- **Easier:** one popup matches the product the team already built once.
- **Harder or owed:** a Sites screen, a block window, hide-not-quit for a desktop app, a page replace in the extension, cycle timing, tray tooltip, preset file, three settings, a day view. Re-run nothing in the eval for this. Blocking is not a model.
- **Follow-up:** the code is a later commit. Hiding a window is the behavior. The Win32 call is Bennett's to pick when he builds it.
