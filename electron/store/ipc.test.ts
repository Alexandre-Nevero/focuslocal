import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import fs, {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {test} from "node:test";
import type {Review} from "../../src/shared/types.ts";

test("review taps and privacy preserve the local record lifecycle", async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "ledger-ipc-"));
    const file = join(directory, "ledger.db");
    const widget = join(directory, "widget.txt");
    let db: DatabaseSync | null = null;
    const closeDb = () => {
        db?.close();
        db = null;
    };
    t.after(() => {
        closeDb();
        rmSync(directory, {recursive: true, force: true});
    });
    // Store's import.meta.glob is Vite-only; keep SQLite, on-disk files and the actual migrations real.
    const getDb = () => {
        if (db != null)
            return db;
        db = new DatabaseSync(file);
        db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=2000");
        db.exec("CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
        for (const name of ["001_init.sql", "002_visit_exec_name.sql", "003_memory_votes.sql"]) {
            if (db.prepare("SELECT name FROM schema_migration WHERE name = ?").get(name))
                continue;
            db.exec(readFileSync(new URL(`./migrations/${name}`, import.meta.url), "utf8"));
            db.prepare("INSERT INTO schema_migration VALUES (?, ?)").run(name, "2026-10-09T12:00:00Z");
        }
        return db;
    };
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();
    t.mock.module("electron", {exports: {
        ipcMain: {
            on: () => {},
            handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => handlers.set(channel, handler)
        },
        BrowserWindow: {getAllWindows: () => []},
        systemPreferences: {},
        powerMonitor: new EventEmitter()
    }});
    t.mock.module("@miniben90/x-win", {exports: {activeWindow: () => {
        throw new Error("These review-only tests must not capture a desktop");
    }}});
    t.mock.module("./db.ts", {exports: {getDb, closeDb}});
    t.mock.module("../paths.ts", {exports: {
        ledgerDir: () => directory, dbPath: () => file, widgetFilePath: () => widget
    }});
    t.mock.module("../windows.ts", {exports: {
        openMain: () => {}, toggleMiniWindow: () => {}, ROUTE_PATTERN: /^(home|history|privacy)$/
    }});
    t.mock.module("../ai/runtime.ts", {exports: {
        runtimeStatus: () => "missing-file", getJudge: () => null, getModel: () => null, runtimeSettled: Promise.resolve()
    }});
    t.mock.module("../ai/judge.ts", {exports: {
        MODEL_ID: "test-local-model", judgeWindow: () => {
            throw new Error("These tests must not call a model");
        }
    }});
    // Import after installing the native/window/model seams so no desktop or user store can be reached.
    const {registerIpc} = await import("../ipc.ts");
    const {labelWindow} = await import("../harness/harness.ts");
    registerIpc();
    const invoke = (channel: string, ...args: unknown[]) => {
        const handler = handlers.get(channel);
        assert.ok(handler, `Missing handler ${channel}`);
        return handler(undefined, ...args);
    };
    const seed = () => {
        const store = getDb();
        store.exec("DELETE FROM session; DELETE FROM memory");
        store.prepare("INSERT INTO session (id, intention, started_at, ended_at) VALUES (?, ?, ?, ?)")
            .run("review", "Write an authored note", "2026-10-09T12:00:00Z", "2026-10-09T12:03:00Z");
        for (const id of ["first", "second", "later"])
            store.prepare(`INSERT INTO visit (id, session_id, app_name, exec_name, window_title, started_at, last_seen_at, ended_at, kind)
                VALUES (?, 'review', 'Notepad', 'notepad.exe', 'Authored note', '2026-10-09T12:00:00Z',
                    '2026-10-09T12:01:00Z', '2026-10-09T12:01:00Z', 'attention')`).run(id);
    };
    const remember = () => labelWindow(
        {intention: "Write an authored note", targets: []},
        {appName: "Notepad", execName: "notepad.exe", title: "Another authored note", url: null},
        (key) => {
            const row = getDb().prepare("SELECT id, label FROM memory WHERE match_key = ? AND tap_count >= 2")
                .get(key);
            if (row == null)
                return null;
            assert.ok(row.label === "serves" || row.label === "drifts");
            return {id: String(row.id), label: row.label};
        },
        null
    );
    const memory = () => getDb().prepare("SELECT label, tap_count FROM memory WHERE match_key = 'notepad'")
        .get();
    const verdicts = () => getDb().prepare("SELECT visit_id, source, label FROM verdict ORDER BY visit_id")
        .all();

    await t.test("review decides unresolved rows automatically and corrections remain optional", () => {
        seed();
        const store = getDb();
        store.prepare("INSERT INTO verdict (id, visit_id, source, label, confidence) VALUES ('unknown', 'first', 'model', 'unclear', NULL)").run();
        store.prepare("INSERT INTO verdict (id, visit_id, source, label, confidence) VALUES ('unverified', 'second', 'model', 'serves', 0.9)").run();
        store.prepare("UPDATE visit SET window_title = 'New tab' WHERE id = 'second'").run();
        const review = invoke("review.get", "review") as Review;
        assert.deepEqual(review.visits.map((v) => [v.id, v.shown, v.shownSource]), [
            ["first", "serves", "rule"], ["second", "drifts", "rule"], ["later", "serves", "rule"]
        ]);
        assert.equal(review.visits[0]?.verdict?.label, "unclear", "keep original model evidence");
        store.prepare("INSERT INTO setting (key, value) VALUES ('tau', '0.8')").run();
        const verified = invoke("review.get", "review") as Review;
        assert.equal(verified.visits.find((v) => v.id === "second")?.shown, "serves");
        store.prepare("UPDATE verdict SET confidence = 0.2 WHERE visit_id = 'second'").run();
        assert.equal((invoke("review.get", "review") as Review).visits.find((v) => v.id === "second")?.shown, "drifts");
        invoke("review.tap", "first", "drifts");
        invoke("review.tap", "second", "serves");
        store.prepare("UPDATE visit SET kind = 'away' WHERE id = 'later'").run();
        const corrected = invoke("review.get", "review") as Review;
        assert.deepEqual(corrected.visits.map((v) => [v.id, v.shown, v.shownSource]), [
            ["first", "drifts", "user"], ["second", "serves", "user"], ["later", null, null]
        ]);
        store.prepare("DELETE FROM setting WHERE key = 'tau'").run();
    });

    await t.test("repeating one visit's tap cannot teach memory", async () => {
        seed();
        invoke("review.tap", "first", "serves");
        invoke("review.tap", "first", "serves");
        const next = await remember();
        assert.equal(next.source, "model");
        assert.equal(next.label, "unclear");
        assert.equal(memory()?.tap_count, 1);
        const review = invoke("review.get", "review") as Review;
        const visit = review.visits.find((v) => v.id === "first");
        assert.equal(visit?.shown, "serves");
        assert.equal(visit?.verdict?.source, "user");
    });

    await t.test("distinct visits teach memory and a conflicting tap resets support", async () => {
        seed();
        invoke("review.tap", "first", "serves");
        assert.equal((await remember()).source, "model");
        invoke("review.tap", "second", "serves");
        const learned = await remember();
        assert.equal(learned.source, "memory");
        assert.equal(learned.label, "serves");
        assert.equal(memory()?.tap_count, 2);
        invoke("review.tap", "second", "drifts");
        assert.equal(memory()?.label, "drifts");
        assert.equal(memory()?.tap_count, 1);
        assert.equal((await remember()).source, "model");
        invoke("review.tap", "later", "drifts");
        const relearned = await remember();
        assert.equal(relearned.source, "memory");
        assert.equal(relearned.label, "drifts");
        assert.deepEqual(verdicts().map((v) => [v.visit_id, v.source, v.label]), [
            ["first", "user", "serves"], ["later", "user", "drifts"], ["second", "user", "drifts"]
        ]);
    });

    await t.test("dropping memory retains past user and memory verdict labels", async () => {
        seed();
        invoke("review.tap", "first", "serves");
        invoke("review.tap", "second", "serves");
        const learned = await remember();
        assert.equal(learned.source, "memory");
        getDb().prepare("INSERT INTO verdict (id, visit_id, memory_id, source, label) VALUES ('remembered', 'later', ?, ?, ?)")
            .run(learned.memoryId, learned.source, learned.label);
        const before = verdicts();
        invoke("privacy.dropMemory");
        assert.equal(getDb().prepare("SELECT count(*) AS n FROM memory")
            .get()?.n, 0);
        assert.deepEqual(verdicts(), before);
        assert.equal(getDb().prepare("SELECT memory_id FROM verdict WHERE id = 'remembered'")
            .get()?.memory_id, null);
        assert.equal((await remember()).source, "model");
    });

    await t.test("forgetting and conflicting corrections allow distinct visits to teach again", async () => {
        seed();
        invoke("review.tap", "first", "serves");
        invoke("review.tap", "second", "serves");
        invoke("privacy.dropMemory");
        invoke("review.tap", "first", "serves");
        invoke("review.tap", "first", "serves");
        assert.equal(memory()?.tap_count, 1);
        assert.equal((await remember()).source, "model");
        invoke("review.tap", "second", "serves");
        assert.equal((await remember()).source, "memory");
        invoke("review.tap", "first", "drifts");
        invoke("review.tap", "first", "serves");
        invoke("review.tap", "second", "serves");
        assert.equal(memory()?.tap_count, 2);
        assert.equal((await remember()).source, "memory");
    });

    await t.test("delete retries exclude reads and new sessions and coalesce repeated requests", async () => {
        seed();
        let locked = true;
        const remove = fs.rmSync;
        const fault = t.mock.method(fs, "rmSync", (...args: Parameters<typeof fs.rmSync>) => {
            if (args[0] === file && locked) {
                locked = false;
                throw new Error("Authored transient host lock");
            }
            return remove(...args);
        });
        const deleting = invoke("privacy.deleteFile");
        const repeated = invoke("privacy.deleteFile");
        try {
            assert.throws(() => invoke("history.list"), /deletion in progress/i);
            assert.throws(() => invoke("session.start", {intention: "must not start", targets: []}), /deletion in progress/i);
            await deleting;
            await repeated;
            assert.equal(existsSync(file), false);
        } finally {
            await Promise.allSettled([deleting, repeated]);
            fault.mock.restore();
        }
        assert.deepEqual(invoke("history.list"), []);
    });

    await t.test("failed deletion reports failure, preserves history and releases exclusivity", async () => {
        seed();
        const remove = fs.rmSync;
        const fault = t.mock.method(fs, "rmSync", (...args: Parameters<typeof fs.rmSync>) => {
            if (args[0] === file)
                throw new Error("Authored persistent host lock");
            return remove(...args);
        });
        try {
            await assert.rejects(Promise.resolve(invoke("privacy.deleteFile")), /Delete failed, file still present/);
        } finally {
            fault.mock.restore();
        }
        assert.equal(existsSync(file), true);
        const history = invoke("history.list") as {id: string}[];
        assert.deepEqual(history.map((row) => row.id), ["review"]);
    });

    await t.test("deleting the temp store removes sidecars and reopens without sessions", async () => {
        seed();
        assert.ok(existsSync(file));
        closeDb();
        // Orphan sidecars must be removed too, not merely cleaned up by SQLite closing its connection.
        writeFileSync(`${file}-wal`, "");
        writeFileSync(`${file}-shm`, "");
        writeFileSync(widget, "Authored intention\n1791547200\n");
        // No capture was started and no visits were enqueued: this covers synchronous deletion only.
        await invoke("privacy.deleteFile");
        for (const path of [file, `${file}-wal`, `${file}-shm`, widget])
            assert.equal(existsSync(path), false, `${path} must be removed`);
        assert.deepEqual(invoke("history.list"), []);
        assert.equal(invoke("session.current"), null);
        assert.equal(getDb().prepare("SELECT count(*) AS n FROM session")
            .get()?.n, 0);
    });
});
