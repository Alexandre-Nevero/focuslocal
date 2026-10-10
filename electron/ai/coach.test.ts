import assert from "node:assert/strict";
import {test} from "node:test";
import {
    acceptIntent, coachPrompt, extractActions, gateReply, type LocalRecord
} from "./coach.ts";
import type {Review, ReviewVisit} from "../../src/shared/types.ts";

const emptyRecord: LocalRecord = {
    sessionCount: 0,
    yesCount: 0,
    notYetCount: 0,
    labelMs: {},
    repeatedReaches: [],
    blockHits: [],
    workList: ["docs.google.com"],
    blockList: ["instagram.com"]
};

const visit = (fields: Partial<ReviewVisit>): ReviewVisit => ({
    id: "v1",
    sessionId: "s1",
    appName: "Chrome",
    windowTitle: "Feed",
    url: "https://instagram.com/",
    startedAt: "2026-10-09T09:00:00Z",
    lastSeenAt: "2026-10-09T09:05:00Z",
    endedAt: "2026-10-09T09:05:00Z",
    kind: "attention",
    verdict: null,
    shown: "drifts",
    unsure: false,
    ...fields
} as ReviewVisit);

const review: Review = {
    session: {
        id: "s1",
        intention: "Finish the pitch deck",
        analyzedIntent: null,
        startedAt: "2026-10-09T09:00:00Z",
        endedAt: "2026-10-09T10:00:00Z",
        outcome: "not_yet",
        targets: []
    },
    visits: [visit({})],
    unrecordedMs: 60_000
};

test("the coach prompt includes a reach that appears on more than one session", () => {
    const record: LocalRecord = {
        ...emptyRecord,
        sessionCount: 4,
        repeatedReaches: ["instagram.com", "Slack"]
    };
    const prompt = coachPrompt(review, record);
    assert.ok(prompt.includes("Reached on more than one session: instagram.com, Slack"));
});

test("the number gate rejects 47 seconds from the reported corpus claim", () => {
    const reply = gateReply("People often switch screens after about 47 seconds.", review, emptyRecord);
    assert.equal(reply, "The coach could not answer from the record.");
});

test("extractActions keeps add-block for a reach not on the lists and drops an unknown action", () => {
    const record: LocalRecord = {...emptyRecord, workList: ["docs.google.com"], blockList: ["tiktok.com"]};
    const actions = extractActions(
        "You reached for it.\n[[add-block:reddit.com]]\n[[open-settings]]\n[[add-block:docs.google.com]]",
        record
    );
    assert.deepEqual(actions, [{type: "add-block", target: "reddit.com"}]);
});

test("acceptIntent strips a think block and keeps the first real line", () => {
    assert.equal(
        acceptIntent("<think>plan</think>\nFinish the pitch deck"),
        "Finish the pitch deck"
    );
});
