import {useEffect, useRef, useState, type PointerEvent} from "react";

const PET = 96;
const POPUP_W = 320;
const POPUP_H = 420;
const DRAG_PX = 4;
const DRAG_MS = 500;

function elapsedMinutes(startedAt: string | null, now: number) {
    if (startedAt == null)
        return 0;
    const start = Date.parse(startedAt);
    if (Number.isNaN(start))
        return 0;
    return Math.max(0, Math.floor((now - start) / 60_000));
}

type CompanionPopupProps = {
    mode: "running" | "idle",
    intention: string,
    startedAt: string | null,
    coachText: string | null,
    hasEnded: boolean,
    onEnd(): void,
    onNotWork(): void,
    onAsk(text: string): void,
    onDrag(dx: number, dy: number): void,
    expanded: boolean,
    onToggle(): void
};

export function CompanionPopup({
    mode,
    intention,
    startedAt,
    coachText,
    hasEnded,
    onEnd,
    onNotWork,
    onAsk,
    onDrag,
    expanded,
    onToggle
}: CompanionPopupProps) {
    const [now, setNow] = useState(() => Date.now());
    const [askDraft, setAskDraft] = useState("");
    const [petHover, setPetHover] = useState(false);
    const dragRef = useRef<{
        pointerId: number,
        startX: number,
        startY: number,
        lastX: number,
        lastY: number,
        startTime: number,
        dragging: boolean
    } | null>(null);

    useEffect(() => {
        if (mode !== "running" || startedAt == null)
            return;
        const id = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(id);
    }, [mode, startedAt]);

    useEffect(() => {
        if (!expanded)
            return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                onToggle();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [expanded, onToggle]);

    const beginPointer = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0)
            return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
            startTime: Date.now(),
            dragging: false
        };
    };

    const movePointer = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (drag == null || drag.pointerId !== event.pointerId)
            return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        const dist = Math.hypot(dx, dy);
        const held = Date.now() - drag.startTime;
        if (!drag.dragging && (dist > DRAG_PX || held > DRAG_MS))
            drag.dragging = true;
        if (!drag.dragging)
            return;
        const stepX = event.clientX - drag.lastX;
        const stepY = event.clientY - drag.lastY;
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        if (stepX !== 0 || stepY !== 0)
            onDrag(stepX, stepY);
    };

    const endPointer = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (drag == null || drag.pointerId !== event.pointerId)
            return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        const wasDrag = drag.dragging
            || Math.hypot(dx, dy) > DRAG_PX
            || Date.now() - drag.startTime > DRAG_MS;
        dragRef.current = null;
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
            /* capture may already be released */
        }
        if (!wasDrag)
            onToggle();
    };

    const submitAsk = () => {
        const text = askDraft.trim();
        if (text === "")
            return;
        onAsk(text);
        setAskDraft("");
    };

    const minutes = elapsedMinutes(startedAt, now);
    const intentionLabel = intention === "" ? "No intention written" : intention;

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                width: expanded ? PET + POPUP_W : PET,
                height: expanded ? POPUP_H : PET,
                margin: 0,
                padding: 0,
                background: "transparent",
                fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
                fontSize: "0.9375rem",
                color: "CanvasText",
                boxSizing: "border-box"
            }}
        >
            <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label="Companion"
                onPointerDown={beginPointer}
                onPointerMove={movePointer}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                onPointerEnter={() => setPetHover(true)}
                onPointerLeave={() => setPetHover(false)}
                style={{
                    width: PET,
                    height: PET,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "default",
                    touchAction: "none",
                    userSelect: "none",
                    transform: petHover ? "translateY(-3px)" : undefined,
                    transition: "transform 0.15s ease-out"
                }}
            >
                <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                    <circle cx="28" cy="28" r="24" fill="color-mix(in srgb, CanvasText 18%, Canvas)" stroke="CanvasText" strokeWidth="2" />
                </svg>
            </div>
            {expanded ? (
                <section
                    style={{
                        width: POPUP_W,
                        height: POPUP_H,
                        boxSizing: "border-box",
                        padding: "12px 14px",
                        background: "Canvas",
                        border: "1px solid color-mix(in srgb, CanvasText 14%, Canvas)",
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        overflow: "auto"
                    }}
                >
                    {mode === "running" ? (
                        <>
                            <p style={{margin: 0, lineHeight: 1.35}} title={intention}>{intentionLabel}</p>
                            <p style={{margin: 0, color: "color-mix(in srgb, CanvasText 64%, Canvas)"}}>{minutes} min</p>
                            <div style={{display: "flex", flexDirection: "column", gap: 8, marginTop: "auto"}}>
                                <button type="button" onClick={onEnd}>End</button>
                                <button type="button" onClick={onNotWork}>This isn&apos;t the work</button>
                            </div>
                        </>
                    ) : !hasEnded ? (
                        <p style={{margin: 0}}>No session yet.</p>
                    ) : (
                        <>
                            {coachText != null && (
                                <p style={{margin: 0, lineHeight: 1.45, whiteSpace: "pre-wrap"}}>{coachText}</p>
                            )}
                            <form
                                style={{display: "flex", gap: 8, marginTop: "auto"}}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    submitAsk();
                                }}
                            >
                                <input
                                    type="text"
                                    value={askDraft}
                                    onChange={(event) => setAskDraft(event.target.value)}
                                    placeholder="Ask the coach"
                                    style={{flex: 1, minWidth: 0}}
                                />
                                <button type="submit">Ask</button>
                            </form>
                        </>
                    )}
                </section>
            ) : null}
        </main>
    );
}
