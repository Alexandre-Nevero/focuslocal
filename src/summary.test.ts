import assert from "node:assert/strict";
import {test} from "node:test";
import {driftedWindows, labelTotals, median, windowMs} from "./summary.ts";
import type {Label, Review, ReviewVisit} from "./shared/types.ts";

const t0 = Date.parse("2026-10-09T09:00:00Z");
const at = (min: number) => new Date(t0 + min * 60_000).toISOString();

function visit(id: string, from: number, to: number, shown: Label | null, app: string, url: string | null = null, kind: ReviewVisit["kind"] = "attention"): ReviewVisit {
    return {
        id, sessionId: "s", appName: app, windowTitle: null, url,
        startedAt: at(from), lastSeenAt: at(to), endedAt: at(to), kind, verdict: null, shown
    };
}

const review: Review = {
    session: {id: "s", intention: "Acme deck draft", analyzedIntent: null, startedAt: at(0), endedAt: at(30), outcome: null, targets: []},
    visits: [
        visit("a", 0, 12, "serves", "Keynote"),
        visit("b", 12, 18, "drifts", "Chrome", "https://www.youtube.com/watch?v=1"),
        visit("c", 18, 21, "drifts", "Slack"),
        visit("d", 21, 24, "drifts", "Chrome", "https://youtube.com/shorts/2"),
        visit("e", 24, 27, null, "Away", null, "away")
    ],
    unrecordedMs: 3 * 60_000
};

test("totals are absolute minutes per label and add up to the session's wall clock", () => {
    const totals = labelTotals([review]);
    const min = (ms: number) => ms / 60_000;
    assert.deepEqual(
        Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, min(v)])),
        {serves: 12, drifts: 12, unclear: 0, judging: 0, away: 3, unrecorded: 3}
    );
    assert.equal(min(windowMs(totals)), 24, "away and not recorded are not window time");
});

test("drifted windows group by site or app, longest first", () => {
    assert.deepEqual(driftedWindows([review]).map((w) => [w.name, w.ms / 60_000, w.visits]), [
        ["youtube.com", 9, 2],
        ["Slack", 3, 1]
    ]);
});

test("no reviews means no totals and no drifted windows", () => {
    assert.equal(windowMs(labelTotals([])), 0);
    assert.deepEqual(driftedWindows([]), []);
});


test("median of measured latencies handles odd, even, and empty", () => {
    assert.equal(median([900, 300, 500]), 500);
    assert.equal(median([400, 200, 600, 800]), 500);
    assert.equal(median([]), null);
});
