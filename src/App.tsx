import {lazy, useEffect, useLayoutEffect, useState, type ReactNode} from "react";
import {ErrorNote, Page} from "./components.tsx";
import {ledger, useLoad} from "./ledger.ts";
import {Assistant} from "./companion/Companion.tsx";
import {Idle} from "./screens/Idle.tsx";
import {Running} from "./screens/Running.tsx";

// Each window loads only the screens it routes to. The companion renderer never parses the dashboard or review code.
const Dashboard = lazy(() => import("./screens/Dashboard.tsx").then((m) => ({default: m.Dashboard})));
const Declare = lazy(() => import("./screens/Declare.tsx").then((m) => ({default: m.Declare})));
const History = lazy(() => import("./screens/History.tsx").then((m) => ({default: m.History})));
const Ledger = lazy(() => import("./screens/Ledger.tsx").then((m) => ({default: m.Ledger})));
const Mini = lazy(() => import("./screens/Mini.tsx").then((m) => ({default: m.Mini})));
const Permissions = lazy(() => import("./screens/Permissions.tsx").then((m) => ({default: m.Permissions})));
const Privacy = lazy(() => import("./screens/Privacy.tsx").then((m) => ({default: m.Privacy})));
const Review = lazy(() => import("./screens/Review.tsx").then((m) => ({default: m.Review})));

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

    useLayoutEffect(() => {
        document.documentElement.dataset["surface"] = name || "idle";
    }, [name]);

    if (name === "assistant")
        return (
            <Assistant
                session={session.state === "ready" ? session.value : null}
                loading={session.state === "loading"}
                error={session.state === "error" ? session.error : null}
            />
        );

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
