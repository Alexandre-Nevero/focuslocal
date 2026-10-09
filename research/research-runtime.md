# On-device runtime for Ledger: research (2026-10-09)

## Verdict
- **Cross-platform build (Windows + macOS): Electron + `node-llama-cpp` 3.22.1 + Qwen3.5-2B-Instruct Q4_K_M GGUF (1.28 GB).** One JS code path for both machines. It ships prebuilt Vulkan/CUDA/CPU binaries for Windows and Metal binaries for macOS, so nobody has to compile anything. Smaller fallback: Qwen3.5-0.8B (Q4_K_M 0.53 GB).
- **Windows only:** the same stack. Use the Vulkan backend: CUDA won't load on Bennett's laptop without a CUDA Toolkit install (see below).
- **macOS only:** use the same stack if the app shell is Electron. If the shell is native Swift, Apple FoundationModels is an option: no model file to ship, and guided generation can return an enum. It has a real cost, though: Apple Intelligence must be on, and the probe got 2 of 4 wrong. **Bennett owns the runtime and is on Windows, so in a Mac-only build he can't run his own runtime.**
- **First-launch cost:** the 1.28 GB GGUF is bundled, so nothing downloads. Binaries add about 74 MB (Windows Vulkan) or about 15 MB (Mac Metal). Load time is about 1–3 s from SSD **[ESTIMATE, not measured]**. Call `context.warmup()` once at startup.

## Runtimes
| Option | Win10 19045 + A1000 | M4 | Separate install? | Network client? | Status |
|---|---|---|---|---|---|
| **node-llama-cpp 3.22.1** (2026-09-28, MIT) | Vulkan/CUDA/CPU prebuilt | Metal prebuilt | No | Only if you call its downloaders | **Pick** |
| llama-cpp-2 crate (0.1.159) for Tauri | needs Rust + clang + cmake build | yes | No | No | Out: Rust isn't installed and the build is slow |
| llama-server sidecar | yes | yes | No | **Yes, local HTTP** | Out |
| Ollama | yes | yes | **Yes** | **HTTP on localhost:11434** | Out |
| Apple FoundationModels | — | macOS 26+, Swift | No | No | Mac-only option |
| Phi Silica / Windows AI APIs | **No** (Windows 11 only) | — | — | — | Out |
| Foundry Local | the SDK downloads execution providers and models | yes | No | **Yes (downloads)** | Out |
| Transformers.js / WebLLM in the renderer | WebGPU | WebGPU in Safari 26 | No | Fetches models from a CDN/HF by default | Out: slower, more setup |

Sources and notes:
- **node-llama-cpp**
  - Prebuilt packages: win-x64, win-x64-cuda, win-x64-cuda-ext, win-x64-vulkan, mac-arm64-metal ([package.json](https://raw.githubusercontent.com/withcatai/node-llama-cpp/master/package.json)). Latest release v3.22.1 ([releases](https://github.com/withcatai/node-llama-cpp/releases/tag/v3.22.1)).
  - Electron: it runs **only in the main process**. Inside Electron, building from source defaults to `"never"`. Keep the native binaries out of the asar archive ([Electron guide](https://node-llama-cpp.withcat.ai/guide/electron), [LlamaOptions](https://node-llama-cpp.withcat.ai/api/type-aliases/LlamaOptions)).
  - CUDA: the prebuilt binaries need **CUDA Toolkit ≥12.4 installed** ([CUDA guide](https://node-llama-cpp.withcat.ai/guide/CUDA)). The win-x64-cuda package bundles no cudart/cublas DLLs ([file list](https://unpkg.com/@node-llama-cpp/win-x64-cuda@3.22.1/?meta)).
  - Vulkan: the Vulkan driver comes with the GPU driver on Windows ([Vulkan guide](https://node-llama-cpp.withcat.ai/guide/Vulkan)). So on Bennett's laptop, `gpu:"auto"` should fall through to Vulkan **[INFERENCE]**.
- **Bennett's GPU:** the RTX A1000 Laptop has **4 GB** GDDR6 at 176 GB/s ([TechPowerUp](https://www.techpowerup.com/gpu-specs/rtx-a1000-mobile.c3920)). Confirm with `nvidia-smi`.
- **Phi Silica:** needs a Copilot+ NPU or Windows 11 with an RTX 30-series card with 6+ GB VRAM. The GPU path also needs an Insider build 26300+ and a LAF token. It is being replaced by Aion Instruct ([Phi Silica](https://learn.microsoft.com/en-us/windows/ai/apis/phi-silica), [troubleshooting](https://learn.microsoft.com/en-us/windows/ai/apis/troubleshooting)).
- **Foundry Local:** [get-started guide](https://learn.microsoft.com/en-us/azure/foundry-local/get-started).
- **Ollama:** [API docs](https://raw.githubusercontent.com/ollama/ollama/main/docs/api.md).
- **llama-cpp-2:** needs clang/bindgen ([docs.rs](https://docs.rs/crate/llama-cpp-2/latest)).
- **FoundationModels:** availability depends on device and region support for Apple Intelligence ([SystemLanguageModel](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel)). Guided generation uses constrained sampling, and enums can be `@Generable` ([guided generation](https://developer.apple.com/documentation/foundationmodels/generating-swift-data-structures-with-guided-generation)). To call it from Electron, use a Swift CLI helper over stdio **[INFERENCE: standard pattern, not tested]**.
- **Browser runtimes:** Safari 26 has WebGPU ([WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). Transformers.js needs `env.allowRemoteModels=false` and local wasm paths to stay offline ([docs](https://huggingface.co/docs/transformers.js/custom_usage)).

## Models (Q4_K_M sizes from Hugging Face file listings)
| Model | Q4_K_M | License / obligations |
|---|---|---|
| **Qwen3.5-2B** | 1.28 GB ([unsloth](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF)) | Apache-2.0; **non-thinking by default** ([card](https://huggingface.co/Qwen/Qwen3.5-2B)) |
| Qwen3.5-0.8B / 4B | 0.53 / 2.74 GB | Apache-2.0 |
| Qwen3 0.6B / 1.7B / 4B | 0.48 / 1.28 / 2.50 GB ([bartowski](https://huggingface.co/bartowski/Qwen_Qwen3-1.7B-GGUF)) | Apache-2.0. Thinking is on by default: use `QwenChatWrapper({thoughts:"discourage"})` or `budgets.thoughtTokens` ([API](https://node-llama-cpp.withcat.ai/api/classes/QwenChatWrapper)) |
| Qwen2.5 1.5B / 3B | 0.99 / 1.93 GB | 1.5B Apache-2.0; **3B is Qwen-Research (non-commercial)** ([card](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct)) |
| Llama 3.2 1B / 3B | 0.81 / 2.02 GB | Llama 3.2 license: ship a copy of the license and show **“Built with Llama”** ([LICENSE](https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama3_2/LICENSE)) |
| Gemma 3 1B / 4B | 0.81 / 2.49 GB | Gemma Terms: ship the terms plus a NOTICE file, and follow the prohibited-use policy ([terms](https://ai.google.dev/gemma/terms)) |
| Gemma 3n E2B / E4B | 3.03 / 4.54 GB | Gemma Terms; too big |
| Gemma 4 E2B | Q6_K 3.9 GB | Apache-2.0 per the [node-llama-cpp blog](https://node-llama-cpp.withcat.ai/blog/v3.19-gemma-4); too big for 4 GB VRAM |
| Phi-4-mini | 2.49 GB | MIT |

**Latency for a ~200-token prompt plus ~20 output tokens.** All of these are estimates scaled by size from Llama-2-7B Q4_0 (3.56 GiB) benchmarks:
- **M4 (10-core GPU) Metal:** baseline is 221 t/s prompt processing and 24 t/s generation ([llama.cpp #4167](https://github.com/ggml-org/llama.cpp/discussions/4167)). For a 2B model: about 700 t/s prompt and 60 t/s generation, so **~0.6 s**.
- **A1000-class GPU:** baseline is an RTX 3050 6 GB (same GA107 chip) under CUDA at 1147 / 38 t/s ([#15013](https://github.com/ggml-org/llama.cpp/discussions/15013)). For a 2B model: **~0.3 s**. Vulkan will probably be slower **[unverified]**.
- **CPU only on the i5-12600HX:** **~2–3 s [unverified guess]**.

## Forcing exactly three labels
- **Best option:** the structured-decisions API added in v3.22.0 ([guide](https://node-llama-cpp.withcat.ai/guide/structured-decisions)). Call `model.createDecisionContext({contextSize:{max:1024}})`, then `.decide(doc, {label:{type:"choice", criteria:{serves:"…", drifts:"…", unclear:"…"}}})`. It returns a choice from the set plus `confidence`. Map low confidence to `unclear`; that fits the 0.80 precision rule. The guide recommends Qwen3.5-2B and 0.8B for this.
- **For the short reason:** add a second call using `llama.createGrammarForJsonSchema({type:"object", properties:{label:{enum:["serves","drifts","unclear"]}, reason:{type:"string"}}})` with `maxTokens:40` ([grammar guide](https://node-llama-cpp.withcat.ai/guide/grammar)).
- **On Mac:** a `@Generable enum` does the same job.

## Timeouts and fallback
- **Timeout:** pass an `AbortController` signal to `session.prompt` (`signal`, `stopOnAbortSignal`, `maxTokens`) ([options](https://node-llama-cpp.withcat.ai/api/type-aliases/LLamaChatPromptOptions)). Around `decide()`, use `Promise.race` with something like a 5 s budget. On timeout, store **unclear**, matching system-design §5.
- **GPU fallback:** with `gpu:"auto"`, it tries the GPU types from best to worst and uses the first prebuilt binary that works. `gpu:false` forces CPU. `InsufficientMemoryError` fires if the layers don't fit in VRAM, so catch it and retry with `gpuLayers` lowered or `gpu:false` ([LlamaOptions](https://node-llama-cpp.withcat.ai/api/type-aliases/LlamaOptions)). If nothing loads, use rules and memory and mark everything else unclear (idea.md).

## Privacy
Always load the model from a bundled `modelPath`. Never use `resolveModelFile("hf:…")` or `pull`. Keep `build:"never"` and `skipDownload:true`. The library still contains download code (the `ipull` dependency), but we never call it. Say this in the disclosure.

## Disclosure list
The hackathon rule asks us to disclose models, frameworks and APIs. List:
- Electron (MIT)
- node-llama-cpp (MIT), which wraps llama.cpp (MIT)
- Qwen3.5-2B (Apache-2.0, © Alibaba Qwen team); include the LICENSE file
- GGUF quantization by unsloth
- On Mac, if used: Apple FoundationModels

If we swap to Llama, add “Built with Llama”. If we swap to Gemma, add the NOTICE file.