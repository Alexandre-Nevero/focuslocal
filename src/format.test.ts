import assert from "node:assert/strict";
import {test} from "node:test";
import {capital, clock, counted, countWord, duration, host, latency, minutes, modelStatusWord, outcomeWord, sourceWord} from "./format.ts";

// US-007 and BR-006: counts are words, and nothing formats a percent, a rate, or an hours headline.

test("counts up to twenty are words, zero is 'no'", () => {
    assert.equal(countWord(0), "no");
    assert.equal(countWord(1), "one");
    assert.equal(countWord(20), "twenty");
    assert.equal(countWord(21), "21");
});

test("counted pluralizes and capital starts a sentence", () => {
    assert.equal(counted(1, "block"), "one block");
    assert.equal(counted(4, "block"), "four blocks");
    assert.equal(counted(2, "stretch", "stretches"), "two stretches");
    assert.equal(capital(counted(0, "verdict")), "No verdicts");
});

test("durations are per-row lengths, never a percent", () => {
    assert.equal(duration(30_000), "under a minute");
    assert.equal(duration(6 * 60_000), "6 min");
    assert.equal(duration(60 * 60_000), "1 h");
    assert.equal(duration(65 * 60_000), "1 h 5 min");
    for (const ms of [0, 59_999, 3_600_000, 86_400_000])
        assert.doesNotMatch(duration(ms), /%|hours focused/);
});

test("figure-column totals keep zero exact", () => {
    assert.equal(minutes(0), "0 min");
    assert.equal(minutes(20_000), "<1 min");
    assert.equal(minutes(23 * 60_000), "23 min");
});

test("the clock shows elapsed time and never goes negative", () => {
    assert.equal(clock(-5000), "00:00");
    assert.equal(clock(47 * 60_000 + 4000), "47:04");
    assert.equal(clock(3_600_000 + 61_000), "1:01:01");
});

test("outcome words do not praise or scold (BR-002)", () => {
    assert.equal(outcomeWord("yes"), "Yes");
    assert.equal(outcomeWord("not_yet"), "Not yet");
    assert.equal(outcomeWord("unanswered"), "Unanswered");
    assert.equal(outcomeWord(null), "Unanswered");
    assert.equal(outcomeWord(null, true), "Running");
});

test("every verdict source has a plain phrase (US-004)", () => {
    assert.equal(sourceWord("rule"), "from your list");
    assert.equal(sourceWord("memory"), "from memory");
    assert.equal(sourceWord("model"), "from the on-device model");
    assert.equal(sourceWord("user"), "marked by you");
});

test("host strips www and survives junk", () => {
    assert.equal(host("https://www.youtube.com/watch?v=1"), "youtube.com");
    assert.equal(host("not a url"), null);
    assert.equal(host(null), null);
});


test("model status and latency read as plain words", () => {
    assert.equal(modelStatusWord("ready"), "Ready");
    assert.equal(modelStatusWord("loading"), "Getting ready");
    assert.equal(modelStatusWord("missing-file"), "Not available");
    assert.equal(modelStatusWord("failed:oom"), "Not available");
    assert.equal(latency(412.4), "412 ms");
    assert.equal(latency(1450), "1.4 s");
});
