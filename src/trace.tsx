import {timeOfDay} from "./format.ts";
import {buildSegments, variantWord, type Variant} from "./trace-model.ts";
import type {Review} from "./shared/types.ts";

export function Trace({review, active, onActive}: {
    review: Review,
    active: string | null,
    onActive(visitId: string | null): void
}) {
    const segments = buildSegments(review);
    const {session} = review;
    const end = session.endedAt ?? new Date().toISOString();
    const label = `The block from ${timeOfDay(session.startedAt)} to ${timeOfDay(end)}, drawn as one strip. ` +
        "The rows below list the same visits in order.";

    return (
        <figure className="trace">
            <div
                className="trace-strip"
                role="img"
                aria-label={label}
            >
                {segments.length === 0 && <span className="seg seg-unrecorded" style={{flexGrow: 1}} />}
                {segments.map((segment) => (
                    <span
                        key={segment.key}
                        className={`seg seg-${segment.variant}`}
                        style={{flexGrow: segment.ms}}
                        data-active={segment.visitId != null && segment.visitId === active ? "" : undefined}
                        onPointerEnter={() => onActive(segment.visitId)}
                        onPointerLeave={() => onActive(null)}
                    />
                ))}
            </div>
            <figcaption className="trace-axis">
                <time dateTime={session.startedAt}>{timeOfDay(session.startedAt)}</time>
                <time dateTime={end}>{session.endedAt == null ? "now" : timeOfDay(end)}</time>
            </figcaption>
        </figure>
    );
}

export function Legend({variants}: {variants: Variant[]}) {
    const order: Variant[] = ["serves", "drifts", "unclear", "judging", "away", "unrecorded"];
    return (
        <ul className="legend" aria-label="How to read the strip">
            {order.filter((v) => variants.includes(v)).map((variant) => (
                <li key={variant}>
                    <span className={`seg seg-${variant} swatch`} aria-hidden="true" />
                    {variantWord[variant]}
                </li>
            ))}
        </ul>
    );
}
