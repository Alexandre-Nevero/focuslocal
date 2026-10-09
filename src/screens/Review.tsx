import {useState} from "react";
import {ErrorNote, OutcomePair, Page} from "../components.tsx";
import {capital, counted, dayLabel, duration, host, sourceWord, timeOfDay, timeRange} from "../format.ts";
import {errorText, ledger, useLoad} from "../ledger.ts";
import {Legend, Trace} from "../trace.tsx";
import {variantOf, variantWord} from "../trace-model.ts";
import type {ReviewVisit} from "../shared/types.ts";

function visitMs(visit: ReviewVisit) {
    return Math.max(0, Date.parse(visit.endedAt ?? visit.lastSeenAt) - Date.parse(visit.startedAt));
}

function LabelCell({visit}: {visit: ReviewVisit}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const variant = variantOf(visit);

    const tap = async (label: "serves" | "drifts") => {
        setBusy(true);
        setError(null);
        try {
            await ledger.review.tap(visit.id, label);
        } catch (err) {
            setError(errorText(err));
        }
        setBusy(false);
    };

    if (variant === "away")
        return <span className="label-word quiet">Not judged</span>;
    if (variant === "judging")
        return <span className="label-word quiet">Judging…</span>;
    if (variant === "unclear") {
        return (
            <div className="label-unclear">
                <span className="label-word">Unclear. You decide.</span>
                <span className="tap-pair" role="group" aria-label={`Label ${visit.appName}`}>
                    <button type="button" className="btn btn-tap" disabled={busy} onClick={() => void tap("serves")}>Serves</button>
                    <button type="button" className="btn btn-tap" disabled={busy} onClick={() => void tap("drifts")}>Drifts</button>
                </span>
                {error != null && <span className="label-error" role="alert">Not saved: {error}</span>}
            </div>
        );
    }

    const source = visit.verdict?.source;
    return (
        <span className="label-asserted">
            <span className="label-word">{source === "user" ? `You marked it ${variant}` : variantWord[variant]}</span>
            {source != null && source !== "user" && <span className="label-source">{sourceWord(source)}</span>}
        </span>
    );
}

function VisitRow({visit, active, onActive}: {visit: ReviewVisit, active: boolean, onActive(id: string | null): void}) {
    const variant = variantOf(visit);
    const site = host(visit.url);
    const detail = [visit.windowTitle, site].filter((part) => part != null && part !== "").join(" · ");

    return (
        <li
            className="visit"
            data-variant={variant}
            data-source={visit.verdict?.source}
            data-active={active ? "" : undefined}
            onPointerEnter={() => onActive(visit.id)}
            onPointerLeave={() => onActive(null)}
            onFocus={() => onActive(visit.id)}
            onBlur={() => onActive(null)}
        >
            <span className="visit-when">
                <time className="visit-time" dateTime={visit.startedAt}>{timeOfDay(visit.startedAt)}</time>
                <span className="visit-dur">{duration(visitMs(visit))}</span>
            </span>
            <span className={`seg seg-${variant} visit-swatch`} aria-hidden="true" />
            <span className="visit-what">
                <span className="visit-app">{visit.kind === "away" ? "Away from the machine" : visit.appName}</span>
                {visit.kind !== "away" && detail !== "" && <span className="visit-title" title={detail}>{detail}</span>}
            </span>
            <span className="visit-label"><LabelCell visit={visit} /></span>
        </li>
    );
}

/** The record first, the finish question last (US-004, US-005, US-010, BR-007). */
export function Review({sessionId}: {sessionId: string}) {
    const [load] = useLoad(() => ledger.review.get(sessionId), [sessionId], ["verdict:updated"]);
    const [active, setActive] = useState<string | null>(null);

    if (load.state === "loading")
        return <Page><p className="status">Reading the local file…</p></Page>;
    if (load.state === "error") {
        return (
            <Page>
                <ErrorNote title="The local file could not be read." error={load.error}>No session is shown in its place.</ErrorNote>
            </Page>
        );
    }

    const review = load.value;
    const {session, visits, unrecordedMs} = review;
    const ordered = [...visits].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
    const attention = ordered.filter((v) => v.kind === "attention");
    const away = ordered.length - attention.length;
    const unclear = attention.filter((v) => v.shown === "unclear").length;
    const variants = [...new Set(ordered.map(variantOf)), ...(unrecordedMs >= 1000 ? ["unrecorded" as const] : [])];

    return (
        <Page>
            <article className="review">
                <header className="review-head">
                    <h1 className={session.intention === "" ? "display is-empty" : "display"}>
                        {session.intention === "" ? "No intention was written for this block." : session.intention}
                    </h1>
                    <p className="meta">
                        {dayLabel(session.startedAt)} · {timeRange(session.startedAt, session.endedAt)} ·{" "}
                        {counted(attention.length, "window visit")}{away > 0 ? `, ${counted(away, "stretch", "stretches")} away` : ""}
                    </p>
                    {session.intention === "" && <p className="hint">Nothing below is judged against a sentence. The record is still yours to read.</p>}
                </header>

                <Trace review={review} active={active} onActive={setActive} />
                <Legend variants={variants} />

                {unrecordedMs >= 1000 && (
                    <p className="gap-note">
                        <span className="seg seg-unrecorded swatch" aria-hidden="true" />
                        <span><strong>{capital(duration(unrecordedMs))} not recorded.</strong> Ledger did not see this time, so it is not
                            given to any window.
                        </span>
                    </p>
                )}

                <section className="visits" aria-labelledby="visits-heading">
                    <div className="visits-head">
                        <h2 id="visits-heading" className="section-title">In the order it happened</h2>
                        {unclear > 0 && <p className="quiet">{capital(counted(unclear, "row"))} waiting for your word.</p>}
                    </div>
                    {ordered.length === 0
                        ? <p className="empty">No windows were recorded in this block.</p>
                        : (
                            <ol className="visit-list">
                                {ordered.map((visit) => (
                                    <VisitRow key={visit.id} visit={visit} active={active === visit.id} onActive={setActive} />
                                ))}
                            </ol>
                        )}
                </section>

                {session.endedAt != null && <OutcomePair sessionId={session.id} outcome={session.outcome} />}
            </article>
        </Page>
    );
}
