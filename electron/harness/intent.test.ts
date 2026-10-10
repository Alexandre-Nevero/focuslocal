import assert from "node:assert/strict";
import {test} from "node:test";
import {labelWindow} from "./harness.ts";
import type {Judge} from "../ai/judge.ts";
import type {Label} from "../../src/shared/types.ts";
import type {WindowFacts} from "./rules.ts";

const word: WindowFacts = {appName: "Microsoft Word", execName: "WINWORD", title: "Acme brief.docx - Word", url: null};
const plain: WindowFacts = {appName: "Notepad", execName: "notepad.exe", title: "notes.txt", url: null};

function recordingJudge(): {judge: Judge, intentions: string[]} {
    const intentions: string[] = [];
    const judge = {
        llama: {},
        decision: {
            decide: async (_doc: string, opts: {label: {instruction: string}}) => {
                const match = /working on: "((?:\\"|[^"])*)"\./.exec(opts.label.instruction);
                intentions.push(match != null ? match[1]!.replace(/\\"/g, "\"") : opts.label.instruction);
                return {label: {choice: "serves" as Label, confidence: 0.9}};
            }
        },
        session: {
            resetChatHistory: () => {},
            prompt: async () => "{\"reason\":\"on task\",\"label\":\"serves\"}"
        },
        grammar: {
            parse: (raw: string) => JSON.parse(raw) as {reason: string, label: Label}
        }
    } as unknown as Judge;
    return {judge, intentions};
}

test("a rule match does not call task", async () => {
    let called = false;
    const {judge, intentions} = recordingJudge();
    const result = await labelWindow(
        {intention: "Finish the brief", targets: [{target: "winword", role: "work"}]},
        word,
        () => null,
        judge,
        async () => {
            called = true;
            return "restated work";
        }
    );
    assert.equal(called, false);
    assert.equal(intentions.length, 0);
    assert.deepEqual([result.source, result.label], ["rule", "serves"]);
});

test("a memory match does not call task", async () => {
    let called = false;
    const {judge, intentions} = recordingJudge();
    const result = await labelWindow(
        {intention: "Finish the brief", targets: []},
        word,
        (key) => (key === "winword" ? {id: "mem-1", label: "drifts"} : null),
        judge,
        async () => {
            called = true;
            return "restated work";
        }
    );
    assert.equal(called, false);
    assert.equal(intentions.length, 0);
    assert.deepEqual([result.source, result.label, result.memoryId], ["memory", "drifts", "mem-1"]);
});

test("the model stage receives the restated string when task resolves to a non-empty reading", async () => {
    const {judge, intentions} = recordingJudge();
    await labelWindow(
        {intention: "Finish the brief", targets: []},
        plain,
        () => null,
        judge,
        async () => "Ship the quarterly report"
    );
    assert.deepEqual(intentions, ["Ship the quarterly report"]);
});

test("a throwing task leaves the typed sentence", async () => {
    const {judge, intentions} = recordingJudge();
    await labelWindow(
        {intention: "Finish the brief", targets: []},
        plain,
        () => null,
        judge,
        async () => {
            throw new Error("coach unavailable");
        }
    );
    assert.deepEqual(intentions, ["Finish the brief"]);
});

test("a blank task leaves the typed sentence", async () => {
    const {judge, intentions} = recordingJudge();
    await labelWindow(
        {intention: "Finish the brief", targets: []},
        plain,
        () => null,
        judge,
        async () => null
    );
    assert.deepEqual(intentions, ["Finish the brief"]);
    intentions.length = 0;
    await labelWindow(
        {intention: "Finish the brief", targets: []},
        plain,
        () => null,
        judge,
        async () => ""
    );
    assert.deepEqual(intentions, ["Finish the brief"]);
    intentions.length = 0;
    await labelWindow(
        {intention: "Finish the brief", targets: []},
        plain,
        () => null,
        judge,
        async () => "   "
    );
    assert.deepEqual(intentions, ["Finish the brief"]);
});

test("an empty intention does not call task and the model label is drifts", async () => {
    let called = false;
    const {judge, intentions} = recordingJudge();
    const result = await labelWindow(
        {intention: "", targets: []},
        plain,
        () => null,
        judge,
        async () => {
            called = true;
            return "restated work";
        }
    );
    assert.equal(called, false);
    assert.equal(intentions.length, 0);
    assert.deepEqual(result, {
        source: "model",
        label: "drifts",
        memoryId: null,
        reason: null,
        modelId: null,
        modelStage: null,
        latencyMs: null,
        confidence: null
    });
});
