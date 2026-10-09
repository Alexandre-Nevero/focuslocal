import {capital, counted, outcomeWord} from "../format.ts";
import {go, ledger, useLoad} from "../ledger.ts";

/** The tray popover's resting state (320 × 420), also shown in the main window. Start, history, privacy (US-001). */
export function Idle() {
    const [history] = useLoad(() => ledger.history.list(), [], ["session:changed"]);
    const rows = history.state === "ready" ? history.value : [];
    const last = rows.find((row) => row.endedAt != null);

    return (
        <main className="idle">
            <p className="wordmark wordmark-static">Ledger</p>

            <div className="idle-start">
                <h1 className="idle-title">Say what this block is for, then work.</h1>
                <button type="button" className="btn btn-primary btn-block" onClick={() => go("declare")}>Start a block</button>
            </div>

            <div className="idle-foot">
                {history.state === "ready" && last == null && <p className="quiet">No blocks yet. The first review shows up after you end one.</p>}
                {last != null && (
                    <button type="button" className="idle-last" onClick={() => void ledger.windows.open(`review/${last.id}`)}>
                        <span className="idle-last-label">Last block</span>
                        <span className="idle-last-intention">{last.intention === "" ? "No intention written" : last.intention}</span>
                        <span className="quiet">{outcomeWord(last.outcome)}</span>
                    </button>
                )}
                <nav className="idle-nav" aria-label="Ledger">
                    <button type="button" className="link" onClick={() => void ledger.windows.open("history")}>
                        History{rows.length > 0 ? ` · ${capital(counted(rows.length, "block"))}` : ""}
                    </button>
                    <button type="button" className="link" onClick={() => void ledger.windows.open("sites")}>Sites</button>
                    <button type="button" className="link" onClick={() => void ledger.windows.open("privacy")}>Privacy</button>
                </nav>
            </div>
        </main>
    );
}
