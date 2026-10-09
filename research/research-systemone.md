# Evaluation of System One Decision Models for Ledger

## Verdict
**Do not introduce a separate System One model.** Use **`node-llama-cpp`'s native `.decide()` API on the already-selected Qwen3.5-2B-Instruct Q4_K_M model** as Stage 3, cascading to grammar-constrained generation on the same model as Stage 4. 

- **Decider** requires Python (`llama-cpp-python` / `decide_gguf.py`) to parse token-position logits with custom calibration configs; it cannot run in `node-llama-cpp` unmodified.
- **Kev** uses an unsupported pointer-head architecture with block-causal masking; no official GGUF exists.
- **GLiNER2.5-Decide** is a DeBERTa encoder; it cannot run in `llama.cpp` and pulling in `onnxruntime-node` risks native Electron 44 ABI crashes across Windows, macOS, and Linux Mint 12.5 hours before freeze.
- **Single-model S1 + S4** uses 1.65 GB total VRAM (well within the 4 GB GPU cliff), requires 0 MB extra download, and takes **~1.5–2 hours** to integrate.

---

## 1. Candidate Model Evaluations

### 1. Decider ([Mapika/decider](https://github.com/Mapika/decider))
- **Base / Fine-tune:** Qwen3.5 base models (`0.8B`, `2B`, `4B`, `35B-A3B-Base`). Supervised proper-scoring-rule training (CE + Brier) followed by calibration-aware RL (v8–v10).
- **Sizes:** 0.8B, 2B, 4B, 35B (MoE, 3B active).
- **GGUF Availability:** Only 2B and 4B have official GGUFs:
  - [`Mapika/decider-2b-GGUF`](https://huggingface.co/Mapika/decider-2b-GGUF): `decider-2b-v11-Q4_K_M.gguf` (1.30 GB), `decider-2b-v11-Q8_0.gguf` (1.98 GB).
  - [`Mapika/decider-4b-GGUF`](https://huggingface.co/Mapika/decider-4b-GGUF): `decider-4b-v2.1-Q4_K_M.gguf` (2.70 GB), `decider-4b-v2.1-Q8_0.gguf` (4.48 GB).
  - *0.8B and 35B are Safetensors only; no official GGUF repository.*
- **llama.cpp / node-llama-cpp unmodified:** **NO.** While GGUF loads in `llama.cpp`, it does not generate text. Inference requires `decide_gguf.py` / `decider-ai` (Python) to inject question slots and read logits at specific prediction offsets scaled by `decider_config.json` temperatures. `node-llama-cpp` does not support this custom layout.
- **ONNX Availability:** None published.
- **License:** Apache-2.0.
- **Zero-Shot Accuracy & Calibration:** JevBench hard tier: ~65–72% accuracy. ECE reduced from 0.31 (v10) to 0.18 (2B v11) and 0.15 (4B v2.1).
- **Input Format:** Typed questions: `choice`, `score`, `noul` (yes/no).

### 2. Kev ([jaredpalmer/kev](https://github.com/jaredpalmer/kev))
- **Base / Fine-tune:** Qwen3.5 base (`0.8B`, `4B`, `9B`) and Qwen3.8 (`27B`). Uses a frozen causal LM + block-causal attention mask + LoRA adapter + custom pointer readout head.
- **Sizes:** 0.8B, 4B, 9B, 27B (superseded prototype: kev-0.5b).
- **GGUF Availability:** **None official.** [`jaredpalmer/kev`](https://huggingface.co/collections/jaredpalmer/kev) publishes PEFT Safetensors only. Unofficial experimental community forks exist (`espetro/llama.cpp/tree/kev`), but no production GGUFs.
- **llama.cpp / node-llama-cpp unmodified:** **NO.** Custom pointer readout head and block-causal masking are unsupported in stock `llama.cpp` and `node-llama-cpp`.
- **ONNX Availability:** None official. Runs via Python PyTorch/vLLM.
- **License:** Apache-2.0.
- **Zero-Shot Accuracy & Calibration:** Prototype 0.5B: 79.9% in-domain (ECE 0.065), 56.1% out-of-domain (transfer-v4 dev). Kev-0.8B/4B: ~68–76% accuracy on transfer-v4 dev.
- **Input Format:** `choice`, `score`, `noul` (TypeSafe System One schema).

### 3. GLiNER2.5-Decide ([fastino/GLiNER2.5-Decide](https://huggingface.co/fastino/GLiNER2.5-Decide))
- **Base / Fine-tune:** DeBERTa-v3-large (`fastino/gliner2-large-v1`) bidirectional encoder with schema-driven classification head. Multilingual variant (287M) on mmDeBERTa.
- **Sizes:** 340M (English), 287M (multilingual).
- **GGUF Availability:** **None.** Encoders/token-classifiers cannot run in `llama.cpp`.
- **llama.cpp / node-llama-cpp unmodified:** **NO.** Architecture incompatible.
- **ONNX Availability & JS Runtime:** **YES.** [`onnx-community/GLiNER2.5-Decide-ONNX`](https://huggingface.co/onnx-community/GLiNER2.5-Decide-ONNX) and mobile variant (~345 MB). Usable via `@huggingface/transformers` (WASM/WebGPU) or `onnxruntime-node` (`@lmoe/gliner-onnx`). However, `onnxruntime-node` introduces native C++ ABI hazards inside Electron 44 across 3 OSes; WASM is slow.
- **License:** Apache-2.0.
- **Zero-Shot Accuracy & Calibration:** Fastino internal benchmark (5,100 examples across 17 datasets): **60.2% exact-match accuracy**; calibrated softmax over labels.
- **Input Format:** Schema-defined label choices and criteria descriptions.

### 4. node-llama-cpp Structured Decisions ([Guide](https://node-llama-cpp.withcat.ai/guide/structured-decisions))
- **Base / Mechanism:** Evaluates prompt context once via `model.createDecisionContext()`, then evaluates questions in parallel. Does not generate free text: performs single-step logit evaluation over option tokens, normalizing via softmax.
- **Sizes / GGUF:** Uses standard causal GGUF models. Official guide recommends `hf:unsloth/Qwen3.5-2B-GGUF:Q4_K_M` (1.28 GB) and `Qwen3.5-0.8B` (0.81 GB).
- **Runs unmodified:** **YES, native in `node-llama-cpp >= 3.22.0`.**
- **ONNX Availability:** Not needed (runs in-process via C++ bindings).
- **License:** MIT (`node-llama-cpp`), Apache-2.0 (`Qwen3.5`).
- **Confidence Definition:** The normalized probability (softmax score) of the winning choice. Low confidence indicates probability mass split between alternatives.
- **Input Format:** `choice` (with option criteria descriptions), `score`, and `noul`.

---

## 2. Recommendation: S1 + S4 Pipeline Architecture

### Stage 3 & Stage 4 Pairing
Run **both Stage 3 and Stage 4 on the same `Qwen3.5-2B-Instruct Q4_K_M` model instance**:
1. **Stage 3 (S1 Fast Gate):** Call `decisionContext.decide(visitDoc, { label: { type: "choice", criteria: { serves: "...", drifts: "...", unclear: "..." } } })`.
   - Execution time: ~40–80 ms (Vulkan/Metal), ~200 ms (CPU).
   - Precision gate: If `choice !== "unclear"` AND `confidence >= 0.80` ($\tau = 0.80$), assert verdict immediately. Skip Stage 4.
2. **Stage 4 (SLM Reasoner):** If $p < 0.80$:
   - Fall back to `chatSession.prompt()` on the same model instance using `createGrammarForJsonSchema({ type: "object", properties: { label: { enum: ["serves","drifts","unclear"] }, reason: { type: "string" } } })` with `maxTokens: 40` (~400 ms).
   - If SLM is also low-confidence or times out (5 s budget), store **"unclear"** (abstain).

### Is a Separate S1 Model Better?
**No.** 
- A separate model adds 0.8–1.3 GB to the bundled Electron installer.
- Requires allocating two separate model weights in VRAM.
- `node-llama-cpp` allows multiple contexts (`LlamaDecisionContext` and `LlamaChatSession`) on the *same* `LlamaModel` instance with zero weight duplication.

### Memory Budget
| Component | 4 GB RTX A1000 (Windows/Linux) | 16 GB Unified Memory (macOS M4) |
|---|---|---|
| Qwen3.5-2B Q4_K_M Weights | 1.28 GB | 1.28 GB |
| DecisionContext KV Cache (512 ctx) | ~32 MB | ~32 MB |
| ChatContext KV Cache (1024 ctx) | ~64 MB | ~64 MB |
| Runtime & Buffer Overhead | ~250 MB | ~250 MB |
| **Total AI Memory Footprint** | **~1.63 GB** (Leaves >2.3 GB free VRAM) | **~1.63 GB** (Negligible) |

*(If a separate 0.8B model were added, total footprint climbs to ~2.6 GB VRAM, dangerously near the 4 GB limit under Vulkan OS desktop overhead).*

### Integration Estimate
- **Same-model `.decide()` + JSON grammar fallback:** **1.5 – 2.5 hours**.
- **Separate S1 model (Decider / GLiNER):** **8 – 12+ hours** (reverse-engineering Python logit extraction or debugging `onnxruntime-node` Electron native rebuilds across 3 OSes).

---

### Critical Files for Implementation

List 3-5 files most critical for implementing this plan:
- `src/main/ai/runtime.ts` — Loads Qwen3.5-2B GGUF with `gpu: "auto"`, instantiates `LlamaModel`, and exports decision and chat contexts.
- `src/main/ai/judge.ts` — Implements Stage 3 fast decision with $\tau \ge 0.80$ gate and Stage 4 JSON grammar fallback for reasoned verdicts.
- `src/main/harness/pipeline.ts` — Implements the 4-stage pipeline (Rules $\to$ Memory $\to$ S1 Fast Gate $\to$ SLM Reasoner) enforcing the 0.80 precision abstention rule.