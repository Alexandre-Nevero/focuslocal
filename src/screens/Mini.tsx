import {useState} from "react";
import {Clock} from "../components.tsx";
import {ledger, useCaptureState, type Load} from "../ledger.ts";
import type {Session} from "../shared/types.ts";

/** Always-on-top strip (280 × 72): intention and clock only (BR-001). */
export function Mini({session}: {session: Load<Session | null>}) {
    const capture = useCaptureState();
    const [failed, setFailed] = useState(false);

    if (session.state === "loading")
        return <main className="mini" />;

    const running = session.state === "ready" ? session.value : null;
    if (running == null) {
        return (
            <main className="mini">
                <p className="mini-intention is-empty">No block running.</p>
                <button type="button" className="btn btn-small btn-quiet" onClick={() => void ledger.widgets.toggleMini()}>Hide</button>
            </main>
        );
    }

    return (
        <main className="mini">
            <div className="mini-text">
                <p className="mini-intention" title={running.intention}>{running.intention === "" ? "No intention written" : running.intention}</p>
                <p className="mini-clock">
                    {failed ? "Did not end. Try again." : capture === "ok" ? <Clock since={running.startedAt} /> : "Not recording"}
                </p>
            </div>
            <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() => ledger.session.end().then(() => setFailed(false), () => setFailed(true))}
            >End
            </button>
        </main>
    );
}
