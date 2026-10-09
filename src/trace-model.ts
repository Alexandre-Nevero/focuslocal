import type {Review, ReviewVisit} from "./shared/types.ts";

// The review strip's data: the whole block as ordered segments. Length is time; no number is printed on it (BR-006).
// Variants never rely on color alone: solid, outlined, dashed, faint, hatched.

export type Variant = "serves" | "drifts" | "unclear" | "judging" | "away" | "unrecorded";

export type Segment = {key: string, variant: Variant, ms: number, visitId: string | null};

export function variantOf(visit: ReviewVisit): Variant {
    if (visit.kind === "away")
        return "away";

    const shown = visit.shown;
    if (shown === "unclear")
        return "drifts";
    return shown ?? "judging";
}

export const variantWord: Record<Variant, string> = {
    serves: "Serves",
    drifts: "Drifts",
    unclear: "Unclear",
    judging: "Judging",
    away: "Away",
    unrecorded: "Not recorded"
};

function visitEnd(visit: ReviewVisit) {
    return Date.parse(visit.endedAt ?? visit.lastSeenAt);
}

/** Visits in order, with every uncovered stretch of the wall clock made into its own hatched segment (US-010). */
export function buildSegments({session, visits}: Review, now = Date.now()): Segment[] {
    const start = Date.parse(session.startedAt);
    const end = session.endedAt == null ? now : Date.parse(session.endedAt);
    const ordered = [...visits].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
    const segments: Segment[] = [];
    let cursor = start;

    for (const visit of ordered) {
        const from = Math.max(Date.parse(visit.startedAt), cursor);
        const to = visitEnd(visit);
        if (from - cursor >= 1000)
            segments.push({key: `gap-${cursor}`, variant: "unrecorded", ms: from - cursor, visitId: null});
        if (to > from)
            segments.push({key: visit.id, variant: variantOf(visit), ms: to - from, visitId: visit.id});
        cursor = Math.max(cursor, to);
    }
    if (end - cursor >= 1000)
        segments.push({key: `gap-${cursor}`, variant: "unrecorded", ms: end - cursor, visitId: null});

    return segments;
}
