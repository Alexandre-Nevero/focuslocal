import {useRef, useState, type FormEvent} from "react";
import {errorText, go, ledger, useLoad} from "../ledger.ts";
import coachMascot from "../assets/mascot/pose-coach.svg";
import type {CoachMessage} from "../shared/types.ts";

const prompts = [
    "Where did my time go?",
    "Which apps pulled me away?",
    "Help me pick what to do next",
    'Look at my "Not yet" sessions'
] as const;

export function Coach() {
    const [history, historyRefresh] = useLoad(() => ledger.history.list(), [], ["session:changed"]);
    const [historyDraft, setHistoryDraft] = useState("");
    const latest = history.state === "ready"
        ? history.value.find((session) => session.endedAt != null) ?? null
        : null;
    const [saved, refresh] = useLoad(
        () => (latest == null ? Promise.resolve([] as CoachMessage[]) : ledger.coach.history(latest.id)),
        [latest?.id]
    );

    return (
        <section className="coach-shell" aria-labelledby="coach-title">
            <header className="coach-head">
                <img className="coach-brand-mascot" src={coachMascot} alt="" />
                <h1 id="coach-title" className="coach-title">Twofold Coach</h1>
                <span className="coach-local"><i aria-hidden="true" />Local record</span>
                <button className="coach-judge" type="button" onClick={() => latest != null && go(`review/${latest.id}`)} disabled={latest == null}>
                    Ask the judge
                </button>
                <button className="coach-close" type="button" aria-label="Close Coach" onClick={() => go("dashboard")}>×</button>
            </header>

            <div className="coach-context">
                <span>Working on</span>
                <p>{latest != null ? latest.intention || "Untitled session" : history.state === "loading" ? "Loading session…" : "No ended session yet"}</p>
            </div>

            <div className="coach-chat" aria-live="polite" aria-relevant="additions text">
                {history.state === "loading" && <p className="coach-state" role="status">Looking for your latest session…</p>}
                {history.state === "error" && <div className="coach-error" role="alert">
                    <p>Your latest session could not be read: {history.error}</p>
                    <button className="coach-judge" type="button" onClick={historyRefresh}>Retry loading history</button>
                </div>}
                {history.state === "ready" && latest == null && <p className="coach-state">End a session to talk about its local record.</p>}
                {latest != null && saved.state === "loading" && <p className="coach-state" role="status">Loading this conversation…</p>}
                {latest != null && saved.state === "error" && <div className="coach-error" role="alert">
                    <p>This conversation could not be read: {saved.error}</p>
                    <button className="coach-judge" type="button" onClick={refresh}>Retry loading conversation</button>
                </div>}
                {latest != null && saved.state === "ready" && (saved.value.length === 0
                    ? <WelcomeMessage />
                    : <div className="coach-transcript">
                        {saved.value.map((message, index) => (
                            <MessageBubble key={`${index}-${message.role}`} message={message} />
                        ))}
                    </div>)}
            </div>

            {(latest != null || history.state !== "ready") && <Composer
                sessionId={latest?.id}
                history={saved.state === "ready" ? saved.value : []}
                canAsk={latest != null && (saved.state === "ready" || saved.state === "error")}
                refresh={refresh}
                draft={historyDraft}
                setDraft={setHistoryDraft}
            />}
        </section>
    );
}

function WelcomeMessage() {
    return (
        <div className="coach-welcome">
            <img src={coachMascot} alt="" />
            <div className="coach-bubble">
                I can see this session and your local record. Ask me about what happened.
                <time>Now</time>
            </div>
        </div>
    );
}

function MessageBubble({message}: {message: CoachMessage}) {
    return message.role === "assistant"
        ? <div className="coach-message assistant"><img src={coachMascot} alt="" /><div className="coach-bubble">{message.content}</div></div>
        : <div className="coach-message user"><div className="coach-bubble">{message.content}</div></div>;
}

type ComposerProps = {
    sessionId?: string,
    history: CoachMessage[],
    canAsk: boolean,
    refresh: () => void,
    draft: string,
    setDraft: (value: string) => void
};

function Composer({sessionId, history, canAsk, refresh, draft, setDraft}: ComposerProps) {
    const input = useRef<HTMLTextAreaElement>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function ask(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const message = draft.trim();
        if (message === "" || pending || !canAsk || sessionId == null)
            return;
        setPending(true);
        setError(null);
        try {
            await ledger.coach.ask(sessionId, message, history.slice(-12));
            setDraft("");
            refresh();
        } catch (err) {
            setError(errorText(err));
        } finally {
            setPending(false);
        }
    }

    return (
        <footer className="coach-footer">
            <div className="coach-suggestions">
                <p>Try asking</p>
                <div>{prompts.map((prompt) => <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                        setDraft(prompt);
                        input.current?.focus();
                    }}
                    disabled={pending}
                >{prompt}
                </button>)}
                {sessionId != null && <button type="button" onClick={() => go(`review/${sessionId}`)}>See the judge’s guesses</button>}
                </div>
            </div>
            {error != null && <p className="coach-error" role="alert">Coach could not reply: {error}. You can try again.</p>}
            {pending && <p className="coach-state" role="status">Coach is checking the local record…</p>}
            <form className="coach-form" onSubmit={ask}>
                <label className="sr-only" htmlFor="coach-prompt">Ask about your session</label>
                <textarea ref={input} id="coach-prompt" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} placeholder="Ask about your session…" rows={1} maxLength={1000} disabled={pending} />
                <button className="coach-send" type="submit" aria-label="Send message" disabled={pending || draft.trim() === "" || !canAsk}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3.5-6.5L4 12Z" /><path d="m11.5 13.5 4-4" /></svg>
                </button>
            </form>
        </footer>
    );
}
