import fs from "node:fs";
import path from "node:path";
import {app} from "electron";
import {loadJudge, MODEL_FILE, type Judge} from "./judge.ts";
import type {ModelStatus} from "../../src/shared/types.ts";

let status: ModelStatus = "loading";
let judge: Judge | null = null;
let started = false;
let stopping = false;
let settle: () => void;
/** Resolves once loading ends, ready or not. Harness waits on it so visits closed during load are not stored unclear. */
export const runtimeSettled = new Promise<void>((resolve) => settle = resolve);

export const runtimeStatus = () => status;
export const getJudge = () => judge;

const modelPath = () => (app.isPackaged
    ? path.join(process.resourcesPath, "models", MODEL_FILE)
    : path.join(process.env.APP_ROOT, "models", MODEL_FILE));

export function modelsDir() {
    return path.dirname(modelPath());
}

/** Loads in the background. Start, End, and the review never wait on it (US-001); if it fails, Harness stores unclear (BR-003). */
export async function startRuntime() {
    started = true;
    try {
        if (stopping)
            return;
        if (!fs.existsSync(modelPath()))
            status = "missing-file";
        else {
            const loaded = await loadJudge(modelPath());
            if (stopping)
                await loaded.llama.dispose();
            else {
                judge = loaded;
                status = "ready";
            }
        }
    } catch (err) {
        status = `failed:${err instanceof Error ? err.message : String(err)}`;
    } finally {
        settle();
    }
}

export async function stopRuntime() {
    stopping = true;
    if (started)
        await runtimeSettled;
    const loaded = judge;
    judge = null;
    await loaded?.llama.dispose();
}
