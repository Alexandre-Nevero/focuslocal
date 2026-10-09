import assert from "node:assert/strict";
import {test} from "node:test";
import {acceptPresetAnswer, fillBlock, matchPreset} from "./presets.ts";

test("pitch deck matches the writing preset", () => {
    assert.equal(matchPreset("finish the client pitch deck"), "writing");
});

test("fillBlock merges the writing block list", () => {
    const block = fillBlock({
        intention: "finish the client pitch deck",
        savedBlock: [],
        work: [],
        preset: "writing"
    });
    assert.ok(block.includes("youtube.com"));
});

test("hosts named in the intention are not blocked", () => {
    const block = fillBlock({
        intention: "read instagram.com",
        savedBlock: ["instagram.com", "youtube.com"],
        work: [],
        preset: "writing"
    });
    assert.ok(!block.includes("instagram.com"));
    assert.ok(block.includes("youtube.com"));
});

test("acceptPresetAnswer rejects site names and accepts preset ids", () => {
    assert.equal(acceptPresetAnswer("youtube.com"), null);
    assert.equal(acceptPresetAnswer("writing"), "writing");
    assert.equal(acceptPresetAnswer("none"), "none");
});
