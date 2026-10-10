import assert from "node:assert/strict";
import {existsSync, mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {test} from "node:test";
import type {LlamaModel} from "node-llama-cpp";

test("coach IPC uses the ended local review and stores complete turns safely", async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "ledger-coach-"));
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
    const getDb = () => {
        if (db != null)
            return db;
        db = new DatabaseSync(file);
        db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=2000");
        db.exec("CREATE TABLE schema_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
        for (const name of ["001_init.sql", "002_visit_exec_name.sql", "003_memory_votes.sql", "004_coach_turn.sql"])
            db.exec(readFileSync(new URL(`./migrations/${name}`, import.meta.url), "utf8"));
        return db;
    };
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    let model: LlamaModel | null = {} as LlamaModel;
    let readiness = Promise.resolve();
    let ask = async () => "The record shows the writing app was used.";
    t.mock.module("electron", {exports: {
        ipcMain: {on: () => {}, handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler)},
        BrowserWindow: {getAllWindows: () => []}, systemPreferences: {}
    }});
    t.mock.module("./db.ts", {exports: {getDb, closeDb}});
    t.mock.module("../paths.ts", {exports: {ledgerDir: () => directory, dbPath: () => file, widgetFilePath: () => widget}});
    t.mock.module("../windows.ts", {exports: {openMain: () => {}, ROUTE_PATTERN: /^review\//, toggleMiniWindow: () => {}}});
    t.mock.module("../capture/poller.ts", {exports: {startCapture: () => {}, stopCapture: () => {}}});
    t.mock.module("../harness/queue.ts", {exports: {discardJudgments: () => {}}});
    t.mock.module("../ai/runtime.ts", {exports: {
        runtimeStatus: () => (model == null ? "missing-file" : "ready"),
        runtimeSettled: {then: (...args: Parameters<Promise<void>["then"]>) => readiness.then(...args)},
        getModel: () => model, getJudge: () => null
    }});
    t.mock.module("../ai/coach.ts", {exports: {
        CANNOT_ANSWER: "The coach could not answer from the record.",
        askCoach: (...args: unknown[]) => ask(...args as [])
    }});
    const {registerIpc} = await import("../ipc.ts");
    registerIpc();
    const invoke = (channel: string, ...args: unknown[]) => {
        const handler = handlers.get(channel);
        assert.ok(handler, `missing ${channel}`);
        return handler(undefined, ...args);
    };
    const store = getDb();
    store.prepare("INSERT INTO session (id, intention, started_at, ended_at) VALUES (?, ?, ?, ?)")
        .run("ended", "Write a note", "2026-10-10T09:00:00Z", "2026-10-10T09:02:00Z");
    store.prepare("INSERT INTO session (id, intention, started_at) VALUES (?, ?, ?)")
        .run("running", "Still writing", "2026-10-10T09:02:00Z");
    store.prepare(`INSERT INTO visit (id, session_id, app_name, window_title, started_at, last_seen_at, ended_at, kind)
        VALUES ('v1', 'ended', 'Writer', 'Private window title', '2026-10-10T09:00:00Z',
            '2026-10-10T09:01:00Z', '2026-10-10T09:01:00Z', 'attention')`).run();
    store.prepare("INSERT INTO verdict (id, visit_id, source, label) VALUES ('d1', 'v1', 'user', 'serves')").run();

    await t.test("running sessions and unavailable model reject; ended session is grounded and persisted", async () => {
        await assert.rejects(Promise.resolve(invoke("coach.ask", "running", "How did it go?", [])), /after a session ends/);
        model = null;
        await assert.rejects(Promise.resolve(invoke("coach.ask", "ended", "How did it go?", [])), /unavailable/);
        model = {} as LlamaModel;
        const prior = Array.from({length: 13}, (_, index) => ({role: "user", content: `q${index}`}));
        const result = await invoke("coach.ask", "ended", "What happened?", prior) as {reply: string};
        assert.equal(result.reply, "The record shows the writing app was used.");
        assert.deepEqual((invoke("coach.history", "ended") as {role: string, content: string}[]).map((turn) => turn.content), [
            "What happened?", result.reply
        ]);
        const row = store.prepare("SELECT content FROM coach_turn WHERE role = 'user'").get();
        assert.equal(row?.content, "What happened?");
        assert.equal(store.prepare("SELECT content FROM coach_turn WHERE role = 'assistant'").get()?.content, result.reply);
    });

    await t.test("history is bounded to the latest 12 turns", async () => {
        let received: unknown[] = [];
        ask = async (...args: unknown[]) => {
            received = args;
            return "Okay.";
        };
        const prior = Array.from({length: 15}, (_, index) => ({role: "user", content: `q${index}`}));
        await invoke("coach.ask", "ended", "again", prior);
        assert.equal((received[3] as unknown[]).length, 12);
        assert.equal(((received[3] as {content: string}[])[0])?.content, "q3");
    });

    await t.test("coach context includes human per-app time without window metadata", async () => {
        let received: unknown[] = [];
        ask = async (...args: unknown[]) => {
            received = args;
            return "Okay.";
        };
        await invoke("coach.ask", "ended", "Where did my time go?", []);
        const record = received[1] as {session: {timeByApp: Record<string, string>, visits: {duration: string}[]}};
        assert.equal(record.session.timeByApp.Writer, "1 minute");
        assert.equal(record.session.visits[0]?.duration, "1 minute");
        const serialized = JSON.stringify(record);
        assert.equal(serialized.includes("Private window title"), false);
        assert.equal(serialized.includes("url"), false);
    });

    await t.test("deleting during generation waits, rejects persistence, and does not recreate the file", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => release = resolve);
        ask = async () => {
            await gate;
            return "Too late.";
        };
        const pending = invoke("coach.ask", "ended", "race", []) as Promise<unknown>;
        await new Promise((resolve) => setImmediate(resolve));
        const deleting = invoke("privacy.deleteFile") as Promise<void>;
        release();
        await assert.rejects(pending, /deletion in progress/i);
        await deleting;
        assert.equal(existsSync(file), false);
        assert.equal(db, null);
    });
    await t.test("deletion drains a coach request waiting for model readiness", async () => {
        let release!: () => void;
        readiness = new Promise<void>((resolve) => release = resolve);
        let generated = false;
        ask = async () => {
            generated = true;
            return "Too late.";
        };
        getDb().prepare(`INSERT INTO session (id, intention, started_at, ended_at)
            VALUES ('waiting', 'write', '2026-10-10T09:00:00Z', '2026-10-10T09:01:00Z')`)
            .run();
        const pending = invoke("coach.ask", "waiting", "What happened?", []) as Promise<unknown>;
        await new Promise((resolve) => setImmediate(resolve));
        const deleting = invoke("privacy.deleteFile") as Promise<void>;
        release();
        await assert.rejects(pending, /deletion in progress/i);
        await deleting;
        assert.equal(generated, false);
        assert.equal(existsSync(file), false);
        assert.equal(db, null);
    });
});
