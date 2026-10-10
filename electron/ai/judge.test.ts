import assert from "node:assert/strict";
import {test} from "node:test";
import {storedLabel} from "./judge.ts";

test("storedLabel keeps serves and drifts", () => {
    assert.equal(storedLabel("serves", null), "serves");
    assert.equal(storedLabel("drifts", null), "drifts");
});

test("storedLabel resolves unclear from the stronger binary score", () => {
    const probs = {serves: 0.4, drifts: 0.55, unclear: 0.05};
    assert.equal(storedLabel("unclear", probs), "drifts");
    assert.equal(storedLabel("unclear", {serves: 0.6, drifts: 0.35, unclear: 0.05}), "serves");
});

test("storedLabel defaults unclear to drifts without scores", () => {
    assert.equal(storedLabel("unclear", null), "drifts");
});
