import type {PeriodMode} from "./shared/types.ts";

// Calendar periods for the Dashboard and the Ledger. Every boundary is local device time. A session belongs to the
// day, week, or month its start falls in, so a session that crosses midnight is counted once (docs/design.md §5.3).

export type Period = {mode: PeriodMode, anchor: Date};

export type Range = {start: number, end: number};

/** One column of the breakdown chart: an hour in Day mode, a calendar day otherwise. */
export type Bucket = Range & {key: string, label: string, tick: string | null};

const LOCALE = "en-US";

export const periodModes: readonly PeriodMode[] = ["day", "week", "month"];

export function parsePeriodMode(text: string | undefined): PeriodMode | null {
    return periodModes.find((mode) => mode === text) ?? null;
}

export function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKey(date: Date) {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${m}-${d}`;
}

/** `YYYY-MM-DD` to local midnight, or null for anything that is not a real calendar date. */
export function parseDayKey(text: string | undefined): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? "");
    if (match == null)
        return null;

    const [, y, m, d] = match.map(Number);
    if (y == null || m == null || d == null)
        return null;

    const date = new Date(y, m - 1, d);
    return dayKey(date) === text ? date : null;
}

/** Weeks start on Monday. */
function startOfWeek(date: Date) {
    return addDays(startOfDay(date), -((date.getDay() + 6) % 7));
}

export function periodRange({mode, anchor}: Period): Range {
    switch (mode) {
        case "day": {
            const start = startOfDay(anchor);
            return {start: start.getTime(), end: addDays(start, 1).getTime()};
        }
        case "week": {
            const start = startOfWeek(anchor);
            return {start: start.getTime(), end: addDays(start, 7).getTime()};
        }
        case "month":
            return {
                start: new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime(),
                end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1).getTime()
            };
        default: {
            const exhaustive: never = mode;
            return exhaustive;
        }
    }
}

export function shiftPeriod({mode, anchor}: Period, step: 1 | -1): Period {
    switch (mode) {
        case "day": return {mode, anchor: addDays(anchor, step)};
        case "week": return {mode, anchor: addDays(anchor, 7 * step)};
        case "month": return {mode, anchor: new Date(anchor.getFullYear(), anchor.getMonth() + step, 1)};
        default: {
            const exhaustive: never = mode;
            return exhaustive;
        }
    }
}

export function containsDay(period: Period, date: Date) {
    const {start, end} = periodRange(period);
    const t = startOfDay(date).getTime();
    return t >= start && t < end;
}

export function inRange(iso: string, {start, end}: Range) {
    const t = Date.parse(iso);
    return t >= start && t < end;
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function buckets(period: Period): Bucket[] {
    const {start, end} = periodRange(period);
    const out: Bucket[] = [];

    if (period.mode === "day") {
        const day = new Date(start);
        for (let h = 0; h < 24; h++) {
            const from = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h);
            const to = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h + 1);
            out.push({
                key: `h${h}`,
                start: from.getTime(),
                end: to.getTime(),
                label: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`,
                tick: h % 4 === 0 ? hourLabel(h) : null
            });
        }
        return out;
    }

    let lastDay = 0;
    for (let d = new Date(start); d.getTime() < end; d = addDays(d, 1))
        lastDay = d.getDate();

    for (let d = new Date(start); d.getTime() < end; d = addDays(d, 1)) {
        const date = d.getDate();
        const tick = period.mode === "week"
            ? d.toLocaleDateString(LOCALE, {weekday: "short"})
            : date === 1 || date === lastDay || date % 7 === 0 ? d.toLocaleDateString(LOCALE, {month: "short", day: "numeric"}) : null;
        out.push({
            key: dayKey(d),
            start: d.getTime(),
            end: addDays(d, 1).getTime(),
            label: d.toLocaleDateString(LOCALE, {weekday: "short", month: "short", day: "numeric"}),
            tick
        });
    }
    return out;
}

/** The page heading for a period. */
export function periodTitle({mode, anchor}: Period) {
    switch (mode) {
        case "day": return anchor.toLocaleDateString(LOCALE, {weekday: "long", month: "long", day: "numeric"});
        case "month": return anchor.toLocaleDateString(LOCALE, {month: "long", year: "numeric"});
        case "week": return `Week of ${weekSpan(anchor)}`;
        default: {
            const exhaustive: never = mode;
            return exhaustive;
        }
    }
}

/** The compact label inside the date control. */
export function periodShort({mode, anchor}: Period) {
    switch (mode) {
        case "day": return anchor.toLocaleDateString(LOCALE, {month: "short", day: "numeric", year: "numeric"});
        case "month": return anchor.toLocaleDateString(LOCALE, {month: "long", year: "numeric"});
        case "week": return weekSpan(anchor);
        default: {
            const exhaustive: never = mode;
            return exhaustive;
        }
    }
}

/** "this month", "this week", "today", or the period itself in prose. */
export function periodPhrase(period: Period, today = new Date()) {
    if (containsDay(period, today))
        return period.mode === "day" ? "today" : `this ${period.mode}`;
    switch (period.mode) {
        case "day": return `on ${periodShort(period)}`;
        case "week": return `in the week of ${weekSpan(period.anchor)}`;
        case "month": return `in ${periodShort(period)}`;
        default: {
            const exhaustive: never = period.mode;
            return exhaustive;
        }
    }
}

function weekSpan(anchor: Date) {
    const first = startOfWeek(anchor);
    const last = addDays(first, 6);
    const from = first.toLocaleDateString(LOCALE, {month: "short", day: "numeric"});
    const to = first.getMonth() === last.getMonth()
        ? String(last.getDate())
        : last.toLocaleDateString(LOCALE, {month: "short", day: "numeric"});
    return `${from}–${to}, ${last.getFullYear()}`;
}

/** Long day heading for the Ledger: "Friday, Oct 9". */
export function dayTitle(date: Date) {
    return date.toLocaleDateString(LOCALE, {weekday: "long", month: "short", day: "numeric"});
}

/**
 * The clock range a day's timeline draws, in whole hours. 06:00–22:00 by default, widened in even hours so that
 * every session that touches the day stays visible, including night work.
 */
export function clockSpan(spans: {start: number, end: number}[], day: Date) {
    const midnight = startOfDay(day).getTime();
    let from = 6;
    let to = 22;
    for (const span of spans) {
        const a = Math.max(0, (span.start - midnight) / 3_600_000);
        const b = Math.min(24, (span.end - midnight) / 3_600_000);
        if (b <= 0 || a >= 24)
            continue;
        from = Math.min(from, Math.floor(a / 2) * 2);
        to = Math.max(to, Math.ceil(b / 2) * 2);
    }
    return {from, to: Math.min(24, to)};
}
