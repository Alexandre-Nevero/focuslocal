import {useState} from "react";
import {IntentionEditor} from "../IntentionEditor.tsx";
import {Clock, ErrorNote} from "../components.tsx";
import {errorText, ledger, useCaptureState} from "../ledger.ts";
import type {Session} from "../shared/types.ts";

/**
 * The intention and the clock, nothing else (BR-001). This view does not read visits or verdicts at all, so it cannot
 * show one. Nothing moves except the seconds.
 */
export function Running({session, variant = "default"}: {session: Session, variant?: "default" | "assistant"}) {
    const capture = useCaptureState();
    const [ending, setEnding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const assistant = variant === "assistant";

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
        <section className={assistant ? "running running-assistant" : "running"}>
            <IntentionEditor key={session.id} sessionId={session.id} intention={session.intention} />

            <p className="running-clock" aria-live="off">
                {capture === "ok"
                    ? <Clock since={session.startedAt} />
                    : <span className="running-gap">Not recording right now. The review will show this stretch as not recorded.</span>}
            </p>

            {error != null && <ErrorNote title="The session did not end." error={error} />}

            {assistant && (
                <div className="running-not-work">
                    <button type="button" className="btn btn-quiet" disabled>This isn't the work</button>
                    <p className="hint">Not available while a live visit is still being recorded.</p>
                </div>
            )}

            <div className="running-actions">
                <button type="button" className="btn btn-primary" onClick={() => void end()} disabled={ending}>
                    {ending ? "Ending…" : assistant ? "End" : "End session"}
                </button>
                {!assistant && (
                    <button type="button" className="link" onClick={() => void ledger.widgets.toggleMini()}>Show mini window</button>
                )}
            </div>
        </section>
    );
}
