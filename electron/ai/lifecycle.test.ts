import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {test} from "node:test";
import type * as Runtime from "./runtime.ts";
import type {Label} from "../../src/shared/types.ts";

test("model lifecycle failures preserve fallback and release native resources", {timeout: 10_000}, async (t) => {
    let filePresent = true;
    let failure: "load" | "warmup" | "decide" | "prompt" | null = null;
    let acquired: {disposed: boolean}[] = [];
    let loadGate: Promise<void> | null = null;
    let enteredLoad: (() => void) | null = null;
    const nativeFailure = new Error("Authored native failure");
    const originalRoot = process.env.APP_ROOT;
    process.env.APP_ROOT = "C:/ledger-lifecycle-test";
    t.after(() => {
        if (originalRoot == null)
            Reflect.deleteProperty(process.env, "APP_ROOT");
        else
            process.env.APP_ROOT = originalRoot;
    });
    t.mock.module("electron", {exports: {app: {isPackaged: false}}});
    t.mock.module("node:fs", {exports: {default: {existsSync: () => filePresent}}});
    t.mock.module("node-llama-cpp", {exports: {
        InsufficientMemoryError: class extends Error {},
        QwenChatWrapper: class {},
        LlamaChatSession: class {
            public resetChatHistory() {}

            public async prompt() {
                if (failure === "prompt")
                    throw nativeFailure;
                return JSON.stringify({label: "serves", reason: "Editing the intended document"});
            }
        },
        getLlama: async () => {
            const resource = {disposed: false};
            acquired.push(resource);
            return {
                dispose: async () => {
                    resource.disposed = true;
                },
                createGrammarForJsonSchema: async () => ({parse: (text: string) => JSON.parse(text)}),
                loadModel: async () => {
                    enteredLoad?.();
                    await loadGate;
                    if (failure === "load")
                        throw nativeFailure;
                    return {
                        createDecisionContext: async () => ({
                            warmup: async () => {
                                if (failure === "warmup")
                                    throw nativeFailure;
                            },
                            decide: async () => {
                                if (failure === "decide")
                                    throw nativeFailure;
                                return {label: {
                                    type: "choice", choice: "serves", confidence: 0.9,
                                    probabilities: {serves: 0.9, drifts: 0.08, unclear: 0.02}
                                }};
                            }
                        }),
                        createContext: async () => ({getSequence: () => ({})})
                    };
                }
            };
        }
    }});

    // Import after replacing the native loader, file probe, and Electron; no GGUF or Electron process is needed.
    const {loadJudge} = await import("./judge.ts");
    const {labelWindow} = await import("../harness/harness.ts");
    // Each URL owns fresh runtime state, including its one-shot runtimeSettled promise; the real judge stays shared.
    const runtimeFor = (name: string): Promise<typeof Runtime> =>
        import(new URL(`./runtime.ts?lifecycle=${name}`, import.meta.url).href);
    const session = {intention: "Draft the authored brief", targets: []};
    const word = {appName: "Microsoft Word", execName: "WINWORD", title: "Authored brief.docx", url: null};

    await t.test("missing, load, and warmup failures settle without disabling rules or learned memory", async (t) => {
        const db = new DatabaseSync(":memory:");
        t.after(() => db.close());
        db.exec("PRAGMA foreign_keys=ON");
        for (const name of ["001_init.sql", "002_visit_exec_name.sql", "003_memory_votes.sql"])
            db.exec(readFileSync(new URL(`../store/migrations/${name}`, import.meta.url), "utf8"));
        db.prepare("INSERT INTO memory (id, match_key, label, tap_count) VALUES ('learned-word', 'winword', 'drifts', 2)").run();
        const query = db.prepare("SELECT id, label FROM memory WHERE match_key = ? AND tap_count >= 2");
        const recall = (key: string): {id: string, label: Label} | null => {
            const row = query.get(key);
            if (row == null)
                return null;
            assert.ok(row.label === "serves" || row.label === "drifts");
            return {id: String(row.id), label: row.label};
        };
        for (const stage of ["missing", "load", "warmup"] as const) {
            await t.test(stage, async () => {
                filePresent = stage !== "missing";
                failure = stage === "missing" ? null : stage;
                acquired = [];
                const runtime = await runtimeFor(stage);
                let settled = false;
                void runtime.runtimeSettled.then(() => {
                    settled = true;
                });
                await runtime.startRuntime();
                assert.equal(settled, true, "unavailable models must release the waiting queue");
                if (stage === "missing")
                    assert.equal(runtime.runtimeStatus(), "missing-file");
                else
                    assert.ok(runtime.runtimeStatus().startsWith("failed:"));
                assert.equal(runtime.getJudge(), null);

                const residual = await labelWindow(session,
                    {appName: "Notepad", execName: "notepad.exe", title: "Authored notes", url: null}, recall, runtime.getJudge());
                assert.deepEqual(residual, {
                    source: "model", label: "drifts", memoryId: null, reason: null,
                    modelId: null, modelStage: null, latencyMs: null, confidence: null
                });
                const ruled = await labelWindow({...session, targets: [{target: "word", role: "work"}]},
                    word, recall, runtime.getJudge());
                assert.deepEqual([ruled.source, ruled.label, ruled.memoryId, ruled.modelId], ["rule", "serves", null, null]);
                const remembered = await labelWindow(session, word, recall, runtime.getJudge());
                assert.deepEqual([remembered.source, remembered.label, remembered.memoryId, remembered.modelId],
                    ["memory", "drifts", "learned-word", null]);
                assert.deepEqual(acquired.map((resource) => resource.disposed), stage === "missing" ? [] : [true],
                    "failed initialization must release everything owned by the acquired native runtime");
            });
        }
    });

    await t.test("native decide or prompt failure cannot turn partial model output into an asserted verdict", async (t) => {
        failure = null;
        acquired = [];
        const judge = await loadJudge("authored-model.gguf");
        t.after(() => judge.llama.dispose());
        for (const stage of ["decide", "prompt"] as const) {
            failure = stage;
            const result = await labelWindow(session, word, () => null, judge);
            assert.deepEqual([result.source, result.label, result.reason, result.latencyMs],
                stage === "decide" ? ["model", "drifts", null, null] : ["model", "serves", null, null]);
            assert.deepEqual([result.confidence, result.modelStage], stage === "decide" ? [null, null] : [0.9, "decide"]);
        }
    });

    await t.test("stopping during native load cannot publish or retain the late judge", async () => {
        filePresent = true;
        failure = null;
        acquired = [];
        const entered = new Promise<void>((resolve) => enteredLoad = resolve);
        let releaseLoad!: () => void;
        loadGate = new Promise<void>((resolve) => releaseLoad = resolve);
        const runtime = await runtimeFor("stop-during-load");
        const starting = runtime.startRuntime();
        await entered;
        const stopping = runtime.stopRuntime();
        releaseLoad();
        await Promise.all([starting, stopping, runtime.runtimeSettled]);
        assert.equal(runtime.getJudge(), null, "a late load must not resurrect the runtime after stop");
        assert.deepEqual(acquired.map((resource) => resource.disposed), [true]);
    });
});
