const HOST = "com.focuslocal.ledger";
const brands = navigator.userAgentData?.brands.map(({brand}) => brand) ?? [];
const browser = brands.includes("Brave") ? "brave"
    : brands.includes("Microsoft Edge") ? "msedge"
        : brands.includes("Google Chrome") ? "chrome" : "chromium";
let port = null;
let delay = 1000;
let activeRequest = 0;

/** Relays only the currently focused, non-private tab. */
async function sendActive() {
    const request = ++activeRequest;
    try {
        // A hidden incognito window can leave lastFocusedWindow pointing at a normal window.
        // Require actual focus as well, so private-window activity never refreshes that row.
        const window = await chrome.windows.getLastFocused();
        if (!window.focused || window.incognito || !port) {
            return;
        }
        const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
        if (request !== activeRequest || !tab || tab.incognito || tab.windowId !== window.id || !port) {
            return;
        }
        port.postMessage({type: "tab", url: tab.url ?? null, title: tab.title ?? null, browser});
    } catch {
        // Window/tab closure and native-host disconnection can race the asynchronous query.
        console.warn("Ledger active-tab relay unavailable");
    }
}

/**
 * Backs off failed connections; a healthy port resets the delay.
 * @param {number} connectedAt Port creation timestamp.
 */
function reconnect(connectedAt) {
    port = null;
    ++activeRequest;
    if (Date.now() - connectedAt > 30000) {
        delay = 1000;
    }
    setTimeout(connect, delay);
    // MV3's 30 s idle deadline can otherwise cancel the capped reconnect timer.
    if (delay === 30000)
        setTimeout(() => void chrome.runtime.getPlatformInfo(), 15000);
    delay = Math.min(delay * 2, 30000);
}

/** Starts a native port on each service-worker launch. */
function connect() {
    const connectedAt = Date.now();
    try {
        port = chrome.runtime.connectNative(HOST);
        port.onDisconnect.addListener(() => {
            const error = chrome.runtime.lastError;
            console.warn("Ledger native host disconnected", error?.message ?? "Port closed");
            reconnect(connectedAt);
        });
        void sendActive();
    } catch {
        console.warn("Ledger native host connection unavailable");
        reconnect(connectedAt);
    }
}

chrome.tabs.onActivated.addListener(sendActive);
chrome.tabs.onUpdated.addListener((_id, info) => {
    if (info.status === "complete") {
        void sendActive();
    }
});
chrome.windows.onFocusChanged.addListener((windowId) => {
    ++activeRequest;
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        void sendActive();
    }
});
connect();
