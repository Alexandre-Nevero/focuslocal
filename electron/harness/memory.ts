import {bare, hostOf, type WindowFacts} from "./rules.ts";

const BROWSER = /chrome|edge|brave|chromium|firefox|opera|vivaldi|safari/i;

/**
 * Memory key (system-design §9): the URL host, else the process name. A browser without a URL gets none: its name says
 * nothing about the page. Used by the tap (one vote) and by Harness (applied at tap_count >= 2, BR-004).
 */
export function memoryKey(w: WindowFacts): string | null {
    const host = hostOf(w.url);
    if (host != null)
        return host;
    if (BROWSER.test(`${w.execName ?? ""} ${w.appName}`))
        return null;

    return bare(w.execName ?? w.appName);
}
