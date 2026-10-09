---
# FMD context block — schema 1.1.0
team_size: 3
mode: team
build_type: hackathon
time_budget: 16h
judged: true
computes_numbers: false
exposed_surface: false
outlives_demo: true
selection_mode: auto

competition:
  name: AppBuildersPH Hackathon 2026
  theme: LOCAL AI
  format: 5-minute pitch and live demo, then 3-minute judge Q&A
  rubric:
    - Problem and Usefulness: 25
    - Local AI Implementation: 25
    - Technical Execution: 20
    - Innovation: 15
    - Product and Demo Quality: 15
  hard_requirements:
    - Meaningful AI inference runs on the user's device
    - The core local AI does not rely entirely on a cloud API
    - Working end-to-end product
    - Explain the specific value of local inference
    - Disclose models, frameworks, APIs, tools, and any existing code
    - Distinguish local functions from internet-dependent functions
    - Public GitHub repository at the deadline
    - One submission, code freeze 2026-10-10 10:00 Asia/Manila
    - About a one-minute demo video, plus an X or LinkedIn post tagging the required accounts
---

# Context intake

## Human override of the auto set

`selection_mode` stays `auto`. The team overrode the proposed set once, on 2026-10-09, so the docs exist before building starts.

Generating now:

- `idea.md`
- `docs/prd.md` (filled from the product template, saved under this name)
- `docs/design.md`
- `docs/system-design.md`
- `docs/data-model.md`
- `docs/index.md`
- `docs/adr/` for the two decisions that the later docs assume

Deferred, with the reason:

- `tests.md`. No code exists yet. The first slice writes its cases.
- `pitch.md`, `release.md`, `onboarding.md`. The build is judged, and those docs are owed before Demo Day, not before the first commit of product behavior.
- `security.md`. `exposed_surface` is false. There is no account and no network API. Reopen this if sync or a cloud fallback appears.
- `operations.md`. `outlives_demo` is true, and the doc waits until something is actually deployable.
- `ledger.md`, `changes.md`. A team build would normally get both. ADRs hold the why until a ledger is worth keeping.
- `methods.md`. `computes_numbers` is false. Eval precision is a measured result, not a price or a score the product derives.
- `build.md`, `phase-plan`, `crew`. No execution plan until the app shell and the model runtime are chosen.

## Who resolves what

Alexandre Andrei Nevero owns the product documents. Bennett Payoyo (GitHub `Yahiro025`) owns `docs/system-design.md`, the app shell, and the model runtime. Alex (GitHub `alxxrzfyr`) is the third teammate. Earlier notes that say "Bennet" mean Bennett Payoyo.
