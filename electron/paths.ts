import os from "node:os";
import path from "node:path";

/**
 * Ledger's data directory. Not `app.getPath("userData")`, so the native host (which runs without Electron's app module)
 * resolves the same place.
 */
export function ledgerDir(): string {
    if (process.platform === "win32")
        return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Ledger");
    else if (process.platform === "darwin")
        return path.join(os.homedir(), "Library", "Application Support", "Ledger");

    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "Ledger");
}

export const dbPath = () => path.join(ledgerDir(), "ledger.db");
export const widgetFilePath = () => path.join(ledgerDir(), "widget.txt");
