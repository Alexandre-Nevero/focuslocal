import {randomUUID} from "node:crypto";
import {getDb} from "../store/db.ts";
import {emit} from "../ipc.ts";
import {getJudge, runtimeSettled} from "../ai/runtime.ts";
import {labelWindow} from "./harness.ts";
import type {DeclaredTarget, Label} from "../../src/shared/types.ts";

// Single-flight FIFO: one judgment at a time (system-design §9 Harness).
const queue: string[] = [];
let draining = false;
let generation = 0;

/** Deleted stores and quit sessions must not receive a late native result. End alone keeps pending work. */
export function discardJudgments() {
    queue.length = 0;
    generation++;
}

export function enqueueVisit(visitId: string) {
    queue.push(visitId);
    void drain();
}

/** Closed attention visits with no verdict yet, e.g. closed before a crash or a quit. */
export function enqueueUnjudged() {
    const rows = getDb().prepare(`
        SELECT v.id FROM visit v LEFT JOIN verdict d ON d.visit_id = v.id
        WHERE v.kind = 'attention' AND v.ended_at IS NOT NULL AND d.id IS NULL ORDER BY v.started_at
    `)
        .all();
    for (const row of rows)
        enqueueVisit(String(row.id));
}

async function drain() {
    if (draining)
        return;
    draining = true;
    try {
        await runtimeSettled;
        while (queue.length > 0) {
            const visitId = queue.shift()!;
            try {
                await judgeVisit(visitId, generation);
            } catch (err) {
                // A failed write stays "Judging…" until the next launch.
                console.error(`Harness: visit ${visitId}`, err);
            }
        }
    } finally {
        draining = false;
    }
}

async function judgeVisit(visitId: string, queuedGeneration: number) {
    const db = getDb();
    const visit = db.prepare(`
        SELECT v.app_name, v.exec_name, v.window_title, v.url, v.session_id, s.intention
        FROM visit v JOIN session s ON s.id = v.session_id
        WHERE v.id = ? AND NOT EXISTS (SELECT 1 FROM verdict WHERE visit_id = v.id)
    `).get(visitId);
    if (visit == null)
        return;

    const targets = db.prepare("SELECT target, role FROM declared_target WHERE session_id = ?")
        .all(String(visit.session_id)) as DeclaredTarget[];
    const recall = db.prepare("SELECT id, label FROM memory WHERE match_key = ? AND tap_count >= 2");
    const v = await labelWindow(
        {intention: String(visit.intention), targets},
        {
            appName: String(visit.app_name),
            execName: visit.exec_name == null ? null : String(visit.exec_name),
            title: visit.window_title == null ? null : String(visit.window_title),
            url: visit.url == null ? null : String(visit.url)
        },
        (key) => (recall.get(key) as {id: string, label: Label} | undefined) ?? null,
        getJudge()
    );
    if (queuedGeneration !== generation)
        return;

    // A tap made while the model ran wins: the user's label is never overwritten.
    getDb().prepare(`
        INSERT INTO verdict (id, visit_id, memory_id, source, label, reason, model_id, model_stage, latency_ms, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (visit_id) DO NOTHING
    `)
        .run(randomUUID(), visitId, v.memoryId, v.source, v.label, v.reason, v.modelId, v.modelStage, v.latencyMs, v.confidence);
    emit("verdict:updated", {visitId});
}
