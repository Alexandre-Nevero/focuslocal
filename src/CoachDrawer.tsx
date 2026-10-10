import {useEffect, useRef, type ReactNode} from "react";
import {go} from "./ledger.ts";

export function CoachDrawer({children, dashboard}: {children: ReactNode, dashboard: ReactNode}) {
    const panel = useRef<HTMLElement>(null);
    useEffect(() => {
        const previous = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panel.current?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            if (previous instanceof HTMLElement && previous.isConnected)
                previous.focus();
        };
    }, []);

    return (
        <>
            <div className="coach-dashboard" inert>{dashboard}</div>
            <button className="coach-backdrop" type="button" tabIndex={-1} aria-label="Close Coach" onClick={() => go("dashboard")} />
            <aside
                ref={panel}
                className="coach-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Twofold Coach"
                tabIndex={-1}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        go("dashboard");
                    }
                    if (event.key !== "Tab")
                        return;
                    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>(
                        "button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href], [tabindex='0']"
                    ) ?? []).filter((element) => element.getClientRects().length > 0);
                    const first = controls[0];
                    const last = controls.at(-1);
                    if (first == null) {
                        event.preventDefault();
                        return;
                    }
                    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
                        event.preventDefault();
                        last?.focus();
                    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
                        event.preventDefault();
                        first.focus();
                    }
                }}
            >{children}
            </aside>
        </>
    );
}
