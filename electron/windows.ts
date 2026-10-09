import path from "node:path";
import {fileURLToPath} from "node:url";
import {app, BrowserWindow, Menu, nativeImage, screen, Tray} from "electron";
import type {AssistantWindowState, Route} from "../src/shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROUTE_PATTERN = new RegExp(
    "^(idle|declare|permissions|running|assistant|review/[\\w-]+|history|privacy|mini" +
    "|dashboard(/(day|week|month)/\\d{4}-\\d{2}-\\d{2})?|ledger(/\\d{4}-\\d{2}-\\d{2})?)$"
);

let mainWindow: BrowserWindow | null = null;
let popover: BrowserWindow | null = null;
let mini: BrowserWindow | null = null;
let assistant: BrowserWindow | null = null;
let assistantCollapsedBounds: Electron.Rectangle | null = null;
let assistantExpanded = false;
let tray: Tray | null = null;

function createWindow(route: Route, options: Electron.BrowserWindowConstructorOptions) {
    const win = new BrowserWindow({
        ...options,
        webPreferences: {
            preload: path.join(__dirname, "preload.mjs"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            spellcheck: false,
            enableWebSQL: false
        }
    });
    // Twofold opens no external links and navigates nowhere else.
    win.webContents.setWindowOpenHandler(() => ({action: "deny"}));
    win.webContents.on("will-navigate", (event) => event.preventDefault());

    loadRoute(win, route);
    return win;
}

function loadRoute(win: BrowserWindow, route: Route) {
    const devServer = process.env.VITE_DEV_SERVER_URL;
    if (devServer != null)
        void win.loadURL(`${devServer}#/${route}`);
    else
        void win.loadFile(path.join(process.env.APP_ROOT, "dist", "index.html"), {hash: `/${route}`});
}

/** Shows the main window at a route, creating it if needed. */
export function openMain(route: Route) {
    if (mainWindow == null || mainWindow.isDestroyed()) {
        mainWindow = createWindow(route, {width: 960, height: 700, title: "Twofold", show: true});
        mainWindow.on("closed", () => mainWindow = null);
    } else {
        loadRoute(mainWindow, route);
        mainWindow.show();
        mainWindow.focus();
    }
}

function preparePopover() {
    if (popover == null || popover.isDestroyed()) {
        popover = createWindow("idle", {
            width: 320, height: 420, frame: false, resizable: false, show: false, skipTaskbar: true, alwaysOnTop: true
        });
        popover.on("blur", () => popover?.hide());
    } else {
        loadRoute(popover, "idle");
    }
    popover.setSize(320, 420, false);
    return popover;
}

function togglePopover() {
    if (tray == null)
        return;
    if (popover != null && !popover.isDestroyed() && popover.isVisible()) {
        popover.hide();
        return;
    }

    const win = preparePopover();
    // Anchor above (or below) the tray icon, kept inside the work area of that display.
    const trayBounds = tray.getBounds();
    const {workArea} = screen.getDisplayMatching(trayBounds);
    const popoverBounds = win.getBounds();
    const width = popoverBounds.width;
    const height = popoverBounds.height;
    const x = Math.min(Math.max(trayBounds.x + trayBounds.width / 2 - width / 2, workArea.x), workArea.x + workArea.width - width);
    const y = trayBounds.y > workArea.y + workArea.height / 2
        ? trayBounds.y - height
        : trayBounds.y + trayBounds.height;
    win.setPosition(Math.round(x), Math.round(Math.max(y, workArea.y)));
    win.show();
    win.focus();
}

export function getAssistantState(): AssistantWindowState {
    return {expanded: assistantExpanded};
}

function sendAssistantState() {
    if (assistant != null && !assistant.isDestroyed())
        assistant.webContents.send("ledger:assistant:state", getAssistantState());
}

/** Collapsed companion window edge, in DIPs. The renderer's .assistant-control is the same size (src/styles.css). */
const ASSISTANT_SIZE = 88;

/** Creates the startup-owned assistant without taking focus. */
export function createAssistantWindow() {
    if (assistant != null && !assistant.isDestroyed())
        return assistant;

    const {workArea} = screen.getPrimaryDisplay();
    const size = ASSISTANT_SIZE;
    assistantCollapsedBounds = {
        x: workArea.x + workArea.width - size - 16,
        y: workArea.y + workArea.height - size - 16,
        width: size,
        height: size
    };
    assistantExpanded = false;
    const win = createWindow("assistant", {
        ...assistantCollapsedBounds,
        title: "Twofold Assistant",
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        hasShadow: false,
        resizable: false,
        show: false,
        skipTaskbar: true,
        alwaysOnTop: true
    });
    assistant = win;
    win.once("ready-to-show", () => {
        if (assistant === win) {
            win.showInactive();
            sendAssistantState();
        }
    });
    win.on("blur", () => {
        if (assistant === win && assistantExpanded)
            collapseAssistant();
    });
    win.on("closed", () => {
        if (assistant === win) {
            assistant = null;
            assistantCollapsedBounds = null;
            assistantExpanded = false;
        }
    });
    return win;
}

export function destroyAssistantWindow() {
    const win = assistant;
    assistant = null;
    assistantCollapsedBounds = null;
    assistantExpanded = false;
    if (win != null && !win.isDestroyed())
        win.destroy();
}

export function isAssistantSender(sender: Electron.WebContents) {
    return assistant != null && !assistant.isDestroyed() && assistant.webContents === sender;
}

/** Moves the collapsed assistant by a bounded renderer-reported pointer delta. */
export function moveAssistantBy(dx: number, dy: number) {
    if (assistant == null || assistant.isDestroyed() || assistantExpanded || !Number.isFinite(dx) || !Number.isFinite(dy))
        return;
    const bounds = assistant.getBounds();
    const width = 56;
    const height = 56;
    const candidate = {
        x: Math.round(bounds.x + dx),
        y: Math.round(bounds.y + dy),
        width,
        height
    };
    const {workArea} = screen.getDisplayMatching(candidate);
    const x = Math.min(Math.max(candidate.x, workArea.x), workArea.x + workArea.width - width);
    const y = Math.min(Math.max(candidate.y, workArea.y), workArea.y + workArea.height - height);
    assistantCollapsedBounds = {x, y, width, height};
    assistant.setBounds(assistantCollapsedBounds, false);
    sendAssistantState();
}

export function collapseAssistant(): AssistantWindowState {
    if (assistant == null || assistant.isDestroyed() || !assistantExpanded)
        return getAssistantState();
    assistantExpanded = false;
    if (assistantCollapsedBounds != null)
        assistant.setBounds(assistantCollapsedBounds, false);
    sendAssistantState();
    return getAssistantState();
}

export function toggleAssistant(): AssistantWindowState {
    if (assistant == null || assistant.isDestroyed())
        throw new Error("The assistant window is not available");
    if (assistantExpanded)
        return collapseAssistant();

    const collapsed = assistant.getBounds();
    assistantCollapsedBounds = {
        x: collapsed.x,
        y: collapsed.y,
        width: ASSISTANT_SIZE,
        height: ASSISTANT_SIZE
    };
    const {workArea} = screen.getDisplayMatching(assistantCollapsedBounds);
    const width = Math.min(380, workArea.width);
    assistantExpanded = true;
    assistant.setBounds({
        x: workArea.x + workArea.width - width,
        y: workArea.y,
        width,
        height: workArea.height
    }, false);
    assistant.show();
    assistant.focus();
    sendAssistantState();
    return getAssistantState();
}

export function toggleMiniWindow() {
    if (mini != null && !mini.isDestroyed()) {
        mini.close();
        return;
    }
    const {workArea} = screen.getPrimaryDisplay();
    mini = createWindow("mini", {
        width: 280, height: 72, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true,
        x: workArea.x + workArea.width - 280 - 16, y: workArea.y + workArea.height - 72 - 16
    });
    mini.on("closed", () => mini = null);
}

export function createTray() {
    // Tray icons must be raster (nativeImage does not read SVG). Placeholder mark until the UI/UX issue ships the real one.
    const icon = nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, "tray-icon.png"));
    tray = new Tray(icon);
    tray.setToolTip("Twofold");
    tray.on("click", togglePopover);
    tray.on("right-click", () => tray?.popUpContextMenu(Menu.buildFromTemplate([
        {label: "Open Twofold", click: () => openMain("idle")},
        {label: "Show mini window", click: toggleMiniWindow},
        {type: "separator"},
        {label: "Quit", click: () => app.quit()}
    ])));
    app.on("before-quit", () => tray?.destroy());
}
