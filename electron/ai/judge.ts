// The model stage (ADR-005, system-design §9 Harness step 3). No Electron imports: `npm run eval` loads this under
// ELECTRON_RUN_AS_NODE. Wording tuned on the dev set (spike/dev-cases.json), never on eval/fixtures.json.
import {
    getLlama, InsufficientMemoryError, LlamaChatSession, QwenChatWrapper, type Llama, type LlamaDecisionContext, type LlamaJsonSchemaGrammar
} from "node-llama-cpp";
import type {Label, ModelStage} from "../../src/shared/types.ts";

// ADR-003: one pinned local file, never resolved from the network at runtime. scripts/fetch-model.mjs puts it in models/.
export const MODEL_FILE = "Qwen3.5-2B-Q4_K_M.gguf";
export const MODEL_ID = "qwen3.5-2b-q4_k_m";

const BUDGET_MS = 10_000;

// Shared by the S1 criteria and the S2 system prompt. Keep this order: reversing it cost 2 of 43 dev cases.
const DEFINITIONS = {
    serves: "Work on this task: the file, tool, reference page, or message for it",
    drifts: "Not this task: entertainment, social media, games, shopping, news, or other work",
    unclear: "Generic window that could be either (new tab, file browser, chat list, calculator)"
};
const SYSTEM = "You check whether one desktop window is part of the work a person said they are doing. " +
    `Labels: serves = ${DEFINITIONS.serves}. drifts = ${DEFINITIONS.drifts}. unclear = ${DEFINITIONS.unclear}. ` +
    "Judge only whether the window is used for that work, not whether the work is finished. " +
    "Give a reason under 140 characters. Never repeat the window title or the URL in the reason.";

const reasonFirst = {
    type: "object",
    properties: {reason: {type: "string", maxLength: 140}, label: {enum: ["serves", "drifts", "unclear"]}}
} as const;

export type Judge = {
    llama: Llama,
    decision: LlamaDecisionContext,
    session: LlamaChatSession,
    grammar: LlamaJsonSchemaGrammar<typeof reasonFirst>
};

export type JudgedWindow = {appName: string, title: string | null, url: string | null};

export type ModelResult = {
    label: Label,
    confidence: number | null,
    reason: string | null,
    modelStage: ModelStage | null,
    latencyMs: number | null
};

async function load(modelPath: string, gpu: "auto" | false): Promise<Judge> {
    const llama = await getLlama({gpu, build: "never"});
    try {
        const model = await llama.loadModel({modelPath});
        const decision = await model.createDecisionContext({contextSize: {max: 1024}});
        const chat = await model.createContext({contextSize: 2048});
        const grammar = await llama.createGrammarForJsonSchema(reasonFirst);
        // The auto-resolved Qwen 3.5 wrapper opens a <think> segment that swallows the grammar's "{" (spike O1).
        const session = new LlamaChatSession({
            contextSequence: chat.getSequence(),
            chatWrapper: new QwenChatWrapper({variation: "3.5", thoughts: "discourage"}),
            systemPrompt: SYSTEM
        });
        return {llama, decision, session, grammar};
    } catch (err) {
        await llama.dispose();
        throw err;
    }
}

/**
 * Loads the model and runs one throwaway S1 + S2 pair: warmup() alone leaves the first choice decide() ~10 s cold on
 * Vulkan (spike O1). Retries once on CPU when the GPU is out of memory.
 */
export async function loadJudge(modelPath: string): Promise<Judge> {
    let judge: Judge;
    try {
        judge = await load(modelPath, "auto");
    } catch (err) {
        if (!(err instanceof InsufficientMemoryError))
            throw err;
        judge = await load(modelPath, false);
    }
    try {
        await judge.decision.warmup();
        await judgeWindow(judge, "sort the downloads folder", {appName: "File Explorer", title: "Downloads", url: null});
        return judge;
    } catch (err) {
        await judge.llama.dispose();
        throw err;
    }
}

const question = (intention: string) => `The person said they are working on: "${intention}". Is this window part of that work?`;
const windowDoc = (w: JudgedWindow) => `App: ${w.appName}\nTitle: ${(w.title ?? "").slice(0, 200)}\nURL: ${w.url ?? "none"}`;

/** S1 decide + S2 reason within one 10 s budget. Never throws: a failure is stored as unclear (BR-003). */
export async function judgeWindow(judge: Judge, intention: string, w: JudgedWindow): Promise<ModelResult> {
    const signal = AbortSignal.timeout(BUDGET_MS);
    const doc = windowDoc(w);
    const started = performance.now();
    let s1: {choice: Label, confidence: number} | null = null;
    try {
        const {label} = await judge.decision.decide(doc, {
            label: {type: "choice", instruction: question(intention), criteria: DEFINITIONS}
        }, {signal});
        s1 = {choice: label.choice, confidence: label.confidence};

        judge.session.resetChatHistory();
        const s2 = judge.grammar.parse(await judge.session.prompt(`${question(intention)}\n\n${doc}`, {
            grammar: judge.grammar, maxTokens: 80, signal
        }));

        const reason = s2.reason.trim().slice(0, 140);
        const leaks = [w.title, w.url].some((text) => text != null && text !== "" && reason.toLowerCase().includes(text.toLowerCase()));
        return {
            label: s1.choice === s2.label ? s1.choice : "unclear",
            confidence: s1.confidence,
            reason: leaks || reason === "" ? null : reason,
            modelStage: "reason",
            latencyMs: Math.round(performance.now() - started)
        };
    } catch {
        // Timeout or a parse failure: unclear. If S1 answered, keep its confidence and say S2 did not run.
        return {
            label: "unclear",
            confidence: s1?.confidence ?? null,
            reason: null,
            modelStage: s1 == null ? null : "decide",
            latencyMs: null
        };
    }
}
