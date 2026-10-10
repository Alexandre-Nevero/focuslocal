const HOST = "com.focuslocal.ledger";
const brands = navigator.userAgentData?.brands.map(({brand}) => brand) ?? [];
const browser = brands.includes("Brave") ? "brave"
    : brands.includes("Microsoft Edge") ? "msedge"
        : brands.includes("Google Chrome") ? "chrome" : "chromium";
const blockedPage = chrome.runtime.getURL("blocked.html");
let port = null;
let delay = 1000;
let activeRequest = 0;
/** @type {{sites: string[], at: number} | null} */
let blocklistCache = null;

const stripWww = (host) => (host.startsWith("www.") ? host.slice(4) : host);

/**
 * @param {string} host @param {string} pattern
 * @param pattern
 */
function siteBlocked(host, pattern) {
    const h = stripWww(host.toLowerCase());
    const p = stripWww(pattern.toLowerCase());
    return h === p || h.endsWith(`.${p}`);
}

/**
 *
 */
function fetchBlocklist() {
    const now = Date.now();
    if (blocklistCache != null && now - blocklistCache.at < 2000) {
        return Promise.resolve(blocklistCache.sites);
    }
    return new Promise((resolve) => {
        chrome.runtime.sendNativeMessage(HOST, {type: "blocklist"}, (reply) => {
            const sites = Array.isArray(reply?.sites)
                ? reply.sites.filter((site) => typeof site === "string")
                : [];
            blocklistCache = {sites, at: Date.now()};
            resolve(sites);
        });
    });
}

/**
 *
 * @param target
 */
function recordHit(target) {
    if (port) {
        port.postMessage({type: "hit", target});
        return;
    }
    chrome.runtime.sendNativeMessage(HOST, {type: "hit", target}, () => {});
}

/**
 * @param {number} tabId @param {chrome.tabs.Tab} tab
 * @param tab
 */
async function maybeBlock(tabId, tab) {
    if (tab.incognito || tab.url == null || tab.url.startsWith(blockedPage)) {
        return;
    }
    try {
        const window = await chrome.windows.get(tab.windowId);
        if (window.incognito) {
            return;
        }
        const host = new URL(tab.url).hostname;
        if (host === "") {
            return;
        }
        const sites = await fetchBlocklist();
        const match = sites.find((site) => siteBlocked(host, site));
        if (match == null) {
            return;
        }
        recordHit(match);
        await chrome.tabs.update(tabId, {url: `${blockedPage}?host=${encodeURIComponent(host)}`});
    } catch {
        // Malformed URLs and native-host races should not break tab relay.
    }
}

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
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === "complete") {
        void sendActive();
        void maybeBlock(tabId, tab);
    }
});
chrome.windows.onFocusChanged.addListener((windowId) => {
    ++activeRequest;
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        void sendActive();
    }
});
connect();
