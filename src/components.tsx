import {useEffect, useId, useRef, useState, type ReactNode} from "react";
import {capital, clock, modelStatusWord} from "./format.ts";
import {errorText, go, ledger, useLoad, useNow} from "./ledger.ts";
import {containsDay, dayKey, parseDayKey, periodShort, shiftPeriod, startOfDay, type Period} from "./period.ts";
import mascotFace from "./assets/mascot/mascot-face.svg";
import type {Outcome, PeriodMode, Role, Route} from "./shared/types.ts";

/* ---------- Icons: one 16px grid, 1.6 stroke, round joins ---------- */

function Icon({children, size = 16}: {children: ReactNode, size?: number}) {
    return (
        <svg
            viewBox="0 0 16 16"
            width={size}
            height={size}
            aria-hidden="true"
            focusable="false"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        >{children}
        </svg>
    );
}

export const CloseIcon = () => <Icon size={12}><path d="M4 4l8 8M12 4l-8 8" /></Icon>;
export const ChevronLeftIcon = () => <Icon><path d="M10 3.5L5.5 8l4.5 4.5" /></Icon>;
export const ChevronRightIcon = () => <Icon><path d="M6 3.5L10.5 8 6 12.5" /></Icon>;
export const ArrowRightIcon = () => <Icon size={14}><path d="M3 8h10M9 4l4 4-4 4" /></Icon>;
export const PlusIcon = () => <Icon size={14}><path d="M8 3v10M3 8h10" /></Icon>;
export const CalendarIcon = () => (
    <Icon>
        <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
        <path d="M2.5 7h11M5.5 2v3M10.5 2v3" />
    </Icon>
);
/** Two sliders: the local Settings page (privacy facts and data removal), not an account. */
export const SettingsIcon = () => (
    <Icon size={18}>
        <path d="M2.5 5h6M12 5h1.5M2.5 11H4M7.5 11h6" />
        <circle cx="10.25" cy="5" r="1.75" />
        <circle cx="5.75" cy="11" r="1.75" />
    </Icon>
);

/* ---------- Brand: mascot face mark and split wordmark (docs/design.md §3.2, §3.3) ---------- */


/** One whole intention around a broken observed trace. Static: never animated, never tied to data. */
export function BrandMark({size = 32}: {size?: number}) {
    return (
        <img className="brand-mark" src={mascotFace} width={size} height={size} alt="" aria-hidden="true" draggable={false} />
    );
}

export function Wordmark({size = "md"}: {size?: "sm" | "md"}) {
    return (
        <span className={`wordmark-split wordmark-${size}`} aria-hidden="true">
            <span className="wm-top">twofold</span>
            <span className="wm-bottom">twofold</span>
        </span>
    );
}

/* ---------- Shell ---------- */

export type NavKey = "dashboard" | "ledger" | "privacy";

const NAV = [
    {key: "dashboard", label: "Dashboard", route: "dashboard"},
    {key: "ledger", label: "Daily", route: "ledger"}
] as const satisfies readonly {key: NavKey, label: string, route: Route}[];

function RunningPill({since}: {since: string}) {
    const now = useNow();
    return (
        <button type="button" className="pill pill-running" onClick={() => go("running")}>
            <span className="dot dot-ink" aria-hidden="true" />
            Session running
            <time className="figure" dateTime={since}>{clock(now - Date.parse(since))}</time>
        </button>
    );
}

/** Network and model facts in one quiet pill; it opens Settings, where each fact is explained. */
function StatusPill() {
    const [facts, reload] = useLoad(() => ledger.privacy.get(), [], ["verdict:updated"]);
    const loading = facts.state === "ready" && facts.value.modelStatus === "loading";

    // The model has no ready event; re-read only while it is still loading.
    useEffect(() => {
        if (!loading)
            return;
        const id = window.setInterval(reload, 4000);
        return () => window.clearInterval(id);
    }, [loading]);

    const model = facts.state === "ready" ? `Labels ${modelStatusWord(facts.value.modelStatus).toLowerCase()}` : null;
    return (
        <button
            type="button"
            className="pill pill-status"
            title="Twofold is blocked from the internet. Open Settings for more."
            onClick={() => go("privacy")}
        >
            <span className="dot" aria-hidden="true" />
            Private
            {model != null && <><span className="pill-sep" aria-hidden="true" />{model}</>}
        </button>
    );
}

/** Brand, the two sections, and the machine facts at right. Settings is the round control. No search, account, or avatar (D-09). */
export function TopBar({current}: {current?: NavKey}) {
    const [session] = useLoad(() => ledger.session.current(), [], ["session:changed"]);
    const running = session.state === "ready" ? session.value : null;

    return (
        <header className="topbar">
            <div className="topbar-inner">
                <button type="button" className="brand" aria-label="Twofold. Go to the Dashboard" onClick={() => go("dashboard")}>
                    <BrandMark size={34} />
                    <Wordmark />
                </button>

                <nav className="topnav" aria-label="Main">
                    {NAV.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className="navlink"
                            aria-current={current === item.key ? "page" : undefined}
                            onClick={() => go(item.route)}
                        >{item.label}
                        </button>
                    ))}
                </nav>

                <div className="topbar-end">
                    {session.state === "ready" && running == null && (
                        <button type="button" className="btn btn-primary btn-small" onClick={() => go("declare")}>
                            <PlusIcon />Start a session
                        </button>
                    )}
                    {running != null && <RunningPill since={running.startedAt} />}
                    <StatusPill />
                    <button
                        type="button"
                        className="icon-btn icon-btn-round"
                        aria-label="Settings"
                        title="Settings"
                        aria-current={current === "privacy" ? "page" : undefined}
                        onClick={() => go("privacy")}
                    >
                        <SettingsIcon />
                    </button>
                </div>
            </div>
        </header>
    );
}

export function Page({current, wide = false, children}: {current?: NavKey, wide?: boolean, children: ReactNode}) {
    return (
        <>
            <TopBar current={current} />
            <main className={wide ? "page page-wide" : "page"}>{children}</main>
        </>
    );
}

/** Previous and next, a date picker, the range switch, and Today. Every dependent card reads the same period. */
export function PeriodNav({period, modes, onChange}: {
    period: Period,
    modes: readonly PeriodMode[] | null,
    onChange(next: Period): void
}) {
    const picker = useRef<HTMLInputElement>(null);
    const today = startOfDay(new Date());

    const openPicker = () => {
        try {
            picker.current?.showPicker();
        } catch {
            picker.current?.focus();
        }
    };

    return (
        <div className="period-nav" role="group" aria-label="Period">
            <div className="period-step">
                <button type="button" className="icon-btn" aria-label={`Previous ${period.mode}`} onClick={() => onChange(shiftPeriod(period, -1))}>
                    <ChevronLeftIcon />
                </button>
                <span className="date-control">
                    <button type="button" className="date-button" onClick={openPicker}>
                        <CalendarIcon />
                        <span>{periodShort(period)}</span>
                        <span className="sr-only">. Choose a date</span>
                    </button>
                    <input
                        ref={picker}
                        type="date"
                        className="date-input"
                        tabIndex={-1}
                        aria-hidden="true"
                        value={dayKey(period.anchor)}
                        onChange={(e) => {
                            const day = parseDayKey(e.target.value);
                            if (day != null)
                                onChange({mode: period.mode, anchor: day});
                        }}
                    />
                </span>
                <button type="button" className="icon-btn" aria-label={`Next ${period.mode}`} onClick={() => onChange(shiftPeriod(period, 1))}>
                    <ChevronRightIcon />
                </button>
            </div>
            {modes != null && (
                <div className="segmented" role="group" aria-label="Range">
                    {modes.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={period.mode === mode}
                            onClick={() => onChange({mode, anchor: period.anchor})}
                        >{capital(mode)}
                        </button>
                    ))}
                </div>
            )}
            <button
                type="button"
                className="btn btn-quiet btn-small"
                disabled={containsDay(period, today)}
                onClick={() => onChange({mode: period.mode, anchor: today})}
            >Today
            </button>
        </div>
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
    const answered = answer === "yes" || answer === "not_yet";

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
        if (!answered) {
            try {
                await ledger.review.answer(sessionId, "unanswered");
            } catch (err) {
                setError(errorText(err));
                return;
            }
        }
        go("dashboard");
    };

    return (
        <section className="outcome" aria-labelledby={headingId}>
            <h2 id={headingId} className="outcome-question">Did you finish what you wrote?</h2>
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
                {answered ? "Saved. You can change it at any time." : "Either answer is kept as it is."}
                {" "}
                <button type="button" className="link" onClick={() => void close()}>
                    {answered ? "Back to the Dashboard" : "Skip for now"}
                </button>
            </p>
            {error != null && <ErrorNote title="The answer was not saved." error={error} />}
        </section>
    );
}

type ConfirmPhase = "idle" | "confirming" | "working" | "done" | "error";

/** A destructive action behind a second, inline step. No modal: the task needs neither interruption nor trapped focus. */
export function ConfirmStep({title, action, consequence, confirmLabel, doneText, failText, onConfirm}: {
    title?: string,
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
                <div className="confirm-text">
                    {title != null && <p className="setting-name">{title}</p>}
                    <p className="confirm-consequence">{consequence}</p>
                </div>
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
