# ADR-007 — Windows first, Apple Silicon solo makers later

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owners:** Alexandre Andrei Nevero
- **Related:** idea.md §2, idea.md §10, prd.md §2, prd.md §6, ADR-003, ADR-004

### Context

ADR-004 treats Windows, macOS, and Linux as equal work. The team does have all three machines. The hackathon does not have time to polish three capture paths and still finish the review. A later customer was also named in the same sitting. A solo maker on an Apple Silicon Mac, shipping alone, reached in English. That person is not who this cycle's build is for.

### Why now

Capture work starts from this order. Leaving three operating systems equal would spend the freeze on paths the demo does not need yet, and writing the later buyer into this cycle's persona would build the wrong machine.

### Options considered

1. **Keep three operating systems equal.** Pros: matches ADR-004 and every teammate can dogfood on their own machine. Cons: three capture paths before the review is trustworthy on one.
2. **Promise Apple Silicon customers now.** Pros: one download and one permission story. Cons: the team is developing on Windows tonight, and the pitch machine is not the machine the loop will be proved on first.
3. **Prove the loop on Windows. Fold macOS and Linux only if that path is stable and time remains. Write the Apple Silicon solo maker as the later customer, not as this cycle's build.**

### Decision

Option 3.

- This build develops the review on Windows. macOS and Linux are folded only after the Windows path is stable and time is left before the 2026-10-10 10:00 Asia/Manila freeze. A path that is not folded is not described as supported.
- The later customer is a solo maker on an Apple Silicon Mac. Indie hackers, solo founders, freelance designers and developers, writers, and creators who ship alone. English channels. Intel Macs stay unsupported, which ADR-004 already says. That customer adds no feature in this build.
- The review, the harness order, and Qwen3.5-2B stay. There is no switch to Apple's on-device model.

### Why this option

Option 1 spends the freeze three times. Option 2 describes a customer the current work is not proving. Option 3 keeps ADR-004 as the record of how capture works on each OS, and changes only the order those paths are owed.

### Overrides

- **Prior ADRs:** softens ADR-004 where it treats Windows, macOS, and Linux as equal work for this build. ADR-004 still holds for how capture, the plugin, and widgets work on each OS. ADR-003's runtime is unchanged.
- **Doc or plan truth:** idea.md §2 and §10. prd.md §2 and §6. README. Does not edit system-design.md.
- **Out of scope:** does not delete the Windows, macOS, or Linux capture notes. Does not add a solo-maker story or a Mac-only screen.

### Consequences

- **Easier:** one capture path has to work before any other is started.
- **Harder or owed:** Bennett's system design still describes three OSes. This ADR does not rewrite it. A path folded later has to be checked against that design, not assumed from it.
- **Follow-up:** none. The owning docs are updated in the same change.
