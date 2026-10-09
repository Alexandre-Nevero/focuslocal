import assert from "node:assert/strict";
import {test} from "node:test";
import {lengthMin, phaseAt, PRESET_25_5, PRESET_50_10, trayWord} from "./cycle.ts";

const MS_PER_MIN = 60_000;

test("25/5 with count 2 is 55 minutes", () => {
    const plan = PRESET_25_5(2);
    assert.equal(lengthMin(plan), 55);
});

test("preset count must be 1 through 8", () => {
    assert.throws(() => PRESET_25_5(0), RangeError);
    assert.throws(() => PRESET_50_10(9), RangeError);
    assert.equal(PRESET_50_10(1).workMin, 50);
});

test("phaseAt on timed plan: work at start, break in first rest, done after length", () => {
    const plan = PRESET_25_5(2);

    assert.deepEqual(phaseAt(plan, 0), {phase: "work", done: false});
    assert.deepEqual(phaseAt(plan, 24 * MS_PER_MIN), {phase: "work", done: false});
    assert.deepEqual(phaseAt(plan, 25 * MS_PER_MIN), {phase: "break", done: false});
    assert.deepEqual(phaseAt(plan, 29 * MS_PER_MIN), {phase: "break", done: false});
    assert.deepEqual(phaseAt(plan, 30 * MS_PER_MIN), {phase: "work", done: false});
    assert.deepEqual(phaseAt(plan, 54 * MS_PER_MIN), {phase: "work", done: false});
    assert.deepEqual(phaseAt(plan, 55 * MS_PER_MIN), {phase: "work", done: true});
    assert.deepEqual(phaseAt(plan, 60 * MS_PER_MIN), {phase: "work", done: true});
});

test("zero-length break stays in work", () => {
    const plan = {kind: "timed" as const, workMin: 10, breakMin: 0, count: 3};
    assert.equal(lengthMin(plan), 30);
    assert.deepEqual(phaseAt(plan, 10 * MS_PER_MIN), {phase: "work", done: false});
    assert.deepEqual(phaseAt(plan, 20 * MS_PER_MIN), {phase: "work", done: false});
});

test("open plan is always work and never done", () => {
    const plan = {kind: "open" as const};
    assert.deepEqual(phaseAt(plan, 0), {phase: "work", done: false});
    assert.deepEqual(phaseAt(plan, 1_000_000 * MS_PER_MIN), {phase: "work", done: false});
});

test("trayWord", () => {
    assert.equal(trayWord({phase: "work", asking: false}), "work");
    assert.equal(trayWord({phase: "break", asking: false}), "break");
    assert.equal(trayWord({phase: null, asking: false}), "work");
    assert.equal(trayWord({phase: "work", asking: true}), "?");
    assert.equal(trayWord({phase: "break", asking: true}), "?");
    assert.equal(trayWord({phase: null, asking: true}), "?");
});
