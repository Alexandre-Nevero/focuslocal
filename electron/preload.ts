import {contextBridge, ipcRenderer} from "electron";
import type {LedgerApi, LedgerEvents} from "../src/shared/types.ts";

// `window.ledger` is the renderer's only door to main (system-design §9 IPC contract). Nothing else is exposed.
const call = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const ledger: LedgerApi = {
    session: {start: call("session.start"), end: call("session.end"), current: call("session.current")},
    review: {get: call("review.get"), tap: call("review.tap"), answer: call("review.answer")},
    history: {list: call("history.list")},
    privacy: {get: call("privacy.get"), dropMemory: call("privacy.dropMemory"), deleteFile: call("privacy.deleteFile")},
    permissions: {get: call("permissions.get")},
    widgets: {toggleMini: call("widgets.toggleMini")},
    windows: {open: call("windows.open")},
    sites: {list: call("sites.list"), save: call("sites.save"), remove: call("sites.remove")},
    settings: {get: call("settings.get"), set: call("settings.set")},
    companion: {notWork: call("companion.notWork"), nudge: call("companion.nudge"), resize: call("companion.resize")},
    coach: {ask: call("coach.ask")},
    presets: {fill: call("presets.fill")},
    on(event, listener) {
        const channel = `ledger:${event}`;
        const handler = (_event: Electron.IpcRendererEvent, payload: LedgerEvents[typeof event]) => listener(payload);
        ipcRenderer.on(channel, handler);
        return () => void ipcRenderer.off(channel, handler);
    }
};

contextBridge.exposeInMainWorld("ledger", ledger);
