import type {ModelStatus, Outcome, Source} from "./shared/types.ts";

// Counts are words (US-007, BR-006). No formatter here produces a percent, a rate, or an hours headline.
const WORDS = [
    "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"
];

export function countWord(n: number) {
    return WORDS[n] ?? String(n);
}

export function counted(n: number, singular: string, plural = `${singular}s`) {
    return `${countWord(n)} ${n === 1 ? singular : plural}`;
}

export function capital(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Length of one visit or gap, for its own row. Never summed into a headline. */
export function duration(ms: number) {
    if (ms < 60_000)
        return "under a minute";

    const minutes = Math.round(ms / 60_000);
    if (minutes < 60)
        return `${minutes} min`;

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** A total in a figure column: exact zero stays "0 min" so it is not read as "a little". */
export function minutes(ms: number) {
    if (ms <= 0)
        return "0 min";
    if (ms < 60_000)
        return "<1 min";

    return duration(ms);
}

/** Elapsed time of the open session, for the clock only. */
export function clock(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function timeOfDay(iso: string) {
    return new Date(iso).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
}

export function dayLabel(iso: string) {
    return new Date(iso).toLocaleDateString([], {weekday: "short", day: "numeric", month: "short"});
}

export function timeRange(start: string, end: string | null) {
    return `${timeOfDay(start)}–${end == null ? "now" : timeOfDay(end)}`;
}

export function outcomeWord(outcome: Outcome | null, running = false) {
    if (running)
        return "Running";

    switch (outcome) {
        case "yes": return "Yes";
        case "not_yet": return "Not yet";
        default: return "Unanswered";
    }
}

/** Where a shown label came from, in the person's words. */
export function sourceWord(source: Source) {
    switch (source) {
        case "rule": return "from your list";
        case "memory": return "from memory";
        case "model": return "from the on-device model";
        case "user": return "marked by you";
    }
}

export function host(url: string | null) {
    if (url == null)
        return null;

    try {
        return new URL(url).host.replace(/^www\./, "");
    } catch {
        return null;
    }
}


/** The on-device model's state in everyday words, for the status pill and Settings. */
export function modelStatusWord(status: ModelStatus) {
    if (status === "ready")
        return "Ready";
    if (status === "loading")
        return "Getting ready";

    return "Not available";
}

/** A measured model latency: milliseconds under a second, seconds with one decimal above. */
export function latency(ms: number) {
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
