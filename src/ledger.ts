import {useEffect, useState} from "react";
import type {CaptureState, LedgerApi, LedgerEvents, Route} from "./shared/types.ts";

/** The renderer's only door to main (electron/preload.ts). Nothing else is used for data. */
export const ledger = (window as unknown as {ledger: LedgerApi}).ledger;

/** Moves this window to another in-app route. */
export function go(route: Route) {
    window.location.hash = `/${route}`;
}

export function errorText(err: unknown) {
    if (err instanceof Error)
        return err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

    return String(err);
}

export type Load<T> =
    | {state: "loading"}
    | {state: "ready", value: T}
    | {state: "error", error: string};

/**
 * Runs a read against main and re-runs it when any of `events` fires. A refetch keeps the last value on screen
 * until the new one lands, so an event never flashes the screen back to its loading state.
 */
export function useLoad<T>(read: () => Promise<T>, deps: unknown[], events: (keyof LedgerEvents)[] = []) {
    const [load, setLoad] = useState<Load<T>>({state: "loading"});
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let live = true;
        read().then(
            (value) => {
                if (live)
                    setLoad({state: "ready", value});
            },
            (err: unknown) => {
                if (live)
                    setLoad({state: "error", error: errorText(err)});
            }
        );
        return () => {
            live = false;
        };
    }, [...deps, tick]);

    useEffect(() => {
        const offs = events.map((event) => ledger.on(event, () => setTick((t) => t + 1)));
        return () => offs.forEach((off) => off());
    }, []);

    return [load, () => setTick((t) => t + 1)] as const;
}

export function useNow(intervalMs = 1000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return now;
}

/** Capture health pushed by main. A failing capture swaps the clock line for the gap copy (US-002). */
export function useCaptureState() {
    const [state, setState] = useState<CaptureState>("ok");
    useEffect(() => ledger.on("capture:status", ({state: next}) => setState(next)), []);
    return state;
}
