import {duration, timeOfDay} from "./format.ts";
import {buildSegments, traceOrder, variantWord, type Segment, type Variant} from "./trace-model.ts";
import type {Review} from "./shared/types.ts";

function segmentTitle(segment: Segment, review: Review) {
    const visit = review.visits.find((v) => v.id === segment.visitId);
    const what = visit == null ? "Not recorded" : visit.kind === "away" ? "Away from the machine" : visit.appName;
    return visit == null || visit.kind === "away"
        ? `${what} · ${duration(segment.ms)}`
        : `${what} · ${duration(segment.ms)} · ${variantWord[segment.variant]}`;
}

/**
 * The signature component: the declared intention as one continuous warm line, the observed windows as a patterned
 * strip beneath it. The line never shortens or recolors; it is not a verdict (docs/design.md §5.4).
 */
export function Trace({review, active, onActive, compact = false}: {
    review: Review,
    active: string | null,
    onActive(visitId: string | null): void,
    compact?: boolean
}) {
    const segments = buildSegments(review);
    const {session} = review;
    const end = session.endedAt ?? new Date().toISOString();
    const hasIntention = session.intention.trim() !== "";
    const label = `The session from ${timeOfDay(session.startedAt)} to ${timeOfDay(end)}, drawn as one strip` +
        `${hasIntention ? " under the line of your intention" : ""}. The review lists the same visits in order.`;

    return (
        <figure className={compact ? "trace trace-compact" : "trace"}>
            {!compact && hasIntention && (
                <div className="overprint" aria-hidden="true">
                    <span className="reg reg-start" />
                    <span className="reg reg-end" />
                </div>
            )}
            <div className="trace-strip" role="img" aria-label={label}>
                {segments.length === 0 && <span className="seg seg-unrecorded" style={{flexGrow: 1}} />}
                {segments.map((segment) => (
                    <span
                        key={segment.key}
                        className={`seg seg-${segment.variant}`}
                        style={{flexGrow: segment.ms}}
                        title={compact ? undefined : segmentTitle(segment, review)}
                        data-active={segment.visitId != null && segment.visitId === active ? "" : undefined}
                        onPointerEnter={() => onActive(segment.visitId)}
                        onPointerLeave={() => onActive(null)}
                    />
                ))}
            </div>
            {!compact && (
                <figcaption className="trace-axis">
                    <time dateTime={session.startedAt}>{timeOfDay(session.startedAt)}</time>
                    <time dateTime={end}>{session.endedAt == null ? "now" : timeOfDay(end)}</time>
                </figcaption>
            )}
        </figure>
    );
}

export function Legend({variants, intention = false}: {variants: readonly Variant[], intention?: boolean}) {
    return (
        <ul className="legend" aria-label="How to read the strip">
            {intention && (
                <li>
                    <span className="swatch swatch-intention" aria-hidden="true" />
                    Your intention
                </li>
            )}
            {traceOrder.filter((v) => variants.includes(v)).map((variant) => (
                <li key={variant}>
                    <span className={`seg seg-${variant} swatch`} aria-hidden="true" />
                    {variantWord[variant]}
                </li>
            ))}
        </ul>
    );
}
