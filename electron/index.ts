import path from "node:path";
import {fileURLToPath} from "node:url";
import {app, session} from "electron";
import {registerIpc, recoverUnfinishedSession} from "./ipc.ts";
import {ledgerDir} from "./paths.ts";
import {openCompanion} from "./companion-window.ts";
import {watchPhase} from "./phase.ts";
import {readSwitch} from "./saved-lists.ts";
import {createTray, openMain} from "./windows.ts";
import {startRuntime, stopRuntime} from "./ai/runtime.ts";
import {discardJudgments, enqueueUnjudged} from "./harness/queue.ts";
import {stopCapture} from "./capture/poller.ts";
import {closeDb} from "./store/db.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Built layout: dist/ (renderer), dist-electron/ (main + preload). APP_ROOT is the repo root in dev.
process.env.APP_ROOT = path.join(__dirname, "..");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL != null
    ? path.join(process.env.APP_ROOT, "public")
    : path.join(process.env.APP_ROOT, "dist");

// Chromium's profile (caches, local storage) would otherwise share %APPDATA%\Ledger with ledger.db. Keep it in a subfolder.
app.setPath("userData", path.join(ledgerDir(), "chromium"));

// On Linux, GPU compositing paints the transparent companion window as a black, clipped square.
// The UI is flat paper, so software compositing is enough.
if (process.platform === "linux") {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch("enable-transparent-visuals");
}

/**
 * No network client (BR-005, system-design §9): every request that is not a local file is cancelled.
 * The Vite dev server is allowed only in an unpackaged dev run.
 */
function blockNetwork() {
    const devServer = !app.isPackaged ? process.env.VITE_DEV_SERVER_URL : undefined;
    const devHost = devServer != null ? new URL(devServer).host : null;
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = new URL(details.url);
        const local = url.protocol === "file:" || url.protocol === "devtools:" || url.protocol === "data:";
        const dev = devHost != null && url.host === devHost && ["http:", "ws:"].includes(url.protocol);
        callback({cancel: !local && !dev});
    });
}

if (!app.requestSingleInstanceLock())
    app.quit();
else {
    app.on("second-instance", () => openMain("idle"));

    // Ledger lives in the tray: closing every window does not quit it. Quit is in the tray's right-click menu.
    app.on("window-all-closed", () => {});
    let stopping = false;
    let stopped = false;
    app.on("will-quit", (event) => {
        if (stopped)
            return;
        event.preventDefault();
        if (stopping)
            return;
        stopping = true;
        stopCapture();
        discardJudgments();
        void stopRuntime().catch((err) => console.error("Model shutdown failed", err))
            .finally(() => {
                closeDb();
                stopped = true;
                app.quit();
            });
    });

    void app.whenReady().then(() => {
        blockNetwork();
        registerIpc();
        createTray();
        const recovered = recoverUnfinishedSession();
        enqueueUnjudged();
        if (readSwitch("companion"))
            openCompanion();
        openMain(recovered != null ? `review/${recovered}` : "idle");
        setInterval(() => watchPhase(), 5000);
        // After the windows show, so Start never waits on the model (US-001).
        void startRuntime();
    });
}
