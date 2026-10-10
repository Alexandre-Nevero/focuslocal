import {useState} from "react";
import {errorText, ledger} from "./ledger.ts";

/** Both surfaces edit the saved sentence without changing visits or the finish answer. */
export function IntentionEditor({sessionId, intention}: {sessionId: string, intention: string}) {
    const [draft, setDraft] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState("");
    const changed = draft != null && draft !== intention;
    const save = async () => {
        if (busy || !changed)
            return;
        setBusy(true);
        try {
            await ledger.session.updateIntention(sessionId, draft);
            setDraft(null);
            setNote("Intention saved.");
        } catch (error) {
            setNote(`Not saved: ${errorText(error)}`);
        }
        setBusy(false);
    };
    const cancel = () => {
        setDraft(null);
        setNote("Change cancelled.");
    };
    return (
        <div className="session-intention-editor">
            <label htmlFor={`intention-${sessionId}`}>You meant to</label>
            <textarea
                id={`intention-${sessionId}`}
                rows={2}
                maxLength={4000}
                value={draft ?? intention}
                placeholder="No intention written. You can add one."
                readOnly={busy}
                onChange={(event) => {
                    setDraft(event.target.value);
                    setNote("Unsaved change");
                }}
                onKeyDown={(event) => {
                    if (event.key === "Escape") cancel();
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        void save();
                    }
                }}
            />
            {changed && (
                <div className="intention-editor-actions">
                    <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void save()}>
                        {busy ? "Saving…" : "Save intention"}
                    </button>
                    <button type="button" className="link" disabled={busy} onClick={cancel}>Cancel</button>
                </div>
            )}
            <p className="hint" role="status">{note}</p>
        </div>
    );
}
