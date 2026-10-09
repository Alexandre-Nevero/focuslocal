# Research: 3-Stage Pipeline Feasibility (Laya, Jev, Embedding Filter)

## Verdict: Reject 3-Stage Pipeline, Use 1-Stage Qwen3.5-2B
- **Laya Integration in Electron in <= 3h:** **IMPOSSIBLE without violating project constraints.** Laya cannot run in `node-llama-cpp` (it is an encoder + custom decision head, not a causal decoder). It has no zero-dependency Node.js binding. Running it offline requires either `ollaya` (opens a localhost HTTP socket -> disallowed) or bundling Python + PyTorch/ONNX on Windows, macOS, and Linux (stdio subprocess). Cross-compiling and packaging Python on 3 OSes in <= 3h before the freeze is a high-risk operational trap.
- **Model Performance:** Base Laya scores **0.362** on zero-shot typed decisions (near random chance) and ships severely overconfident (ECE 0.466). It cannot hit the 0.80 precision gate.
- **Recommended Pipeline:** **1-Stage SLM directly in Electron main process** using **`node-llama-cpp` 3.22.1 + Qwen3.5-2B-Instruct Q4_K_M (1.28 GB)**.

---

## 1. Laya Breakdown
- **Identity & Backbones:** Non-autoregressive System-1 decision model by Convai Innovations (`convaiinnovations/laya`, Apache-2.0). 
  - English (`convaiinnovations/laya`): ModernBERT-large (395M) + 2-layer decision head = **421M params** (~808 MB Safetensors).
  - Multilingual (`convaiinnovations/laya-multilingual`): mmBERT-base = **322M params** (~647 MB).
- **Inputs & Outputs:** State (string/JSON) + typed questions (`choice`, `score`, `noul`). Scores choices at `[MASK]` tokens in a single forward pass without generating text.
- **Latency Claims:** 32.8–39.5 ms on Tesla T4; 8–10 ms on RTX 4090; 193–464 ms on CPU.
- **Runtime Options:**
  - Python (`pip install laya`, `transformers`, `torch`).
  - ONNX (`laya[onnx]`, used in `ollaya`'s Rust runner).
  - CoreML via `FluidInference/FluidUse` (macOS Apple Silicon only).
  - **llama.cpp / GGUF:** **Unsupported.** The Hugging Face `?local-app=llama.cpp` link is an automatic generic UI tag. ModernBERT bidirectional encoders with marker-scoring heads cannot execute in llama.cpp.
- **Electron Integration & Subprocess Cost:** Running without network sockets requires a bundled standalone Python stdio subprocess on 3 OSes (Windows x64, macOS arm64, Linux x64). This bloats the app installer by 1.5–2.5 GB, adds 2–4s cold boot overhead, requires fragile IPC serialization, and cannot be implemented and tested across all 3 platforms in 3 hours.

## 2. Zero-Shot Benchmarks & Calibration
- **Zero-Shot Accuracy:** On the official `typed-decisions` benchmark (2,000 decisions), base Laya achieves **0.362** (multilingual: 0.342) against a 0.318 random baseline and 0.461 majority-class baseline. The author notes: *"Base checkpoints are near chance on typed-decisions zero-shot... Laya is a fast base to specialise, not a zero-shot decision engine."*
- **Calibration:** Ships drastically overconfident (mean ECE 0.466 before temperature scaling). Issue #185 notes `action.act_probability` AUROC is 0.30 (worse than random). Abstaining at $p < 0.80$ on base Laya will not yield 0.80 precision.

## 3. What is "Jev"?
- **TypeSafe Jev (v1.13.0):** Closed-source commercial System-1 decision model and API (`POST /v1/systemone`) by TypeSafe. Laya and Ollaya emulate its request/response schemas. Also inspired GGUF fine-tunes like `jevk5` (alibiserikbay) and `jeb` (AINode). Not LeCun's JEPA.

## 4. Embedding Pre-Filter Assessment
- **Candidates:** `bge-small-en-v1.5-q8_0.gguf` (33.5M params, **~35 MB**, MIT, <10 ms) or `nomic-embed-text-v1.5.Q8_0.gguf` (137M params, **~147 MB**, Apache-2.0, ~15 ms). Supported via `LlamaEmbeddingContext`.
- **Cosine Soundness:** **Unsound as a classifier.** Cosine similarity measures semantic/topic overlap, not task alignment. A developer terminal ("cmd.exe" or "zsh") has near-zero cosine similarity with an intention like "Fix auth bug", while a distracting blog ("Hacker News: Why OAuth is Broken") has high similarity.
- **Stage Evaluation:** Latency is unconstrained (calculated during session, shown at review). Loading an embedding model alongside an SLM wastes 100–200 MB VRAM on Bennett's 4 GB RTX A1000 for no functional gain.

## Recommended Architecture
Drop Stages 1 & 2. Run **Qwen3.5-2B via `node-llama-cpp` 3.22.1** directly for the residual window:
1. Native C++ bindings (Vulkan on Win/Linux, Metal on macOS), zero sockets, zero Python.
2. Structured decision API (`model.createDecisionContext`) enforces `{label: "serves"|"drifts"|"unclear", reason: string}`.
3. True zero-shot reasoning handles arbitrary intention sentences.