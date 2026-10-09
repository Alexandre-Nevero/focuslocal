import {useEffect, useState} from "react";

// Route switch only. Each route below is a placeholder heading; the frontend issue replaces them with the real screens.
// Routes and their screens: docs/design.md §2. Data: window.ledger (src/shared/types.ts LedgerApi) and nothing else.

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

    switch (name) {
        case "idle": return <h1>Idle</h1>;
        case "declare": return <h1>Declare</h1>;
        case "permissions": return <h1>Permissions</h1>;
        case "running": return <h1>Running</h1>;
        case "review": return <h1>Review {param}</h1>;
        case "ledger": return <h1>Ledger</h1>;
        case "privacy": return <h1>Privacy</h1>;
        case "mini": return <h1>Mini</h1>;
        default: return <h1>Unknown route: {route}</h1>;
    }
}
