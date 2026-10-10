import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {test} from "node:test";
import {fileURLToPath} from "node:url";

const status = frame({type: "status"});
const tab = {type: "tab", url: "ledger-test:authored-tab", title: "  Authored Café 窓  ", browser: "msedge"};

function frame(value: unknown): Buffer {
    const body = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length);
    return Buffer.concat([header, body]);
}

function replies(output: Buffer): unknown[] {
    const result: unknown[] = [];
    for (let offset = 0; offset < output.length;) {
        assert.ok(output.length - offset >= 4, "stdout ends with a partial header");
        const length = output.readUInt32LE(offset);
        assert.ok(length > 0 && length <= 1024 * 1024, "stdout contains only bounded frames");
        offset += 4;
        assert.ok(output.length - offset >= length, "stdout ends with a partial body");
        result.push(JSON.parse(output.subarray(offset, offset + length).toString("utf8")));
        offset += length;
    }
    return result;
}

test("native host process preserves framing, database ownership and privacy", {timeout: 60000}, async (t) => {
    const root = mkdtempSync(join(tmpdir(), "ledger host #%-"));
    const directory = process.platform === "darwin"
        ? join(root, "Library", "Application Support", "Ledger") : join(root, "Ledger");
    const file = join(directory, "ledger.db");
    t.after(() => rmSync(root, {recursive: true, force: true}));
    const env = {...process.env, APPDATA: root, XDG_CONFIG_HOME: root, HOME: root, USERPROFILE: root};
    const launch = () => {
        const child = spawn(process.execPath, [fileURLToPath(new URL("./host.ts", import.meta.url)), "ignored-origin", "--parent-window=0"], {
            env, stdio: ["pipe", "pipe", "pipe"], timeout: 10000
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
        const result = once(child, "close").then(([code, signal]) => {
            assert.equal(signal, null, "host must not hang or require killing");
            const diagnostics = Buffer.concat(stderr).toString("utf8");
            assert.ok(!diagnostics.includes(tab.url) && !diagnostics.includes(tab.title), "diagnostics must not disclose tab data");
            return {code, diagnostics, messages: replies(Buffer.concat(stdout))};
        });
        t.after(() => child.kill());
        const waitForOutput = async (bytes: number) => {
            while (stdout.reduce((total, chunk) => total + chunk.length, 0) < bytes) {
                await Promise.race([
                    once(child.stdout, "data"),
                    result.then(() => {
                        throw new Error("Host exited before its reply");
                    })
                ]);
            }
        };
        return {child, result, waitForOutput};
    };
    const run = async (...chunks: Buffer[]) => {
        const {child, result} = launch();
        for (const chunk of chunks) {
            await new Promise<void>((resolve, reject) => {
                child.stdin.write(chunk, (error) => (error ? reject(error) : resolve()));
            });
        }
        child.stdin.end();
        return await result;
    };
    const migrate = () => {
        mkdirSync(directory, {recursive: true});
        const db = new DatabaseSync(file);
        db.exec("PRAGMA journal_mode=WAL");
        const migrations = new URL("../electron/store/migrations/", import.meta.url);
        for (const name of readdirSync(migrations).filter((name) => name.endsWith(".sql"))
            .sort())
            db.exec(readFileSync(new URL(name, migrations), "utf8"));
        db.close();
    };

    await t.test("missing directory or database stays absent while status still replies", async () => {
        for (const createDirectory of [false, true]) {
            if (createDirectory)
                mkdirSync(directory, {recursive: true});
            const result = await run(Buffer.concat([frame(tab), status]), status);
            assert.equal(result.code, 0);
            assert.deepEqual(result.messages, [{none: true}, {none: true}]);
            assert.equal(existsSync(file), false);
            assert.equal(existsSync(`${file}-wal`), false);
            assert.equal(existsSync(`${file}-shm`), false);
            assert.equal(existsSync(directory), createDirectory);
        }
    });

    migrate();
    await t.test("fragmented and coalesced UTF-8 frames upsert only browser_tab", async () => {
        const longTitle = `${tab.title}${"authored ".repeat(80)}`;
        const first = frame({...tab, title: longTitle});
        const split = first.indexOf(Buffer.from("é")) + 1;
        const before = Date.now();
        const result = await run(first.subarray(0, 1), first.subarray(1, 3), first.subarray(3, split),
            Buffer.concat([first.subarray(split), status, status]));
        assert.equal(result.code, 0);
        assert.deepEqual(result.messages, [{none: true}, {none: true}]);
        const db = new DatabaseSync(file);
        try {
            const row = db.prepare("SELECT * FROM browser_tab").get();
            assert.ok(row);
            assert.equal(row.id, 1);
            assert.equal(row.url, tab.url);
            assert.equal(row.title, longTitle);
            assert.equal(row.browser, "msedge");
            const updated = Date.parse(String(row.updated_at));
            assert.ok(updated >= before && updated <= Date.now());
            for (const table of ["session", "visit", "verdict", "memory", "setting"])
                assert.equal(db.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count, 0);
        } finally {
            db.close();
        }
        for (const browser of ["chrome", "brave", "chromium"]) {
            assert.deepEqual((await run(frame({type: "tab", url: null, title: null, browser}))).messages, []);
            const read = new DatabaseSync(file, {readOnly: true});
            try {
                assert.deepEqual(read.prepare("SELECT url, title, browser FROM browser_tab").all()
                    .map((row) => ({...row})),
                [{url: null, title: null, browser}]);
            } finally {
                read.close();
            }
        }
    });

    await t.test("invalid JSON, UTF-8, shapes and browser names do not write or disrupt the next status", async () => {
        const invalid = [null, [], "status", {type: "other"}, {...tab, browser: ""}, {...tab, browser: "firefox"},
            {...tab, browser: ["chrome"]}, {...tab, url: 1}, {...tab, title: {}}, {type: "tab", browser: "chrome"}];
        const result = await run(Buffer.concat([
            frame(Buffer.from(`{broken ${tab.title} ${tab.url}`)), frame(Buffer.alloc(0)),
            frame(Buffer.concat([Buffer.from('{"type":"tab","browser":"chrome","url":null,"title":"'),
                Buffer.from([0xff]), Buffer.from('"}')])), ...invalid.map(frame), status
        ]));
        assert.equal(result.code, 0);
        assert.deepEqual(result.messages, [{none: true}]);
        assert.ok(result.diagnostics.includes("ledger-host:"));
        const db = new DatabaseSync(file, {readOnly: true});
        assert.equal(db.prepare("SELECT browser FROM browser_tab").get()?.browser, "chromium");
        db.close();
    });

    await t.test("one live process releases each DB before replying and reopens after deletion", async () => {
        const db = new DatabaseSync(file);
        db.prepare("INSERT INTO session (id, intention, started_at) VALUES (?, ?, ?)")
            .run("test", "Authored intention", "2026-10-09T12:00:00.000Z");
        db.close();
        const {child, result, waitForOutput} = launch();
        const runningReply = {intention: "Authored intention", startedAt: "2026-10-09T12:00:00.000Z"};
        const runningBytes = frame(runningReply).length;
        child.stdin.write(status);
        await waitForOutput(runningBytes);
        // On Windows this also detects a host keeping SQLite's file handle open.
        renameSync(file, `${file}.saved`);
        child.stdin.write(Buffer.concat([frame(tab), status]));
        await waitForOutput(runningBytes + frame({none: true}).length);
        assert.equal(existsSync(file), false);
        renameSync(`${file}.saved`, file);
        child.stdin.write(status);
        await waitForOutput(2 * runningBytes + frame({none: true}).length);
        child.stdin.end();
        const finished = await result;
        assert.equal(finished.code, 0);
        assert.deepEqual(finished.messages, [
            {intention: "Authored intention", startedAt: "2026-10-09T12:00:00.000Z"}, {none: true},
            {intention: "Authored intention", startedAt: "2026-10-09T12:00:00.000Z"}
        ]);
    });

    await t.test("blocklist with no running session returns empty sites", async () => {
        assert.deepEqual((await run(frame({type: "blocklist"}))).messages, [{sites: []}]);
    });

    await t.test("EOF flushes large replies and oversized replies remain valid frames", async () => {
        const db = new DatabaseSync(file);
        db.prepare("UPDATE session SET intention = ''").run();
        assert.deepEqual((await run(status)).messages, [{intention: "", startedAt: "2026-10-09T12:00:00.000Z"}]);
        const intention = "é".repeat(32000);
        db.prepare("UPDATE session SET intention = ?").run(intention);
        const result = await run(Buffer.concat(Array.from({length: 32}, () => status)));
        assert.equal(result.code, 0);
        assert.equal(result.messages.length, 32);
        for (const message of result.messages)
            assert.deepEqual(message, {intention, startedAt: "2026-10-09T12:00:00.000Z"});
        db.prepare("UPDATE session SET intention = ?").run("é".repeat(1024 * 1024));
        assert.deepEqual((await run(status)).messages, [{none: true}]);
        db.prepare("UPDATE session SET ended_at = ?").run("2026-10-09T12:01:00.000Z");
        assert.deepEqual((await run(status)).messages, [{none: true}]);
        db.close();
    });

    await t.test("oversized and truncated frames fail without losing an earlier status reply", async () => {
        const excessive = Buffer.alloc(4);
        excessive.writeUInt32LE(1024 * 1024 + 1);
        for (const broken of [excessive, Buffer.from([4, 0]), frame(tab).subarray(0, 12)]) {
            const result = await run(Buffer.concat([status, broken]));
            assert.equal(result.code, 1);
            assert.deepEqual(result.messages, [{none: true}]);
        }
    });

    await t.test("SQLite contention drops tab instead of acknowledging a write", async () => {
        const db = new DatabaseSync(file);
        db.exec("BEGIN IMMEDIATE");
        try {
            const result = await run(Buffer.concat([frame(tab), status]));
            assert.equal(result.code, 0);
            assert.deepEqual(result.messages, [{none: true}]);
            assert.ok(result.diagnostics.includes("ledger-host:"));
            assert.equal(db.prepare("SELECT browser FROM browser_tab").get()?.browser, "chromium");
        } finally {
            db.exec("ROLLBACK");
            db.close();
        }
    });

    await t.test("unmigrated or corrupt files are not repaired or populated by the host", async () => {
        rmSync(file);
        for (const contents of [Buffer.alloc(0), Buffer.from("authored corrupt sqlite file")]) {
            writeFileSync(file, contents);
            const result = await run(Buffer.concat([frame(tab), status, status]));
            assert.equal(result.code, 0);
            assert.deepEqual(result.messages, [{none: true}, {none: true}]);
            assert.ok(result.diagnostics.includes("ledger-host:"));
            assert.deepEqual(readFileSync(file), contents);
        }
    });
});
