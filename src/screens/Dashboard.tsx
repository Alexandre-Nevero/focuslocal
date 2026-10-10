import {useRef, useState, type KeyboardEvent} from "react";
import {ArrowRightIcon, BrandMark, ChevronLeftIcon, ChevronRightIcon, ErrorNote, Page, PeriodNav} from "../components.tsx";
import {capital, counted, dayLabel, duration, minutes, timeRange} from "../format.ts";
import {go, ledger, readReviews, useLoad} from "../ledger.ts";
import {
    buckets, dayKey, inRange, parseDayKey, parsePeriodMode, periodModes, periodPhrase, periodRange, periodTitle, sameDay,
    startOfDay, type Bucket, type Period
} from "../period.ts";
import {driftedWindows, labelTotals, windowMs} from "../summary.ts";
import {Legend, Trace} from "../trace.tsx";
import {traceOrder, variantWord} from "../trace-model.ts";
import type {HistoryRow, Review} from "../shared/types.ts";

type Reviews = Map<string, Review | null> | null;

const byStart = (a: HistoryRow, b: HistoryRow) => Date.parse(a.startedAt) - Date.parse(b.startedAt);

function sessionMs(row: HistoryRow) {
    return row.endedAt == null ? 0 : Math.max(0, Date.parse(row.endedAt) - Date.parse(row.startedAt));
}

function whenLabel(iso: string) {
    return sameDay(new Date(iso), new Date()) ? "Today" : dayLabel(iso);
}

function loadedReviews(ids: string[], reviews: Reviews) {
    if (reviews == null)
        return null;
    return ids.map((id) => reviews.get(id)).filter((r): r is Review => r != null);
}

/* ---------- Breakdown chart ---------- */

function Breakdown({period, columns, rows, reviews, selected, onSelect}: {
    period: Period,
    columns: Bucket[],
    rows: HistoryRow[],
    reviews: Reviews,
    selected: string | null,
    onSelect(key: string | null): void
}) {
    const [pointer, setPointer] = useState<string | null>(null);
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const counts = columns.map((col) => rows.filter((row) => inRange(row.startedAt, col)));
    const peak = Math.max(2, ...counts.map((c) => c.length));
    const ticks = [...new Set([peak, Math.round(peak / 2), 0])];
    const lastWithData = counts.reduce((last, c, i) => (c.length > 0 ? i : last), -1);
    const selectedIndex = columns.findIndex((c) => c.key === selected);
    const rovingIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, lastWithData);
    const shownKey = pointer ?? selected;
    const shownIndex = columns.findIndex((c) => c.key === shownKey);
    const unit = period.mode === "day" ? "hour" : "day";

    const onKey = (event: KeyboardEvent, index: number) => {
        const next = {ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: columns.length - 1}[event.key];
        if (next == null)
            return;
        event.preventDefault();
        const clamped = Math.min(columns.length - 1, Math.max(0, next));
        refs.current[clamped]?.focus();
    };

    const tip = shownIndex >= 0 ? (() => {
        const col = columns[shownIndex]!;
        const inCol = counts[shownIndex]!;
        const ended = loadedReviews(inCol.filter((r) => r.endedAt != null).map((r) => r.id), reviews);
        const totals = ended == null ? null : labelTotals(ended);
        return {col, count: inCol.length, totals, x: ((shownIndex + 0.5) / columns.length) * 100};
    })() : null;

    return (
        <div className="chart">
            <div className="chart-y" aria-hidden="true">
                {ticks.map((t) => <span key={t}>{t}</span>)}
            </div>
            <div className="chart-body">
                <div className="chart-plot">
                    {ticks.map((t) => <span key={t} className="chart-grid" style={{bottom: `${(t / peak) * 100}%`}} aria-hidden="true" />)}
                    <div className="chart-cols" role="group" aria-label={`Sessions per ${unit}. Arrow keys move between ${unit}s.`}>
                        {columns.map((col, i) => {
                            const n = counts[i]!.length;
                            return (
                                <button
                                    key={col.key}
                                    ref={(el) => {
                                        refs.current[i] = el;
                                    }}
                                    type="button"
                                    className="chart-col"
                                    tabIndex={i === rovingIndex ? 0 : -1}
                                    aria-pressed={col.key === selected}
                                    aria-label={`${col.label}: ${counted(n, "session")}`}
                                    data-empty={n === 0 ? "" : undefined}
                                    onClick={() => onSelect(col.key === selected ? null : col.key)}
                                    onKeyDown={(e) => onKey(e, i)}
                                    onPointerEnter={() => setPointer(col.key)}
                                    onPointerLeave={() => setPointer(null)}
                                    onFocus={() => setPointer(col.key)}
                                    onBlur={() => setPointer(null)}
                                >
                                    <span className="chart-bar" style={{height: n === 0 ? undefined : `${(n / peak) * 100}%`}} />
                                </button>
                            );
                        })}
                    </div>
                    {tip != null && (
                        <div className="chart-tip" style={{left: `clamp(5.5rem, ${tip.x}%, calc(100% - 5.5rem))`}} aria-hidden="true">
                            <p className="chart-tip-title">{tip.col.label}</p>
                            <dl>
                                <div><dt>Sessions</dt><dd>{tip.count}</dd></div>
                                {tip.totals != null && tip.count > 0 && (
                                    <>
                                        <div><dt><span className="tip-key tip-key-window" />Window time</dt><dd>{minutes(windowMs(tip.totals))}</dd></div>
                                        <div><dt><span className="tip-key tip-key-away" />Away</dt><dd>{minutes(tip.totals.away)}</dd></div>
                                    </>
                                )}
                            </dl>
                        </div>
                    )}
                </div>
                <div className="chart-x" aria-hidden="true">
                    {columns.map((col) => <span key={col.key}>{col.tick ?? ""}</span>)}
                </div>
            </div>
        </div>
    );
}

/* ---------- Intention overlay ---------- */

function Overlay({scope, scopeLabel, reviews}: {scope: HistoryRow[], scopeLabel: string, reviews: Reviews}) {
    const [picked, setPicked] = useState<string | null>(null);
    const [active, setActive] = useState<string | null>(null);
    const ended = scope.filter((r) => r.endedAt != null).sort(byStart);
    const index = Math.max(0, ended.findIndex((r) => r.id === picked));
    const current = ended.length === 0 ? null : (picked == null ? ended[ended.length - 1]! : ended[index]!);
    const position = current == null ? -1 : ended.indexOf(current);
    const review = current == null || reviews == null ? undefined : reviews.get(current.id);

    return (
        <section className="card overlay-card" aria-labelledby="overlay-heading">
            <div className="card-head">
                <h2 id="overlay-heading" className="card-label">Your intention, laid over the session</h2>
                {ended.length > 1 && (
                    <div className="stepper" role="group" aria-label="Choose a session">
                        <button
                            type="button"
                            className="icon-btn icon-btn-sm"
                            aria-label="Earlier session"
                            disabled={position <= 0}
                            onClick={() => setPicked(ended[position - 1]!.id)}
                        ><ChevronLeftIcon />
                        </button>
                        <span className="card-meta" aria-live="polite">Session {position + 1} of {ended.length}</span>
                        <button
                            type="button"
                            className="icon-btn icon-btn-sm"
                            aria-label="Later session"
                            disabled={position >= ended.length - 1}
                            onClick={() => setPicked(ended[position + 1]!.id)}
                        ><ChevronRightIcon />
                        </button>
                    </div>
                )}
                {ended.length === 1 && <p className="card-meta">Latest session {scopeLabel}</p>}
            </div>

            {current == null
                ? (
                    <div className="card-empty">
                        <p>No session ended {scopeLabel}. A session appears here, with its windows, once it ends.</p>
                    </div>
                )
                : (
                    <>
                        <div className="overlay-intent">
                            <p className={current.intention === "" ? "overlay-sentence is-empty" : "overlay-sentence"}>
                                {current.intention === "" ? "No intention was written, so no line is drawn above the windows." : current.intention}
                            </p>
                            <p className="overlay-meta">
                                <span>{whenLabel(current.startedAt)}, {timeRange(current.startedAt, current.endedAt)}</span>
                                <span className="figure">{duration(sessionMs(current))}</span>
                            </p>
                        </div>
                        {review === undefined && <div className="skeleton skeleton-trace" aria-label="Reading the windows…" />}
                        {review === null && <ErrorNote title="The windows of this session could not be read." />}
                        {review != null && <Trace review={review} active={active} onActive={setActive} />}
                        <div className="overlay-foot">
                            <Legend variants={traceOrder.filter((v) => v !== "judging")} intention />
                            <div className="overlay-links">
                                <button type="button" className="link" onClick={() => go(`ledger/${dayKey(new Date(current.startedAt))}`)}>
                                    Open this day
                                </button>
                                <button type="button" className="btn btn-quiet btn-small" onClick={() => go(`review/${current.id}`)}>
                                    Open review<ArrowRightIcon />
                                </button>
                            </div>
                        </div>
                    </>
                )}
        </section>
    );
}

/* ---------- Lower band ---------- */

function RecentSessions({rows, highlight}: {rows: HistoryRow[], highlight: string | null}) {
    const recent = [...rows].sort((a, b) => byStart(b, a)).slice(0, 4);
    return (
        <section className="card lower-card" aria-labelledby="recent-heading">
            <div className="card-head">
                <h2 id="recent-heading" className="card-title">Recent sessions</h2>
                <p className="card-meta">{counted(rows.length, "session")}</p>
            </div>
            {recent.length === 0
                ? <p className="card-empty">No sessions yet in this period.</p>
                : (
                    <ol className="recent-list">
                        {recent.map((row) => {
                            const running = row.endedAt == null;
                            return (
                                <li key={row.id}>
                                    <button
                                        type="button"
                                        className="recent-row"
                                        data-current={row.id === highlight ? "" : undefined}
                                        disabled={running}
                                        onClick={() => go(`review/${row.id}`)}
                                    >
                                        <span className="dot" aria-hidden="true" />
                                        <span className="recent-what">
                                            <span className={row.intention === "" ? "recent-intention is-empty" : "recent-intention"}>
                                                {row.intention === "" ? "No intention written" : row.intention}
                                            </span>
                                            <span className="recent-when">{whenLabel(row.startedAt)} · {timeRange(row.startedAt, row.endedAt)}</span>
                                        </span>
                                        <span className="figure">{running ? "Running" : duration(sessionMs(row))}</span>
                                        {!running && <ChevronRightIcon />}
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                )}
            <button type="button" className="link card-link" onClick={() => go("history")}>
                View all sessions<ArrowRightIcon />
            </button>
        </section>
    );
}

function DriftedWindows({reviews}: {reviews: Review[] | null}) {
    const windows = reviews == null ? null : driftedWindows(reviews);
    const unclear = reviews == null ? 0 : reviews.flatMap((r) => r.visits).filter((v) => v.kind === "attention" && v.shown === "unclear").length;

    return (
        <section className="card lower-card" aria-labelledby="drifted-heading">
            <div className="card-head">
                <h2 id="drifted-heading" className="card-title">Drifted windows</h2>
                {windows != null && <p className="card-meta">{counted(windows.length, "window")}</p>}
            </div>
            {windows == null && <div className="skeleton skeleton-list" aria-label="Reading the windows…" />}
            {windows != null && windows.length === 0 && <p className="card-empty">No window was labelled Drifted in this period.</p>}
            {windows != null && windows.length > 0 && (
                <ol className="drift-list">
                    {windows.slice(0, 5).map((w) => (
                        <li key={w.key} className="drift-row">
                            <span className="monogram" aria-hidden="true">{w.name.charAt(0).toUpperCase()}</span>
                            <span className="drift-what">
                                <span className="drift-name">{w.name}</span>
                                <span className="drift-visits">{counted(w.visits, "visit")}</span>
                            </span>
                            <span className="figure">{minutes(w.ms)}</span>
                        </li>
                    ))}
                </ol>
            )}
            {windows != null && windows.length > 5 && <p className="card-note">{capital(counted(windows.length - 5, "more window"))} in the reviews.</p>}
            {unclear > 0 && <p className="card-note">{capital(counted(unclear, "unclear window"))} not counted. Settle {unclear === 1 ? "it" : "them"} in the review.</p>}
        </section>
    );
}

function AttentionBreakdown({reviews, mode}: {reviews: Review[] | null, mode: Period["mode"]}) {
    const totals = reviews == null ? null : labelTotals(reviews);
    const attention = totals == null ? 0 : windowMs(totals);
    const categories = totals == null ? [] : [
        {key: "attention", label: "Attention", ms: attention},
        {key: "away", label: "Away", ms: totals.away},
        {key: "unrecorded", label: "Not recorded", ms: totals.unrecorded}
    ];
    const total = categories.reduce((sum, item) => sum + item.ms, 0);
    const outer = categories.filter((item) => item.ms > 0);
    const inner = traceOrder.filter((variant) => variant !== "away" && variant !== "unrecorded" && (totals?.[variant] ?? 0) > 0);
    const innerSummary = inner.map((variant) => `${variantWord[variant]} ${minutes(totals?.[variant] ?? 0)}`)
        .join(" · ") || "no recorded windows";

    return (
        <section className="card lower-card attention-card" aria-labelledby="attention-heading">
            <div className="card-head">
                <h2 id="attention-heading" className="card-label">Attention breakdown</h2>
                <p className="card-meta attention-period">{mode}</p>
            </div>
            {totals == null
                ? <div className="skeleton skeleton-chart" role="status" aria-label="Reading the windows…" />
                : (
                    <>
                        <div className="attention-chart">
                            <svg viewBox="0 0 240 240" role="img" aria-label={`Inner ring: ${innerSummary}. Outer ring: recorded Attention, Away, and Not recorded.`}>
                                <circle className="attention-track" cx="120" cy="120" r="101" strokeWidth="17" />
                                <circle className="attention-track" cx="120" cy="120" r="80" strokeWidth="11" />
                                {outer.map((item, index) => {
                                    const length = item.ms / total * 100;
                                    const offset = outer.slice(0, index).reduce((sum, previous) => sum + previous.ms, 0) / total * 100;
                                    return <circle key={item.key} className={`attention-arc attention-${item.key}`} cx="120" cy="120" r="101" strokeWidth="17" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-offset} transform="rotate(-90 120 120)" />;
                                })}
                                {inner.map((variant, index) => {
                                    const length = totals[variant] / attention * 100;
                                    const offset = inner.slice(0, index)
                                        .reduce((sum, previous) => sum + totals[previous], 0) / attention * 100;
                                    return <circle key={variant} className={`attention-arc attention-${variant}`} cx="120" cy="120" r="80" strokeWidth="11" pathLength="100" strokeDasharray={`${Math.max(0, length - 0.8)} ${100 - Math.max(0, length - 0.8)}`} strokeDashoffset={-offset} transform="rotate(-90 120 120)" />;
                                })}
                            </svg>
                            <div className="attention-center">
                                <strong>{minutes(attention)}</strong>
                                <span>Attention</span>
                            </div>
                        </div>
                        <dl className="attention-list">
                            {categories.map((item) => (
                                <div key={item.key}>
                                    <dt><span className={`attention-dot attention-${item.key}`} aria-hidden="true" />{item.label}</dt>
                                    <dd className="figure">{minutes(item.ms)}</dd>
                                </div>
                            ))}
                        </dl>
                        <p className="attention-note">Attention is recorded window time, whatever its label. Inner ring: {innerSummary}.</p>
                    </>
                )}
        </section>
    );
}

/* ---------- Screen ---------- */

function DashboardBody({period, onPeriod}: {period: Period, onPeriod(next: Period): void}) {
    const [history] = useLoad(() => ledger.history.list(), [], ["session:changed"]);
    const [selected, setSelected] = useState<string | null>(null);
    const range = periodRange(period);
    const rows = history.state === "ready" ? history.value.filter((r) => inRange(r.startedAt, range)) : [];
    const ended = rows.filter((r) => r.endedAt != null);
    const ids = ended.map((r) => r.id);
    const [reviewsLoad] = useLoad(() => readReviews(ids), [ids.join(",")], ["verdict:updated"]);
    const reviews: Reviews = reviewsLoad.state === "ready" ? reviewsLoad.value : null;
    const columns = buckets(period);
    const column = columns.find((c) => c.key === selected) ?? null;
    const scope = column == null ? rows : rows.filter((r) => inRange(r.startedAt, column));
    const phrase = periodPhrase(period);
    const scopeLabel = column == null ? phrase : period.mode === "day" ? `at ${column.label}` : `on ${column.label}`;
    const overlayId = scope.filter((r) => r.endedAt != null)
        .sort(byStart)
        .at(-1)?.id ?? null;
    const runningNow = rows.some((r) => r.endedAt == null);

    const subtitle = history.state === "loading"
        ? "Reading the local file…"
        : ended.length === 0
            ? `No sessions ended ${phrase}.`
            : `${capital(counted(ended.length, "session"))} ended ${phrase}.${runningNow ? " One is running now." : ""}`;

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">{periodTitle(period)}</h1>
                    <p className="page-sub">{subtitle}</p>
                </div>
                <PeriodNav
                    period={period}
                    modes={periodModes}
                    onChange={(next) => {
                        // Switching range keeps the chosen day in view.
                        const day = column != null && period.mode !== "day" ? new Date(column.start) : next.anchor;
                        onPeriod(next.mode !== period.mode ? {mode: next.mode, anchor: day} : next);
                    }}
                />
            </header>

            {history.state === "error" && (
                <ErrorNote title="The local file could not be read." error={history.error}>Nothing is drawn in its place.</ErrorNote>
            )}

            <div className="dash">
                {history.state === "ready" && history.value.length === 0 && (
                    <div className="card first-run">
                        <BrandMark size={44} />
                        <div>
                            <p className="first-run-title">What you meant, and what the windows show.</p>
                            <p className="quiet">Write one sentence, work, and end the session. The review opens with your windows laid under it.</p>
                        </div>
                        <button type="button" className="btn btn-primary" onClick={() => go("declare")}>Start a session</button>
                    </div>
                )}

                <section className="card chart-card" aria-labelledby="breakdown-heading">
                    <div className="card-head">
                        <h2 id="breakdown-heading" className="card-label">{capital(period.mode === "day" ? "daily" : `${period.mode}ly`)} breakdown</h2>
                        <p className="card-meta">Sessions per {period.mode === "day" ? "hour" : "day"}</p>
                    </div>
                    {history.state === "loading"
                        ? <div className="skeleton skeleton-chart" aria-label="Reading the local file…" />
                        : (
                            <Breakdown
                                period={period}
                                columns={columns}
                                rows={rows}
                                reviews={reviews}
                                selected={selected}
                                onSelect={setSelected}
                            />
                        )}
                </section>

                <Overlay key={`${period.mode}-${range.start}-${selected ?? ""}`} scope={scope} scopeLabel={scopeLabel} reviews={reviews} />

                <div className="dash-lower">
                    <RecentSessions rows={rows} highlight={overlayId} />
                    <DriftedWindows reviews={loadedReviews(ids, reviews)} />
                    <AttentionBreakdown reviews={loadedReviews(ids, reviews)} mode={period.mode} />
                </div>
            </div>
        </>
    );
}

/** Month overview, then one session against its intention, then the details (docs/design.md §5). */
export function Dashboard({mode, date}: {mode?: string, date?: string}) {
    const period: Period = {mode: parsePeriodMode(mode) ?? "month", anchor: parseDayKey(date) ?? startOfDay(new Date())};
    const onPeriod = (next: Period) => go(`dashboard/${next.mode}/${dayKey(next.anchor)}`);

    return (
        <Page current="dashboard" wide>
            <DashboardBody key={`${period.mode}-${periodRange(period).start}`} period={period} onPeriod={onPeriod} />
        </Page>
    );
}
