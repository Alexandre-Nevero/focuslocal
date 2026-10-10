const HOST = "com.focuslocal.ledger";
const brands = navigator.userAgentData?.brands.map(({brand}) => brand) ?? [];
const browser = brands.includes("Brave") ? "brave"
    : brands.includes("Microsoft Edge") ? "msedge"
        : brands.includes("Google Chrome") ? "chrome" : "chromium";
let port = null;
let delay = 1000;
let activeRequest = 0;
let popupRequest = 0;
const popupReplies = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "popup" || !["summary", "answer", "updateIntention", "tap", "start", "open", "end"].includes(message.action))
        return false;
    if (!port) {
        sendResponse({error: "unavailable"});
        return false;
    }
    const requestId = `popup-${++popupRequest}`;
    popupReplies.set(requestId, sendResponse);
    setTimeout(() => {
        const pending = popupReplies.get(requestId);
        if (!pending) return;
        popupReplies.delete(requestId);
        pending({error: "unavailable"});
    }, 5000);
    const request = {...message, requestId};
    delete request.type;
    try {
        port.postMessage({type: "popup", ...request});
    } catch {
        popupReplies.delete(requestId);
        sendResponse({error: "unavailable"});
    }
    return true;
});

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
        port.onMessage.addListener((message) => {
            if (typeof message?.requestId !== "string") return;
            const sendResponse = popupReplies.get(message.requestId);
            if (!sendResponse) return;
            popupReplies.delete(message.requestId);
            delete message.requestId;
            sendResponse(message);
        });
        port.onDisconnect.addListener(() => {
            for (const sendResponse of popupReplies.values()) sendResponse({error: "unavailable"});
            popupReplies.clear();
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
