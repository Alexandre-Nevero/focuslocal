import {host} from "./format.ts";
import {buildSegments, type Variant} from "./trace-model.ts";
import type {Review} from "./shared/types.ts";

// Absolute totals for a set of ended sessions. Each figure is a sum of segment lengths on the review strip, so it
// always agrees with what the strip draws. No share, rate, or score is derived here (BR-006).

export type LabelTotals = Record<Variant, number>;

export const emptyTotals = (): LabelTotals => ({serves: 0, drifts: 0, unclear: 0, judging: 0, away: 0, unrecorded: 0});

export function labelTotals(reviews: Review[], now = Date.now()): LabelTotals {
    const totals = emptyTotals();
    for (const review of reviews) {
        for (const segment of buildSegments(review, now))
            totals[segment.variant] += segment.ms;
    }
    return totals;
}

/** Time in front of a window, whatever its label. Away and not recorded are not window time. */
export function windowMs(totals: LabelTotals) {
    return totals.serves + totals.drifts + totals.unclear + totals.judging;
}

export type DriftedWindow = {key: string, name: string, ms: number, visits: number};

/**
 * Windows whose shown label is Drifted, grouped by site (for a browser) or app, longest first. This is the plain
 * per-window list from docs/design.md §5.6, not a detour: no rule joins visits across unclear or away stretches.
 */
export function driftedWindows(reviews: Review[], now = Date.now()): DriftedWindow[] {
    const groups = new Map<string, DriftedWindow>();
    for (const review of reviews) {
        for (const visit of review.visits) {
            if (visit.kind !== "attention" || visit.shown !== "drifts")
                continue;
            const name = host(visit.url) ?? visit.appName;
            const key = name.toLowerCase();
            const end = visit.endedAt ?? (review.session.endedAt == null ? new Date(now).toISOString() : visit.lastSeenAt);
            const ms = Math.max(0, Date.parse(end) - Date.parse(visit.startedAt));
            const group = groups.get(key) ?? {key, name, ms: 0, visits: 0};
            group.ms += ms;
            group.visits += 1;
            groups.set(key, group);
        }
    }
    return [...groups.values()].sort((a, b) => b.ms - a.ms || a.name.localeCompare(b.name));
}


/** Middle value of measured numbers (mean of the two middle ones for an even count), or null with nothing measured. */
export function median(values: number[]): number | null {
    if (values.length === 0)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const upper = sorted[mid] ?? 0;
    return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? upper) + upper) / 2;
}
