import {useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent} from "react";
import {ErrorNote} from "../components.tsx";
import {ledger} from "../ledger.ts";
import {Idle} from "../screens/Idle.tsx";
import {Running} from "../screens/Running.tsx";
import type {AssistantVisualState, AssistantWindowState, Session} from "../shared/types.ts";
import poseCoach from "../assets/mascot/pose-coach.svg";
import poseDragging from "../assets/mascot/pose-dragging.svg";
import poseHover from "../assets/mascot/pose-hover.svg";
import poseIdle from "../assets/mascot/pose-idle.svg";

type Gesture = {
    pointerId: number,
    startX: number,
    startY: number,
    lastX: number,
    lastY: number,
    startedAt: number,
    dragging: boolean
};

type AssistantProps = {
    session: Session | null,
    loading: boolean,
    error: unknown
};

const pose: Record<AssistantVisualState, string> = {
    idle: poseIdle,
    hover: poseHover,
    dragging: poseDragging,
    expanded: poseCoach
};

function Mascot({state, className}: {state: AssistantVisualState, className: string}) {
    return (
        <span className={className} aria-hidden="true">
            <img src={pose[state]} alt="" draggable={false} />
        </span>
    );
}

export function Assistant({session, loading, error}: AssistantProps) {
    const [visual, setVisual] = useState<AssistantVisualState>("idle");
    const [nativeState, setNativeState] = useState<AssistantWindowState>({expanded: false});
    const expandedRef = useRef(false);
    const gesture = useRef<Gesture | null>(null);
    const pending = useRef({dx: 0, dy: 0});
    const frame = useRef<number | null>(null);

    const applyNativeState = useCallback((next: AssistantWindowState) => {
        if (expandedRef.current && !next.expanded)
            setVisual("idle");
        expandedRef.current = next.expanded;
        setNativeState(next);
    }, []);

    const scheduleMove = () => {
        if (frame.current != null)
            return;
        frame.current = window.requestAnimationFrame(() => {
            frame.current = null;
            const {dx, dy} = pending.current;
            pending.current = {dx: 0, dy: 0};
            if (dx !== 0 || dy !== 0)
                ledger.assistant.move(dx, dy);
        });
    };

    const toggle = async () => {
        try {
            applyNativeState(await ledger.assistant.toggle());
        } catch {
            setVisual("idle");
        }
    };

    const collapse = useCallback(async () => {
        try {
            applyNativeState(await ledger.assistant.collapse());
        } catch {
            return;
        }
    }, [applyNativeState]);

    const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        if (!event.isPrimary || event.button !== 0)
            return;
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = {
            pointerId: event.pointerId,
            startX: event.screenX,
            startY: event.screenY,
            lastX: event.screenX,
            lastY: event.screenY,
            startedAt: performance.now(),
            dragging: false
        };
        pending.current = {dx: 0, dy: 0};
    };

    const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
        const current = gesture.current;
        if (current == null || current.pointerId !== event.pointerId)
            return;

        pending.current.dx += event.screenX - current.lastX;
        pending.current.dy += event.screenY - current.lastY;
        current.lastX = event.screenX;
        current.lastY = event.screenY;
        const distance = Math.hypot(event.screenX - current.startX, event.screenY - current.startY);
        if (!current.dragging && distance > 4) {
            current.dragging = true;
            setVisual("dragging");
        }
        if (current.dragging)
            scheduleMove();
    };

    const finishGesture = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
        const current = gesture.current;
        if (current == null || current.pointerId !== event.pointerId)
            return;
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);

        const distance = Math.hypot(event.screenX - current.startX, event.screenY - current.startY);
        const quickTap = !cancelled && !current.dragging && distance <= 4 && performance.now() - current.startedAt <= 500;
        if (!current.dragging)
            pending.current = {dx: 0, dy: 0};
        if (quickTap)
            void toggle();
        else
            setVisual(event.currentTarget.matches(":hover") ? "hover" : "idle");
    };

    const onClick = (event: MouseEvent<HTMLButtonElement>) => {
        if (event.detail === 0)
            void toggle();
    };

    useEffect(() => {
        let active = true;
        const unsubscribe = ledger.on("assistant:state", (next) => {
            if (active)
                applyNativeState(next);
        });
        void ledger.assistant.state().then((next) => {
            if (active)
                applyNativeState(next);
        }).catch(() => {});
        return () => {
            active = false;
            unsubscribe();
            if (frame.current != null)
                window.cancelAnimationFrame(frame.current);
        };
    }, [applyNativeState]);

    useEffect(() => {
        if (!nativeState.expanded)
            return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape")
                void collapse();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [collapse, nativeState.expanded]);

    if (!nativeState.expanded) {
        return (
            <main className="assistant-surface assistant-collapsed">
                <button
                    type="button"
                    className="assistant-control"
                    data-state={visual}
                    aria-label="Open Twofold assistant"
                    onClick={onClick}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={(event) => finishGesture(event)}
                    onPointerCancel={(event) => finishGesture(event, true)}
                    onPointerEnter={() => {
                        if (gesture.current == null)
                            setVisual("hover");
                    }}
                    onPointerLeave={() => {
                        if (gesture.current == null)
                            setVisual("idle");
                    }}
                >
                    <Mascot state={visual} className="assistant-figure" />
                </button>
            </main>
        );
    }

    return (
        <main className="assistant-surface assistant-panel" aria-label="Twofold session controls">
            <header className="assistant-head">
                <Mascot state="expanded" className="assistant-panel-mascot" />
                <button type="button" className="icon-btn assistant-close" aria-label="Close assistant" onClick={() => void collapse()}>
                    <span aria-hidden="true">×</span>
                </button>
            </header>
            <div className="assistant-content">
                {loading && <p className="status">Opening Twofold…</p>}
                {error != null && <ErrorNote title="The current session could not be read." error={String(error)} />}
                {!loading && error == null && (session == null
                    ? <Idle />
                    : <Running session={session} />)}
            </div>
        </main>
    );
}
