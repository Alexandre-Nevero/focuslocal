import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import path from "node:path";
import {fileURLToPath} from "node:url";

assert.equal(process.platform, "win32", "This launcher check is for Windows");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bat = path.join(repo, "out", "native-host", "ledger-host.bat");
const child = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `""${bat}" --parent-window=0"`], {
    windowsVerbatimArguments: true, windowsHide: true, timeout: 10000
});
const output = [];
let diagnostics = "";
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.on("data", (chunk) => diagnostics += chunk);
const closed = once(child, "close");
const body = Buffer.from('{"type":"status"}');
const header = Buffer.alloc(4);
header.writeUInt32LE(body.length);
child.stdin.end(Buffer.concat([header, body]));
const [code, signal] = await closed;
assert.equal(signal, null, "Native host timed out");
assert.equal(code, 0, diagnostics);
const frame = Buffer.concat(output);
assert.ok(frame.length >= 4, "Native host did not reply");
assert.equal(frame.readUInt32LE(0), frame.length - 4, "stdout contains something other than one frame");
const reply = JSON.parse(frame.subarray(4).toString("utf8"));
assert.ok(reply.none === true || (typeof reply.intention === "string" && Number.isFinite(Date.parse(reply.startedAt))),
    "Invalid session status reply");
console.log(`Native host framing ok: ${reply.none ? "no session" : "running session"}`);
