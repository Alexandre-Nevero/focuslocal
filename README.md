# Ledger

A desktop session review. You say what you meant to finish. The app records the windows you actually used. At the end it asks whether you finished it. Judgment runs on the machine. The window title does not leave it.

This repository is the product record for that rebuild. There is no application code yet. A judge cannot run Ledger from this commit.

## Read this first

[`docs/index.md`](docs/index.md) says which file owns which fact. The problem and the feature list are in [`idea.md`](idea.md). Stories are in [`docs/prd.md`](docs/prd.md).

## What runs where

| Function | Where |
|----------|--------|
| Model fetch, `npm install`, browser extension install | Internet (at setup only) |
| Capture, judging, review, eval, extension relay, widgets, memory | On the device (local) |
| Account, sync, cloud model | Not in this product |

The privacy panel, when it is built, counts model calls and states that the build has no network client. It does not measure packets. A packet check is a monitor outside the app.

## Disclosure

Ledger reuses the problem and several decisions from MEANT, a project Alexandre Andrei Nevero built during an internship at Eden Ventures and presented there. The prior write-up is [docs/prd-intent.md](https://github.com/Alexandre-Nevero/meant/blob/main/docs/prd-intent.md) in that repository. This repository does not copy that application's code. The 0.80 precision bar is carried from that project's eval, which scored 0.733 on the verdicts it would have shown. It is not a result for Ledger.

A four-window probe on 2026-10-09, Apple M4, 16 GB, macOS 26.5, showed the on-device model answering in about 0.2 seconds once warm and getting two of the four windows wrong. That probe did not select the runtime.

Ledger builds upon Electron, React, electron-vite, node-llama-cpp/llama.cpp, Qwen3.5-2B (Apache-2.0, plus a LICENSE copy in `models/`), and @miniben90/x-win. Laya, Kev, GLiNER, Decider, and Jev were evaluated and not shipped (Decider pending O5). The choices are in [ADR-003](docs/adr/ADR-003-electron-and-node-llama-cpp.md) and [ADR-005](docs/adr/ADR-005-system-one-plus-slm.md).

## Hackathon

AppBuildersPH Hackathon 2026. Theme is local AI. Code freeze is 2026-10-10 10:00 Asia/Manila. One public repository. This file will be wrong the moment the first slice of the app lands, and it should be updated then rather than left as a claim that the app runs.
