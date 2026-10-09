/// <reference types="vite-plugin-electron/electron-env" />
/* eslint-disable @typescript-eslint/consistent-type-definitions -- global declaration merging needs interfaces */

declare namespace NodeJS {
    interface ProcessEnv {
        /** Repo root in dev; the app directory when packaged. Contains dist/ (renderer) and dist-electron/ (main + preload). */
        APP_ROOT: string,
        /** public/ in dev, dist/ when built. */
        VITE_PUBLIC: string
    }
}

// Exposed by electron/preload.ts.
interface Window {
    ledger: import("../src/shared/types.ts").LedgerApi
}
