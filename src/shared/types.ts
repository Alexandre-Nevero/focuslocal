// Shared between the main process, the preload bridge, and the renderer. No Node or DOM imports.
// Row shapes mirror docs/data-model.md; the API mirrors the IPC contract in docs/system-design.md §9.

export type Label = "serves" | "drifts" | "unclear";
export type Source = "rule" | "memory" | "model" | "user";
export type ModelStage = "decide" | "reason";
export type Role = "work" | "distraction";
export type Outcome = "yes" | "not_yet" | "unanswered";
export type VisitKind = "attention" | "away";

/** Renderer routes (docs/design.md §2): one bundle, selected by URL hash `#/<route>`. */
export type Route =
    | "idle" | "declare" | "permissions" | "running" | `review/${string}` | "history" | "privacy" | "mini"
    | "companion" | "sites" | "block";

export type Session = {
    id: string,
    intention: string,
    analyzedIntent: string | null,
    startedAt: string,
    endedAt: string | null,
    outcome: Outcome | null,
    targets: DeclaredTarget[]
};

export type DeclaredTarget = {
    target: string,
    role: Role
};

export type Visit = {
    id: string,
    sessionId: string,
    appName: string,
    windowTitle: string | null,
    url: string | null,
    startedAt: string,
    lastSeenAt: string,
    endedAt: string | null,
    kind: VisitKind
};

export type Verdict = {
    id: string,
    visitId: string,
    memoryId: string | null,
    source: Source,
    label: Label,
    reason: string | null,
    modelId: string | null,
    modelStage: ModelStage | null,
    latencyMs: number | null,
    confidence: number | null
};

/** A visit as the review renders it. `verdict` is null while Harness is still judging ("Judging…"). */
export type ReviewVisit = Visit & {
    verdict: Verdict | null,
    /** The stored verdict label, or null while judging. */
    shown: Label | null
};

export type Review = {
    session: Session,
    visits: ReviewVisit[],
    /** Wall-clock time of the session not covered by any visit (US-010). */
    unrecordedMs: number
};

/** One past session on the History screen (ADR-008: a row, not a score). */
export type HistoryRow = {
    id: string,
    intention: string,
    startedAt: string,
    endedAt: string | null,
    outcome: Outcome | null
};

export type ModelStatus = "loading" | "ready" | "missing-file" | `failed:${string}`;

export type Privacy = {
    modelCalls: number,
    modelId: string | null,
    modelStatus: ModelStatus,
    tau: number | null,
    evalRanAt: string | null,
    dbPath: string
};

export type PermissionState = "granted" | "denied" | "not-determined" | "restricted" | "unknown";

export type Permissions = {
    screen: PermissionState,
    accessibility: PermissionState
};

export type CaptureState = "ok" | "failing" | "denied";

/** Events main pushes to every window. */
export type LedgerEvents = {
    "verdict:updated": {visitId: string},
    "capture:status": {state: CaptureState},
    /** A session started or ended anywhere (popover, mini window, extension): re-read session.current(). */
    "session:changed": {sessionId: string | null}
};

/** `window.ledger`, exposed by electron/preload.ts. Every call rejects with an Error on failure; render that, never fake data. */
export type CoachActionWire = {type: string, target?: string, sessionId?: string};

export type LedgerApi = {
    session: {
        start(input: {
            intention: string,
            targets: DeclaredTarget[],
            cycle?: {workMin: number, breakMin: number, count: number} | null
        }): Promise<Session>,
        end(): Promise<{sessionId: string}>,
        current(): Promise<Session | null>
    },
    review: {
        get(sessionId: string): Promise<Review>,
        tap(visitId: string, label: "serves" | "drifts"): Promise<void>,
        answer(sessionId: string, outcome: Outcome): Promise<void>
    },
    history: {
        list(): Promise<HistoryRow[]>
    },
    privacy: {
        get(): Promise<Privacy>,
        dropMemory(): Promise<void>,
        deleteFile(): Promise<void>
    },
    permissions: {
        get(): Promise<Permissions>
    },
    widgets: {
        toggleMini(): Promise<void>
    },
    windows: {
        /** Shows the main window at a route (the popover and mini window are too small for review, ledger, privacy). */
        open(route: Route): Promise<void>
    },
    sites: {
        list(): Promise<{work: string[], block: string[]}>,
        save(target: string, role: "work" | "block"): Promise<void>,
        remove(target: string): Promise<void>
    },
    settings: {
        get(): Promise<{judge: boolean, coach: boolean, companion: boolean}>,
        set(key: "judge" | "coach" | "companion", on: boolean): Promise<void>
    },
    companion: {
        notWork(): Promise<void>,
        nudge(dx: number, dy: number): Promise<void>,
        resize(expanded: boolean): Promise<void>
    },
    coach: {
        ask(sessionId: string, text: string): Promise<{reply: string, actions: CoachActionWire[]}>
    },
    presets: {
        fill(intention: string, work: string[]): Promise<string[]>
    },
    /** Subscribe to a main-process event. Returns the unsubscribe function. */
    on<E extends keyof LedgerEvents>(event: E, listener: (payload: LedgerEvents[E]) => void): () => void
};

/** IPC channel names: one per call, `<group>.<method>`. */
export const ledgerChannels = [
    "session.start", "session.end", "session.current",
    "review.get", "review.tap", "review.answer",
    "history.list",
    "privacy.get", "privacy.dropMemory", "privacy.deleteFile",
    "permissions.get",
    "widgets.toggleMini",
    "windows.open",
    "sites.list", "sites.save", "sites.remove",
    "settings.get", "settings.set",
    "companion.notWork", "companion.nudge", "companion.resize",
    "coach.ask",
    "presets.fill"
] as const;
export type LedgerChannel = typeof ledgerChannels[number];
