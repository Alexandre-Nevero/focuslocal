import {randomUUID} from "node:crypto";
import {powerMonitor} from "electron";
import {activeWindow, type WindowInfo} from "@miniben90/x-win";
import {getDb} from "../store/db.ts";
import {emit} from "../ipc.ts";
import {enqueueVisit} from "../harness/queue.ts";
import {bare} from "../harness/rules.ts";
import type {CaptureState} from "../../src/shared/types.ts";

// The 1 s capture loop, system-design §9 "Capture loop".
const TICK_MS = 1000;
const AWAY_S = 120;
const SLEEP_GAP_MS = 5000;
const FAILS_FOR_GAP = 3;
const TAB_FRESH_MS = 5000;
const CHROMIUM = new Set(["chrome", "msedge", "brave", "chromium", "google-chrome"]);

type Open = {
    id: string,
    kind: "attention" | "away",
    key: string,
    startedAt: number,
    lastSeen: number,
    /** A Chromium visit whose URL is still unknown: re-read each tick (x-win can return "" right after a switch). */
    wantsUrl: boolean
};
type Facts = {name: string, exec: string | null, title: string | null, url: string | null};

let sessionId: string | null = null;
let timer: NodeJS.Timeout | undefined;
let open: Open | null = null;
/** No visit starts before this: the end of the last closed visit, or capture start. */
let floor = 0;
let lastTick = 0;
let failures = 0;
let state: CaptureState = "ok";
let locked = false;

const onLock = () => locked = true;
const onUnlock = () => locked = false;
const iso = (ms: number) => new Date(ms).toISOString();

function setState(next: CaptureState) {
    if (next !== state)
        emit("capture:status", {state: state = next});
}

function openVisit(at: number, kind: Open["kind"], key: string, f: Facts): Open {
    const id = randomUUID();
    const startedAt = Math.max(at, floor);
    getDb().prepare(`
        INSERT INTO visit (id, session_id, app_name, exec_name, window_title, url, started_at, last_seen_at, kind)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .run(id, sessionId, f.name, f.exec, f.title, f.url, iso(startedAt), iso(startedAt), kind);
    return {id, kind, key, startedAt, lastSeen: startedAt, wantsUrl: f.exec != null && CHROMIUM.has(bare(f.exec)) && f.url == null};
}

/** Ends the open visit (never before it started) and sends an attention visit to Harness. */
function closeVisit(at: number | "last-seen") {
    if (open == null)
        return;
    const {id, kind, startedAt, lastSeen} = open;
    const end = at === "last-seen" ? lastSeen : Math.max(startedAt, at);
    open = null;
    floor = end;
    getDb().prepare("UPDATE visit SET ended_at = ?, last_seen_at = ? WHERE id = ?")
        .run(iso(end), iso(end), id);
    if (kind === "attention")
        enqueueVisit(id);
}

function touch(now: number) {
    if (open == null)
        return;
    open.lastSeen = now;
    getDb().prepare("UPDATE visit SET last_seen_at = ? WHERE id = ?")
        .run(iso(now), open.id);
}

/** x-win's url getter costs 30–470 ms, so it runs only on a key change or while a Chromium visit has no URL yet. */
function readUrl(w: WindowInfo, exec: string): string | null {
    let url = "";
    try {
        url = w.url;
    } catch {
        // Elevated windows can refuse UI Automation; fall through to the extension's tab.
    }
    if (url !== "" || !CHROMIUM.has(exec))
        return url || null;

    // The extension's last tab (#25), when it is the same page and fresh. Edge never returns a URL through x-win.
    const tab = getDb().prepare("SELECT url, title, updated_at FROM browser_tab WHERE id = 1")
        .get();
    const fresh = tab != null && Date.now() - Date.parse(String(tab.updated_at)) <= TAB_FRESH_MS;
    return fresh && tab.url != null && tab.title != null && w.title.startsWith(String(tab.title)) ? String(tab.url) : null;
}

function tick() {
    const now = Date.now();
    // Sleep or suspend: the time between ticks is unrecorded.
    if (lastTick !== 0 && now - lastTick > SLEEP_GAP_MS)
        closeVisit("last-seen");
    lastTick = now;

    const idle = powerMonitor.getSystemIdleTime();
    if (idle >= AWAY_S || locked || powerMonitor.getSystemIdleState(AWAY_S) === "locked") {
        if (open?.kind === "away")
            touch(now);
        else {
            const awaySince = now - (idle >= AWAY_S ? idle * 1000 : 0);
            closeVisit(awaySince);
            open = openVisit(awaySince, "away", "", {name: "Away", exec: null, title: null, url: null});
        }
        return;
    }
    if (open?.kind === "away")
        closeVisit(now);

    let w: WindowInfo | null;
    try {
        w = activeWindow();
    } catch {
        w = null;
    }
    if (w?.info == null) {
        // Three misses in a row: a gap, not a guess (US-002, US-010).
        if (++failures === FAILS_FOR_GAP) {
            closeVisit("last-seen");
            setState("failing");
        }
        return;
    }
    failures = 0;
    setState("ok");

    // Ledger's own windows: the previous visit continues.
    if (w.info.processId === process.pid) {
        touch(now);
        return;
    }

    const exec = bare(w.info.execName);
    const key = `${exec}\u0000${w.title}`;
    if (open?.key === key) {
        touch(now);
        if (open.wantsUrl) {
            const url = readUrl(w, exec);
            if (url != null) {
                getDb().prepare("UPDATE visit SET url = ? WHERE id = ?")
                    .run(url, open.id);
                open.wantsUrl = false;
            }
        }
        return;
    }

    closeVisit(now);
    open = openVisit(now, "attention", key, {
        name: w.info.name || w.info.execName,
        exec: w.info.execName,
        title: w.title.slice(0, 512) || null,
        url: readUrl(w, exec)
    });
}

export function startCapture(id: string) {
    stopCapture();
    sessionId = id;
    floor = Date.now();
    lastTick = 0;
    failures = 0;
    state = "ok";
    locked = false;
    powerMonitor.on("lock-screen", onLock);
    powerMonitor.on("unlock-screen", onUnlock);
    tick();
    timer = setInterval(tick, TICK_MS);
}

/** Closes the open visit at its last tick and stops: session end, delete-file, quit. */
export function stopCapture() {
    clearInterval(timer);
    timer = undefined;
    powerMonitor.off("lock-screen", onLock);
    powerMonitor.off("unlock-screen", onUnlock);
    closeVisit("last-seen");
    sessionId = null;
}
