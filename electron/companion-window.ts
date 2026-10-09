import path from "node:path";
import {fileURLToPath} from "node:url";
import {BrowserWindow, screen} from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PET_SIZE = 96;

let companion: BrowserWindow | null = null;

function loadCompanionRoute(win: BrowserWindow) {
    const devServer = process.env.VITE_DEV_SERVER_URL;
    if (devServer != null)
        void win.loadURL(`${devServer}#/companion`);
    else
        void win.loadFile(path.join(process.env.APP_ROOT, "dist", "index.html"), {hash: "/companion"});
}

function clampToWorkArea(bounds: {x: number, y: number, width: number, height: number}) {
    const {workArea} = screen.getDisplayNearestPoint({x: bounds.x, y: bounds.y});
    const width = Math.min(bounds.width, workArea.width);
    const height = Math.min(bounds.height, workArea.height);
    const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width);
    const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height);
    return {x: Math.round(x), y: Math.round(y), width, height};
}

function createCompanionWindow() {
    const {workArea} = screen.getPrimaryDisplay();
    const x = workArea.x + workArea.width - PET_SIZE - 16;
    const y = workArea.y + workArea.height - PET_SIZE - 16;

    const win = new BrowserWindow({
        width: PET_SIZE,
        height: PET_SIZE,
        x,
        y,
        frame: false,
        transparent: true,
        resizable: false,
        show: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.mjs"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false
        }
    });

    win.webContents.setWindowOpenHandler(() => ({action: "deny"}));
    win.webContents.on("will-navigate", (event) => event.preventDefault());
    loadCompanionRoute(win);
    win.on("closed", () => {
        companion = null;
    });
    return win;
}

export function openCompanion(): void {
    if (companion == null || companion.isDestroyed())
        companion = createCompanionWindow();
    if (!companion.isVisible())
        companion.show();
}

export function closeCompanion(): void {
    if (companion != null && !companion.isDestroyed()) {
        companion.close();
        companion = null;
    }
}

export function setCompanionShown(on: boolean): void {
    if (on)
        openCompanion();
    else if (companion != null && !companion.isDestroyed())
        companion.hide();
}

export function applyCompanionBounds(bounds: {x: number, y: number, width: number, height: number}): void {
    if (companion == null || companion.isDestroyed())
        return;
    const clamped = clampToWorkArea(bounds);
    companion.setBounds(clamped);
}

export function currentCompanionBounds(): {x: number, y: number, width: number, height: number} {
    if (companion == null || companion.isDestroyed())
        return {x: 0, y: 0, width: PET_SIZE, height: PET_SIZE};
    const [x = 0, y = 0] = companion.getPosition();
    const [width = PET_SIZE, height = PET_SIZE] = companion.getSize();
    return {x, y, width, height};
}
