import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {test} from "node:test";
import {labelWindow} from "../harness/harness.ts";
import type {Label} from "../../src/shared/types.ts";

test("legacy aggregate memory loses eligibility without losing historical labels", async (t) => {
    const db = new DatabaseSync(":memory:");
    t.after(() => db.close());
    db.exec("PRAGMA foreign_keys=ON");
    const migrate = (name: string) => db.exec(readFileSync(new URL(`./migrations/${name}`, import.meta.url), "utf8"));
    migrate("001_init.sql");
    migrate("002_visit_exec_name.sql");
    db.prepare("INSERT INTO session (id, intention, started_at, ended_at) VALUES ('legacy', '', ?, ?)")
        .run("2026-10-09T12:00:00Z", "2026-10-09T12:01:00Z");
    db.exec("INSERT INTO memory (id, match_key, label, tap_count) VALUES ('old-memory', 'notepad', 'drifts', 2)");
    db.prepare(`INSERT INTO visit (id, session_id, app_name, exec_name, started_at, last_seen_at, ended_at, kind)
        VALUES ('old-visit', 'legacy', 'Notepad', 'notepad.exe', ?, ?, ?, 'attention')`)
        .run("2026-10-09T12:00:00Z", "2026-10-09T12:01:00Z", "2026-10-09T12:01:00Z");
    db.exec(`INSERT INTO verdict (id, visit_id, memory_id, source, label)
        VALUES ('old-verdict', 'old-visit', 'old-memory', 'memory', 'drifts')`);
    const past = db.prepare("SELECT visit_id, memory_id, source, label FROM verdict").all();
    migrate("003_memory_votes.sql");
    assert.deepEqual(db.prepare("SELECT visit_id, memory_id, source, label FROM verdict").all(), past);
    const recall = (key: string): {id: string, label: Label} | null => {
        const row = db.prepare("SELECT id, label FROM memory WHERE match_key = ? AND tap_count >= 2").get(key);
        if (!row)
            return null;
        assert.ok(row.label === "serves" || row.label === "drifts");
        return {id: String(row.id), label: row.label};
    };
    const next = await labelWindow({intention: "Finish the authored note", targets: []},
        {appName: "Notepad", execName: "notepad.exe", title: "Authored note", url: null}, recall, null);
    assert.deepEqual([next.source, next.label, next.memoryId], ["model", "unclear", null]);
});
