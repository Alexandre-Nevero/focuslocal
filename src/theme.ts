import {useEffect, useState} from "react";

// Appearance: System follows the OS, Light and Dark pin it. Stored in this machine's renderer storage only.
// The CSS resolves every token with light-dark(), so the choice is applied by setting color-scheme on <html>.

export type Theme = "system" | "light" | "dark";

export const themes: readonly Theme[] = ["system", "light", "dark"];

const KEY = "twofold.theme";

export function parseTheme(value: string | null): Theme {
    return themes.find((t) => t === value) ?? "system";
}

export function applyTheme(theme: Theme) {
    document.documentElement.dataset["theme"] = theme;
}

export function readTheme(): Theme {
    try {
        return parseTheme(window.localStorage.getItem(KEY));
    } catch {
        return "system";
    }
}

/** The current theme, kept in step across the main window, popover, and mini window. */
export function useTheme() {
    const [theme, setTheme] = useState<Theme>(readTheme);

    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === KEY) {
                const next = parseTheme(event.newValue);
                applyTheme(next);
                setTheme(next);
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const choose = (next: Theme) => {
        try {
            window.localStorage.setItem(KEY, next);
        } catch {
            // Storage can be unavailable; the choice still applies to this window.
        }
        applyTheme(next);
        setTheme(next);
    };

    return [theme, choose] as const;
}
