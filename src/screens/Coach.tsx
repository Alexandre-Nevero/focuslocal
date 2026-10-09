import {ledger, useLoad} from "../ledger.ts";

export function Coach() {
    const [history] = useLoad(() => ledger.history.list(), []);
    const latest = history.state === "ready" ? history.value[0] : null;

    return (
        <section className="coach-shell" aria-labelledby="coach-title">
            <header className="coach-head">
                <p className="coach-label">Twofold</p>
                <h1 id="coach-title" className="coach-title">Coach</h1>
            </header>

            <section className="coach-latest" aria-label="Latest session">
                {history.state === "loading" && <p className="status">Looking for your latest session…</p>}
                {history.state === "error" && (
                    <p className="coach-state" role="alert">Your latest session could not be read.</p>
                )}
                {history.state === "ready" && latest == null && (
                    <p className="coach-state">No past sessions yet. End a session and it will appear here.</p>
                )}
                {latest != null && (
                    <div>
                        <p className="coach-kicker">Latest session</p>
                        {latest.intention !== "" && <p className="coach-intention">{latest.intention}</p>}
                    </div>
                )}
            </section>

            <section className="coach-unavailable" aria-labelledby="coach-unavailable-title">
                <h2 id="coach-unavailable-title">Conversation isn’t connected yet.</h2>
                <p>Coach replies will appear here once the local conversation is connected.</p>
            </section>
        </section>
    );
}
