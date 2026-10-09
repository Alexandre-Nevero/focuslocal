// Post-session coach (US-011): Qwen 3.5 2B describes one ended session's record on-device.
// Not on the verdict path; analyzeIntention reads the typed intention once and does not label, vote, or explain a window.
// No Electron imports; the caller passes the models directory.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {getLlama, LlamaChatSession, QwenChatWrapper, type ChatHistoryItem, type LlamaModel} from "node-llama-cpp";
import type {Outcome, Review, ReviewVisit, Source} from "../../src/shared/types.ts";

export const COACH_FILE = "Qwen3.5-2B-Q4_K_M.gguf";

const TIMEOUT_MS = 30_000;
const GATE_FAIL = "The coach could not answer from the record.";
const SOURCES: Record<Source, string> = {rule: "your list", memory: "remembered", model: "on-device model", user: "you marked it"};
const OUTCOMES: Record<Outcome, string> = {yes: "yes", "not_yet": "not yet", unanswered: "unanswered"};

const corpusPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "coach-corpus.json");
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8")) as {id: string, claim: string, label: string}[];

export type BlockHitKind = "site" | "app";

export type LocalRecord = {
    sessionCount: number,
    yesCount: number,
    notYetCount: number,
    /** Milliseconds of attention per shown label key (serves, drifts, unclear, judging, away). */
    labelMs: Record<string, number>,
    /** Apps or sites that appeared in more than one session. */
    repeatedReaches: string[],
    blockHits: {target: string, kind: BlockHitKind}[],
    workList: string[],
    blockList: string[]
};

export type CoachAction =
    | {type: "start-block"}
    | {type: "add-block", target: string}
    | {type: "add-work", target: string}
    | {type: "open-review", sessionId: string}
    | {type: "open-sites"};

const spanMs = (v: ReviewVisit) => Date.parse(v.endedAt ?? v.lastSeenAt) - Date.parse(v.startedAt);
const minutes = (ms: number) => (ms < 60_000 ? "under 1 min" : `${Math.round(ms / 60_000)} min`);

function listHas(list: string[], target: string): boolean {
    const key = target.trim().toLowerCase();
    return list.some((entry) => entry.trim().toLowerCase() === key);
}

function visitLine(v: ReviewVisit): string {
    if (v.kind === "away")
        return `- away, ${minutes(spanMs(v))}`;
    const label = v.shown ?? (v.verdict == null ? "judging" : v.verdict.label);
    const source = v.verdict == null ? "pending" : SOURCES[v.verdict.source];
    const site = v.url?.trim();
    const place = site !== "" && site != null ? site : v.appName;
    return `- ${place}, shown ${label}, source ${source}, ${minutes(spanMs(v))}`;
}

function blockHitLine(hit: {target: string, kind: BlockHitKind}): string {
    return `- ${hit.target} (${hit.kind}), reach, no duration`;
}

/** Numbers the coach may state: figures for this prompt plus verified corpus claims only. */
export function allowedNumbers(figures: string): Set<string> {
    const allowed = new Set<string>();
    for (const match of figures.matchAll(/\d+(?:\.\d+)?/g))
        allowed.add(match[0]);
    for (const entry of corpus) {
        if (entry.label !== "verified")
            continue;
        for (const match of entry.claim.matchAll(/\d+(?:\.\d+)?/g))
            allowed.add(match[0]);
    }
    return allowed;
}

function labelMsLines(record: LocalRecord): string[] {
    return Object.entries(record.labelMs)
        .filter(([, ms]) => ms > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, ms]) => `- ${label}: ${minutes(ms)}`);
}

/** Computed figures for this session and the local file, fenced for the model. */
export function sessionFigures(review: Review, record: LocalRecord): string {
    const {session, visits, unrecordedMs} = review;
    const intention = session.intention.trim();
    const analyzed = (session.analyzedIntent ?? "").trim();
    const lines = [
        "This session:",
        intention === "" ? "Intention: (none written)" : `Intention: ${JSON.stringify(intention)}`,
        ...(analyzed !== "" ? [`Read for judging as: ${JSON.stringify(analyzed)}`] : []),
        `Finish answer: ${OUTCOMES[session.outcome ?? "unanswered"]}`,
        "Visits (place, shown label, source, time):",
        ...visits.map(visitLine),
        ...(record.blockHits.length === 0 ? [] : ["Block hits (reach, no duration):", ...record.blockHits.map(blockHitLine)]),
        `Not recorded: ${minutes(unrecordedMs)}`,
        "",
        "Local file:",
        `Sessions: ${record.sessionCount}`,
        `Finish yes: ${record.yesCount}`,
        `Finish not yet: ${record.notYetCount}`,
        ...(labelMsLines(record).length === 0 ? [] : ["Time per shown label (all sessions):", ...labelMsLines(record)]),
        ...(record.repeatedReaches.length === 0
            ? ["Reached on more than one session: (none)"]
            : [`Reached on more than one session: ${record.repeatedReaches.join(", ")}`]),
        `Work list: ${record.workList.length === 0 ? "(empty)" : record.workList.join(", ")}`,
        `Block list: ${record.blockList.length === 0 ? "(empty)" : record.blockList.join(", ")}`
    ];
    return lines.join("\n");
}

const RULES = [
    "Describe only what the fenced figures show for this session and the local counts. Never praise, celebrate, scold, judge, or grade the person, and keep the same plain tone whatever the finish answer is.",
    "Never give a score, rate, percentage, streak, or total hours headline.",
    "You see this session's figures and the local-file counts together. Do not claim you see only one session.",
    "Claims C9, C11, C12, and C13 in the corpus are constraints on the product, not advice to repeat. C21 may inform you that not every switch is failure. Never state numbers from C22.",
    "A number in your reply must appear in the figures or in a corpus claim labeled verified. Otherwise the reply is discarded.",
    "Answer in at most 4 short sentences. Never repeat a full window title or URL; name the app or site.",
    "To suggest a button the app can run, put one token on its own line: [[start-block]], [[open-sites]], [[add-block:TARGET]], [[add-work:TARGET]], or [[open-review:SESSION_ID]]. TARGET must not repeat a window title. Give no other buttons or technique advice."
];

/** The system prompt: figures, corpus, and rules (ADR-014, ADR-012). */
export function coachPrompt(review: Review, record: LocalRecord): string {
    const figures = sessionFigures(review, record);
    return [
        "You are the coach inside Ledger, an on-device app. A person ended one focus session and is reading its Review. " +
            "Answer using only the figures and corpus below.",
        "",
        "```figures",
        figures,
        "```",
        "",
        "Corpus (claims as data; C9, C11, C12, C13 are not advice to recite):",
        JSON.stringify(corpus, null, 2),
        "",
        "Rules:",
        ...RULES.map((rule) => `- ${rule}`)
    ].join("\n");
}

export function intentPrompt(sentence: string): string {
    const clipped = sentence.trim().slice(0, 300);
    return "Restate the person's task in one short sentence. Keep any named work product they mentioned. " +
        "Do not add apps, sites, steps, judgment, windows, or URLs. Reply with that sentence only.\n\n" +
        `They wrote: ${JSON.stringify(clipped)}`;
}

export function acceptIntent(reply: string): string | null {
    const text = reply.replace(/<think>[\s\S]*?<\/think>/gi, "");
    const lines = text.split(/\r?\n/);
    let line = "";
    for (const part of lines) {
        const trimmed = part.trim();
        if (trimmed !== "") {
            line = trimmed;
            break;
        }
    }
    line = line.replace(/^(Task|Reading|Intention):\s*/i, "");
    if ((line.startsWith("\"") && line.endsWith("\"")) || (line.startsWith("'") && line.endsWith("'")))
        line = line.slice(1, -1);
    line = line.replace(/https?:\/\/\S+/gi, "");
    line = line.replace(/\s+/g, " ").trim();
    if (line.length < 2)
        return null;
    return line.slice(0, 300);
}

const ACTION_RE = /\[\[([^\]]+)\]\]/g;

export function extractActions(reply: string, record: LocalRecord): CoachAction[] {
    const actions: CoachAction[] = [];
    for (const match of reply.matchAll(ACTION_RE)) {
        const body = (match[1] ?? "").trim();
        if (body === "start-block") {
            actions.push({type: "start-block"});
            continue;
        }
        if (body === "open-sites") {
            actions.push({type: "open-sites"});
            continue;
        }
        const colon = body.indexOf(":");
        if (colon === -1)
            continue;
        const kind = body.slice(0, colon).trim()
            .toLowerCase();
        const arg = body.slice(colon + 1).trim();
        if (arg === "")
            continue;
        if (kind === "add-block") {
            if (listHas(record.workList, arg) || listHas(record.blockList, arg))
                continue;
            actions.push({type: "add-block", target: arg});
            continue;
        }
        if (kind === "add-work") {
            actions.push({type: "add-work", target: arg});
            continue;
        }
        if (kind === "open-review")
            actions.push({type: "open-review", sessionId: arg});
    }
    return actions;
}

export function gateReply(reply: string, review: Review, record: LocalRecord): string {
    const figures = sessionFigures(review, record);
    const allowed = allowedNumbers(figures);
    for (const match of reply.matchAll(/\d+(?:\.\d+)?/g)) {
        if (!allowed.has(match[0]))
            return GATE_FAIL;
    }
    return redact(reply, review);
}

type Coach = {model: LlamaModel, session: LlamaChatSession};

async function load(modelPath: string, gpu: "auto" | false): Promise<Coach> {
    const llama = await getLlama({gpu, build: "never"});
    const model = await llama.loadModel({modelPath});
    try {
        const context = await model.createContext({contextSize: 4096});
        const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
            chatWrapper: new QwenChatWrapper({variation: "3.5", thoughts: "discourage"})
        });
        return {model, session};
    } catch (err) {
        await model.dispose();
        throw err;
    }
}

async function loadCoach(modelPath: string): Promise<Coach> {
    try {
        return await load(modelPath, "auto");
    } catch (autoErr) {
        try {
            return await load(modelPath, false);
        } catch (cpuErr) {
            const autoMsg = autoErr instanceof Error ? autoErr.message : String(autoErr);
            const cpuMsg = cpuErr instanceof Error ? cpuErr.message : String(cpuErr);
            throw new Error("Coach model failed on auto (" + autoMsg + ") and CPU (" + cpuMsg + ")");
        }
    }
}

let loaded: Promise<Coach> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let stopped: Promise<void> | null = null;
const quitting = new AbortController();

async function ensureLoaded(modelsDir: string): Promise<Coach> {
    quitting.signal.throwIfAborted();
    if (loaded == null) {
        const modelPath = path.join(modelsDir, COACH_FILE);
        if (!fs.existsSync(modelPath))
            throw new Error("Coach model file missing");
        loaded = loadCoach(modelPath).catch((err: unknown) => {
            loaded = null;
            throw err;
        });
    }
    return loaded;
}

export function redact(reply: string, review: Review): string {
    for (const v of review.visits)
        for (const [text, mask] of [[v.windowTitle, "[window title]"], [v.url, "[URL]"]] as const) {
            const needle = text?.trim() ?? "";
            if (needle.length >= 20)
                reply = reply.replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), mask);
        }
    return reply;
}

async function answer(
    modelsDir: string,
    review: Review,
    record: LocalRecord,
    messages: {role: "user" | "coach", text: string}[]
): Promise<{reply: string, actions: CoachAction[]}> {
    const {session} = await ensureLoaded(modelsDir);
    session.setChatHistory([
        {type: "system", text: coachPrompt(review, record)},
        ...messages.slice(0, -1).map((m): ChatHistoryItem =>
            (m.role === "user" ? {type: "user", text: m.text} : {type: "model", response: [m.text]}))
    ]);
    const raw = (await session.prompt(messages.at(-1)!.text, {
        maxTokens: 200,
        signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), quitting.signal])
    })).trim();
    if (raw === "")
        throw new Error("Coach returned no reply");
    const reply = gateReply(raw, review, record);
    const actions = reply === GATE_FAIL ? [] : extractActions(raw, record);
    return {reply, actions};
}

async function readIntention(modelsDir: string, sentence: string): Promise<string> {
    const {session} = await ensureLoaded(modelsDir);
    const userTurn = "Reply with the sentence only.";
    session.setChatHistory([
        {type: "system", text: intentPrompt(sentence)}
    ]);
    const reply = (await session.prompt(userTurn, {
        maxTokens: 80,
        signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), quitting.signal])
    })).trim();
    const accepted = acceptIntent(reply);
    if (accepted == null)
        throw new Error("Intention reading was rejected");
    return accepted;
}

export async function askCoach(
    modelsDir: string,
    review: Review,
    record: LocalRecord,
    messages: {role: "user" | "coach", text: string}[]
): Promise<{reply: string, actions: CoachAction[]}> {
    if (stopped != null)
        throw new Error("Coach is stopped");
    const result = queue.then(() => answer(modelsDir, review, record, messages));
    queue = result.catch(() => {});
    return result;
}

export async function analyzeIntention(modelsDir: string, sentence: string): Promise<string> {
    if (stopped != null)
        throw new Error("Coach is stopped");
    const reply = queue.then(() => readIntention(modelsDir, sentence));
    queue = reply.catch(() => {});
    return reply;
}

export async function stopCoach(): Promise<void> {
    quitting.abort();
    stopped ??= queue.then(async () => {
        const coach = await loaded?.catch(() => null);
        loaded = null;
        await coach?.model.dispose();
    });
    return stopped;
}
