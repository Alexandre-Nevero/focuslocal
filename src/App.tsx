import {useEffect, useState} from "react";
import {ErrorNote} from "./components.tsx";
import {ledger, useLoad} from "./ledger.ts";
import {Declare} from "./screens/Declare.tsx";
import {History} from "./screens/History.tsx";
import {Idle} from "./screens/Idle.tsx";
import {Mini} from "./screens/Mini.tsx";
import {Permissions} from "./screens/Permissions.tsx";
import {Privacy} from "./screens/Privacy.tsx";
import {Review} from "./screens/Review.tsx";
import {BlockNotice} from "./screens/BlockNotice.tsx";
import {Companion} from "./screens/Companion.tsx";
import {Running} from "./screens/Running.tsx";
import {Sites} from "./screens/Sites.tsx";

// Routes and their screens: docs/design.md §2. Data: window.ledger (src/shared/types.ts LedgerApi) and nothing else.

function SitesScreen() {
    const [lists, reload] = useLoad(() => ledger.sites.list(), []);
    if (lists.state !== "ready")
        return <main className="page"><p className="status">Reading saved lists…</p></main>;
    const {work, block} = lists.value;
    return (
        <main className="page">
            <Sites
                work={work}
                block={block}
                onAdd={(role, target) => void ledger.sites.save(target, role).then(() => reload())}
                onRemove={(target) => void ledger.sites.remove(target).then(() => reload())}
            />
        </main>
    );
}

function useHashRoute() {
    const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, ""));
    useEffect(() => {
        const onChange = () => setRoute(window.location.hash.replace(/^#\/?/, ""));
        window.addEventListener("hashchange", onChange);
        return () => window.removeEventListener("hashchange", onChange);
    }, []);
    return route;
}

export function App() {
    const route = useHashRoute();
    const [name = "idle", param] = route.split("/");
    const [session] = useLoad(() => ledger.session.current(), [], ["session:changed"]);

    useEffect(() => {
        document.documentElement.dataset["surface"] = name || "idle";
    }, [name]);

    if (name === "mini")
        return <Mini session={session} />;

    if (name === "companion")
        return <Companion />;

    if (name === "block") {
        const intention = session.state === "ready" && session.value != null ? session.value.intention : "";
        return <BlockNotice intention={intention === "" ? "No intention written" : intention} />;
    }

    if (name === "sites")
        return <SitesScreen />;

    // A running block owns the popover: idle, declare, and running all show it until it ends.
    const running = session.state === "ready" ? session.value : null;
    const waiting = session.state === "loading";

    switch (name) {
        case "":
        case "idle":
            if (waiting)
                return null;
            return running != null ? <Running session={running} /> : <Idle />;
        case "declare":
            if (waiting)
                return null;
            return running != null ? <Running session={running} /> : <Declare />;
        case "running":
            if (waiting)
                return null;
            if (session.state === "error")
                return <main className="page"><ErrorNote title="The running block could not be read." error={session.error} /></main>;
            return running != null ? <Running session={running} /> : <Idle />;
        case "permissions": return <Permissions />;
        case "review": return param == null ? <History /> : <Review sessionId={param} />;
        case "history": return <History />;
        case "privacy": return <Privacy />;
        default: return <main className="page"><ErrorNote title={`There is no screen called “${route}”.`} /></main>;
    }
}
