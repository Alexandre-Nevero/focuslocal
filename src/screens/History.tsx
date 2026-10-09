import {useState} from "react";
import {ErrorNote, Page} from "../components.tsx";
import {capital, counted, dayLabel, outcomeWord, timeRange} from "../format.ts";
import {go, ledger, useLoad} from "../ledger.ts";
import type {HistoryRow, Review} from "../shared/types.ts";

type Entry = {row: HistoryRow, apps: string[] | null};

/** The apps a block was mostly made of, longest first. */
function topApps(review: Review) {
    const totals = new Map<string, number>();
    for (const visit of review.visits) {
        if (visit.kind !== "attention")
            continue;
        const ms = Date.parse(visit.endedAt ?? visit.lastSeenAt) - Date.parse(visit.startedAt);
        totals.set(visit.appName, (totals.get(visit.appName) ?? 0) + Math.max(0, ms));
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([app]) => app);
}

async function readHistory(): Promise<Entry[]> {
    const rows = await ledger.history.list();
    return Promise.all(rows.map(async (row): Promise<Entry> => {
        if (row.endedAt == null)
            return {row, apps: []};
        try {
            return {row, apps: topApps(await ledger.review.get(row.id))};
        } catch {
            return {row, apps: null};
        }
    }));
}

/**
 * Past blocks as rows (US-007). An app that keeps coming back is the same chip down the column; pointing at one
 * lights it in every row. The screen never says what the repetition means.
 */
export function History() {
    const [load] = useLoad(readHistory, [], ["session:changed"]);
    const [hot, setHot] = useState<string | null>(null);

    return (
        <Page current="history">
            <header className="screen-head">
                <h1 className="screen-title">Past blocks</h1>
                {load.state === "ready" && load.value.length > 0 && <p className="quiet">{capital(counted(load.value.length, "block"))}.</p>}
            </header>

            {load.state === "loading" && <p className="status">Reading the local file…</p>}
            {load.state === "error" && <ErrorNote title="The local file could not be read." error={load.error}>No blocks are shown in its place.</ErrorNote>}
            {load.state === "ready" && load.value.length === 0 && (
                <div className="empty">
                    <p>No blocks yet. A block shows up here once it ends.</p>
                    <button type="button" className="btn btn-primary" onClick={() => go("declare")}>Start a block</button>
                </div>
            )}
            {load.state === "ready" && load.value.length > 0 && (
                <ol className="session-list" data-hot={hot ?? undefined}>
                    {load.value.map(({row, apps}) => {
                        const running = row.endedAt == null;
                        return (
                            <li key={row.id}>
                                <button
                                    type="button"
                                    className="session-row"
                                    disabled={running}
                                    onClick={() => go(`review/${row.id}`)}
                                >
                                    <span className="session-when">
                                        <span>{dayLabel(row.startedAt)}</span>
                                        <span className="quiet">{timeRange(row.startedAt, row.endedAt)}</span>
                                    </span>
                                    <span className="session-what">
                                        <span className={row.intention === "" ? "session-intention is-empty" : "session-intention"}>
                                            {row.intention === "" ? "No intention written" : row.intention}
                                        </span>
                                        {apps == null && <span className="quiet">Windows could not be read.</span>}
                                        {apps != null && apps.length > 0 && (
                                            <span className="app-chips">
                                                {apps.map((app) => (
                                                    <span
                                                        key={app}
                                                        className="app-chip"
                                                        data-hot={hot === app ? "" : undefined}
                                                        onPointerEnter={() => setHot(app)}
                                                        onPointerLeave={() => setHot(null)}
                                                    >{app}
                                                    </span>
                                                ))}
                                            </span>
                                        )}
                                    </span>
                                    <span className="session-outcome">{outcomeWord(row.outcome, running)}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Page>
    );
}
