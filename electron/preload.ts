import {contextBridge, ipcRenderer} from "electron";
import type {LedgerApi, LedgerEvents} from "../src/shared/types.ts";

// `window.ledger` is the renderer's only door to main (system-design §9 IPC contract). Nothing else is exposed.
const call = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const ledger: LedgerApi = {
    coach: {history: call("coach.history"), ask: call("coach.ask")},
    session: {start: call("session.start"), end: call("session.end"), current: call("session.current"), updateIntention: call("session.updateIntention")},
    review: {get: call("review.get"), tap: call("review.tap"), answer: call("review.answer")},
    history: {list: call("history.list")},
    privacy: {get: call("privacy.get"), dropMemory: call("privacy.dropMemory"), deleteFile: call("privacy.deleteFile")},
    permissions: {get: call("permissions.get")},
    widgets: {toggleMini: call("widgets.toggleMini")},
    assistant: {
        move: (dx, dy) => ipcRenderer.send("assistant.move", dx, dy),
        toggle: call("assistant.toggle"),
        collapse: call("assistant.collapse"),
        state: call("assistant.state")
    },
    windows: {open: call("windows.open")},
    on(event, listener) {
        const channel = `ledger:${event}`;
        const handler = (_event: Electron.IpcRendererEvent, payload: LedgerEvents[typeof event]) => listener(payload);
        ipcRenderer.on(channel, handler);
        return () => void ipcRenderer.off(channel, handler);
    }
};

contextBridge.exposeInMainWorld("ledger", ledger);
