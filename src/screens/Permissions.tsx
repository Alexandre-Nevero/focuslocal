import {ErrorNote} from "../components.tsx";
import {go, ledger, useLoad} from "../ledger.ts";
import type {PermissionState} from "../shared/types.ts";

function stateWord(state: PermissionState) {
    switch (state) {
        case "granted": return "Granted";
        case "denied": return "Not granted";
        case "not-determined": return "Not asked yet";
        case "restricted": return "Blocked by the system";
        default: return "Unknown";
    }
}

/** Explains the capture permission and what fails without it (US-002). */
export function Permissions() {
    const [load, reload] = useLoad(() => ledger.permissions.get(), []);
    const allGranted = load.state === "ready" && load.value.screen === "granted" && load.value.accessibility === "granted";

    return (
        <main className="permissions">
            <h1 className="screen-title">Ledger needs to see which window is in front.</h1>
            <p className="lede">
                It reads the frontmost app, its title, and the address when a browser shares it, and writes them only to a file on
                this machine. Without the permission nothing is recorded, and the review names that gap instead of guessing.
            </p>

            {load.state === "error" && <ErrorNote title="The permission state could not be read." error={load.error} />}
            {load.state === "ready" && (
                <dl className="spec">
                    <div>
                        <dt>Screen recording</dt>
                        <dd data-ok={load.value.screen === "granted" || undefined}>{stateWord(load.value.screen)}</dd>
                    </div>
                    <div>
                        <dt>Accessibility</dt>
                        <dd data-ok={load.value.accessibility === "granted" || undefined}>{stateWord(load.value.accessibility)}</dd>
                    </div>
                </dl>
            )}

            {!allGranted && (
                <p className="hint">
                    On a Mac: open System Settings, then Privacy &amp; Security. Turn Ledger on under Screen Recording and under
                    Accessibility, then come back here.
                </p>
            )}

            <div className="actions">
                {allGranted
                    ? <button type="button" className="btn btn-primary" onClick={() => go("idle")}>Continue</button>
                    : <button type="button" className="btn btn-primary" onClick={reload}>Check again</button>}
                {!allGranted && <button type="button" className="link" onClick={() => go("idle")}>Not now</button>}
            </div>
        </main>
    );
}
