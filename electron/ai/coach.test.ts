import assert from "node:assert/strict";
import {test} from "node:test";
import type {LlamaModel} from "node-llama-cpp";

test("Coach grounds numbers and releases its separate context", async (t) => {
    let output = "The record shows writing in the editor.";
    let disposed = 0;
    let sessionDisposed = 0;
    t.mock.module("node-llama-cpp", {exports: {
        QwenChatWrapper: class {},
        LlamaChatSession: class {
            async prompt() {
                return output;
            }

            dispose() {
                sessionDisposed++;
            }
        }
    }});
    const {askCoach, CANNOT_ANSWER} = await import("./coach.ts");
    const model = {createContext: async () => ({
        getSequence: () => ({}), dispose: async () => {
            disposed++;
        }
    })} as unknown as LlamaModel;
    const record = {intention: "write essay in gdocs", visits: [{app: "Google Docs", duration: "2 minutes"}], counts: {serves: 1}};
    assert.equal(await askCoach(model, record, "What happened?", []), output);
    output = "The visit lasted 120,000 milliseconds.";
    assert.equal(await askCoach(model, record, "What happened?", []), CANNOT_ANSWER);
    output = "The record shows one visit to Google Docs labeled as serves, with a duration of 2 minutes.";
    assert.equal(await askCoach(model, record, "What happened?", []), output);
    output = "The record shows a visit to Google Docs, during which the app served the session for 120,000 milliseconds.";
    assert.equal(await askCoach(model, record, "What happened?", []), "The record shows a visit to Google Docs.");
    output = "There was one visit.";
    assert.equal(await askCoach(model, record, "What happened?", []), output);
    output = "There were 99 switches.";
    assert.equal(await askCoach(model, record, "What happened?", []), CANNOT_ANSWER);
    output = "There were ten switches.";
    assert.equal(await askCoach(model, record, "What happened?", []), CANNOT_ANSWER);
    output = "One thing I'd add is that the editor was used.";
    assert.equal(await askCoach(model, record, "What happened?", []), output);
    output = "Use [[start-block]] to begin.";
    assert.equal(await askCoach(model, record, "What happened?", []), CANNOT_ANSWER);
    output = "The record shows https://private.example/essay.";
    assert.equal(await askCoach(model, record, "What happened?", []), CANNOT_ANSWER);
    assert.equal(await askCoach(model, record, "Hello!", []), "Hi. What would you like to know about this block?");
    const timedRecord = {session: {timeByApp: {Writer: "2 minutes"}, away: "30 seconds", unrecorded: "5 seconds"}};
    assert.equal(await askCoach(model, timedRecord, "Where did my time go?", []),
        "Recorded app time for this block:\nWriter: 2 minutes.\nAway: 30 seconds.\nNot recorded: 5 seconds.");
    assert.equal(disposed, 10);
    assert.equal(sessionDisposed, 10);
});
