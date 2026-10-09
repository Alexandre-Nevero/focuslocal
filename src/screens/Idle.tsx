import {BrandMark, Wordmark} from "../components.tsx";
import {capital, counted, outcomeWord} from "../format.ts";
import {go, ledger, useLoad} from "../ledger.ts";

/** The tray popover's resting state (320 × 420), also shown in the main window. Start, Dashboard, privacy (US-001). */
export function Idle() {
    const [history] = useLoad(() => ledger.history.list(), [], ["session:changed"]);
    const rows = history.state === "ready" ? history.value : [];
    const last = rows.find((row) => row.endedAt != null);

    return (
        <main className="idle">
            <p className="idle-brand" role="img" aria-label="Twofold">
                <BrandMark size={26} />
                <Wordmark size="sm" />
            </p>

            <div className="idle-start">
                <h1 className="idle-title">Say what this session is for, then work.</h1>
                <button type="button" className="btn btn-primary btn-block" onClick={() => go("declare")}>Start a session</button>
            </div>

            <div className="idle-foot">
                {history.state === "ready" && last == null && <p className="quiet">No sessions yet. The first review opens when you end one.</p>}
                {last != null && (
                    <button type="button" className="idle-last" onClick={() => void ledger.windows.open(`review/${last.id}`)}>
                        <span className="idle-last-label">Last session</span>
                        <span className={last.intention === "" ? "idle-last-intention is-empty" : "idle-last-intention"}>
                            {last.intention === "" ? "No intention written" : last.intention}
                        </span>
                        <span className="quiet">Finished: {outcomeWord(last.outcome)}</span>
                    </button>
                )}
                <nav className="idle-nav" aria-label="Twofold">
                    <button type="button" className="link" onClick={() => void ledger.windows.open("dashboard")}>
                        Dashboard{rows.length > 0 ? ` · ${capital(counted(rows.length, "session"))}` : ""}
                    </button>
                    <button type="button" className="link" onClick={() => void ledger.windows.open("privacy")}>Settings</button>
                </nav>
            </div>
        </main>
    );
}
