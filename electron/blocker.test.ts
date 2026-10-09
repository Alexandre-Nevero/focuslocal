import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {test} from "node:test";

test("blocker decisions, judge phase, and hit storage", async (t) => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
        CREATE TABLE block_hit (
            id TEXT NOT NULL PRIMARY KEY,
            session_id TEXT NOT NULL,
            target TEXT NOT NULL,
            kind TEXT NOT NULL,
            reached_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX uq_block_hit_once ON block_hit (session_id, target);
    `);
    t.mock.module("./store/db.ts", {exports: {getDb: () => db}});
    const {decision, hostsIn, judgeEnabled, recordHit} = await import("./blocker.ts");

    assert.equal(decision({
        target: "youtube.com",
        kind: "site",
        work: ["youtube.com"],
        block: ["instagram.com"],
        intention: ""
    }), "allow");
    assert.equal(decision({
        target: "instagram.com",
        kind: "site",
        work: [],
        block: ["instagram.com"],
        intention: ""
    }), "block");

    assert.deepEqual(hostsIn("Post to instagram.com before lunch"), ["instagram.com"]);
    assert.equal(decision({
        target: "www.instagram.com",
        kind: "site",
        work: [],
        block: ["instagram.com"],
        intention: "Post to instagram.com before lunch"
    }), "allow");

    assert.equal(judgeEnabled("work"), true);
    assert.equal(judgeEnabled("break"), false);
    assert.equal(judgeEnabled(null), true);
    assert.equal(decision({
        target: "twitter.com",
        kind: "site",
        work: [],
        block: ["twitter.com"],
        intention: ""
    }), "block");

    recordHit("sess-1", "youtube.com", "site");
    recordHit("sess-1", "youtube.com", "site");
    const count = db.prepare("SELECT COUNT(*) AS n FROM block_hit").get() as {n: number};
    assert.equal(count.n, 1);
});
