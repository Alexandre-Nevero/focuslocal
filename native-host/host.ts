import {isUtf8} from "node:buffer";
import {DatabaseSync} from "node:sqlite";
import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {dbPath} from "../electron/paths.ts";
import {readReview, tapVisit, updateSessionIntention} from "../electron/store/review.ts";

type PopupRoute = "idle" | "declare" | "running" | "history" | "privacy" | `review/${string}`;
type Message = {type: "status"} | {type: "popup", action: "summary", requestId: string} | {
    type: "popup", action: "answer", requestId: string, sessionId: string, outcome: "yes" | "not_yet" | "unanswered"
} | {type: "popup", action: "updateIntention", requestId: string, sessionId: string, intention: string} | {
    type: "popup", action: "tap", requestId: string, visitId: string, label: "serves" | "drifts"
} | {type: "popup", action: "start", requestId: string, intention: string, targets: {target: string, role: "work" | "distraction"}[]} | {
    type: "popup", action: "open", requestId: string, route: PopupRoute
} | {
    type: "popup", action: "end", requestId: string
} | {
    type: "tab",
    url: string | null,
    title: string | null,
    browser: "chrome" | "msedge" | "brave" | "chromium"
};
type StatusReply = {intention: string, startedAt: string} | {none: true};
type PopupSession = {
    id: string, intention: string, startedAt: string, endedAt: string | null, outcome: string | null,
    targets: {target: string, role: string}[],
    visits: {id: string, kind: string, appName: string, windowTitle: string | null, url: string | null,
        startedAt: string, endedAt: string | null, lastSeenAt: string, label: string | null,
        shown: string | null, shownSource: string | null}[],
    awayMs: number, unrecordedMs: number
};
type PopupReply = {
    running: PopupSession | null,
    latest: PopupSession | null,
    requestId?: string
} | {error: "unavailable", requestId?: string} | {ok: boolean, requestId?: string};

// The relay's tab/status messages do not need Chrome's larger inbound allowance.
const MAX_FRAME = 1024 * 1024;

function validMessage(message: unknown): message is Message {
    if (message == null || typeof message !== "object" || !("type" in message))
        return false;
    if (message.type === "status")
        return true;
    if (message.type === "popup")
        return "requestId" in message && typeof message.requestId === "string" &&
            (("action" in message && message.action === "summary") ||
            ("action" in message && message.action === "answer" && "sessionId" in message &&
                typeof message.sessionId === "string" && "outcome" in message &&
                (message.outcome === "yes" || message.outcome === "not_yet" || message.outcome === "unanswered")) ||
            ("action" in message && message.action === "updateIntention" && "sessionId" in message &&
                typeof message.sessionId === "string" && "intention" in message && typeof message.intention === "string") ||
            ("action" in message && message.action === "tap" && "visitId" in message && typeof message.visitId === "string" &&
                "label" in message && (message.label === "serves" || message.label === "drifts")) ||
            ("action" in message && message.action === "start" && "intention" in message && typeof message.intention === "string" &&
                message.intention.length <= 4000 && "targets" in message && Array.isArray(message.targets) && message.targets.length <= 100 &&
                message.targets.every((target) => target != null && typeof target === "object" && "target" in target &&
                    typeof target.target === "string" && target.target.length <= 256 && "role" in target &&
                    (target.role === "work" || target.role === "distraction"))) ||
            ("action" in message && message.action === "open" && "route" in message &&
                (["idle", "declare", "running", "history", "privacy"].includes(String(message.route)) ||
                    (typeof message.route === "string" && /^review\/[\w-]+$/.test(message.route)))) ||
            ("action" in message && message.action === "end"));
    return message.type === "tab" &&
        "url" in message && (message.url === null || typeof message.url === "string") &&
        "title" in message && (message.title === null || typeof message.title === "string") &&
        "browser" in message && typeof message.browser === "string" &&
        ["chrome", "msedge", "brave", "chromium"].includes(message.browser);
}

function handle(message: Message): StatusReply | PopupReply | undefined {
    if (message.type === "popup" && (message.action === "open" || message.action === "end")) {
        const argument = message.action === "open" ? `--ledger-route=${message.route}` : "--ledger-action=end";
        return {ok: launchApp(argument), requestId: message.requestId};
    }
    if (message.type === "popup" && message.action === "start") {
        const payload = Buffer.from(JSON.stringify({intention: message.intention.trim(), targets: message.targets})).toString("base64url");
        return {ok: launchApp(`--ledger-start=${payload}`), requestId: message.requestId};
    }
    let db: DatabaseSync | undefined;
    let reply: StatusReply | PopupReply | undefined;
    try {
        const file = pathToFileURL(dbPath());
        const readOnly = message.type === "status" || (message.type === "popup" && message.action === "summary");
        file.searchParams.set("mode", readOnly ? "ro" : "rw");
        // A URI string retains mode=rw through node:sqlite's SQLITE_OPEN_URI path.
        // Unlike an existence check, it cannot recreate a DB removed just before open.
        db = new DatabaseSync(file.href, {readOnly});
        db.exec("PRAGMA busy_timeout=2000");
        if (message.type === "tab") {
            db.prepare(`INSERT INTO browser_tab (id, url, title, browser, updated_at) VALUES (1, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET url=excluded.url, title=excluded.title,
                    browser=excluded.browser, updated_at=excluded.updated_at`)
                .run(message.url, message.title, message.browser, new Date().toISOString());
        } else if (message.type === "popup" && message.action === "answer") {
            const result = db.prepare("UPDATE session SET outcome = ? WHERE id = ? AND ended_at IS NOT NULL")
                .run(message.outcome, message.sessionId);
            reply = {ok: result.changes > 0};
        } else if (message.type === "popup" && message.action === "updateIntention") {
            updateSessionIntention(db, message.sessionId, message.intention);
            reply = {ok: true};
        } else if (message.type === "popup" && message.action === "tap") {
            const visit = db.prepare(`SELECT v.kind FROM visit v JOIN session s ON s.id = v.session_id
                WHERE v.id = ? AND s.ended_at IS NOT NULL`).get(message.visitId);
            if (visit == null || visit.kind !== "attention")
                throw new Error("No ended attention visit");
            tapVisit(db, message.visitId, message.label);
            reply = {ok: true};
        } else if (message.type === "popup" && message.action === "summary") {
            const running = db.prepare("SELECT id, intention, started_at FROM session WHERE ended_at IS NULL LIMIT 1").get() as
                {id: string, intention: string, started_at: string} | undefined;
            const ended = db.prepare("SELECT id, intention, started_at, ended_at, outcome FROM session WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 1").get() as
                {id: string, intention: string, started_at: string, ended_at: string, outcome: string | null} | undefined;
            const runningReview = running ? popupSession(readReview(db, running.id)) : null;
            const endedReview = ended ? popupSession(readReview(db, ended.id)) : null;
            reply = {running: runningReview, latest: endedReview};
        } else {
            const row = db.prepare("SELECT intention, started_at FROM session WHERE ended_at IS NULL LIMIT 1").get();
            if (row != null) {
                if (typeof row.intention !== "string" || typeof row.started_at !== "string")
                    throw new Error("Invalid session row");
                reply = {intention: row.intention, startedAt: row.started_at};
            }
        }
    } catch {
        // SQLite errors can contain bound/private values. Never print their message.
        console.error("ledger-host: database unavailable");
        reply = undefined;
    } finally {
        try {
            db?.close();
        } catch {
            console.error("ledger-host: database close failed");
            reply = undefined;
        }
    }
    if (message.type === "status") return reply as StatusReply ?? {none: true};
    if (message.type === "popup") {
        const fallback: PopupReply = message.action === "summary" ? {error: "unavailable"} : {ok: false};
        return {...(reply as PopupReply ?? fallback), requestId: message.requestId} as PopupReply;
    }
    return undefined;
}

function launchApp(argument: string): boolean {
    try {
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        const root = path.resolve(moduleDir, path.basename(path.dirname(moduleDir)) === "out" ? "../.." : "..");
        const env = {...process.env};
        delete env.ELECTRON_RUN_AS_NODE;
        const child = spawn(process.execPath, [root, argument], {env, windowsHide: true, detached: true, stdio: "ignore"});
        child.on("error", () => console.error("ledger-host: desktop app launch failed"));
        child.unref();
        return true;
    } catch {
        console.error("ledger-host: desktop app launch failed");
        return false;
    }
}

function popupSession(review: ReturnType<typeof readReview>): PopupSession {
    const visits = review.visits.map((visit) => ({
        id: visit.id,
        kind: visit.kind,
        appName: visit.appName,
        windowTitle: visit.windowTitle,
        url: visit.url,
        startedAt: visit.startedAt,
        endedAt: visit.endedAt,
        lastSeenAt: visit.lastSeenAt,
        label: visit.shown,
        shown: visit.shown,
        shownSource: visit.shownSource ?? null,
        verdict: visit.verdict
    }));
    const awayMs = review.visits.filter((visit) => visit.kind === "away")
        .reduce((total, visit) => total + Math.max(0, Date.parse(visit.endedAt ?? visit.lastSeenAt) - Date.parse(visit.startedAt)), 0);
    return {
        id: review.session.id,
        intention: review.session.intention,
        startedAt: review.session.startedAt,
        endedAt: review.session.endedAt,
        outcome: review.session.outcome,
        targets: review.session.targets,
        visits,
        awayMs,
        unrecordedMs: review.unrecordedMs
    };
}

async function send(reply: StatusReply | PopupReply): Promise<void> {
    let json = JSON.stringify(reply);
    let length = Buffer.byteLength(json);
    if (length > MAX_FRAME) {
        console.error("ledger-host: status exceeds frame limit");
        json = '{"none":true}';
        length = Buffer.byteLength(json);
    }
    const frame = Buffer.allocUnsafe(4 + length);
    frame.writeUInt32LE(length);
    frame.write(json, 4, "utf8");
    // Await the actual write, bounding output buffering and preserving replies at EOF.
    await new Promise<void>((resolve, reject) => {
        process.stdout.write(frame, (error) => (error ? reject(error) : resolve()));
    });
}

async function relay(): Promise<void> {
    const header = Buffer.allocUnsafe(4);
    let headerBytes = 0;
    let body: Buffer | null = null;
    let bodyBytes = 0;
    for await (const chunk of process.stdin) {
        let offset = 0;
        while (offset < chunk.length) {
            if (body === null) {
                const count = Math.min(4 - headerBytes, chunk.length - offset);
                chunk.copy(header, headerBytes, offset, offset + count);
                headerBytes += count;
                offset += count;
                if (headerBytes < 4)
                    continue;
                const length = header.readUInt32LE(0);
                if (length > MAX_FRAME) {
                    console.error("ledger-host: frame too large");
                    process.exitCode = 1;
                    return;
                }
                body = Buffer.allocUnsafe(length);
                bodyBytes = 0;
            }
            const count = Math.min(body.length - bodyBytes, chunk.length - offset);
            chunk.copy(body, bodyBytes, offset, offset + count);
            bodyBytes += count;
            offset += count;
            if (bodyBytes < body.length)
                continue;
            let message: unknown;
            try {
                if (!isUtf8(body))
                    throw new Error("Invalid UTF-8");
                message = JSON.parse(body.toString("utf8"));
            } catch {
                console.error("ledger-host: bad json or UTF-8");
            }
            body = null;
            headerBytes = 0;
            if (!validMessage(message)) {
                console.error("ledger-host: invalid message");
                continue;
            }
            const reply = handle(message);
            if (reply != null)
                await send(reply);
        }
    }
    if (headerBytes !== 0 || body !== null) {
        console.error("ledger-host: truncated frame");
        process.exitCode = 1;
    }
}

process.stdout.on("error", () => {
    console.error("ledger-host: output unavailable");
    process.exitCode = 1;
    process.stdin.destroy();
});
void relay().catch(() => {
    console.error("ledger-host: stream unavailable");
    process.exitCode = 1;
    process.stdin.destroy();
});
