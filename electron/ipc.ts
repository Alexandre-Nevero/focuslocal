import fs from "node:fs";
import {randomUUID} from "node:crypto";
import {setTimeout as sleep} from "node:timers/promises";
import {BrowserWindow, ipcMain, systemPreferences} from "electron";
import {closeDb, getDb} from "./store/db.ts";
import {dbPath, widgetFilePath} from "./paths.ts";
import {MODEL_ID, runtimeStatus} from "./ai/runtime.ts";
import {openMain, ROUTE_PATTERN, toggleMiniWindow} from "./windows.ts";
import type {
    DeclaredTarget, Label, LedgerChannel, LedgerEvents, LedgerRow, Outcome, Permissions, PermissionState, Privacy, Review,
    ReviewVisit, Route, Session, Source, Verdict
} from "../src/shared/types.ts";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : Number(v));

const BROWSER_APPS = /chrome|edge|brave|chromium|firefox|opera|vivaldi|safari/i;

/** Pushes an event to every window (main, popover, mini). */
export function emit<E extends keyof LedgerEvents>(event: E, payload: LedgerEvents[E]) {
    for (const win of BrowserWindow.getAllWindows())
        win.webContents.send(`ledger:${event}`, payload);
}

function readSession(row: Row): Session {
    const targets = getDb()
        .prepare("SELECT target, role FROM declared_target WHERE session_id = ? ORDER BY rowid")
        .all(String(row.id))
        .map((t) => ({target: String(t.target), role: t.role}) as DeclaredTarget);

    return {
        id: String(row.id),
        intention: String(row.intention),
        startedAt: String(row.started_at),
        endedAt: str(row.ended_at),
        outcome: str(row.outcome) as Outcome | null,
        targets
    };
}

function runningSession(): Session | null {
    const row = getDb().prepare("SELECT * FROM session WHERE ended_at IS NULL")
        .get();
    return row == null ? null : readSession(row);
}

function readTau(): number | null {
    const row = getDb().prepare("SELECT value FROM setting WHERE key = 'tau'")
        .get();
    return row == null ? null : Number(row.value);
}

const durationMs = (from: string, to: string) => Math.max(0, Date.parse(to) - Date.parse(from));

function getReview(sessionId: string): Review {
    const db = getDb();
    const sessionRow = db.prepare("SELECT * FROM session WHERE id = ?").get(sessionId);
    if (sessionRow == null)
        throw new Error(`No session ${sessionId}`);

    const session = readSession(sessionRow);
    const tau = readTau();
    const rows = db.prepare(`
        SELECT v.*, d.id AS d_id, d.memory_id, d.source, d.label, d.reason, d.model_id, d.model_stage, d.latency_ms, d.confidence
        FROM visit v LEFT JOIN verdict d ON d.visit_id = v.id
        WHERE v.session_id = ? ORDER BY v.started_at
    `).all(sessionId);

    const visits = rows.map((r): ReviewVisit => {
        const verdict: Verdict | null = r.d_id == null
            ? null
            : {
                id: String(r.d_id),
                visitId: String(r.id),
                memoryId: str(r.memory_id),
                source: String(r.source) as Source,
                label: String(r.label) as Label,
                reason: str(r.reason),
                modelId: str(r.model_id),
                modelStage: str(r.model_stage) as Verdict["modelStage"],
                latencyMs: num(r.latency_ms),
                confidence: num(r.confidence)
            };
        // Display gate (system-design §9): a model label below tau, or with no tau yet, shows as unclear.
        const gated = verdict?.source === "model" && (tau == null || verdict.confidence == null || verdict.confidence < tau);

        return {
            id: String(r.id),
            sessionId,
            appName: String(r.app_name),
            windowTitle: str(r.window_title),
            url: str(r.url),
            startedAt: String(r.started_at),
            lastSeenAt: String(r.last_seen_at),
            endedAt: str(r.ended_at),
            kind: r.kind === "away" ? "away" : "attention",
            verdict,
            shown: verdict == null ? null : gated ? "unclear" : verdict.label
        };
    });

    const sessionEnd = session.endedAt ?? new Date().toISOString();
    const recordedMs = visits.reduce((sum, v) => sum + durationMs(v.startedAt, v.endedAt ?? v.lastSeenAt), 0);

    return {session, visits, unrecordedMs: Math.max(0, durationMs(session.startedAt, sessionEnd) - recordedMs)};
}

/** A tap is the user's verdict for that visit, and one vote toward memory (applied by Harness only at tap_count >= 2, BR-004). */
function tap(visitId: string, label: "serves" | "drifts") {
    const db = getDb();
    const visit = db.prepare("SELECT app_name, url FROM visit WHERE id = ?").get(visitId);
    if (visit == null)
        throw new Error(`No visit ${visitId}`);

    db.exec("BEGIN");
    try {
        db.prepare(`
            INSERT INTO verdict (id, visit_id, source, label) VALUES (?, ?, 'user', ?)
            ON CONFLICT (visit_id) DO UPDATE SET source = 'user', label = excluded.label, memory_id = NULL, reason = NULL,
                model_id = NULL, model_stage = NULL, latency_ms = NULL, confidence = NULL
        `).run(randomUUID(), visitId, label);

        // match_key: the URL host, else the app, except a browser without a URL (its app name says nothing about the page).
        const url = str(visit.url);
        const appName = String(visit.app_name);
        const matchKey = url != null
            ? new URL(url).hostname.toLowerCase()
            : BROWSER_APPS.test(appName) ? null : appName.toLowerCase();
        if (matchKey != null)
            db.prepare(`
                INSERT INTO memory (id, match_key, label, tap_count) VALUES (?, ?, ?, 1)
                ON CONFLICT (match_key) DO UPDATE SET
                    tap_count = CASE WHEN label = excluded.label THEN tap_count + 1 ELSE 1 END,
                    label = excluded.label
            `).run(randomUUID(), matchKey, label);
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }
    emit("verdict:updated", {visitId});
}

async function deleteFile() {
    closeDb();
    const files = [dbPath(), `${dbPath()}-wal`, `${dbPath()}-shm`, widgetFilePath()];
    for (let attempt = 1; ; attempt++) {
        try {
            for (const file of files)
                fs.rmSync(file, {force: true});
            break;
        } catch (err) {
            // Another process (the native host) can hold the file for a moment.
            if (attempt === 3)
                throw new Error("Delete failed, file still present", {cause: err});
            await sleep(200);
        }
    }
    emit("session:changed", {sessionId: null});
}

function macPermission(kind: "screen" | "accessibility"): PermissionState {
    if (process.platform !== "darwin")
        return "granted";
    if (kind === "accessibility")
        return systemPreferences.isTrustedAccessibilityClient(false) ? "granted" : "denied";

    return systemPreferences.getMediaAccessStatus("screen") as PermissionState;
}

// The renderer is a trust boundary: every argument is checked before it reaches SQL.
function text(value: unknown, name: string): string {
    if (typeof value !== "string")
        throw new TypeError(`${name} must be a string`);
    return value;
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[], name: string): T {
    if (!allowed.includes(value as T))
        throw new TypeError(`${name} must be one of ${allowed.join(", ")}`);
    return value as T;
}

const handlers: Record<LedgerChannel, (...args: unknown[]) => unknown> = {
    "session.start"(input: unknown): Session {
        const {intention, targets} = (input ?? {}) as {intention?: unknown, targets?: unknown};
        if (!Array.isArray(targets))
            throw new TypeError("targets must be an array");
        const declared = targets.map((t: {target?: unknown, role?: unknown}): DeclaredTarget => ({
            target: text(t?.target, "target").trim()
                .toLowerCase(),
            role: oneOf(t?.role, ["work", "distraction"], "role")
        }));
        const sentence = text(intention, "intention").trim();
        if (runningSession() != null)
            throw new Error("A session is already running");

        const db = getDb();
        const id = randomUUID();
        db.exec("BEGIN");
        try {
            db.prepare("INSERT INTO session (id, intention, started_at) VALUES (?, ?, ?)")
                .run(id, sentence, new Date().toISOString());
            for (const {target, role} of declared)
                db.prepare("INSERT OR REPLACE INTO declared_target (id, session_id, target, role) VALUES (?, ?, ?, ?)")
                    .run(randomUUID(), id, target, role);
            db.exec("COMMIT");
        } catch (err) {
            db.exec("ROLLBACK");
            throw err;
        }
        emit("session:changed", {sessionId: id});
        return readSession(db.prepare("SELECT * FROM session WHERE id = ?").get(id)!);
    },
    "session.end"() {
        const db = getDb();
        const running = runningSession();
        if (running == null)
            throw new Error("No session is running");

        const now = new Date().toISOString();
        db.prepare("UPDATE visit SET ended_at = last_seen_at WHERE session_id = ? AND ended_at IS NULL").run(running.id);
        db.prepare("UPDATE session SET ended_at = ? WHERE id = ?").run(now, running.id);
        emit("session:changed", {sessionId: null});
        // The review follows End wherever End was pressed (popover, mini window, main window).
        openMain(`review/${running.id}`);
        return {sessionId: running.id};
    },
    "session.current": runningSession,
    "review.get": (sessionId) => getReview(text(sessionId, "sessionId")),
    "review.tap": (visitId, label) => tap(text(visitId, "visitId"), oneOf(label, ["serves", "drifts"], "label")),
    "review.answer"(sessionId, outcome) {
        const result = getDb()
            .prepare("UPDATE session SET outcome = ? WHERE id = ? AND ended_at IS NOT NULL")
            .run(oneOf(outcome, ["yes", "not_yet", "unanswered"], "outcome"), text(sessionId, "sessionId"));
        if (result.changes === 0)
            throw new Error("The session is still running or does not exist");
    },
    "ledger.list"(): LedgerRow[] {
        return getDb()
            .prepare("SELECT id, intention, started_at, ended_at, outcome FROM session ORDER BY started_at DESC")
            .all()
            .map((r) => ({
                id: String(r.id),
                intention: String(r.intention),
                startedAt: String(r.started_at),
                endedAt: str(r.ended_at),
                outcome: str(r.outcome) as Outcome | null
            }));
    },
    "privacy.get"(): Privacy {
        const db = getDb();
        const status = runtimeStatus();
        return {
            modelCalls: Number(db.prepare("SELECT count(*) AS n FROM verdict WHERE source = 'model'").get()!.n),
            modelId: status === "ready" ? MODEL_ID : null,
            modelStatus: status,
            tau: readTau(),
            evalRanAt: str(db.prepare("SELECT max(ran_at) AS t FROM eval_run").get()!.t),
            dbPath: dbPath()
        };
    },
    "privacy.dropMemory"() {
        getDb().exec("DELETE FROM memory");
    },
    "privacy.deleteFile": deleteFile,
    "permissions.get"(): Permissions {
        return {screen: macPermission("screen"), accessibility: macPermission("accessibility")};
    },
    "widgets.toggleMini": toggleMiniWindow,
    "windows.open"(route) {
        const target = text(route, "route");
        if (!ROUTE_PATTERN.test(target))
            throw new TypeError(`Unknown route ${target}`);
        openMain(target as Route);
    }
};

/**
 * Launch after a crash or a quit mid-session (system-design §9 capture step 6): open visits end at their last tick, the
 * open session ends at its latest tick. Returns that session's id so the app opens its review, or null.
 */
export function recoverUnfinishedSession(): string | null {
    const db = getDb();
    const open = db.prepare("SELECT id, started_at FROM session WHERE ended_at IS NULL").get();
    if (open == null)
        return null;

    const id = String(open.id);
    const lastTick = db.prepare("SELECT max(last_seen_at) AS t FROM visit WHERE session_id = ?").get(id)?.t;
    db.prepare("UPDATE visit SET ended_at = last_seen_at WHERE session_id = ? AND ended_at IS NULL").run(id);
    db.prepare("UPDATE session SET ended_at = ? WHERE id = ?").run(String(lastTick ?? open.started_at), id);
    return id;
}

export function registerIpc() {
    for (const [channel, handler] of Object.entries(handlers))
        ipcMain.handle(channel, (_event, ...args: unknown[]) => handler(...args));
}
