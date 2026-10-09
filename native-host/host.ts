import {randomUUID} from "node:crypto";
import {isUtf8} from "node:buffer";
import {DatabaseSync} from "node:sqlite";
import {pathToFileURL} from "node:url";
import {dbPath} from "../electron/paths.ts";

type Message = {type: "status"} | {type: "blocklist"} | {
    type: "tab",
    url: string | null,
    title: string | null,
    browser: "chrome" | "msedge" | "brave" | "chromium"
} | {type: "hit", target: string};
type StatusReply = {intention: string, startedAt: string} | {none: true};
type BlocklistReply = {sites: string[]};
type Reply = StatusReply | BlocklistReply;

// The relay's tab/status messages do not need Chrome's larger inbound allowance.
const MAX_FRAME = 1024 * 1024;

const stripWww = (host: string) => (host.startsWith("www.") ? host.slice(4) : host);

const HOST_RE =
    /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/gi;

function hostsIn(text: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const match of text.matchAll(HOST_RE)) {
        const host = stripWww(match[1]!.toLowerCase());
        if (seen.has(host))
            continue;
        seen.add(host);
        out.push(host);
    }
    return out;
}

const siteMatches = (host: string, pattern: string) => {
    const h = stripWww(host.toLowerCase());
    const p = stripWww(pattern.toLowerCase());
    return h === p || h.endsWith(`.${p}`);
};

function bareSite(target: string): string {
    const trimmed = target.trim().toLowerCase();
    if (trimmed.includes("://")) {
        try {
            return stripWww(new URL(trimmed).hostname);
        } catch {
            return stripWww(trimmed);
        }
    }
    return stripWww(trimmed);
}

function validMessage(message: unknown): message is Message {
    if (message == null || typeof message !== "object" || !("type" in message))
        return false;
    if (message.type === "status" || message.type === "blocklist")
        return true;
    if (message.type === "hit")
        return "target" in message && typeof message.target === "string";
    return message.type === "tab" &&
        "url" in message && (message.url === null || typeof message.url === "string") &&
        "title" in message && (message.title === null || typeof message.title === "string") &&
        "browser" in message && typeof message.browser === "string" &&
        ["chrome", "msedge", "brave", "chromium"].includes(message.browser);
}

function blocklistSites(db: DatabaseSync, sessionId: string, intention: string): string[] {
    const declared = db.prepare("SELECT target, role FROM declared_target WHERE session_id = ?")
        .all(sessionId) as {target: string, role: string}[];
    const saved = db.prepare("SELECT target FROM saved_target WHERE role = 'block'")
        .all() as {target: string}[];
    const work = declared.filter((row) => row.role === "work").map((row) => bareSite(row.target));
    const intentionHosts = hostsIn(intention.toLowerCase());
    const seen = new Set<string>();
    const sites: string[] = [];
    const candidates = [
        ...declared.filter((row) => row.role === "distraction" && row.target.includes(".")).map((row) => row.target),
        ...saved.filter((row) => row.target.includes(".")).map((row) => row.target)
    ];
    for (const raw of candidates) {
        const site = bareSite(raw);
        if (site === "" || seen.has(site))
            continue;
        if (work.some((entry) => siteMatches(site, entry)))
            continue;
        if (intentionHosts.some((entry) => siteMatches(site, entry)))
            continue;
        seen.add(site);
        sites.push(site);
    }
    return sites;
}

function handle(message: Message): Reply | undefined {
    let db: DatabaseSync | undefined;
    let reply: Reply | undefined;
    const readOnly = message.type === "status" || message.type === "blocklist";
    try {
        const file = pathToFileURL(dbPath());
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
        } else if (message.type === "hit") {
            const row = db.prepare("SELECT id FROM session WHERE ended_at IS NULL LIMIT 1").get() as {id: string} | undefined;
            if (row != null)
                db.prepare("INSERT OR IGNORE INTO block_hit (id, session_id, target, kind, reached_at) VALUES (?, ?, ?, 'site', ?)")
                    .run(randomUUID(), row.id, message.target, new Date().toISOString());
        } else if (message.type === "blocklist") {
            const row = db.prepare("SELECT id, intention FROM session WHERE ended_at IS NULL LIMIT 1")
                .get() as {id: string, intention: string} | undefined;
            reply = {sites: row == null ? [] : blocklistSites(db, row.id, row.intention)};
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
        if (message.type === "blocklist")
            reply = {sites: []};
        else
            reply = undefined;
    } finally {
        try {
            db?.close();
        } catch {
            console.error("ledger-host: database close failed");
            if (message.type === "status")
                reply = undefined;
            else if (message.type === "blocklist")
                reply = {sites: []};
        }
    }
    if (message.type === "status")
        return reply ?? {none: true};
    if (message.type === "blocklist")
        return reply ?? {sites: []};
    return undefined;
}

async function send(reply: Reply): Promise<void> {
    let json = JSON.stringify(reply);
    let length = Buffer.byteLength(json);
    if (length > MAX_FRAME) {
        console.error("ledger-host: status exceeds frame limit");
        json = JSON.stringify("sites" in reply ? {sites: []} : {none: true});
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
