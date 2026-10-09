# Ledger

A desktop session review. You say what you meant to finish. The app records the windows you actually used. The review puts those side by side so you can notice the gap. It also asks whether you finished. That answer is stored and is not the point. Judgment runs on the machine. The window title does not leave it.

This repository is the product record and the app. The app shell, local store, and IPC contract run today; capture, the harness, and the screens are being built (see the open issues).

## Run it (Windows 10 first)

Needs Node 24 and npm 11. The first `npm install` downloads the pinned model (1.28 GB, hash-checked) into `models/`; the first run downloads the Electron binary.

```text
npm install
npm run dev        # Vite dev server + Electron, hot reload. LEDGER_DEBUG_PORT=9333 npm run dev exposes DevTools.
npm start          # build, then run the built app (what a judge runs)
npm run typecheck
npm run lint
```

Ledger lives in the tray: left-click opens the popover, right-click has Open Ledger, Show mini window, and Quit. Data is in `%APPDATA%\Ledger\ledger.db`.

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

Ledger builds upon Electron, React, Vite with vite-plugin-electron (from the node-llama-cpp `electron-typescript-react` template), node-llama-cpp/llama.cpp, Qwen3.5-2B (Apache-2.0, from `unsloth/Qwen3.5-2B-GGUF`), and @miniben90/x-win. Laya, Kev, GLiNER, Decider, and Jev were evaluated and not shipped (Decider pending O5). The choices are in [ADR-003](docs/adr/ADR-003-electron-and-node-llama-cpp.md) and [ADR-005](docs/adr/ADR-005-system-one-plus-slm.md).

## Team

- Alexandre Andrei Nevero. Product documents.
- [Bennett Payoyo](https://github.com/Yahiro025). System design, app shell, and model runtime.
- [Alex](https://github.com/alxxrzfyr).

## Hackathon

AppBuildersPH Hackathon 2026. Theme is local AI. Code freeze is 2026-10-10 10:00 Asia/Manila. One public repository.

This cycle's development target is Windows. macOS and Linux come next only if that path is stable and time remains. The later customer is a solo maker on Apple Silicon. That is not the download this week. See [ADR-007](docs/adr/ADR-007-windows-first.md).
