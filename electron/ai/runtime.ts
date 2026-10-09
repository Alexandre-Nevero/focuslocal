import fs from "node:fs";
import path from "node:path";
import {app} from "electron";
import {getLlama, InsufficientMemoryError, type Llama, type LlamaContext, type LlamaDecisionContext, type LlamaModel} from "node-llama-cpp";
import type {ModelStatus} from "../../src/shared/types.ts";

// ADR-003: one pinned local file, never resolved from the network at runtime. scripts/fetch-model.mjs puts it in models/.
const MODEL_FILE = "Qwen3.5-2B-Q4_K_M.gguf";
export const MODEL_ID = "qwen3.5-2b-q4_k_m";

export type Runtime = {
    llama: Llama,
    model: LlamaModel,
    /** S1: choice decisions. */
    decision: LlamaDecisionContext,
    /** S2: the JSON-grammar reason prompt. */
    chat: LlamaContext
};

let status: ModelStatus = "loading";
let runtime: Runtime | null = null;

export const runtimeStatus = () => status;
export const getRuntime = () => runtime;

const modelPath = () => (app.isPackaged
    ? path.join(process.resourcesPath, "models", MODEL_FILE)
    : path.join(process.env.APP_ROOT, "models", MODEL_FILE));

async function load(gpu: "auto" | false): Promise<Runtime> {
    const llama = await getLlama({gpu, build: "never"});
    try {
        const model = await llama.loadModel({modelPath: modelPath()});
        const decision = await model.createDecisionContext({contextSize: {max: 1024}});
        const chat = await model.createContext({contextSize: 2048});
        await decision.warmup();
        return {llama, model, decision, chat};
    } catch (err) {
        await llama.dispose();
        throw err;
    }
}

/** Loads in the background. Start, End, and the review never wait on it (US-001); until it is ready Harness stores unclear (BR-003). */
export async function startRuntime() {
    if (!fs.existsSync(modelPath())) {
        status = "missing-file";
        return;
    }
    try {
        try {
            runtime = await load("auto");
        } catch (err) {
            if (!(err instanceof InsufficientMemoryError))
                throw err;
            runtime = await load(false);
        }
        status = "ready";
    } catch (err) {
        status = `failed:${err instanceof Error ? err.message : String(err)}`;
    }
}

export async function stopRuntime() {
    await runtime?.llama.dispose();
    runtime = null;
}
