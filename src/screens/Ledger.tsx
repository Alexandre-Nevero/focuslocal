import {ArrowRightIcon, ChevronRightIcon, ErrorNote, Page, PeriodNav} from "../components.tsx";
import {capital, counted, duration, outcomeWord, timeRange} from "../format.ts";
import {go, ledger, readReviews, useLoad, useNow} from "../ledger.ts";
import {clockSpan, dayKey, dayTitle, inRange, parseDayKey, periodRange, sameDay, startOfDay} from "../period.ts";
import {Trace} from "../trace.tsx";
import type {HistoryRow, Review} from "../shared/types.ts";

const HOUR = 3_600_000;

function rowEnd(row: HistoryRow, now: number) {
    return row.endedAt == null ? now : Date.parse(row.endedAt);
}

function Timeline({day, rows, now}: {day: Date, rows: HistoryRow[], now: number}) {
    const spans = rows.map((row) => ({row, start: Date.parse(row.startedAt), end: rowEnd(row, now)}));
    const {from, to} = clockSpan(spans, day);
    const origin = startOfDay(day).getTime() + from * HOUR;
    const width = (to - from) * HOUR;
    const at = (t: number) => Math.min(100, Math.max(0, ((t - origin) / width) * 100));
    const ticks = Array.from({length: (to - from) / 2 + 1}, (_, i) => from + i * 2);

    return (
        <div className="timeline">
            <div className="timeline-track">
                {ticks.slice(1, -1).map((h) => <span key={h} className="timeline-rule" style={{left: `${at(origin + (h - from) * HOUR)}%`}} aria-hidden="true" />)}
                {spans.map(({row, start, end}) => {
                    const running = row.endedAt == null;
                    const name = row.intention === "" ? "Session with no intention" : row.intention;
                    return (
                        <button
                            key={row.id}
                            type="button"
                            className="timeline-span"
                            data-running={running ? "" : undefined}
                            disabled={running}
                            style={{left: `${at(start)}%`, width: `max(6px, ${at(end) - at(start)}%)`}}
                            title={`${name} · ${timeRange(row.startedAt, row.endedAt)}`}
                            aria-label={`${name}, ${timeRange(row.startedAt, row.endedAt)}${running ? ", running" : ". Open review"}`}
                            onClick={() => go(`review/${row.id}`)}
                        />
                    );
                })}
            </div>
            <div className="timeline-ticks" aria-hidden="true">
                {ticks.map((h) => (
                    <span key={h} style={{left: `${at(origin + (h - from) * HOUR)}%`}}>{`${String(h % 24).padStart(2, "0")}:00`}</span>
                ))}
            </div>
        </div>
    );
}

function SessionRow({row, review, now}: {row: HistoryRow, review: Review | null | undefined, now: number}) {
    const running = row.endedAt == null;
    return (
        <li>
            <button type="button" className="day-row" disabled={running} onClick={() => go(`review/${row.id}`)}>
                <span className="dot" aria-hidden="true" />
                <span className="day-what">
                    <span className={row.intention === "" ? "day-intention is-empty" : "day-intention"}>
                        {row.intention === "" ? "No intention written" : row.intention}
                    </span>
                    <span className="day-when">{timeRange(row.startedAt, row.endedAt)} · {duration(rowEnd(row, now) - Date.parse(row.startedAt))}</span>
                </span>
                <span className="day-trace">
                    {/* A running session shows only its clock range: no live labels (BR-001). */}
                    {!running && review != null && <Trace review={review} active={null} onActive={() => undefined} compact />}
                    {!running && review === null && <span className="quiet">Windows could not be read.</span>}
                </span>
                <span className="pill pill-quiet">{outcomeWord(row.outcome, running)}</span>
                {!running ? <ChevronRightIcon /> : <span aria-hidden="true" />}
            </button>
        </li>
    );
}

function LedgerBody({day}: {day: Date}) {
    const now = useNow(30_000);
    const [history] = useLoad(() => ledger.history.list(), [], ["session:changed"]);
    const range = periodRange({mode: "day", anchor: day});
    const rows = history.state === "ready"
        ? history.value.filter((r) => inRange(r.startedAt, range)).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
        : [];
    const ids = rows.filter((r) => r.endedAt != null).map((r) => r.id);
    const [reviewsLoad] = useLoad(() => readReviews(ids), [ids.join(",")], ["verdict:updated"]);
    const reviews = reviewsLoad.state === "ready" ? reviewsLoad.value : null;
    const loaded = reviews == null ? null : ids.map((id) => reviews.get(id)).filter((r): r is Review => r != null);
    const visits = loaded?.flatMap((r) => r.visits);
    const isToday = sameDay(day, new Date());

    const counts = [
        counted(rows.length, "session"),
        ...(visits == null ? [] : [
            counted(visits.filter((v) => v.kind === "attention").length, "window visit"),
            counted(visits.filter((v) => v.kind === "away").length, "away stretch", "away stretches")
        ])
    ];

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">{dayTitle(day)}</h1>
                    <p className="page-sub">Every session that started on this day, in clock order.</p>
                </div>
                <PeriodNav period={{mode: "day", anchor: day}} modes={null} onChange={(next) => go(`ledger/${dayKey(next.anchor)}`)} />
            </header>

            {history.state === "error" && (
                <ErrorNote title="The local file could not be read." error={history.error}>No sessions are shown in its place.</ErrorNote>
            )}

            <div className="dash">
                <section className="card" aria-labelledby="timeline-heading">
                    <div className="card-head">
                        <h2 id="timeline-heading" className="card-title">Timeline</h2>
                        <p className="card-meta card-meta-figures">{counts.join(" · ")}</p>
                    </div>
                    {history.state === "loading"
                        ? <div className="skeleton skeleton-trace" aria-label="Reading the local file…" />
                        : <Timeline day={day} rows={rows} now={now} />}

                    {history.state === "ready" && rows.length === 0 && (
                        <div className="card-empty card-empty-row">
                            <p>{isToday ? "No sessions started today yet." : "No sessions started on this day."}</p>
                            {isToday && <button type="button" className="btn btn-primary btn-small" onClick={() => go("declare")}>Start a session</button>}
                        </div>
                    )}
                    {rows.length > 0 && (
                        <ol className="day-list" aria-label={`Sessions on ${dayTitle(day)}`}>
                            {rows.map((row) => <SessionRow key={row.id} row={row} review={reviews?.get(row.id)} now={now} />)}
                        </ol>
                    )}
                </section>

                <p className="ledger-foot">
                    <button type="button" className="link" onClick={() => go("history")}>
                        View all sessions<ArrowRightIcon />
                    </button>
                    {loaded != null && loaded.length > 0 && (
                        <span className="quiet">
                            {capital(counted(loaded.flatMap((r) => r.visits).filter((v) => v.shown === "unclear").length, "unclear window"))} to settle in the reviews.
                        </span>
                    )}
                </p>
            </div>
        </>
    );
}

/** The chronological record of one day. Selecting a session opens its review (docs/design.md §6). */
export function Ledger({date}: {date?: string}) {
    const day = parseDayKey(date) ?? startOfDay(new Date());
    return (
        <Page current="ledger" wide>
            <LedgerBody key={dayKey(day)} day={day} />
        </Page>
    );
}
