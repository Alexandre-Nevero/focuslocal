import {isUtf8} from "node:buffer";
import {DatabaseSync} from "node:sqlite";
import {pathToFileURL} from "node:url";
import {dbPath} from "../electron/paths.ts";

type Message = {type: "status"} | {
    type: "tab",
    url: string | null,
    title: string | null,
    browser: "chrome" | "msedge" | "brave" | "chromium"
};
type StatusReply = {intention: string, startedAt: string} | {none: true};

// The relay's tab/status messages do not need Chrome's larger inbound allowance.
const MAX_FRAME = 1024 * 1024;

function validMessage(message: unknown): message is Message {
    if (message == null || typeof message !== "object" || !("type" in message))
        return false;
    if (message.type === "status")
        return true;
    return message.type === "tab" &&
        "url" in message && (message.url === null || typeof message.url === "string") &&
        "title" in message && (message.title === null || typeof message.title === "string") &&
        "browser" in message && typeof message.browser === "string" &&
        ["chrome", "msedge", "brave", "chromium"].includes(message.browser);
}

function handle(message: Message): StatusReply | undefined {
    let db: DatabaseSync | undefined;
    let reply: StatusReply | undefined;
    try {
        const file = pathToFileURL(dbPath());
        file.searchParams.set("mode", message.type === "status" ? "ro" : "rw");
        // A URI string retains mode=rw through node:sqlite's SQLITE_OPEN_URI path.
        // Unlike an existence check, it cannot recreate a DB removed just before open.
        db = new DatabaseSync(file.href, {readOnly: message.type === "status"});
        db.exec("PRAGMA busy_timeout=2000");
        if (message.type === "tab") {
            db.prepare(`INSERT INTO browser_tab (id, url, title, browser, updated_at) VALUES (1, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET url=excluded.url, title=excluded.title,
                    browser=excluded.browser, updated_at=excluded.updated_at`)
                .run(message.url, message.title, message.browser, new Date().toISOString());
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
    return message.type === "status" ? reply ?? {none: true} : undefined;
}

async function send(reply: StatusReply): Promise<void> {
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
