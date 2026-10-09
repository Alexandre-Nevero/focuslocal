import path from "node:path";
import {fileURLToPath} from "node:url";
import {app, BrowserWindow, Menu, nativeImage, screen, Tray} from "electron";
import type {Route} from "../src/shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROUTE_PATTERN =
    /^(idle|declare|permissions|running|review\/[\w-]+|history|privacy|mini|companion|sites|block)$/;

let mainWindow: BrowserWindow | null = null;
let popover: BrowserWindow | null = null;
let mini: BrowserWindow | null = null;
let blockWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(route: Route, options: Electron.BrowserWindowConstructorOptions) {
    const win = new BrowserWindow({
        ...options,
        webPreferences: {
            preload: path.join(__dirname, "preload.mjs"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false
        }
    });
    // Ledger opens no external links and navigates nowhere else.
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

function togglePopover() {
    if (tray == null)
        return;
    if (popover == null || popover.isDestroyed()) {
        popover = createWindow("idle", {
            width: 320, height: 420, frame: false, resizable: false, show: false, skipTaskbar: true, alwaysOnTop: true
        });
        popover.on("blur", () => popover?.hide());
    }
    if (popover.isVisible()) {
        popover.hide();
        return;
    }

    // Anchor above (or below) the tray icon, kept inside the work area of that display.
    const trayBounds = tray.getBounds();
    const {workArea} = screen.getDisplayMatching(trayBounds);
    const [width = 320, height = 420] = popover.getSize();
    const x = Math.min(Math.max(trayBounds.x + trayBounds.width / 2 - width / 2, workArea.x), workArea.x + workArea.width - width);
    const y = trayBounds.y > workArea.y + workArea.height / 2
        ? trayBounds.y - height
        : trayBounds.y + trayBounds.height;
    popover.setPosition(Math.round(x), Math.round(Math.max(y, workArea.y)));
    popover.show();
    popover.focus();
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

export function showBlock(): void {
    if (blockWindow != null && !blockWindow.isDestroyed()) {
        blockWindow.show();
        blockWindow.focus();
        return;
    }
    blockWindow = createWindow("block", {
        width: 360, height: 220, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: true
    });
    blockWindow.on("closed", () => blockWindow = null);
}

export function setTrayTip(text: string): void {
    tray?.setToolTip(text);
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
