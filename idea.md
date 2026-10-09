---
status: draft
schema_version: 3.0.0
origin: Rebuilt from the owner's MEANT internship project for AppBuildersPH Hackathon 2026. Concepts carry over. This repository starts with no copied application code.
payer_status: assumed
---

# Idea: Twofold

## 1. Problem statement

The work and the distraction happen on the same computer, so nothing the person already owns can say whether the block they just spent produced the thing it was for. A calendar records that the hour was booked. A timer counts minutes they already felt passing. A site blocker cannot tell the Instagram tab that is the job from the Instagram tab that is the escape, and it cannot see the desktop app they switched into. The minutes they did not notice are the minutes their own memory drops. The cost is the next day. Tomorrow gets planned on the feeling of having worked. For someone self-employed, the slippage is unbilled.

Three falsifiers, carried from the prior MEANT brief (ADR-0055 in that project, 2026-09-15). They are not re-tested here. **P-F1.** The person can already answer "did that block deliver?" without help, so this is motivation rather than missing information. **P-F2.** Drift plus time away is under about 15 percent of the block, so the loss is not where this states it. **P-F3.** They answer the question and the next day does not change, so the review is a diary.

Awareness is the goal. Information is the mechanism. Carried from MEANT ADR-0052 and applied in [ADR-008](docs/adr/ADR-008-awareness-over-accountability.md). The chain is information, then pattern, then noticing, and the middle step lags. The review is not an account book. It is a training loop for noticing. Self-control and accountability are real and secondary. Where they conflict with awareness, awareness wins. A block stops the site or the app and records the reach, not a duration. The review shows that reach, so the gap is still visible. See [ADR-012](docs/adr/ADR-012-meant-loop-on-device.md).

## 2. Target segment

The buyer is a self-employed person who works on their own laptop, pays with their own card, and does the job and the distraction on that same machine. The problem shows up at the end of a work block, on a typical workday, when they did not notice what the block was made of.

The same behavior is served without a card. Researchers, students, and operators whose day lives on one computer get the same loop. v1 has no paywall. MEANT's paid tier was suspended for testing (that project's ADR-0075, 2026-09-22), and this rebuild does not put one back.

Not served. Employers and managers, at any tier. Anyone whose machine is a managed endpoint where they cannot install software.

The boundary is what the app could see. If a stretch of the session has no captured window, the review says so. It does not guess that the unseen time was work.

This cycle the loop is proved on Windows ([ADR-007](docs/adr/ADR-007-windows-first.md)). macOS and Linux are folded in only after that path is stable and time remains. A path that is not folded is not supported.

The later customer is a solo maker on an Apple Silicon Mac. Indie hackers, solo founders, freelance designers and developers, writers, and creators who ship alone, reached in English. Intel Macs stay unsupported. That person is who the product is shaped toward. They are not a feature in this build.

## 3. Evidence

- The owner built MEANT during an internship at Eden Ventures, presented it there, and reports that the presentation validated the problem. This file has the owner's report. It does not have a recording, a buyer, or a date for the presentation.
  > [!evidence] Type: said | Source: owner, planning session for this rebuild | Date: 2026-10-09
- MEANT's cloud judge was built and then hidden. On a 48-session synthetic set it beat a no-model baseline on accuracy (0.544 against 0.369) and still missed the bar for verdicts it would have shown (0.733 against 0.80, 44 of 60). The shipped UI did not call it.
  > [!evidence] Type: did | Source: MEANT docs/prd-intent.md status note 2026-09-25, citing that repo's ADR-0085 and ADR-0086 | Date: 2026-09-25
- On 2026-10-09 the Apple on-device model (`SystemLanguageModel`) was available on an M4 with 16 GB RAM, macOS 26.5. One cold call took 3.89 seconds. Three later calls took 0.23, 0.21, and 0.20 seconds. Given the intention "finish the Acme client pitch deck", the model answered unclear for Chrome "Instagram — Reels", serves for Keynote "Acme pitch v3.key", serves for Chrome "Meta Business Suite — Schedule posts for Acme", and serves for Slack "#random". Two of the four answers are wrong for that intention. This is a probe, n=4, one machine, one model. It is not an eval.
  > [!evidence] Type: did | Source: local probe run in this planning session, /tmp/fm_probe | Date: 2026-10-09

The four tests:

| Test | Pass / Fail | Why |
|------|-------------|-----|
| Real | Pass, narrow | The owner reports an internship presentation that validated the problem. No one has paid. |
| Large | Unmeasured | The prior brief refused to rank segments because pain acuity and reachability were empty (MEANT ADR-0054). Those columns are still empty. |
| Significant | Unmeasured | "Unbilled" is the prior brief's reasoning about the self-employed buyer. It has not been checked against invoices or a diary study. |
| Urgent | Pass for the deadline only | The hackathon freezes code at 2026-10-10 10:00 Asia/Manila. The user's problem is a recurring workday, not an emergency. |

## 4. Root cause (the WHY)

The surfaces are the same machine, and the tools split the evidence apart. A blocker sees a domain and not the intention. A timer sees duration and not the window. A browser extension sees tabs and not the other apps. A cloud model could read the window title only if the title left the machine, which is the privacy problem, so the prior product forbade titles and page text (MEANT I7, amended 2026-09-16). The judge then ran on hostname and path, after the session, and missed its bar. Cost was the other half. Each cloud call had a price, so the judge did not run on every switch.

Local inference removes both constraints for this loop. The title can be read because it stays on the device. A call has no fee, so the residual window can be judged as it happens. Neither claim says the small model is accurate. The probe above says it is not accurate alone.

## 5. Market & alternatives

- **Size band:** not measured. No source.
- **Reachability:** not measured. The prior brief left this column blank on purpose.
- **Top 3 alternatives + their key failure:** The rows are the prior brief's competitive table, last verified 2026-08-28, and that brief already called them perishable.
  1. Rize. Measures and categorizes with AI. It has no intention, and hours are the headline.
  2. Freedom. Blocks sites. It does not record whether the block produced the work.
  3. Session (Apple only). Runs a full loop, then asks what you learned rather than whether you finished the thing you named.

Doing nothing fails in the way §1 describes. The person answers from memory.

## 6. Value proposition

For a **self-employed person whose work and distractions share one computer**, who **does not notice what a block was made of**, this is a **desktop session review** that **puts the stated intention next to the windows they actually used so the gap can be noticed**, unlike **a time tracker that headlines hours or a blocker that only sees domains**, because **the record stays on the device and the review trains noticing rather than scoring the person**.

## 7. Feature set

| `F-###` | Feature | Priority | Solves (problem from §1/§3) | Why not / what would change it |
|---------|---------|----------|-----------------------------|--------------------------------|
| F-001 | Declare an intention, plus the apps and sites that are work today and the ones that pull away. Start is immediate. | Must | The review has nothing to compare attention against without the sentence. | — |
| F-002 | Record the frontmost app, window title, browser URL when available, and time away, while the session runs. | Must | Without a record, the end-of-block question is answered from memory. | — |
| F-003 | Judge each visit with a fixed order. Declared sites and apps first, then remembered labels, then System One on the on-device model for whatever is left. Keep the source, the label, the confidence, and the latency. The judge does not write a reason. An output outside serves / drifts / unclear is stored as unclear. | Must | Hostname-only judgment failed the prior bar, and the model alone mislabeled the probe. | The prose that used to sit on a verdict is the coach (F-011). See [ADR-011](docs/adr/ADR-011-coach-companion-and-system-one.md). |
| F-004 | End the session on a review. Show the intention, the attention record, and every unclear visit. Ask whether they finished it, and treat that answer as secondary to noticing. | Must | Without the record, noticing has nothing to train on. | — |
| F-005 | Turn a repeated tap into memory, and skip the model the next time that app or site appears. A single tap never becomes memory. | Must | The second run is the proof that the product learned without sending the window away. | — |
| F-006 | History of past sessions. The day is a timeline. The month is rows. Counts in words. A repetition is visible as the rows, not as a verdict about the person. | Should | One review is information. The pattern, and then the noticing, needs more than one session, and that middle step lags. | The single-session review still works if this ships a day later. No donut and no fidelity percentage. See [ADR-012](docs/adr/ADR-012-meant-loop-on-device.md). |
| F-007 | A privacy panel. Model-call count, model id, the statement that this build has no network client, and actions to drop memory or delete the local file. | Must | The local-inference claim is a slogan until the user can see what ran and where it sits. | — |
| F-008 | An eval set of labeled windows, with precision reported only from a run of that set. | Must | The prior judge was shown to users conceptually before it cleared a bar. A claimed accuracy with no run is a disqualifier at this hackathon. | — |
| F-009 | Block the sites and apps named for this session. A site is replaced. A desktop app is hidden, not quit. The review shows the reach, with no duration. | Should | The start screen asks what to block, and then has to do it. | Work sites, and a host named in the intention, are never blocked. See [ADR-012](docs/adr/ADR-012-meant-loop-on-device.md). |
| F-010 | An in-session signal that the current window is drift. | Won't | Would have shortened the lag between drift and noticing. | Reason: the prior product removed the live signal (its ADR-0057, 2026-09-15) because a wrong flag during work had no correction. The probe shows a small model will be wrong. Reconsider if shown precision clears the bar in §9 and a correction exists. |
| F-011 | A coach that talks after the session, on the on-device model, from this block and the local record. A suggestion appears only with a button the app can run. A local corpus tells it what not to do. | Should | The record shows the gap. The coach can add the thing you reached for to the block list. | It does not praise or scold the finish answer, and it does not invent a number. See [ADR-014](docs/adr/ADR-014-coach-reads-the-local-record.md). |
| F-012 | An account, sync, and a second device. | Won't | Would have kept the history when they change machines. | Reason: one computer is enough to test the loop, and an account is a network surface the privacy claim then has to explain. Reconsider when a second device is a real request. |
| F-013 | A productivity score, rate, streak, or hours headline. | Won't | Would have given a single number to glance at. | Reason: a score is what a manager would ask to see, and this product does not serve managers. Reconsider never, as currently framed. |
| F-014 | A companion on the desktop: the coach's character, draggable, with a hover motion. A tap opens the popup. During a session that popup can mark the open window "this isn't the work". | Should | The coach needs a place to live that is not a button buried in the review. | The pet does not change with the finish answer, and it shows no verdict while a session runs. See [ADR-011](docs/adr/ADR-011-coach-companion-and-system-one.md). |
| F-015 | A cycle on the start popup. `25 work · 5 break`, `50 work · 10 break`, a count, or custom. When a timed block ends, the popup opens and asks whether they finished. The tray marks work, break, or the waiting question. | Should | A block needs a length, and the question has to show up when the length ends. | No dial and no ticking countdown. See [ADR-012](docs/adr/ADR-012-meant-loop-on-device.md). |
| F-016 | A saved work list and block list. The popup starts from them and can change today without rewriting them. | Should | Typing the same sites every block is how a list gets skipped. | |
| F-017 | Four presets. A keyword in the intention pre-fills the block list. The local model may pick a preset id only when no keyword matches, and may not name a site. | Should | The block list should match the sentence without a second form. | Start does not wait. The first chip edit freezes the fill. See [ADR-012](docs/adr/ADR-012-meant-loop-on-device.md). |
| F-018 | Switches for the judge, the coach, and the companion. Each can be off. Blocking and the review stay on. | Should | A person should be able to run the loop with the model silent. | |

## 8. Success metrics

Targets below are carried from MEANT §8 (M1, M2, M3). They were unmeasurable there because test rows swamped real use. They are targets, not results.

- **Activation:** the builder completes at least 10 sessions with a real intention in the first two weeks.
- **Retention:** at least 70 percent of sessions have a non-empty intention, because an empty sentence gives noticing nothing to train against. The share of sessions marked finished is not a target. That share scores accountability, and §1 says accountability loses.
- **Revenue / value:** no price and no paywall in this cycle. The coach and the companion ship in the build so they can be shown. The later shape is freemium: the loop, the judge, memory, and the companion stay free, and the coach is a one-time licence, priced in USD, with lower prices by country. Not a subscription. No price is set, and no one has paid. The value signal this cycle is still the review being sat with. The outcome answer is stored and is not the goal. See [ADR-011](docs/adr/ADR-011-coach-companion-and-system-one.md).

## 9. Constraints, risks & kill criteria

**Single riskiest assumption:** a small on-device model, used only after declared sites and memory have taken their matches, labels the remaining windows well enough that the review is worth trusting. The n=4 probe does not support this. It is the thing the eval (F-008) has to answer.

**Kill criteria (explicit fail-states):**

- Regulatory: the product makes a clinical, diagnostic, or health claim. It classifies a window against a sentence. It does not classify a person.
- Unit economics: there is no per-call fee. The cost that can kill the demo is a runtime that does not load on the demo machine. If the chosen runtime does not run there, ship the review with rules, memory, and unclear for the residual, and do not pretend a model ran.
- Technical: if precision on verdicts the review would assert, measured on F-008, is under 0.80, the review shows those visits as unclear and asks the person. The 0.80 figure is the bar MEANT set and missed (0.733 on shown verdicts). It is carried, not re-derived. `quality.md` does not exist yet, so this section is the home of the number until that doc does.

**Avoid:**

- A cloud model as a fallback when the local one is slow or unsure. The offline review has to stand on its own. Revisit only for a feature that is labeled as online and is not on the path of F-004.

## 10. Out of scope (for now) — non-feature exclusions only

- Employers, managers, and any view built for them. The data would serve a different person than the one who did the work.
- Clinical or diagnostic use, including tools aimed at ADHD as a condition. The audience may overlap. The product does not.
- A browser extension as the product. An extension cannot see the other apps, which is the gap §4 names. A later helper that only supplies the active URL would be a capture detail, not this product.
- A course, a rebuild manual, or features whose user is a student reconstructing the app. That was a different project (`apexhuman`).
- macOS and Linux as supported platforms this cycle. The build target is Windows. Revisit only if that path is stable and time remains ([ADR-007](docs/adr/ADR-007-windows-first.md)).
- Treating the Apple Silicon solo maker as this cycle's buyer. That person is the later shape of the product. Revisit after the freeze.
