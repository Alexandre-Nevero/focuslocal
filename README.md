# Ledger

A desktop session review. You say what you meant to finish. The app records the windows you actually used. The review puts those side by side so you can notice the gap. It also asks whether you finished. That answer is stored and is not the point. Judgment runs on the machine. The window title does not leave it.

This repository is the product record and the app. The Windows backend implements capture, Store, the rules → memory → model harness, evaluation, and IPC; the tray shell and Chromium extension relay/popup exist. The desktop declaration, running, review, history, and privacy product screens are still unbuilt. Backend evidence is not an end-to-end product completion claim.

## Run it (Windows 10 first)

Needs Node 24 and npm 11. `npm install` sets up dependencies and Electron and downloads the pinned model (1.28 GB, hash-checked) into `models/`; those setup fetches can use the internet.

```text
npm install
npm run dev        # Vite dev server + Electron, hot reload. LEDGER_DEBUG_PORT=9333 npm run dev exposes DevTools.
npm start          # build, then run the built app (what a judge runs)
npm run eval       # score eval/fixtures.json through the harness and set tau (needs the model)
npm test           # node:test backend regressions: lifecycle, capture, learning, migration and native framing
npm run typecheck
npm run lint
```

Ledger lives in the tray: left-click opens the popover, right-click has Open Ledger, Show mini window, and Quit. Data is in `%APPDATA%\Ledger\ledger.db`.

### Browser extension (Windows only)

After dependency/Electron setup, run:

```text
npm run build:host
node scripts/install-native-host.mjs
node scripts/check-native-host.mjs
```

The installer prints the Extension ID derived from `extension/manifest.json`'s public key; compare that output with the browser's ID rather than copying a second constant. In Chrome, Edge, or Brave, open its extensions page, enable Developer mode, choose **Load unpacked**, and select this checkout's `extension/` folder. Launch Ledger once to create/migrate its Store. The popup shows the intention and clock, or "No session"; tab relay skips private windows. The launcher check validates one real framed status response, not browser integration or model accuracy.

To remove it, remove the extension in each browser and run `node scripts/install-native-host.mjs --uninstall`. Installation refuses to overwrite another checkout's host registration; removal preserves unrelated registrations, values, and subkeys. Building/loading/registering this local extension uses no network and does not fetch Electron. macOS/Linux host installation is deferred under [ADR-007](docs/adr/ADR-007-windows-first.md).

Migration `003` resets old memory eligibility because aggregate counts cannot identify supporting visits. It deletes no sessions or historical verdict labels; fresh distinct-visit taps can teach memory again. See [data-model §4](docs/data-model.md#4-lifecycle--migration).

## Read this first

[`docs/index.md`](docs/index.md) says which file owns which fact. The problem and the feature list are in [`idea.md`](idea.md). Stories are in [`docs/prd.md`](docs/prd.md).

## What runs where

| Function | Where |
|----------|--------|
| Dependency, Electron and model fetch | Internet (at setup only) |
| Local browser extension build, install and load | On the device (no network) |
| Capture, judging, review, eval, extension relay, widgets, memory | On the device (local) |
| Account, sync, cloud model | Not in this product |

The privacy panel, when it is built, counts model calls and states that the build has no network client. It does not measure packets. A packet check is a monitor outside the app.

## Disclosure

Ledger reuses the problem and several decisions from MEANT, a project Alexandre Andrei Nevero built during an internship at Eden Ventures and presented there. The prior write-up is [docs/prd-intent.md](https://github.com/Alexandre-Nevero/meant/blob/main/docs/prd-intent.md) in that repository. This repository does not copy that application's code. The inherited precision bar lives in [`idea.md` §9](idea.md); MEANT's eval scored 0.733 on the verdicts it would have shown. It is not a result for Ledger.

A four-window probe on 2026-10-09, Apple M4, 16 GB, macOS 26.5, showed the on-device model answering in about 0.2 seconds once warm and getting two of the four windows wrong. That probe did not select the runtime.

Ledger builds upon Electron, React, Vite with vite-plugin-electron (from the node-llama-cpp `electron-typescript-react` template), node-llama-cpp/llama.cpp, Qwen3.5-2B (Apache-2.0, from `unsloth/Qwen3.5-2B-GGUF`), and @miniben90/x-win. Laya, Kev, GLiNER, Decider, and Jev were evaluated and not shipped (Decider pending O5). The choices are in [ADR-003](docs/adr/ADR-003-electron-and-node-llama-cpp.md), [ADR-005](docs/adr/ADR-005-system-one-plus-slm.md), and [ADR-011](docs/adr/ADR-011-coach-companion-and-system-one.md). ADR-011 is the spec for the coach, the companion, and a System One judge. ADR-012 is the spec for the start popup, the blocker, the cycle, the saved lists, and the presets. The running code still uses the ADR-005 agreement pass. It has no coach, no pet, and no blocker yet.

## Team

- Alexandre Andrei Nevero. Product documents.
- [Bennett Payoyo](https://github.com/Yahiro025). System design, app shell, and model runtime.
- [Alex](https://github.com/alxxrzfyr).

## Hackathon

AppBuildersPH Hackathon 2026. Theme is local AI. Code freeze is 2026-10-10 10:00 Asia/Manila. One public repository.

This cycle's development target is Windows. macOS and Linux come next only if that path is stable and time remains. The later customer is a solo maker on Apple Silicon. That is not the download this week. See [ADR-007](docs/adr/ADR-007-windows-first.md).
