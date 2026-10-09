// Rules → memory → model (ADR-002). No Electron imports: `npm run eval` runs this same function on the fixtures.
import {judgeWindow, MODEL_ID, type Judge} from "../ai/judge.ts";
import {ruleLabel, type WindowFacts} from "./rules.ts";
import {memoryKey} from "./memory.ts";
import type {DeclaredTarget, Label, ModelStage, Source} from "../../src/shared/types.ts";

export type Labelled = {
    source: Source,
    label: Label,
    memoryId: string | null,
    reason: string | null,
    modelId: string | null,
    modelStage: ModelStage | null,
    latencyMs: number | null,
    confidence: number | null
};

const none = {memoryId: null, reason: null, modelId: null, modelStage: null, latencyMs: null, confidence: null};

/**
 * `recall` returns a memory row only at tap_count >= 2 (BR-004). `judge` is null when the model is missing or failed to
 * load: the model stage then stores unclear (BR-003).
 */
export async function labelWindow(
    session: {intention: string, targets: readonly DeclaredTarget[]},
    w: WindowFacts,
    recall: (key: string) => {id: string, label: Label} | null,
    judge: Judge | null
): Promise<Labelled> {
    const rule = ruleLabel(session.targets, w);
    if (rule != null)
        return {...none, source: "rule", label: rule};

    const key = memoryKey(w);
    const remembered = key == null ? null : recall(key);
    if (remembered != null)
        return {...none, source: "memory", label: remembered.label, memoryId: remembered.id};

    if (session.intention === "" || judge == null)
        return {...none, source: "model", label: "unclear"};

    return {...none, source: "model", modelId: MODEL_ID, ...await judgeWindow(judge, session.intention, w)};
}
