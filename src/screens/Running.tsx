import {useState} from "react";
import {Clock, ErrorNote} from "../components.tsx";
import {errorText, ledger, useCaptureState} from "../ledger.ts";
import type {Session} from "../shared/types.ts";

/**
 * The intention and the clock, nothing else (BR-001). This view does not read visits or verdicts at all, so it cannot
 * show one. Nothing moves except the seconds.
 */
export function Running({session}: {session: Session}) {
    const capture = useCaptureState();
    const [ending, setEnding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const end = async () => {
        setEnding(true);
        setError(null);
        try {
            await ledger.session.end();
        } catch (err) {
            setError(errorText(err));
            setEnding(false);
        }
    };

    return (
        <main className="running">
            <p className={session.intention === "" ? "running-intention is-empty" : "running-intention"}>
                {session.intention === "" ? "No intention written for this block." : session.intention}
            </p>

            <p className="running-clock" aria-live="off">
                {capture === "ok"
                    ? <Clock since={session.startedAt} />
                    : <span className="running-gap">Not recording right now. The review will show this stretch as not recorded.</span>}
            </p>

            {error != null && <ErrorNote title="The block did not end." error={error} />}

            <div className="running-actions">
                <button type="button" className="btn btn-primary" onClick={() => void end()} disabled={ending}>
                    {ending ? "Ending…" : "End the block"}
                </button>
                <button type="button" className="link" onClick={() => void ledger.widgets.toggleMini()}>Mini window</button>
            </div>
        </main>
    );
}
