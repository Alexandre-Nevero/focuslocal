# ADR-003 — Electron with node-llama-cpp and Qwen3.5-2B

- **Date:** 2026-10-09
- **Status:** Accepted
- **Owners:** Bennett
- **Related:** F-003, system-design.md §4, ADR-002, research/ledger-stack:research/research-shell.md, research/ledger-stack:research/research-runtime.md

### Context

system-design.md §4 left the app shell and the model runtime unchosen. The team runs Windows 10 (Bennett, RTX A1000 4 GB, no Rust toolchain), macOS on an M4 (Alexandrei, the pitch machine), and Linux Mint XFCE on X11 (Alex). One codebase has to run on all three. The model has to run in-process, with no network client on the review path.

### Why now

Nothing can be scaffolded until the shell and runtime are fixed. Code freeze is 2026-10-10 10:00 Asia/Manila.

### Options considered

1. **Tauri + a Rust llama binding.** Pros: small binaries. Cons: needs Rust and MSVC on Windows and WebKitGTK on Linux; none are installed on the team machines, and the webview differs per OS.
2. **Electron + an HTTP runtime (Ollama or llama-server).** Pros: easy model swaps. Cons: a localhost HTTP client breaks "no network client", and a second process has to be installed and kept running.
3. **Electron + OS runtimes (Phi Silica, Apple FoundationModels).** Pros: no model download. Cons: Phi Silica is Windows 11 only; FoundationModels is a second runtime with different behaviour; Linux has nothing.
4. **Electron 44 + TypeScript + React via electron-vite, with node-llama-cpp 3.22.x in the main process.** Pros: one runtime on all three OSes, prebuilt binaries for Metal, Vulkan, and CPU, no compiler needed, and an official scaffold. Cons: larger app, and a ~1.3 GB model file to fetch at setup.

### Decision

Use option 4.

- Scaffold from `npm create node-llama-cpp@latest -- --template electron-typescript-react`; its electron-builder config already keeps llama binaries out of asar.
- Runtime: `getLlama({gpu: 'auto', build: 'never'})`. It resolves to Metal on the M4 and Vulkan or CPU on Windows and Linux.
- Model: Qwen3.5-2B Q4_K_M GGUF (1.28 GB, Apache-2.0) from `unsloth/Qwen3.5-2B-GGUF`, fetched at setup by `scripts/fetch-model.mjs` with a pinned SHA-256.
- The model is always loaded from a local path. The app never calls `resolveModelFile("hf:…")` at runtime.

### Why this option

It is the only option that runs one in-process runtime on all three OSes without a compiler or a network client. A 2B model at Q4_K_M fits a 4 GB GPU with room for the KV cache, and still runs on CPU-only laptops because verdicts are computed in the background and shown only at review (ADR-001).

### Overrides

- **Prior ADRs:** none. ADR-002's order is unchanged.
- **Doc or plan truth:** replaces system-design.md §4's "App shell and model runtime unchosen" row.
- **Out of scope:** the model stage design (ADR-005) and capture/frontends (ADR-004).

### Consequences

- **Easier:** one TypeScript codebase; the model runs offline on every team machine.
- **Harder or owed:** the model file is a setup-time download; the README must disclose it and the Qwen licence.
- **Contingency, pre-decided:** if S1 + S2 exceeds 10 s per window on any spike machine, ship Qwen3.5-0.8B Q8_0 (`unsloth/Qwen3.5-0.8B-GGUF`) on all OSes and update this ADR.
- **Contingency, pre-decided:** if the Qwen3.5-2B GGUF fails to load (unknown architecture), use `bartowski/Qwen_Qwen3-1.7B-GGUF` Q4_K_M with `QwenChatWrapper({thoughts: 'discourage'})` and update this ADR.
- **Contingency, pre-decided:** if `llama.gpu === false` on a machine, accept CPU and record the measured latency.
