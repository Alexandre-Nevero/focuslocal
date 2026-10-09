import {useId, useState, type ReactNode} from "react";
import {clock} from "./format.ts";
import {errorText, go, ledger, useNow} from "./ledger.ts";
import type {Outcome, Role} from "./shared/types.ts";

export function CloseIcon() {
    return (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
    );
}

/** Slim bar for the main window's reading screens. */
export function TopBar({current}: {current?: "history" | "privacy"}) {
    return (
        <header className="topbar">
            <button type="button" className="wordmark" onClick={() => go("idle")}>Ledger</button>
            <nav className="topnav" aria-label="Ledger">
                <button
                    type="button"
                    className="navlink"
                    aria-current={current === "history" ? "page" : undefined}
                    onClick={() => go("history")}
                >History
                </button>
                <button
                    type="button"
                    className="navlink"
                    aria-current={current === "privacy" ? "page" : undefined}
                    onClick={() => go("privacy")}
                >Privacy
                </button>
            </nav>
        </header>
    );
}

export function Page({current, children}: {current?: "history" | "privacy", children: ReactNode}) {
    return (
        <>
            <TopBar current={current} />
            <main className="page">{children}</main>
        </>
    );
}

export function ErrorNote({title, error, children}: {title: string, error?: string, children?: ReactNode}) {
    return (
        <div className="error-note" role="alert">
            <p className="error-title">{title}</p>
            {children != null && <p>{children}</p>}
            {error != null && <p className="error-detail">{error}</p>}
        </div>
    );
}

/** Elapsed time since `since`. Ticks once a second and never animates (motion.running is none). */
export function Clock({since}: {since: string}) {
    const now = useNow();
    const elapsed = now - Date.parse(since);
    return <time className="clock" dateTime={`PT${Math.max(0, Math.floor(elapsed / 1000))}S`}>{clock(elapsed)}</time>;
}

export function ListEditor({role, title, hint, placeholder, items, onChange}: {
    role: Role,
    title: string,
    hint: string,
    placeholder: string,
    items: string[],
    onChange(items: string[]): void
}) {
    const [draft, setDraft] = useState("");
    const id = useId();

    const add = () => {
        const value = draft.trim().toLowerCase();
        setDraft("");
        if (value !== "" && !items.includes(value))
            onChange([...items, value]);
    };

    return (
        <fieldset className="list-editor" data-role={role}>
            <legend>{title}</legend>
            <p className="hint" id={`${id}-hint`}>{hint}</p>
            {items.length > 0 && (
                <ul className="chips">
                    {items.map((item) => (
                        <li key={item} className="chip" data-role={role}>
                            <span>{item}</span>
                            <button
                                type="button"
                                className="chip-remove"
                                aria-label={`Remove ${item}`}
                                onClick={() => onChange(items.filter((i) => i !== item))}
                            >
                                <CloseIcon />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="list-add">
                <input
                    id={id}
                    type="text"
                    value={draft}
                    placeholder={placeholder}
                    aria-label={`Add to ${title}`}
                    aria-describedby={`${id}-hint`}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add();
                        }
                    }}
                />
                <button type="button" className="btn btn-quiet" onClick={add} disabled={draft.trim() === ""}>Add</button>
            </div>
        </fieldset>
    );
}

/**
 * Yes and not yet, same weight, text only (BR-002). The answer is stored and nothing reacts to it.
 * Closing without an answer stores unanswered; a session already answered keeps its answer.
 */
export function OutcomePair({sessionId, outcome}: {sessionId: string, outcome: Outcome | null}) {
    const [answer, setAnswer] = useState<Outcome | null>(outcome);
    const [error, setError] = useState<string | null>(null);
    const headingId = useId();

    const store = async (next: Outcome) => {
        setError(null);
        try {
            await ledger.review.answer(sessionId, next);
            setAnswer(next);
        } catch (err) {
            setError(errorText(err));
        }
    };

    const close = async () => {
        if (answer == null || answer === "unanswered") {
            try {
                await ledger.review.answer(sessionId, "unanswered");
            } catch (err) {
                setError(errorText(err));
                return;
            }
        }
        go("history");
    };

    return (
        <section className="outcome" aria-labelledby={headingId}>
            <h2 id={headingId} className="outcome-question">Did the block finish what you wrote?</h2>
            <div className="outcome-pair" role="group" aria-labelledby={headingId}>
                <button
                    type="button"
                    className="btn btn-choice"
                    aria-pressed={answer === "yes"}
                    onClick={() => void store("yes")}
                >Yes
                </button>
                <button
                    type="button"
                    className="btn btn-choice"
                    aria-pressed={answer === "not_yet"}
                    onClick={() => void store("not_yet")}
                >Not yet
                </button>
            </div>
            <p className="outcome-foot" aria-live="polite">
                {answer === "yes" || answer === "not_yet" ? "Stored. Either answer is kept as it is." : "Either answer is kept as it is."}
                {" "}
                <button type="button" className="link" onClick={() => void close()}>
                    {answer === "yes" || answer === "not_yet" ? "Done" : "Close without answering"}
                </button>
            </p>
            {error != null && <ErrorNote title="The answer was not stored." error={error} />}
        </section>
    );
}

type ConfirmPhase = "idle" | "confirming" | "working" | "done" | "error";

/** A destructive action behind a second, inline step. No modal: the task needs neither interruption nor trapped focus. */
export function ConfirmStep({action, consequence, confirmLabel, doneText, failText, onConfirm}: {
    action: string,
    consequence: string,
    confirmLabel: string,
    doneText: string,
    failText: string,
    onConfirm(): Promise<void>
}) {
    const [phase, setPhase] = useState<ConfirmPhase>("idle");
    const [error, setError] = useState<string | null>(null);

    const confirm = async () => {
        setPhase("working");
        try {
            await onConfirm();
            setPhase("done");
        } catch (err) {
            setError(errorText(err));
            setPhase("error");
        }
    };

    return (
        <div className="confirm" data-phase={phase}>
            <div className="confirm-row">
                <p className="confirm-consequence">{consequence}</p>
                {(phase === "idle" || phase === "done" || phase === "error") && (
                    <button type="button" className="btn btn-quiet btn-danger" onClick={() => setPhase("confirming")}>{action}</button>
                )}
            </div>
            {(phase === "confirming" || phase === "working") && (
                <div className="confirm-step" role="group" aria-label={`Confirm: ${action}`}>
                    <p>This cannot be undone.</p>
                    <button
                        type="button"
                        className="btn btn-danger-solid"
                        disabled={phase === "working"}
                        onClick={() => void confirm()}
                        autoFocus
                    >{phase === "working" ? "Working…" : confirmLabel}
                    </button>
                    <button
                        type="button"
                        className="btn btn-quiet"
                        disabled={phase === "working"}
                        onClick={() => setPhase("idle")}
                    >Keep it
                    </button>
                </div>
            )}
            <p className="confirm-status" aria-live="polite">{phase === "done" ? doneText : ""}</p>
            {phase === "error" && <ErrorNote title={failText} error={error ?? undefined} />}
        </div>
    );
}
