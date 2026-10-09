import fs from "node:fs";
import path from "node:path";
import {app} from "electron";
import {loadJudge, MODEL_FILE, type Judge} from "./judge.ts";
import type {ModelStatus} from "../../src/shared/types.ts";

let status: ModelStatus = "loading";
let judge: Judge | null = null;
let settle: () => void;
/** Resolves once loading ends, ready or not. Harness waits on it so visits closed during load are not stored unclear. */
export const runtimeSettled = new Promise<void>((resolve) => settle = resolve);

export const runtimeStatus = () => status;
export const getJudge = () => judge;

const modelPath = () => (app.isPackaged
    ? path.join(process.resourcesPath, "models", MODEL_FILE)
    : path.join(process.env.APP_ROOT, "models", MODEL_FILE));

/** Loads in the background. Start, End, and the review never wait on it (US-001); if it fails, Harness stores unclear (BR-003). */
export async function startRuntime() {
    try {
        if (!fs.existsSync(modelPath()))
            status = "missing-file";
        else {
            judge = await loadJudge(modelPath());
            status = "ready";
        }
    } catch (err) {
        status = `failed:${err instanceof Error ? err.message : String(err)}`;
    } finally {
        settle();
    }
}

export async function stopRuntime() {
    await judge?.llama.dispose();
    judge = null;
}
