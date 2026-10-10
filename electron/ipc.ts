import fs from "node:fs";
import {randomUUID} from "node:crypto";
import {setTimeout as sleep} from "node:timers/promises";
import {BrowserWindow, ipcMain, systemPreferences} from "electron";
import {closeDb, getDb} from "./store/db.ts";
import {readReview, tapVisit, updateSessionIntention} from "./store/review.ts";
import {dbPath, widgetFilePath} from "./paths.ts";
import {getModel, runtimeSettled, runtimeStatus} from "./ai/runtime.ts";
import {askCoach, type CoachTurn} from "./ai/coach.ts";
import {MODEL_ID} from "./ai/judge.ts";
import {startCapture, stopCapture} from "./capture/poller.ts";
import {discardJudgments} from "./harness/queue.ts";
import {openMain, ROUTE_PATTERN, toggleMiniWindow} from "./windows.ts";
import type {
    DeclaredTarget, HistoryRow, LedgerChannel, LedgerEvents, Outcome, Permissions, PermissionState, Privacy, Review,
    Route, Session
} from "../src/shared/types.ts";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));

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


function getReview(sessionId: string): Review {
    return readReview(getDb(), sessionId);
}

function readTau(): number | null {
    const row = getDb().prepare("SELECT value FROM setting WHERE key = 'tau'")
        .get();
    return row == null ? null : Number(row.value);
}

function tap(visitId: string, label: "serves" | "drifts") {
    tapVisit(getDb(), visitId, label);
    emit("verdict:updated", {visitId});
}

function coachTurns(value: unknown): CoachTurn[] {
    if (!Array.isArray(value) || value.length > 100)
        throw new TypeError("history must be an array of at most 100 turns");
    return value.slice(-12).map((entry) => {
        const turn = entry as {role?: unknown, content?: unknown};
        const role = oneOf(turn?.role, ["user", "assistant"], "history role");
        const content = text(turn?.content, "history content");
        if (content.length > 1200)
            throw new Error("History turn is too long");
        return {role, content};
    });
}

function coachRecord(db: ReturnType<typeof getDb>, sessionId: string) {
    const session = db.prepare("SELECT id, intention, ended_at, outcome FROM session WHERE id = ?").get(sessionId);
    if (session == null || session.ended_at == null)
        throw new Error("The coach is available after a session ends");
    const review = getReview(sessionId);
    const visits = review.visits.filter((visit) => visit.kind === "attention");
    const allSessions = db.prepare("SELECT id, outcome FROM session WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 30").all();
    const byLabel = {serves: 0, drifts: 0, unclear: 0};
    const sourceCounts = {rule: 0, memory: 0, model: 0, user: 0};
    for (const visit of visits) {
        if (visit.shown != null)
            byLabel[visit.shown]++;
        if (visit.shownSource != null)
            sourceCounts[visit.shownSource]++;
    }
    const durationByLabel: Record<string, number> = {serves: 0, drifts: 0, unclear: 0};
    const durationByApp = new Map<string, number>();
    const humanDuration = (ms: number) => {
        const seconds = Math.max(0, Math.round(ms / 1000));
        if (seconds < 60) return `${seconds} seconds`;
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;
        return `${minutes} ${minutes === 1 ? "minute" : "minutes"}` + (remaining === 0 ? "" : ` ${remaining} seconds`);
    };
    const durationMs = (visit: Review["visits"][number]) => Math.max(0,
        Date.parse(visit.endedAt ?? visit.lastSeenAt) - Date.parse(visit.startedAt));
    for (const visit of visits)
        durationByApp.set(visit.appName, (durationByApp.get(visit.appName) ?? 0) + durationMs(visit));
    for (const row of allSessions) {
        const priorReview = readReview(db, String(row.id));
        for (const visit of priorReview.visits) {
            if (visit.kind !== "attention" || visit.shown == null)
                continue;
            durationByLabel[visit.shown] = (durationByLabel[visit.shown] ?? 0) + durationMs(visit);
        }
    }
    const repeatedApps = db.prepare(`
        SELECT app_name FROM visit WHERE kind = 'attention' GROUP BY app_name
        HAVING COUNT(DISTINCT session_id) > 1 ORDER BY COUNT(DISTINCT session_id) DESC LIMIT 8
    `).all()
        .map((row) => String(row.app_name));
    const outcomes = {yes: 0, not_yet: 0, unanswered: 0};
    for (const row of db.prepare("SELECT COALESCE(outcome, 'unanswered') AS outcome, count(*) AS n FROM session WHERE ended_at IS NOT NULL GROUP BY outcome").all()) {
        const outcome = String(row.outcome);
        if (outcome in outcomes) outcomes[outcome as keyof typeof outcomes] = Number(row.n);
    }
    const appTimes = [...durationByApp].sort((a, b) => b[1] - a[1]);
    return {
        session: {
            intention: String(session.intention),
            outcome: String(session.outcome ?? "unanswered"),
            visits: visits.slice(-24).map((visit) => ({
                app: visit.appName,
                label: visit.shown,
                source: visit.shownSource,
                duration: humanDuration(durationMs(visit))
            })),
            timeByApp: Object.fromEntries(appTimes.slice(0, 20).map(([app, ms]) => [app, humanDuration(ms)])),
            otherAppTime: humanDuration(appTimes.slice(20).reduce((sum, [, ms]) => sum + ms, 0)),
            labels: byLabel,
            sources: sourceCounts,
            awayVisits: review.visits.filter((visit) => visit.kind === "away").length,
            away: humanDuration(review.visits.filter((visit) => visit.kind === "away").reduce((sum, visit) => sum + durationMs(visit), 0)),
            unrecorded: humanDuration(review.unrecordedMs)
        },
        local: {sessions: Number(db.prepare("SELECT count(*) AS n FROM session WHERE ended_at IS NOT NULL").get()!.n), outcomes,
            timeByLabel: Object.fromEntries(Object.entries(durationByLabel).map(([label, ms]) => [label, humanDuration(ms)])), repeatedApps}
    };
}

let deleting: Promise<void> | null = null;
let coachInFlight: Promise<unknown> | null = null;
function deleteFile() {
    return deleting ??= removeFile().finally(() => deleting = null);
}

async function removeFile() {
    stopCapture();
    await coachInFlight?.catch(() => undefined);
    discardJudgments();
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
        startCapture(id);
        return readSession(db.prepare("SELECT * FROM session WHERE id = ?").get(id)!);
    },
    "session.end"() {
        const db = getDb();
        const running = runningSession();
        if (running == null)
            throw new Error("No session is running");

        const now = new Date().toISOString();
        stopCapture();
        db.prepare("UPDATE session SET ended_at = ? WHERE id = ?").run(now, running.id);
        emit("session:changed", {sessionId: null});
        // The review follows End wherever End was pressed (popover, mini window, main window).
        openMain(`review/${running.id}`);
        return {sessionId: running.id};
    },
    "session.updateIntention"(sessionId, intention) {
        const id = text(sessionId, "sessionId");
        const sentence = text(intention, "intention");
        if (sentence.length > 4000)
            throw new Error("Intention is too long");
        updateSessionIntention(getDb(), id, sentence);
        emit("session:changed", {sessionId: runningSession()?.id ?? null});
        return readSession(getDb().prepare("SELECT * FROM session WHERE id = ?")
            .get(id)!);
    },
    "session.current": runningSession,
    "review.get": (sessionId) => getReview(text(sessionId, "sessionId")),
    "coach.history": (sessionId) => {
        const id = text(sessionId, "sessionId");
        const session = getDb().prepare("SELECT ended_at FROM session WHERE id = ?")
            .get(id);
        if (session == null || session.ended_at == null)
            throw new Error("The coach is available after a session ends");
        return getDb().prepare(`
            SELECT role, content FROM (
                SELECT rowid, role, content FROM coach_turn WHERE session_id = ? ORDER BY rowid DESC LIMIT 100
            ) ORDER BY rowid
        `)
            .all(id)
            .map((row) => ({role: String(row.role) as CoachTurn["role"], content: String(row.content)}));
    },
    "coach.ask": async (sessionId, message, rawHistory) => {
        const id = text(sessionId, "sessionId");
        const prompt = text(message, "message").trim();
        if (prompt.length === 0 || prompt.length > 1000)
            throw new Error("Message must contain 1 to 1000 characters");
        const history = coachTurns(rawHistory);
        const previous = coachInFlight;
        const operation = (async () => {
            await previous?.catch(() => undefined);
            if (deleting != null)
                throw new Error("Local file deletion in progress");
            let readinessTimer: ReturnType<typeof setTimeout> | undefined;
            try {
                await Promise.race([
                    runtimeSettled,
                    new Promise<never>((_, reject) => {
                        readinessTimer = setTimeout(() => reject(new Error("On-device coach readiness timed out")), 30_000);
                    })
                ]);
            } finally {
                if (readinessTimer != null)
                    clearTimeout(readinessTimer);
            }
            if (deleting != null)
                throw new Error("Local file deletion in progress");
            const model = getModel();
            if (model == null)
                throw new Error(`On-device coach is unavailable (${runtimeStatus()})`);
            const db = getDb();
            const record = coachRecord(db, id);
            const reply = await askCoach(model, record, prompt, history);
            if (deleting != null)
                throw new Error("Local file deletion in progress");
            db.exec("BEGIN");
            try {
                const insert = db.prepare("INSERT INTO coach_turn (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)");
                const now = new Date().toISOString();
                insert.run(randomUUID(), id, "user", prompt, now);
                insert.run(randomUUID(), id, "assistant", reply, now);
                db.exec("COMMIT");
            } catch (error) {
                db.exec("ROLLBACK");
                throw error;
            }
            return {reply};
        })();
        coachInFlight = operation;
        try {
            return await operation;
        } finally {
            if (coachInFlight === operation)
                coachInFlight = null;
        }
    },
    "review.tap": (visitId, label) => tap(text(visitId, "visitId"), oneOf(label, ["serves", "drifts"], "label")),
    "review.answer"(sessionId, outcome) {
        const result = getDb()
            .prepare("UPDATE session SET outcome = ? WHERE id = ? AND ended_at IS NOT NULL")
            .run(oneOf(outcome, ["yes", "not_yet", "unanswered"], "outcome"), text(sessionId, "sessionId"));
        if (result.changes === 0)
            throw new Error("The session is still running or does not exist");
    },
    "history.list"(): HistoryRow[] {
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

/** End through the same capture and store lifecycle used by the desktop controls. */
export function endSessionFromExtension() {
    if (deleting != null)
        throw new Error("Local file deletion in progress");
    if (runningSession() == null)
        return;
    return handlers["session.end"]();
}

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

const assistantWindows = import("./windows.ts");
const MAX_ASSISTANT_DELTA = 128;

function validAssistantDelta(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_ASSISTANT_DELTA;
}

export function registerIpc() {
    ipcMain.on("assistant.move", (event, dx: unknown, dy: unknown) => {
        void assistantWindows.then((windows) => {
            if (!windows.isAssistantSender(event.sender) || !validAssistantDelta(dx) || !validAssistantDelta(dy))
                return;
            windows.moveAssistantBy(dx, dy);
        });
    });
    ipcMain.handle("assistant.toggle", async (event) => {
        const windows = await assistantWindows;
        if (!windows.isAssistantSender(event.sender))
            throw new Error("Assistant controls are only available to the assistant window");
        return windows.toggleAssistant();
    });
    ipcMain.handle("assistant.collapse", async (event) => {
        const windows = await assistantWindows;
        if (!windows.isAssistantSender(event.sender))
            throw new Error("Assistant controls are only available to the assistant window");
        return windows.collapseAssistant();
    });
    ipcMain.handle("assistant.state", async (event) => {
        const windows = await assistantWindows;
        if (!windows.isAssistantSender(event.sender))
            throw new Error("Assistant controls are only available to the assistant window");
        return windows.getAssistantState();
    });

    for (const [channel, handler] of Object.entries(handlers))
        ipcMain.handle(channel, (_event, ...args: unknown[]) => {
            if (deleting != null && channel !== "privacy.deleteFile")
                throw new Error("Local file deletion in progress");
            return handler(...args);
        });
}

/** Refresh desktop views after a native-host commit; never recreate a deleted Store. */
export function watchExternalStoreChanges() {
    let previousDb: ReturnType<typeof getDb> | null = null;
    let previousVersion: unknown;
    const timer = setInterval(() => {
        if (deleting != null || !fs.existsSync(dbPath())) {
            previousDb = null;
            return;
        }
        try {
            const db = getDb();
            const version = db.prepare("PRAGMA data_version").get()?.data_version;
            if (previousDb === db && previousVersion !== version) {
                emit("session:changed", {sessionId: runningSession()?.id ?? null});
                emit("verdict:updated", {visitId: ""});
            }
            previousDb = db;
            previousVersion = version;
        } catch {
            // A locked or removed file will be checked again on the next tick.
        }
    }, 1000);
    timer.unref();
    return () => clearInterval(timer);
}

/** Start uses the canonical capture lifecycle even when requested by the browser. */
export function startSessionFromExtension(input: unknown) {
    if (deleting != null)
        throw new Error("Local file deletion in progress");
    return handlers["session.start"](input);
}
