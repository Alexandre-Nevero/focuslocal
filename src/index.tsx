import React, {Suspense} from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/public-sans";
import "@fontsource/sometype-mono/400.css";
import "@fontsource/sometype-mono/500.css";
import "@fontsource/sometype-mono/600.css";
import {App} from "./App.tsx";
import {applyTheme, readTheme} from "./theme.ts";
import "./styles.css";

// Before the first paint, so a dark choice never flashes light.
applyTheme(readTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <Suspense fallback={null}>
            <App />
        </Suspense>
    </React.StrictMode>
);
