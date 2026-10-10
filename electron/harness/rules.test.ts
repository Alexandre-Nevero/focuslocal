// `npm test`: node:test with Node's TypeScript type stripping.
import assert from "node:assert/strict";
import {test} from "node:test";
import {automaticLabel, ruleLabel, type WindowFacts} from "./rules.ts";
import {memoryKey} from "./memory.ts";

const word: WindowFacts = {appName: "Microsoft Word", execName: "WINWORD", title: "Acme brief.docx - Word", url: null};
const brave = (url: string | null, title = "Reels • Instagram - Brave"): WindowFacts => ({appName: "Brave Browser", execName: "brave", title, url});

test("automatic review labels need concrete work evidence and respect declared targets", () => {
    const session = {intention: "Draft the Acme brief", targets: []};
    assert.equal(automaticLabel(session, word), "serves");
    assert.equal(automaticLabel(session, brave(null, "New tab")), "drifts");
    assert.equal(automaticLabel({intention: "Write my work today", targets: []}, brave(null, "Work today")), "drifts");
    assert.equal(automaticLabel({intention: "", targets: []}, word), "drifts");
    assert.equal(automaticLabel({intention: "Draft Acme brief", targets: [{target: "winword", role: "distraction"}]}, word), "drifts");
    assert.equal(automaticLabel({intention: "", targets: [{target: "winword", role: "work"}]}, word), "serves");
    assert.equal(automaticLabel({intention: "Write Acme brief", targets: []}, brave(null, "Acmeish briefing")), "drifts");
});

test("app targets match the process name or a word of the app name", () => {
    assert.equal(ruleLabel([{target: "winword", role: "work"}], word), "serves");
    assert.equal(ruleLabel([{target: "word", role: "distraction"}], word), "drifts");
    assert.equal(ruleLabel([{target: "wor", role: "work"}], word), null);
});

test("site targets match the host or a subdomain, never a lookalike", () => {
    const yt = [{target: "youtube.com", role: "distraction"}] as const;
    assert.equal(ruleLabel(yt, brave("https://www.youtube.com/watch?v=1")), "drifts");
    assert.equal(ruleLabel(yt, brave("https://notyoutube.com/")), null);
    // No URL: the site's first label as a title word.
    assert.equal(ruleLabel(yt, brave(null, "lofi beats - YouTube - Brave")), "drifts");
    assert.equal(ruleLabel(yt, brave(null, "youtubers list.docx")), null);
});

test("a site match beats an app match", () => {
    assert.equal(ruleLabel([{target: "brave", role: "work"}, {target: "instagram.com", role: "distraction"}],
        brave("https://www.instagram.com/reels/")), "drifts");
});

test("memory keys: host, else process, never a bare browser", () => {
    assert.equal(memoryKey(brave("https://www.instagram.com/reels/")), "www.instagram.com");
    assert.equal(memoryKey(brave(null)), null);
    assert.equal(memoryKey({appName: "Microsoft Edge", execName: "msedge", title: "New tab", url: null}), null);
    assert.equal(memoryKey(word), "winword");
});
