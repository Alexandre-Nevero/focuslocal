/// <reference lib="es2024.promise" />
import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {existsSync, mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import {test} from "node:test";
import {setImmediate as nextTurn} from "node:timers/promises";

// All inputs are authored. Never resolve paths into the user's Ledger directory.
test("judgment queue lifecycle", async (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), "ledger-queue-"));
    const file = path.join(dir, "ledger.db");
    const widget = path.join(dir, "widget.txt");
    const files = [file, `${file}-wal`, `${file}-shm`, widget];
    const migrations = ["001_init.sql", "002_visit_exec_name.sql", "003_memory_votes.sql"]
        .map((name) => readFileSync(new URL(`../store/migrations/${name}`, import.meta.url), "utf8"));
    let db: DatabaseSync | null = null;

    // db.ts uses Vite's import.meta.glob. Replace only opening/caching; SQL and migrations stay real.
    function getDb(): DatabaseSync {
        if (db == null) {
            const fresh = !existsSync(file);
            db = new DatabaseSync(file);
            db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=2000; PRAGMA foreign_keys=ON;");
            if (fresh)
                for (const sql of migrations)
                    db.exec(sql);
        }
        return db;
    }
    function closeDb() {
        db?.close();
        db = null;
    }

    let finishDecision = () => {};
    let decisionStarted = false;
    let decisionResult = Promise.resolve({label: {choice: "serves", confidence: 0.9}});
    const judge = {
        llama: {dispose: async () => {}},
        decision: {decide: () => {
            decisionStarted = true;
            return decisionResult;
        }},
        session: {
            resetChatHistory: () => {},
            prompt: async () => '{"reason":"This editor is used for the stated task.","label":"serves"}'
        },
        grammar: {parse: (text: string) => JSON.parse(text)}
    };
    t.beforeEach(() => {
        decisionStarted = false;
        const {promise, resolve} = Promise.withResolvers<Awaited<typeof decisionResult>>();
        decisionResult = promise;
        finishDecision = () => resolve({label: {choice: "serves", confidence: 0.9}});
    });
    t.afterEach(async () => {
        // Release inference even after a failed assertion, then drain before closing its SQLite connection.
        finishDecision();
        await nextTurn();
        closeDb();
        for (const name of files)
            rmSync(name, {force: true});
    });
    t.after(async () => {
        finishDecision();
        await nextTurn();
        closeDb();
        rmSync(dir, {recursive: true, force: true});
    });

    type Handler = (event: unknown, ...args: unknown[]) => unknown;
    const handlers = new Map<string, Handler>();
    t.mock.module("electron", {exports: {
        BrowserWindow: {getAllWindows: () => []},
        ipcMain: {handle: (channel: string, handler: Handler) => handlers.set(channel, handler)},
        systemPreferences: {getMediaAccessStatus: () => "granted", isTrustedAccessibilityClient: () => true},
        powerMonitor: Object.assign(new EventEmitter(), {
            getSystemIdleTime: () => 0,
            getSystemIdleState: () => "active"
        })
    }});
    t.mock.module("@miniben90/x-win", {exports: {activeWindow: () => undefined}});
    t.mock.module("../windows.ts", {exports: {
        ROUTE_PATTERN: /^(idle|declare|permissions|running|review\/[\w-]+|history|privacy|mini)$/,
        openMain: () => {},
        toggleMiniWindow: () => {},
        showBlock: () => {},
        setTrayTip: () => {}
    }});
    t.mock.module("../companion-window.ts", {exports: {
        currentCompanionBounds: () => ({x: 0, y: 0, width: 96, height: 96}),
        applyCompanionBounds: () => {},
        setCompanionShown: () => {}
    }});
    t.mock.module("../paths.ts", {exports: {
        ledgerDir: () => dir,
        dbPath: () => file,
        widgetFilePath: () => widget
    }});
    t.mock.module("../store/db.ts", {exports: {getDb, closeDb}});
    t.mock.module("../ai/runtime.ts", {exports: {
        runtimeSettled: Promise.resolve(),
        getJudge: () => judge,
        runtimeStatus: () => "ready",
        modelsDir: () => dir
    }});
    t.mock.module("../ai/coach.ts", {exports: {
        askCoach: async () => "",
        stopCoach: async () => {},
        analyzeIntention: async () => null
    }});

    // Import after installing native/model/path seams. Keep IPC, queue, harness, and judgeWindow real.
    const {enqueueVisit, enqueueUnjudged} = await import("./queue.ts");
    const {registerIpc} = await import("../ipc.ts");
    registerIpc();
    function invoke(channel: string, ...args: unknown[]) {
        const handler = handlers.get(channel);
        assert.ok(handler, `Missing IPC handler: ${channel}`);
        return handler(undefined, ...args);
    }
    function seedSession(id: string, visitIds: string[]) {
        const opened = getDb();
        opened.prepare("INSERT INTO session (id, intention, started_at) VALUES (?, 'finish the authored draft', ?)")
            .run(id, "2026-10-09T12:00:00.000Z");
        const insert = opened.prepare(`
            INSERT INTO visit (id, session_id, app_name, exec_name, window_title, url, started_at, last_seen_at, ended_at, kind)
            VALUES (?, ?, 'Authored Editor', 'authored-editor.exe', 'Draft section', NULL, ?, ?, ?, 'attention')
        `);
        for (const visitId of visitIds)
            insert.run(visitId, id, "2026-10-09T12:00:00.000Z", "2026-10-09T12:00:01.000Z", "2026-10-09T12:00:01.000Z");
    }
    function verdicts() {
        return getDb().prepare("SELECT visit_id, source, label, confidence FROM verdict ORDER BY visit_id")
            .all()
            .map((row) => [row.visit_id, row.source, row.label, row.confidence]);
    }
    async function beginJudgment(visitId: string) {
        enqueueVisit(visitId);
        // SQLite is synchronous; one event-loop turn drains ready promise continuations, not a timed sleep.
        await nextTurn();
        assert.equal(decisionStarted, true, "Enter inference before exercising the lifecycle race");
        assert.deepEqual(verdicts(), [], "The visit stays pending while the native decision is held");
    }

    await t.test("End preserves a closed visit's in-flight judgment", async () => {
        seedSession("ending", ["ended-visit"]);
        await beginJudgment("ended-visit");
        invoke("session.end");
        assert.equal(typeof getDb().prepare("SELECT ended_at FROM session WHERE id = 'ending'")
            .get()?.ended_at, "string");
        assert.deepEqual(verdicts(), []);

        finishDecision();
        await nextTurn();
        assert.deepEqual(verdicts(), [["ended-visit", "model", "serves", 0.9]]);
    });

    await t.test("a tap during inference cannot be overwritten by the late model result", async () => {
        seedSession("tapping", ["tapped-visit"]);
        await beginJudgment("tapped-visit");
        invoke("review.tap", "tapped-visit", "drifts");
        assert.deepEqual(verdicts(), [["tapped-visit", "user", "drifts", null]]);

        finishDecision();
        await nextTurn();
        assert.deepEqual(verdicts(), [["tapped-visit", "user", "drifts", null]]);
        const row = getDb().prepare("SELECT reason, model_id, model_stage, memory_id, latency_ms FROM verdict")
            .get();
        assert.deepEqual({...row}, {reason: null, "model_id": null, "model_stage": null, "memory_id": null, "latency_ms": null});
    });

    await t.test("deleted in-flight and queued work cannot recreate the Ledger file", async () => {
        seedSession("deleted", ["in-flight", "queued"]);
        await beginJudgment("in-flight");
        enqueueVisit("queued");
        await invoke("privacy.deleteFile");
        assert.deepEqual(files.filter((name) => existsSync(name)), []);

        finishDecision();
        await nextTurn();
        // Do not call getDb here: that would recreate the file from the test rather than from stale work.
        assert.deepEqual(files.filter((name) => existsSync(name)), [], "Finishing deleted work must leave the file absent");
    });

    await t.test("old work cannot write into a replacement database, and fresh work can still drain", async () => {
        seedSession("old-session", ["in-flight", "queued"]);
        await beginJudgment("in-flight");
        enqueueVisit("queued");
        await invoke("privacy.deleteFile");

        // IDs belong to a database. Reuse authored IDs to make crossing that boundary observable as wrong verdicts.
        seedSession("new-session", ["in-flight", "queued"]);
        getDb().prepare("INSERT INTO declared_target (id, session_id, target, role) VALUES ('new-rule', 'new-session', 'authored-editor', 'distraction')")
            .run();
        finishDecision();
        await nextTurn();
        assert.deepEqual(verdicts(), [], "Old jobs must not label replacement visits before they are enqueued");

        enqueueUnjudged();
        await nextTurn();
        assert.deepEqual(verdicts(), [["in-flight", "rule", "drifts", null], ["queued", "rule", "drifts", null]]);
    });
});
