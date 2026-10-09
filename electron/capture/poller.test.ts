import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EventEmitter} from "node:events";
import {DatabaseSync} from "node:sqlite";
import {test} from "node:test";

test("idle backdating never fills a sleep gap", async (t) => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    for (const name of ["001_init.sql", "002_visit_exec_name.sql"])
        db.exec(readFileSync(new URL(`../store/migrations/${name}`, import.meta.url), "utf8"));
    const start = Date.parse("2026-10-09T12:00:00Z");
    let now = start;
    let idle = 0;
    const monitor = Object.assign(new EventEmitter(), {
        getSystemIdleTime: () => idle,
        getSystemIdleState: () => "active"
    });
    t.mock.module("electron", {exports: {powerMonitor: monitor}});
    t.mock.module("@miniben90/x-win", {exports: {activeWindow: () => ({
        id: 1, os: "win", title: "Authored note - Notepad", url: "",
        info: {processId: 123, path: "C:/Windows/notepad.exe", name: "Notepad", execName: "notepad.exe"},
        position: {x: 0, y: 0, width: 800, height: 600, isFullScreen: false}, usage: {memory: 1024}
    })}});
    t.mock.module("../store/db.ts", {exports: {getDb: () => db}});
    t.mock.module("../ipc.ts", {exports: {emit: () => {}}});
    t.mock.module("../harness/queue.ts", {exports: {enqueueVisit: () => {}}});
    t.mock.module("../windows.ts", {exports: {showBlock: () => {}}});
    t.mock.method(Date, "now", () => now);
    t.mock.timers.enable({apis: ["setInterval"]});
    // Node's fake clearInterval rejects undefined; preserve the native no-op before capture's first start.
    const clear = globalThis.clearInterval;
    t.mock.method(globalThis, "clearInterval", (id: Parameters<typeof clear>[0]) => {
        if (id != null)
            clear(id);
    });
    // Import after replacing native sensors and the main-process side effects.
    const {startCapture, stopCapture} = await import("./poller.ts");
    t.after(() => {
        stopCapture();
        db.close();
    });
    db.prepare("INSERT INTO session (id, started_at) VALUES ('idle-sleep', ?)").run(new Date(start).toISOString());
    startCapture("idle-sleep");
    for (let seconds = 1; seconds <= 160; seconds++) {
        now = start + seconds * 1000;
        idle = Math.max(0, seconds - 20);
        t.mock.timers.tick(1000);
    }
    const beforeSleep = db.prepare("SELECT kind, started_at, ended_at FROM visit ORDER BY rowid").all();
    assert.deepEqual(beforeSleep.map((v) => [v.kind, v.started_at, v.ended_at]), [
        ["attention", "2026-10-09T12:00:00.000Z", "2026-10-09T12:00:20.000Z"],
        ["away", "2026-10-09T12:00:20.000Z", null]
    ]);
    now = start + 220_000;
    idle = 200;
    t.mock.timers.tick(1000);
    now += 1000;
    idle = 0;
    t.mock.timers.tick(1000);
    stopCapture();
    const visits = db.prepare("SELECT kind, started_at, ended_at FROM visit ORDER BY rowid").all();
    assert.deepEqual(visits.map((v) => [v.kind, v.started_at, v.ended_at]), [
        ["attention", "2026-10-09T12:00:00.000Z", "2026-10-09T12:00:20.000Z"],
        ["away", "2026-10-09T12:00:20.000Z", "2026-10-09T12:02:40.000Z"],
        ["away", "2026-10-09T12:03:40.000Z", "2026-10-09T12:03:41.000Z"],
        ["attention", "2026-10-09T12:03:41.000Z", "2026-10-09T12:03:41.000Z"]
    ]);
});
