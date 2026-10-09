# Ledger — Agent guide

Ledger is a desktop session review that puts a stated intention next to the windows a person actually used, so they can notice the gap. The finish answer is stored and is not the goal. Judgment runs on the device. The window title never leaves the machine. It serves a self-employed person, working on their own laptop, who does not notice what a block was made of.

Teammates need `/docs` and this file. Do not commit an `fmd/` folder.

## Read order

Do this before every change. Stop as soon as you have the owner.

1. Open [`docs/index.md`](docs/index.md) §0. Find the one row for the concern you are about to change. Open that file only.
2. §0.5 has no rows. There is no `docs/ledger.md`.
3. If you are asking why, read [`docs/adr/`](docs/adr/) newest first. The newest Accepted ADR for that concern wins until the owning doc is updated.
4. `docs/BUILD.md` does not exist. Do not invent tasks in a file that was deferred.
5. Do not open pitch, release, or onboarding. They were not generated.

When two docs disagree, this order wins:

1. The newest Accepted ADR for that concern.
2. The owning doc from §0.
3. Older ADRs.

`docs/adr/` is the only why. Chat is not a record.

## Where to write

| You decided | Write it in |
| --- | --- |
| What the user can do, a story, or a flow | [`docs/prd.md`](docs/prd.md) |
| How the pieces connect | [`docs/system-design.md`](docs/system-design.md) |
| Stored shape | [`docs/data-model.md`](docs/data-model.md) |
| Look, components, or routes | [`docs/design.md`](docs/design.md) |
| What you will not build | [`docs/prd.md`](docs/prd.md) non-goals, or a Won't row in [`idea.md`](idea.md) §7 if it is a feature. A reason and a revisit condition. |
| Why you chose | a new file under [`docs/adr/`](docs/adr/) |
| The problem, the buyer, or a metric | [`idea.md`](idea.md) |

Story priority on a product story is Must, Should, or Could. Won't is only for a feature that has no story.

`quality.md` and `security.md` are not in this set. The 0.80 bar lives in [`idea.md`](idea.md) §9 until a quality doc exists. Do not copy it into a second file.

## Writing an ADR

Add `docs/adr/ADR-NNN-short-slug.md` when behavior or structure changed, or when a later reader would ask why. Never reuse `NNN`. Never edit an Accepted ADR. Supersede it.

Fill Context, Why now, Options (at least two), Decision, Why this option, Overrides, Consequences.

There is no ledger, so update the owning doc in the same change. Do not add a §0.5 row.

## Before you finish

- A Must or Should story you touched has an observable Given/When/Then line.
- A real decision has a new ADR.
- No secrets in the diff.
- No network client on the path of the review.
- No productivity score, rate, streak, or hours headline.
- The runtime is node-llama-cpp with Qwen3.5-2B (ADR-003). The Apple on-device model was a probe, n=4, and is not in the build.
- `docs/system-design.md` belongs to Bennett Payoyo. Change it through him.

## Stack currency

Electron 44, node-llama-cpp 3.22, Qwen3.5-2B Q4_K_M, electron-vite, React, @miniben90/x-win. The pins live in [`docs/system-design.md`](docs/system-design.md) §4. Verify a library against its current docs before writing a call. Do not write an API from memory.

## Commands

```text
<confirm at scaffold>
```

```text
<confirm at scaffold>
```

Ask before changing: `idea.md` §1, the harness order in ADR-002, and BR-001 through BR-006.
