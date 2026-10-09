import assert from "node:assert/strict";
import {test} from "node:test";
import {buildSegments, variantOf} from "./trace-model.ts";
import type {Label, Review, ReviewVisit} from "./shared/types.ts";

const t0 = Date.parse("2026-10-10T09:00:00Z");
const at = (min: number) => new Date(t0 + min * 60_000).toISOString();

function visit(id: string, from: number, to: number, shown: Label | null, kind: ReviewVisit["kind"] = "attention"): ReviewVisit {
    return {
        id, sessionId: "s", appName: "App", windowTitle: null, url: null,
        startedAt: at(from), lastSeenAt: at(to), endedAt: at(to), kind, verdict: null, shown
    };
}

function review(visits: ReviewVisit[], endMin: number | null): Review {
    return {
        session: {id: "s", intention: "", startedAt: at(0), endedAt: endMin == null ? null : at(endMin), outcome: null, targets: []},
        visits,
        unrecordedMs: 0
    };
}

test("variants come from the shown label, away, or judging", () => {
    assert.equal(variantOf(visit("a", 0, 1, "serves")), "serves");
    assert.equal(variantOf(visit("a", 0, 1, "unclear")), "unclear");
    assert.equal(variantOf(visit("a", 0, 1, null)), "judging");
    assert.equal(variantOf(visit("a", 0, 1, "drifts", "away")), "away");
});

test("uncovered wall-clock time becomes hatched segments, not a window's time (US-010)", () => {
    const segments = buildSegments(review([visit("a", 2, 10, "serves"), visit("b", 15, 20, "drifts")], 25));
    assert.deepEqual(segments.map((s) => [s.variant, s.ms / 60_000]), [
        ["unrecorded", 2],
        ["serves", 8],
        ["unrecorded", 5],
        ["drifts", 5],
        ["unrecorded", 5]
    ]);
    assert.equal(segments.reduce((sum, s) => sum + s.ms, 0), 25 * 60_000, "the strip covers the whole block");
});

test("visits are ordered by start and overlaps are not double counted", () => {
    const segments = buildSegments(review([visit("late", 10, 20, "serves"), visit("early", 0, 12, "drifts")], 20));
    assert.deepEqual(segments.map((s) => [s.visitId, s.ms / 60_000]), [["early", 12], ["late", 8]]);
});

test("an empty block is one stretch of not recorded", () => {
    assert.deepEqual(buildSegments(review([], 30)).map((s) => s.variant), ["unrecorded"]);
});

test("a running block runs to now", () => {
    const segments = buildSegments(review([visit("a", 0, 5, "serves")], null), t0 + 9 * 60_000);
    assert.deepEqual(segments.map((s) => [s.variant, s.ms / 60_000]), [["serves", 5], ["unrecorded", 4]]);
});
