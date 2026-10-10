import {useState} from "react";
import {IntentionEditor} from "../IntentionEditor.tsx";
import {ChevronLeftIcon, ErrorNote, OutcomePair, Page} from "../components.tsx";
import {capital, counted, dayLabel, duration, host, latency, sourceWord, timeOfDay, timeRange} from "../format.ts";
import {errorText, go, ledger, useLoad} from "../ledger.ts";
import {dayKey, dayTitle} from "../period.ts";
import {median} from "../summary.ts";
import {Legend, Trace} from "../trace.tsx";
import {variantOf} from "../trace-model.ts";
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
        return <span className="label-word quiet">Labelling…</span>;
    const source = visit.shownSource ?? visit.verdict?.source;
    const label = variant === "serves" ? "Served" : "Drift";
    const next = variant === "serves" ? "drifts" : "serves";
    const nextWord = next === "serves" ? "Served" : "Drift";
    return (
        <span className="label-asserted">
            <button
                type="button"
                className="btn btn-tap label-toggle"
                disabled={busy}
                aria-label={`${visit.appName}: ${label}. Change to ${nextWord}`}
                aria-busy={busy}
                title={`Click to change to ${nextWord}`}
                onClick={() => void tap(next)}
            >
                <span className="label-word">{busy ? "Saving…" : label}</span>
                <span className="label-toggle-hint" aria-hidden="true">↔</span>
            </button>
            {source != null && <span className="label-source">{source === "user" ? "Your correction" : sourceWord(source)}</span>}
            {error != null && <span className="label-error" role="alert">Not saved: {error}</span>}
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

/**
 * Where the displayed labels came from, with the stored model's measured median time.
 * Shows nothing until at least one label exists; no figure here is estimated.
 */
function LabelSources({visits}: {visits: ReviewVisit[]}) {
    const verdicts = visits.flatMap((v) => (v.kind === "attention" && v.verdict != null ? [v.verdict] : []));
    if (!visits.some((v) => v.kind === "attention" && v.shown != null))
        return null;

    const sources = (["rule", "memory", "model", "user"] as const)
        .map((source) => ({source, n: visits.filter((v) => v.kind === "attention" && (v.shownSource ?? v.verdict?.source) === source).length}))
        .filter(({n}) => n > 0);
    const modelMs = median(verdicts.flatMap((v) => (v.source === "model" && v.latencyMs != null ? [v.latencyMs] : [])));

    return (
        <section className="sources" aria-labelledby="sources-heading">
            <h2 id="sources-heading" className="sources-title">Labelled on this device</h2>
            <ul className="sources-list">
                {sources.map(({source, n}) => (
                    <li key={source}><span className="figure">{n}</span> {sourceWord(source)}</li>
                ))}
            </ul>
            {modelMs != null && (
                <p className="sources-note">The on-device model took a median of <span className="figure">{latency(modelMs)}</span> per window.</p>
            )}
        </section>
    );
}

/** The record first, the finish question last (US-004, US-005, US-010, BR-007). */
export function Review({sessionId}: {sessionId: string}) {
    const [load] = useLoad(() => ledger.review.get(sessionId), [sessionId], ["verdict:updated", "session:changed"]);
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
    const variants = [...new Set(ordered.map(variantOf)), ...(unrecordedMs >= 1000 ? ["unrecorded" as const] : [])];

    return (
        <Page current="ledger">
            <button type="button" className="link back-link" onClick={() => go(`ledger/${dayKey(new Date(session.startedAt))}`)}>
                <ChevronLeftIcon />Back to {dayTitle(new Date(session.startedAt))}
            </button>
            <article className="review">
                <header className="review-head">
                    <h1 className="section-title">Session review</h1>
                    <IntentionEditor key={session.id} sessionId={session.id} intention={session.intention} />
                    <p className="meta">
                        {dayLabel(session.startedAt)} · {timeRange(session.startedAt, session.endedAt)} ·{" "}
                        {counted(attention.length, "window visit")}{away > 0 ? `, ${counted(away, "stretch", "stretches")} away` : ""}
                    </p>
                    {session.intention === "" && <p className="hint">Without an intention, labels use your lists and default to Drift. You can correct any label.</p>}
                </header>

                <Trace review={review} active={active} onActive={setActive} />
                <Legend variants={variants} intention={session.intention !== ""} />

                {unrecordedMs >= 1000 && (
                    <p className="gap-note">
                        <span className="seg seg-unrecorded swatch" aria-hidden="true" />
                        <span><strong>{capital(duration(unrecordedMs))} not recorded.</strong> Twofold did not see this time, so it is not
                            given to any window.
                        </span>
                    </p>
                )}

                <section className="visits" aria-labelledby="visits-heading">
                    <div className="visits-head">
                        <h2 id="visits-heading" className="section-title">Windows you used</h2>
                        <p className="quiet">Click a label to switch Served / Drift.</p>
                    </div>
                    {ordered.length === 0
                        ? <p className="empty">No windows were recorded in this session.</p>
                        : (
                            <ol className="visit-list">
                                {ordered.map((visit) => (
                                    <VisitRow key={visit.id} visit={visit} active={active === visit.id} onActive={setActive} />
                                ))}
                            </ol>
                        )}
                </section>

                {session.endedAt != null && <LabelSources visits={ordered} />}
                {session.endedAt != null && <OutcomePair sessionId={session.id} outcome={session.outcome} />}
            </article>
        </Page>
    );
}
