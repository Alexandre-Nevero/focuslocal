import {useEffect, useState, type ReactNode} from "react";
import {ErrorNote, Page} from "./components.tsx";
import {ledger, useLoad} from "./ledger.ts";
import {Dashboard} from "./screens/Dashboard.tsx";
import {Declare} from "./screens/Declare.tsx";
import {History} from "./screens/History.tsx";
import {Idle} from "./screens/Idle.tsx";
import {Ledger} from "./screens/Ledger.tsx";
import {Mini} from "./screens/Mini.tsx";
import {Permissions} from "./screens/Permissions.tsx";
import {Privacy} from "./screens/Privacy.tsx";
import {Review} from "./screens/Review.tsx";
import {Running} from "./screens/Running.tsx";

// Routes and their screens: docs/design.md §4.1. Data: window.ledger (src/shared/types.ts LedgerApi) and nothing else.

function useHashRoute() {
    const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, ""));
    useEffect(() => {
        const onChange = () => setRoute(window.location.hash.replace(/^#\/?/, ""));
        window.addEventListener("hashchange", onChange);
        return () => window.removeEventListener("hashchange", onChange);
    }, []);
    return route;
}

/** The tray popover is 320px wide; anything wider is the main window and gets the full shell (docs/design.md §12). */
const WIDE = "(min-width: 641px)";

function useWide() {
    const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
    useEffect(() => {
        const query = window.matchMedia(WIDE);
        const onChange = () => setWide(query.matches);
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);
    return wide;
}

export function App() {
    const route = useHashRoute();
    const wide = useWide();
    const [name = "idle", param, extra] = route.split("/");
    const [session] = useLoad(() => ledger.session.current(), [], ["session:changed"]);

    useEffect(() => {
        document.documentElement.dataset["surface"] = name || "idle";
    }, [name]);

    if (name === "mini")
        return <Mini session={session} />;

    // Popover screens sit bare in the tray popover and inside the shell, as one centered card, in the main window.
    const frame = (node: ReactNode) => (wide
        ? <Page><div className="card form-card">{node}</div></Page>
        : <main className="popover">{node}</main>);
    const home = wide ? <Dashboard /> : <Idle />;

    // A running session owns the popover: idle, declare, and running all show it until it ends.
    const running = session.state === "ready" ? session.value : null;
    const waiting = session.state === "loading";
    const runningView = running == null ? null : frame(<Running session={running} />);

    switch (name) {
        case "":
        case "idle":
            if (waiting)
                return null;
            return wide ? home : runningView ?? home;
        case "declare":
            if (waiting)
                return null;
            return runningView ?? frame(<Declare />);
        case "running":
            if (waiting)
                return null;
            if (session.state === "error")
                return frame(<ErrorNote title="The running session could not be read." error={session.error} />);
            return runningView ?? home;
        case "permissions": return <Permissions />;
        case "dashboard": return <Dashboard mode={param} date={extra} />;
        case "ledger": return <Ledger date={param} />;
        case "review": return param == null ? <History /> : <Review sessionId={param} />;
        case "history": return <History />;
        case "privacy": return <Privacy />;
        default: return <Page><ErrorNote title={`There is no screen called “${route}”.`} /></Page>;
    }
}
